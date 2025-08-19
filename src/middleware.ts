import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createSupabaseMiddleware } from '@/lib/supabase/middleware';
import { getUserRole } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { supabase, response } = createSupabaseMiddleware(request);
  const path = request.nextUrl.pathname;

  // Zones nécessitant authentification
  if (path.startsWith('/dashboard') || path.startsWith('/admin') || path.startsWith('/reports')) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // Double check admin pour /admin et /reports
    if (path.startsWith('/admin') || path.startsWith('/reports')) {
      const role = getUserRole(user);
      if (role !== 'admin') {
        // Rediriger vers dashboard si utilisateur authentifié mais pas admin
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/reports/:path*'],
};
