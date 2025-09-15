// Wrapper minimal pour cooldown email: Upstash REST > Redis TCP (ioredis/node-redis) > Map en mémoire.
interface RedisLike {
  get(key: string): Promise<string | null | unknown>;
  set(key: string, value: string, ...rest: unknown[]): Promise<unknown>;
  del(key: string): Promise<unknown>;
  ping?(): Promise<unknown>;
  quit?(): Promise<unknown>;
  connect?(): Promise<unknown>;
}
let client: RedisLike | null = null;
let redisAvailable = false;
let redisType: 'upstash' | 'ioredis' | 'node-redis' | null = null;
const inMemory = new Map<string, number>();

async function init() {
  if (client || redisAvailable) return;

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_TOKEN;
  if (upstashUrl && upstashToken) {
    try {
      const { Redis } = await import('@upstash/redis');
      client = new Redis({ url: upstashUrl, token: upstashToken }) as unknown as RedisLike;
      redisAvailable = true;
      redisType = 'upstash';
      return;
    } catch (e) {
      console.warn('[cache/redis] upstash client init failed, falling back', e);
    }
  }

  const url = process.env.REDIS_URL;
  if (!url) return;

  try {
    const IORedis = (await import('ioredis')).default as unknown as { new(url: string): { ping(): Promise<unknown>; set(...args: unknown[]): Promise<unknown>; get(key: string): Promise<unknown>; del(key: string): Promise<unknown>; quit(): Promise<unknown>; } };
    const io = new IORedis(url);
    await io.ping();
    client = io as unknown as RedisLike;
    redisAvailable = true;
    redisType = 'ioredis';
    return;
  } catch {
    try {
      const redis = await import('redis');
      const raw = redis.createClient({ url }) as unknown as { connect(): Promise<unknown>; set(...args: unknown[]): Promise<unknown>; get(key: string): Promise<unknown>; del(key: string): Promise<unknown>; quit(): Promise<unknown>; };
      await raw.connect();
      client = raw as unknown as RedisLike;
      redisAvailable = true;
      redisType = 'node-redis';
      return;
    } catch {
      redisAvailable = false;
      client = null;
      redisType = null;
      console.warn('[cache/redis] Redis non disponible, fallback mémoire');
    }
  }
}

export async function getEmailCooldown(email: string): Promise<number | null> {
  await init();
  const key = `forgot_cooldown:${email}`;
  if (redisAvailable && client) {
    try {
      const v = await client.get(key);
      const n = v ? parseInt(String(v), 10) : NaN;
      if (Number.isNaN(n)) return null;
      return n;
    } catch {
      // fallback mémoire
    }
  }
  const ts = inMemory.get(email);
  if (!ts) return null;
  if (ts <= Date.now()) {
    inMemory.delete(email);
    return null;
  }
  return ts;
}

export async function setEmailCooldown(email: string, seconds: number): Promise<void> {
  await init();
  const key = `forgot_cooldown:${email}`;
  const expireTs = Date.now() + seconds * 1000;
  if (redisAvailable && client) {
    try {
      if (redisType === 'upstash') {
        // Upstash REST (ex: seconds)
        await client.set(key, String(expireTs), { ex: seconds });
        return;
      }
      if (redisType === 'ioredis') {
        // ioredis style (SET key value PX ms)
        await (client as { set(key: string, value: string, mode: string, ttl: number): Promise<unknown>; }).set(key, String(expireTs), 'PX', seconds * 1000);
        return;
      }
      if (redisType === 'node-redis') {
        await (client as { set(key: string, value: string, opts: { PX: number }): Promise<unknown>; }).set(key, String(expireTs), { PX: seconds * 1000 });
        return;
      }
    } catch {
      // fallback mémoire
    }
  }
  inMemory.set(email, expireTs);
}
