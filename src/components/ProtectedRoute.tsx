"use client";
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { ReactNode } from 'react';
import { getUserRole } from '@/lib/auth';

interface ProtectedRouteProps {
  requiredRole?: 'user' | 'admin';
  redirectUnauthenticated?: string;
  redirectForbidden?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Protection côté client pour transitions fluides quand l'utilisateur navigue via Link.
 * Complète les vérifications serveur + middleware (défense en profondeur).
 */
export function ProtectedRoute({
  requiredRole = 'user',
  redirectUnauthenticated = '/login',
  redirectForbidden = '/dashboard',
  fallback = <div className="p-6 text-sm text-muted-foreground">Chargement…</div>,
  children,
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const user = session?.user;
  const loading = status === 'loading';

  const role = getUserRole(user);
  const unauthenticated = !loading && !user;
  const forbidden = !loading && user && requiredRole === 'admin' && role !== 'admin';

  useEffect(() => {
    if (unauthenticated) router.replace(redirectUnauthenticated);
    else if (forbidden) router.replace(redirectForbidden);
  }, [unauthenticated, forbidden, router, redirectForbidden, redirectUnauthenticated, pathname]);

  if (loading) return <>{fallback}</>;
  if (unauthenticated) return <div className="p-8 text-sm">Non authentifié</div>;
  if (forbidden) return <div className="p-6 text-sm text-muted-foreground">Redirection…</div>;
  return <>{children}</>;
}
