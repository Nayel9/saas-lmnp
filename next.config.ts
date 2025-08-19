import type { NextConfig } from "next";
import { buildSecurityHeaders } from './src/lib/security-headers';

const securityHeaders = buildSecurityHeaders({ env: process.env.NODE_ENV || 'development', supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL });

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
