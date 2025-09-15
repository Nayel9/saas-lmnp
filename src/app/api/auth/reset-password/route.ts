import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema, consumePasswordResetToken, clearPlainPasswordResetToken } from "@/lib/auth/passwordReset";
import bcrypt from "bcryptjs";
import { ensureRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function buildClearCookieHeader() {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `resetToken=`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=0`,
  ];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

export async function POST(req: NextRequest) {
  const limited = ensureRateLimit(req, "reset-password");
  if (limited) {
    return new Response(
      JSON.stringify({ success: false, error: "Trop de tentatives, réessayez." }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }
  let token: string | undefined;
  let password: string | undefined;
  try {
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ success: false, error: "Payload invalide" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    // Accept token either from body, Authorization header (Bearer ...) or cookie 'resetToken'
    token = parsed.data.token;
    password = parsed.data.password;

    if (!token) {
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
      if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        token = authHeader.slice(7).trim();
      } else {
        const cookieHeader = req.headers.get('cookie') || '';
        const match = cookieHeader.match(/(?:^|;\s*)resetToken=([^;]+)/);
        if (match) token = decodeURIComponent(match[1]);
      }
    }

    if (!token) {
      // Token introuvable — ne pas retourner de détails sensibles. Effacer cookie si présent.
      return new Response(
        JSON.stringify({ success: false, error: "Token manquant" }),
        { status: 400, headers: { "Content-Type": "application/json", "Set-Cookie": buildClearCookieHeader() } },
      );
    }
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: "Payload invalide" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  try {
    const record = await consumePasswordResetToken(token!);
    if (!record) {
      // Token invalide / expiré — effacer cookie resetToken pour éviter réutilisation côté client
      return new Response(
        JSON.stringify({ success: false, error: "Token invalide ou expiré" }),
        { status: 400, headers: { "Content-Type": "application/json", "Set-Cookie": buildClearCookieHeader() } },
      );
    }
    const hash = await bcrypt.hash(password!, 10);
    await prisma.user.update({ where: { id: record.userId }, data: { password: hash } });
    await prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } });
    // Nettoyer le stockage en clair (dev only) pour éviter fuite de tokens en memoire
    try { clearPlainPasswordResetToken(record.userId); } catch { /* ignore */ }
    // Mot de passe réinitialisé -> effacer le cookie resetToken côté client pour sécurité
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", "Set-Cookie": buildClearCookieHeader() } },
    );
  } catch (e) {
    console.error("[reset-password][error]", e);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur serveur" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
