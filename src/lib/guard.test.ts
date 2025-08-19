import {describe, expect, it} from 'vitest';
import type {User} from '@supabase/supabase-js';
import {evaluateAccess} from './guard';

// Fabrique user minimal (cast vers User pour tests uniquement)
function makeUser(role: 'admin' | 'user'): User {
   // Cast contrôlé contexte test
    return {
      id: 'test-id',
      app_metadata: {role},
      user_metadata: {role},
      aud: 'authenticated',
      role: 'authenticated',
      email: `${role}@test.local`,
      email_confirmed_at: new Date().toISOString(),
      phone: '',
      confirmation_sent_at: null,
      confirmed_at: null,
      last_sign_in_at: new Date().toISOString(),
      factors: [],
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      app_roles: [],
      phone_confirmed_at: null,
      is_anonymous: false,
  } as unknown as User;
}

describe('evaluateAccess', () => {
  it('retourne loading si loading', () => {
    expect(evaluateAccess('user', null, true)).toBe('loading');
  });
  it('refuse non authentifié', () => {
    expect(evaluateAccess('user', null, false)).toBe('unauthenticated');
  });
  it('autorise user authentifié pour role user', () => {
    expect(evaluateAccess('user', makeUser('user'), false)).toBe('ok');
  });
  it('refuse user non admin pour role admin', () => {
    expect(evaluateAccess('admin', makeUser('user'), false)).toBe('forbidden');
  });
  it('autorise admin pour role admin', () => {
    expect(evaluateAccess('admin', makeUser('admin'), false)).toBe('ok');
  });
});
