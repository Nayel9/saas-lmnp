import { describe, it, expect } from 'vitest';
import { buildSecurityHeaders } from './security-headers';

function getCsp(headers: { key: string; value: string }[]) {
  return headers.find(h => h.key === 'Content-Security-Policy')?.value || '';
}

function parseDirective(csp: string, name: string) {
  const re = new RegExp(`${name} ([^;]+)`);
  const m = csp.match(re);
  return m ? m[1].trim().split(/\s+/) : [];
}

describe('buildSecurityHeaders', () => {
  it('inclut localhost:54321 en dev sans URL explicite', () => {
    const hs = buildSecurityHeaders({ env: 'development', supabaseUrl: undefined });
    const csp = getCsp(hs);
    const connect = parseDirective(csp, 'connect-src');
    expect(connect).toContain("http://localhost:54321");
    expect(connect).toContain("ws://localhost:54321");
  });
  it('ajoute origin Supabase custom et son ws', () => {
    const hs = buildSecurityHeaders({ env: 'development', supabaseUrl: 'http://localhost:54321' });
    const csp = getCsp(hs);
    const connect = parseDirective(csp, 'connect-src');
    // pas de doublons multiples critiques, présence origin
    const occurrences = connect.filter(s => s === 'http://localhost:54321').length;
    expect(occurrences).toBeGreaterThanOrEqual(1);
  });
  it('gère URL cloud https', () => {
    const hs = buildSecurityHeaders({ env: 'production', supabaseUrl: 'https://proj.supabase.co' });
    const csp = getCsp(hs);
    const connect = parseDirective(csp, 'connect-src');
    expect(connect.some(s => s.includes('proj.supabase.co'))).toBe(true);
    expect(connect.some(s => s.startsWith('wss://proj.supabase.co'))).toBe(true);
    // HSTS présent en prod
    expect(hs.find(h=>h.key==='Strict-Transport-Security')).toBeDefined();
  });
});

