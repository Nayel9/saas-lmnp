import {describe, expect, it} from 'vitest';
import {evaluateAccess} from './guard';

function makeUser(role: 'admin' | 'user') { return { id: 'id', role }; }

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
