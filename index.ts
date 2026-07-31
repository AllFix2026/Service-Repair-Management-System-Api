import "dotenv/config";
import app from "./app";
import { prisma } from "./db/prisma";
import { initSubscriptionJobs } from "./jobs/subscription.job";
import { initArchivalJob } from "./jobs/archival.job";
import { invalidateCachePattern } from "./services/cache/cache";

// v1.0.1 - updated email config
const PORT = Number(process.env.PORT ?? 8000);

const server = app.listen(PORT, async () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);

  // Auto-migrate missing columns if needed
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "PartsInventory" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;`);
    console.log("✅ Database schema updated: PartsInventory.imageUrl column verified.");
  } catch (err) {
    console.error("⚠️ Failed auto-schema update:", err);
  }

  // Flush all inventory caches on every restart so stale data (without imageUrl) is never served
  try {
    await invalidateCachePattern("inv:*");
    console.log("✅ Inventory cache flushed on startup.");
  } catch (err) {
    console.error("⚠️ Cache flush failed:", err);
  }

  // Initialize cron jobs
  initSubscriptionJobs();
  initArchivalJob();
});

async function shutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);

  server.close(async (err) => {
    if (err) {
      console.error("❌ Error closing HTTP server:", err);
      process.exit(1);
    }

    try {
      await prisma.$disconnect();
      console.log("✅ Prisma disconnected. Bye.");
      process.exit(0);
    } catch (e) {
      console.error("❌ Prisma disconnect failed:", e);
      process.exit(1);
    }
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));