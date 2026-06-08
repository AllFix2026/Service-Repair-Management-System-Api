import cron from "node-cron";
import { prisma } from "@/db/prisma";
import { logger } from "@/config/logger.config";

/**
 * Weekly Archival Job
 *
 * Runs every Sunday at 02:00 AM Lanka time (UTC+5:30 = Saturday 20:30 UTC)
 * Cron: "30 20 * * 0"
 *
 * What it does:
 *   1. Moves DELIVERED/PAID repairs older than 2 years → RepairArchive
 *   2. Deletes cleared notifications older than 90 days
 *
 * Data is NEVER permanently deleted — just moved to archive tables.
 * This keeps the hot `Repair` table small and fast at all shop scales.
 */

const TWO_YEARS_AGO = (): Date => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 2);
  return d;
};

const NINETY_DAYS_AGO = (): Date => {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d;
};

const BATCH_SIZE = 500;

async function archiveOldRepairs(): Promise<number> {
  const cutoff = TWO_YEARS_AGO();
  let totalArchived = 0;

  while (true) {
    const oldRepairs = await prisma.repair.findMany({
      where: {
        status: { in: ["DELIVERED", "PAID"] },
        createdAt: { lt: cutoff },
      },
      take: BATCH_SIZE,
      select: {
        id: true,
        tenantId: true,
        shopId: true,
        customerId: true,
        deviceId: true,
        reference: true,
        status: true,
        issue: true,
        diagnosis: true,
        estimatedCost: true,
        finalCost: true,
        technicianId: true,
        createdAt: true,
      },
    });

    if (oldRepairs.length === 0) break;

    // Insert into archive table
    await prisma.repairArchive.createMany({
      data: oldRepairs.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        shopId: r.shopId,
        customerId: r.customerId,
        deviceId: r.deviceId,
        reference: r.reference,
        status: r.status,
        issue: r.issue,
        diagnosis: r.diagnosis,
        estimatedCost: r.estimatedCost,
        finalCost: r.finalCost,
        technicianId: r.technicianId,
        originalCreatedAt: r.createdAt,
      })),
      skipDuplicates: true,
    });

    // Delete from main table (after archive confirmed)
    await prisma.repair.deleteMany({
      where: { id: { in: oldRepairs.map((r) => r.id) } },
    });

    totalArchived += oldRepairs.length;
    logger.info(`[archival.job] → Archived batch of ${oldRepairs.length} repairs`);

    // If batch was smaller than limit, no more to process
    if (oldRepairs.length < BATCH_SIZE) break;
  }

  return totalArchived;
}

async function cleanOldNotifications(): Promise<number> {
  const cutoff = NINETY_DAYS_AGO();
  const result = await prisma.notification.deleteMany({
    where: {
      isCleared: true,
      createdAt: { lt: cutoff },
    },
  });
  return result.count;
}

async function runArchival() {
  logger.info("[archival.job] ─── Weekly archival run started ───────────────");

  try {
    const repairs = await archiveOldRepairs();
    logger.info(`[archival.job] ✅ Archived ${repairs} old repair(s)`);
  } catch (err: any) {
    logger.error(`[archival.job] ❌ Repair archival failed: ${err.message}`);
  }

  try {
    const notifications = await cleanOldNotifications();
    logger.info(`[archival.job] ✅ Cleaned ${notifications} old notification(s)`);
  } catch (err: any) {
    logger.error(`[archival.job] ❌ Notification cleanup failed: ${err.message}`);
  }

  logger.info("[archival.job] ─── Weekly archival run complete ──────────────");
}

export function initArchivalJob() {
  // Every Sunday at 02:00 Lanka time (20:30 UTC Saturday)
  cron.schedule("30 20 * * 0", () => {
    runArchival().catch((err) =>
      logger.error(`[archival.job] Unhandled error: ${err.message}`)
    );
  });

  logger.info("[archival.job] ✅ Weekly archival job registered (Sundays 02:00 LKT)");
}
