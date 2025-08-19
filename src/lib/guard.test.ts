import { describe, it, expect } from 'vitest';
import { evaluateAccess } from './guard';

// Helpers user objects minimaux
const user = (role: 'admin' | 'user'): any => ({
  app_metadata: { role },
  user_metadata: { role },
});

describe('evaluateAccess', () => {
  it('retourne loading si loading', () => {
    expect(evaluateAccess('user', null, true)).toBe('loading');
  });
  it('refuse non authentifié', () => {
    expect(evaluateAccess('user', null, false)).toBe('unauthenticated');
  });
  it('autorise user authentifié pour role user', () => {
    expect(evaluateAccess('user', user('user'), false)).toBe('ok');
  });
  it('refuse user non admin pour role admin', () => {
    expect(evaluateAccess('admin', user('user'), false)).toBe('forbidden');
  });
  it('autorise admin pour role admin', () => {
    expect(evaluateAccess('admin', user('admin'), false)).toBe('ok');
  });
});

