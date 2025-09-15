// Simple Redis connectivity check script
// Usage: REDIS_URL=redis://localhost:6379 pnpm redis:check

async function main() {
  const url = process.env.REDIS_URL || '';
  if (!url) {
    console.error('[check-redis] REDIS_URL not defined. Please set REDIS_URL in your .env');
    process.exit(2);
  }

  // Try ioredis first
  try {
    const IORedis = (await import('ioredis')).default;
    const client = new IORedis(url);
    await client.ping();
    console.log('[check-redis] Connected with ioredis. PING OK');
    try { if (typeof (client as any).quit === 'function') await (client as any).quit(); } catch {}
    process.exit(0);
  } catch (e: any) {
    console.warn('[check-redis] ioredis not available or connect failed:', e?.message ?? e);
  }

  // Try node-redis
  try {
    const redis = await import('redis');
    const client = redis.createClient({ url });
    client.on('error', (err: any) => {
      console.error('[check-redis] node-redis error', err?.message ?? err);
    });
    await client.connect();
    const pong = await client.ping();
    console.log('[check-redis] Connected with node-redis. PING:', pong);
    try { if (typeof (client as any).quit === 'function') await (client as any).quit(); else if (typeof (client as any).disconnect === 'function') await (client as any).disconnect(); } catch {}
    process.exit(0);
  } catch (e: any) {
    console.error('[check-redis] node-redis not available or connect failed:', e?.message ?? e);
  }

  console.error('[check-redis] Could not connect to Redis using ioredis or node-redis');
  process.exit(1);
}

// Handle top-level promise and errors
main().catch((err) => {
  console.error('[check-redis] unexpected error', err?.message ?? err);
  process.exit(1);
});
