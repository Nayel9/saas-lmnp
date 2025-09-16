import { NextResponse } from 'next/server';

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'missing token' }, { status: 400 });
  }

  // Construire cookie sécurisé
  const isProd = process.env.NODE_ENV === 'production';
  const maxAge = Math.floor((parseInt(process.env.RESET_TOKEN_TTL_SECONDS || '') || 1800));
  const cookieParts = [
    `resetToken=${encodeURIComponent(token)}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAge}`,
  ];
  if (isProd) cookieParts.push('Secure');
  const cookieHeader = cookieParts.join('; ');

  const redirectUrl = new URL('/reset-password', req.url);
  const res = NextResponse.redirect(redirectUrl);
  res.headers.set('Set-Cookie', cookieHeader);
  return res;
}
