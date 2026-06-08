import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { logger } from "@/config/logger.config";

// Pool config — connection_limit keeps us under PgBouncer's pool size.
// Use port 6543 (PgBouncer pooler) in DATABASE_URL, not 5432 (direct).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,              // Max connections per Railway process instance
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  logger.error(`[Prisma Pool] Unexpected error on idle client: ${err.message}`);
});

export const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
  log: [
    { emit: "event", level: "query" },
    { emit: "stdout", level: "error" },
    { emit: "stdout", level: "warn" },
  ],
});

// Log slow queries (> 200ms) — helps catch missing indexes before they hit production
prisma.$on("query" as never, (e: any) => {
  if (e.duration > 200) {
    logger.warn(`⚠️  Slow query (${e.duration}ms): ${e.query.substring(0, 200)}`);
  }
});

