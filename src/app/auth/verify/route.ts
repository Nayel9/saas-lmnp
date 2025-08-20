import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/mailer/brevo';
import { clearPlainVerificationToken } from '@/lib/auth/emailVerificationStore';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const email = url.searchParams.get('email');
  if (!token || !email) {
    return NextResponse.redirect(new URL('/login?verified=0', url));
  }
  try {
    const hashed = hashToken(token);
    const record = await prisma.verificationToken.findFirst({ where: { identifier: email, token: hashed } });
    if (!record || record.expires < new Date()) {
      return NextResponse.redirect(new URL('/login?verified=0', url));
    }
    await prisma.user.update({ where: { email }, data: { emailVerified: new Date() } });
    await prisma.verificationToken.deleteMany({ where: { identifier: email } });
    clearPlainVerificationToken(email);
    return NextResponse.redirect(new URL('/login?verified=1', url));
  } catch (e) {
    console.error('[verify][error]', e);
    return NextResponse.redirect(new URL('/login?verified=0', url));
  }
}
