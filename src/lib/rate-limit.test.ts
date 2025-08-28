import { describe, it, expect, beforeEach } from 'vitest';
import { ensureRateLimit, globalRateLimiter } from './rate-limit';

function makeReq(ip = '127.0.0.1') {
  const headers = new Headers();
  headers.set('x-forwarded-for', ip);
  return { headers } as unknown as Request;
}

describe('rate-limit token bucket', () => {
  beforeEach(() => {
    globalRateLimiter.reset();
  });

  it('bloque après plusieurs requêtes dans 60s', () => {
    const req = makeReq('1.2.3.4');
    let blockedCount = 0;
    for (let i = 0; i < 10; i++) {
      const res = ensureRateLimit(req, 'test-route');
      if (res) blockedCount++;
    }
    expect(blockedCount).toBeGreaterThanOrEqual(5); // capacité par défaut 5
  });
});

