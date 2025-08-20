import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/core';
import { getUserRole } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const session = await auth();
  const user = session?.user;

  if (path.startsWith('/dashboard') || path.startsWith('/admin') || path.startsWith('/reports')) {
    if (!user) return NextResponse.redirect(new URL('/login', request.url));
    if ((path.startsWith('/admin') || path.startsWith('/reports')) && getUserRole(user) !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*', '/admin/:path*', '/reports/:path*'] };
