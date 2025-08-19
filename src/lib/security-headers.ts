interface BuildSecurityHeadersArgs { env: string; supabaseUrl?: string; }

/** Construit les en-têtes sécurité (CSP dynamique). */
export function buildSecurityHeaders({ env, supabaseUrl }: BuildSecurityHeadersArgs) {
  const isProd = env === 'production';
  let supabaseOrigin = '';
  let supabaseWs = '';
  if (supabaseUrl) {
    try {
      const u = new URL(supabaseUrl.replace(/\/$/, ''));
      supabaseOrigin = u.origin;
      supabaseWs = (u.protocol === 'https:' ? 'wss://' : 'ws://') + u.host;
    } catch { /* ignore */ }
  }
  // Sources connect explicites avec schémas
  const connectSources = ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'];
  if (supabaseOrigin && !connectSources.includes(supabaseOrigin)) connectSources.push(supabaseOrigin);
  if (supabaseWs && !connectSources.includes(supabaseWs)) connectSources.push(supabaseWs);
  // autoriser localhost:54321 en fallback si pas d'URL fournie (dev local supabase cli)
  if (!supabaseOrigin && env !== 'production') {
    connectSources.push('http://localhost:54321', 'ws://localhost:54321');
  }
  const scriptSources = ["'self'", "'unsafe-inline'"]; if (!isProd) scriptSources.push("'unsafe-eval'"); scriptSources.push('https://*.supabase.co');
  if (supabaseOrigin && !scriptSources.includes(supabaseOrigin)) scriptSources.push(supabaseOrigin);
  const csp = [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connectSources.join(' ')}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  const headers = [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    { key: 'X-XSS-Protection', value: '0' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
    ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
    { key: 'Content-Security-Policy', value: csp },
  ];
  return headers;
}
