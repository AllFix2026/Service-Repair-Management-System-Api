import "dotenv/config";
import app from "./app";
import { prisma } from "./db/prisma";
import { initSubscriptionJobs } from "./jobs/subscription.job";
import { initArchivalJob } from "./jobs/archival.job";

// v1.0.1 - updated email config
const PORT = Number(process.env.PORT ?? 8000);

const server = app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);

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