// Simple Upstash REST connectivity check
// Usage: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env, then run:
//   pnpm upstash:check

async function run() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_TOKEN;
  if (!url || !token) {
    console.error('[check-upstash] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not defined');
    process.exit(2);
  }

  try {
    const { Redis } = await import('@upstash/redis');
    const client = new Redis({ url, token });
    const res = await client.ping();
    console.log('[check-upstash] ping ->', res);
    process.exit(0);
  } catch (e: any) {
    console.error('[check-upstash] failed to connect to Upstash REST:', e && e.message ? e.message : e);
    process.exit(1);
  }
}

// Handle top-level promise and errors
run().catch((err) => {
  console.error('[check-upstash] unexpected error', err?.message ?? err);
  process.exit(1);
});