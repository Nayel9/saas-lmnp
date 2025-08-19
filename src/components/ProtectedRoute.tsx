"use client";
import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { evaluateAccess } from '@/lib/guard';

interface ProtectedRouteProps {
  requiredRole?: 'user' | 'admin';
  redirectUnauthenticated?: string; // défaut /login
  redirectForbidden?: string; // défaut /dashboard
  fallback?: ReactNode; // rendu pendant loading
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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [pathname]);

  const outcome = evaluateAccess(requiredRole, user, loading);

  useEffect(() => {
    if (outcome === 'unauthenticated') router.replace(redirectUnauthenticated);
    else if (outcome === 'forbidden') router.replace(redirectForbidden);
  }, [outcome, router, redirectUnauthenticated, redirectForbidden]);

  if (outcome === 'loading') return <>{fallback}</>;
  if (outcome === 'ok') return <>{children}</>;
  // Dans les cas redirect, on affiche un léger état transitoire (évite flash vide)
  return <div className="p-6 text-sm text-muted-foreground">Redirection…</div>;
}

