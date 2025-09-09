interface BuildSecurityHeadersArgs {
  env: string;
  supabaseUrl?: string;
}

/** Construit les en-têtes sécurité (CSP minimale). */
export function buildSecurityHeaders({ env }: BuildSecurityHeadersArgs) {
  const isProd = env === "production";
  const csp = [
    "default-src 'self'",
    "img-src 'self' data: https:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
    "style-src 'self' 'unsafe-inline' https:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
  ].join("; ");
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
    { key: "X-Frame-Options", value: "DENY" },
    ...(isProd
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ]
      : []),
    { key: "Content-Security-Policy", value: csp },
  ];
  return headers;
}
