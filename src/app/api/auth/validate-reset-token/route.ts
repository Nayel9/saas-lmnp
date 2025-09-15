import { NextResponse } from 'next/server';
import type { JwtPayload } from 'jsonwebtoken';

interface TokenPayload { email?: string; user?: { email?: string }; }

export async function GET(req: Request) {
  // Accept token only from Authorization header (Bearer ...) or cookie named 'resetToken'.
  // This prevents any client-side code from reading the token from the page URL.
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  let token: string | undefined;

  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(/(?:^|;\s*)resetToken=([^;]+)/);
    if (match) token = decodeURIComponent(match[1]);
  }

  if (!token) return NextResponse.json({ error: 'missing token' }, { status: 400 });

  // Try to verify token server-side if possible
  if (process.env.JWT_SECRET) {
    try {
      // dynamic import in case jsonwebtoken is not installed
      const jwt = await import('jsonwebtoken');
      const payload = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload | TokenPayload;
      const nested = (payload as TokenPayload);
      const email = nested.email || nested.user?.email;
      if (email) return NextResponse.json({ email });
    } catch {
      // fall through to payload decode
    }
  }

  // Fallback: decode payload without verification (base64url)
  try {
    const parts = token.split('.');
    const b64 = parts.length > 1 ? parts[1] : parts[0];
    // base64url -> base64 and add padding
    let b64norm = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (b64norm.length % 4 !== 0) b64norm += '=';
    const json = Buffer.from(b64norm, 'base64').toString('utf8');
    const payload = JSON.parse(json);
    const email = payload?.email || payload?.user?.email;
    if (email) return NextResponse.json({ email });
  } catch {
    // ignore
  }

  return NextResponse.json({}, { status: 200 });
}
