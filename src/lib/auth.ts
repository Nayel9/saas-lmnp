import type { User } from '@supabase/supabase-js';

/**
 * Détermination du rôle applicatif.
 * On s'appuie sur app_metadata.role défini côté Supabase (Custom JWT claim) ou user_metadata.role.
 */
export function getUserRole(user: User | null | undefined): 'admin' | 'user' {
  if (!user) return 'user';
  const roleFromApp = (user.app_metadata as Record<string, unknown>)?.role as string | undefined;
  const roleFromUser = (user.user_metadata as Record<string, unknown>)?.role as string | undefined;
  const role = roleFromApp || roleFromUser;
  return role === 'admin' ? 'admin' : 'user';
}

export function isAdmin(user: User | null | undefined): boolean {
  return getUserRole(user) === 'admin';
}

/** Vérifie côté serveur (Server Component / Action) qu'un user est admin sinon throw */
export function assertAdmin(user: User | null | undefined) {
  if (!isAdmin(user)) {
    throw new Error('Accès administrateur requis');
  }
}
