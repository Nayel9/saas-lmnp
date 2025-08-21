/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect } from 'vitest';
import { authOptions } from './options';
import type { Session } from 'next-auth';

// Tests unitaires simples des callbacks jwt/session pour champs profil

describe('auth options callbacks', () => {
  it('ajoute les champs profil dans le token puis la session', async () => {
    const user = { id: 'u1', email: 'test@ex.fr', role: 'user', plan: 'free', firstName: 'Alice', lastName: 'Martin', phone: '+33123456789' };
    let token0: any = {}; // NextAuth callback signature token param libre
    token0 = await (authOptions.callbacks!.jwt!)({ token: token0, user } as any);
    expect(token0.userId).toBe('u1');
    expect(token0.firstName).toBe('Alice');
    expect(token0.lastName).toBe('Martin');
    expect(token0.phone).toBe('+33123456789');
    const session0: Session = { user: { id: '', email: 'test@ex.fr' } as any, expires: new Date().toISOString() };
    const session = await (authOptions.callbacks!.session!)({ session: session0, token: token0 } as any);
    const u = session.user!;
    expect(u.firstName).toBe('Alice');
    expect(u.lastName).toBe('Martin');
    expect(u.phone).toBe('+33123456789');
  });
});
