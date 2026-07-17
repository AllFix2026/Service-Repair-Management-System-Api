/**
 * Redis Cache Config (Tier 2 — 6+ shops)
 *
 * Add REDIS_URL to your Railway environment variables.
 * Railway Redis add-on: https://railway.app/new/template/redis
 *
 * Gracefully falls back to no-op if REDIS_URL is not set,
 * so this won't break Tier 1 deployments.
 */

let redisClient: any = null;

async function getRedisClient() {
  if (!process.env.REDIS_URL) return null;
  if (redisClient) return redisClient;

  try {
    const { createClient } = await import("redis");
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on("error", (err: Error) =>
      console.error("[Redis] Client error:", err.message)
    );
    await redisClient.connect();
    console.log("✅ Redis connected");
    return redisClient;
  } catch (err: any) {
    console.warn("[Redis] Could not connect, falling back to in-memory cache:", err.message);
    return null;
  }
}

export async function redisGet<T>(key: string): Promise<T | null> {
  const client = await getRedisClient();
  if (!client) return null;
  try {
    const val = await client.get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch {
    return null;
  }
}

export async function redisSet(
  key: string,
  data: unknown,
  ttlSeconds = 30
): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  try {
    await client.setEx(key, ttlSeconds, JSON.stringify(data));
  } catch (err: any) {
    console.warn("[Redis] setEx failed:", err.message);
  }
}

export async function redisDel(key: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  try {
    await client.del(key);
  } catch {}
}

export async function redisDelPattern(pattern: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  try {
    const keys: string[] = await client.keys(pattern);
    if (keys.length > 0) await client.del(keys);
  } catch {}
}

export async function isRedisAvailable(): Promise<boolean> {
  const client = await getRedisClient();
  return client !== null;
}
