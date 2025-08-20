import { NextRequest } from 'next/server';
export const runtime = 'nodejs';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { generateVerificationToken, sendVerificationEmail } from '@/lib/mailer/brevo';
import { storePlainVerificationToken } from '@/lib/auth/emailVerificationStore';

const schema = z.object({ email: z.string().email(), password: z.string().min(8) });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return new Response('Validation', { status: 400 });
    const { email, password } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return new Response('Existe déjà', { status: 409 });
    const hash = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { email, password: hash, role: 'user', emailVerified: null } });
    // Invalidation anciens tokens (sécurité ré-inscription rare race)
    await prisma.verificationToken.deleteMany({ where: { identifier: email } }).catch(()=>{});
    const { token, hash: tokenHash, expires } = generateVerificationToken();
    await prisma.verificationToken.create({ data: { identifier: email, token: tokenHash, expires } });
    storePlainVerificationToken(email, token);
    const verifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
    await sendVerificationEmail({ email, verifyUrl });
    return new Response(JSON.stringify({ success: true, message: 'Vérifiez votre email pour activer votre compte' }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown';
    console.error('[signup][error]', e);
    return new Response('Erreur:' + msg, { status: 500 });
  }
}
