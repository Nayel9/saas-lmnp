import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateVerificationToken, sendVerificationEmail } from '@/lib/mailer/brevo';
import { storePlainVerificationToken } from '@/lib/auth/emailVerificationStore';

export const runtime = 'nodejs';

// Rate limit en mémoire (IP+email) => 60s
const RL_WINDOW_MS = 60_000;
const rlMap = new Map<string, number>();

function rlKey(ip: string, email: string) { return `${ip}|${email.toLowerCase()}`; }

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'ip';
  let email: string | undefined;
  try {
    const body = await req.json();
    email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : undefined;
  } catch {/* ignore parse */}
  if (!email) {
    return new Response(JSON.stringify({ success: true, message: 'Si un compte existe, un email a été envoyé.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  const key = rlKey(ip, email);
  const now = Date.now();
  const last = rlMap.get(key);
  const tooSoon = last && (now - last) < RL_WINDOW_MS;
  rlMap.set(key, now); // même si trop tôt, on avance pour éviter spam (token pas régénéré dessous)
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerified && !tooSoon) {
      // Invalider anciens tokens
      await prisma.verificationToken.deleteMany({ where: { identifier: email } });
      const { token, hash, expires } = generateVerificationToken();
      await prisma.verificationToken.create({ data: { identifier: email, token: hash, expires } });
      storePlainVerificationToken(email, token);
      const verifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
      await sendVerificationEmail({ email, verifyUrl });
    }
  } catch (e) {
    console.error('[resend-verification][error]', e);
  }
  return new Response(JSON.stringify({ success: true, message: 'Si un compte existe, un email a été envoyé.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
