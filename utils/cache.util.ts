/**
 * In-Memory Cache Utility
 *
 * Zero-dependency cache using a plain Map.
 * Sufficient for Tier 1 (1-5 shops).
 * Replace with Redis calls (config/redis.config.ts) at Tier 2 (6+ shops).
 *
 * Usage:
 *   setCache(`shop_settings:${shopId}`, data, 60)  // cache 60 seconds
 *   const data = getCache<ShopSettings>(`shop_settings:${shopId}`)
 *   invalidateCache(`shop_settings:${shopId}`)      // on update
 */

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

// Periodically purge expired entries to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.expiresAt) store.delete(key);
  }
}, 60_000); // Sweep every 60 seconds

export function getCache<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache(key: string, data: unknown, ttlSeconds = 60): void {
  store.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export function invalidateCache(key: string): void {
  store.delete(key);
}

/** Invalidate all keys that start with a given prefix e.g. `shop_settings:` */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function getCacheStats(): { size: number; keys: string[] } {
  return { size: store.size, keys: Array.from(store.keys()) };
}
