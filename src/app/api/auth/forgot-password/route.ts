import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema, generatePasswordResetToken, storePlainPasswordResetToken } from "@/lib/auth/passwordReset";
import { sendPasswordResetEmail } from "@/lib/mailer/passwordReset";
import { ensureRateLimit } from "@/lib/rate-limit";
import { getEmailCooldown, setEmailCooldown } from "@/lib/cache/redis";

export const runtime = "nodejs";

// Simple cooldown par email (in-memory). En production, préférer Redis ou stockage persistant.
const FORGOT_COOLDOWN_SECONDS = parseInt(process.env.FORGOT_PASSWORD_COOLDOWN_SECONDS || process.env.NEXT_PUBLIC_FORGOT_PASSWORD_COOLDOWN_SECONDS || '600', 10);

async function verifyRecaptcha(token?: string) {
  // Bypass complet en test pour éviter dépendances réseau / token manquant
  if (process.env.NODE_ENV === 'test') return true;
  const secret = process.env.RECAPTCHA_SECRET;
  if (!secret) return true; // skip verification si non configuré (tests/dev)
  if (!token) return false;
  try {
    const params = new URLSearchParams();
    params.append('secret', secret);
    params.append('response', token);
    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', { method: 'POST', body: params });
    const data = await resp.json();
    // v3: score threshold 0.5; v2: success suffit
    if (typeof data.score === 'number') return data.success && data.score >= 0.5;
    return !!data.success;
  } catch (e) {
    console.warn('[forgot-password] recaptcha verify failed', e);
    return false;
  }
}

export async function POST(req: NextRequest) {
  const limited = ensureRateLimit(req, "forgot-password");
  if (limited) {
    return new Response(
      JSON.stringify({ success: true, message: "Si un compte existe, un email a été envoyé." }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  let email: string | null = null;
  let recaptchaToken: string | undefined;
  try {
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse({ email: body?.email });
    if (parsed.success) email = parsed.data.email;
    recaptchaToken = body?.recaptchaToken;
  } catch {
    // ignore
  }

  if (!email) {
    return new Response(
      JSON.stringify({ success: true, message: "Si un compte existe, un email a été envoyé." }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Vérifier reCAPTCHA (si configuré). Si échec, on répond neutre sans envoyer d'email.
  try {
    const ok = await verifyRecaptcha(recaptchaToken);
    if (!ok) {
      console.warn('[forgot-password] recaptcha failed for', email);
      return new Response(
        JSON.stringify({ success: true, message: "Si un compte existe, un email a été envoyé." }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
  } catch {
    // proceed silently
  }

  // Vérifier cooldown par email
  try {
    const key = email.trim().toLowerCase();
    const expire = await getEmailCooldown(key);
    if (expire && expire > Date.now()) {
      return new Response(
        JSON.stringify({ success: true, message: "Si un compte existe, un email a été envoyé." }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
  } catch {
    // ignore
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.password) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      const { token, hash, expiresAt } = generatePasswordResetToken();
      await prisma.passwordResetToken.create({ data: { userId: user.id, token: hash, expiresAt } });
      storePlainPasswordResetToken(user.id, token);
      const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const resetUrl = `${base.replace(/\/$/, "")}/api/auth/consume-reset-link?token=${encodeURIComponent(token)}`;
      await sendPasswordResetEmail({ email: user.email, resetUrl });
      try {
        const key = user.email.trim().toLowerCase();
        await setEmailCooldown(key, FORGOT_COOLDOWN_SECONDS);
      } catch {
        // ignore
      }
    }
  } catch (e) {
    console.error("[forgot-password][error]", e);
  }

  return new Response(
    JSON.stringify({ success: true, message: "Si un compte existe, un email a été envoyé." }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
