import { env } from "@/config/env";
import { getRedis } from "@/config/redis";
import { logger } from "@/config/logger.config";
import { prisma } from "@/db/prisma";
import { DEFAULT_FEATURE_FLAGS, type FeatureFlagsMap } from "@/types/featureFlags.types";

const TTL_SECONDS = 300;

function prefixedKey(suffix: string): string {
  const raw = env.REDIS_PREFIX?.trim() ?? "";
  const p = raw.replace(/^:+|:+$/g, "");
  if (!p) return suffix;
  return `${p}:${suffix}`;
}

function keyForTenant(tenantId: string) {
  return prefixedKey(`ff:tenant:${tenantId}`);
}

function mergeFlags(stored: unknown): FeatureFlagsMap {
  if (!stored || typeof stored !== "object") {
    return { ...DEFAULT_FEATURE_FLAGS };
  }
  return { ...DEFAULT_FEATURE_FLAGS, ...(stored as Record<string, boolean>) };
}

export async function getFlags(tenantId: string): Promise<FeatureFlagsMap> {
  const redis = getRedis();
  const key = keyForTenant(tenantId);

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        return mergeFlags(JSON.parse(cached));
      }
    } catch (e: any) {
      logger.warn(`[getFlags] Redis read failed: ${e?.message ?? e}`);
    }
  }

  const settings = await prisma.shopSettings.upsert({
    where: { tenantId },
    create: { tenantId, featureFlags: {} },
    update: {},
    select: { featureFlags: true },
  });

  const merged = mergeFlags(settings.featureFlags);

  if (redis) {
    try {
      await redis.set(key, JSON.stringify(merged), "EX", TTL_SECONDS);
    } catch (e: any) {
      logger.warn(`[getFlags] Redis write failed: ${e?.message ?? e}`);
    }
  }

  return merged;
}

export async function invalidateFlags(tenantId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(keyForTenant(tenantId));
  } catch (e: any) {
    logger.warn(`[invalidateFlags] Redis del failed: ${e?.message ?? e}`);
  }
}

// --- GENERIC CACHING SYSTEM (REDIS + IN-MEMORY FALLBACK) ---
const memoryCache = new Map<string, { value: any; expiresAt: number }>();

export async function getCachedData<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch (e: any) {
      logger.warn(`[cache] Redis read failed for key ${key}: ${e?.message ?? e}`);
    }
  }

  // Memory fallback
  const mem = memoryCache.get(key);
  if (mem) {
    if (Date.now() < mem.expiresAt) {
      return mem.value as T;
    } else {
      memoryCache.delete(key);
    }
  }
  return null;
}

export async function setCachedData<T>(key: string, value: T, ttlSeconds: number = TTL_SECONDS): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (e: any) {
      logger.warn(`[cache] Redis write failed for key ${key}: ${e?.message ?? e}`);
    }
  }

  // Memory fallback
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export async function invalidateCacheKey(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(key);
    } catch (e: any) {
      logger.warn(`[cache] Redis del failed for key ${key}: ${e?.message ?? e}`);
    }
  }
  memoryCache.delete(key);
}

export async function invalidateCachePattern(pattern: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (e: any) {
      logger.warn(`[cache] Redis pattern invalidate failed for pattern ${pattern}: ${e?.message ?? e}`);
    }
  }
  // Clear memory cache keys matching the pattern (convert glob to simple regex)
  const regexPattern = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
  for (const key of memoryCache.keys()) {
    if (regexPattern.test(key)) {
      memoryCache.delete(key);
    }
  }
}


