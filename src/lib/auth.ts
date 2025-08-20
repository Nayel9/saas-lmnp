// Auth helpers basés sur NextAuth (session)
import type { Session } from 'next-auth';

export function getUserRoleFromSession(session: Session | null | undefined): 'admin' | 'user' {
  const role = session?.user?.role;
  return role === 'admin' ? 'admin' : 'user';
}

// Compat: signature précédente (user objet avec role)
export function getUserRole(user: { role?: string } | null | undefined): 'admin' | 'user' {
  return user?.role === 'admin' ? 'admin' : 'user';
}

export function isAdminSession(session: Session | null | undefined): boolean {
  return getUserRoleFromSession(session) === 'admin';
}

export function isAdmin(user: { role?: string } | null | undefined): boolean {
  return getUserRole(user) === 'admin';
}

export function assertAdminSession(session: Session | null | undefined) {
  if (!isAdminSession(session)) throw new Error('Accès administrateur requis');
}

export function assertAdmin(user: { role?: string } | null | undefined) {
  if (!isAdmin(user)) throw new Error('Accès administrateur requis');
}
