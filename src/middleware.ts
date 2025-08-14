import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createSupabaseMiddleware } from '@/lib/supabase/middleware';
import { getUserRole } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { supabase, response } = createSupabaseMiddleware(request);
  const path = request.nextUrl.pathname;

  if (path.startsWith('/dashboard') || path.startsWith('/admin')) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (path.startsWith('/admin')) {
      const role = getUserRole(user);
      if (role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
