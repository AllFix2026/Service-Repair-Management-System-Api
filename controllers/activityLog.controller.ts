import { Request, Response } from "express";
import { prisma } from "@/db/prisma";
import { AuthRequest } from "@/types/auth.types";
import { logger } from "@/config/logger.config";

// GET /v1/logs
export const getActivityLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;

    if (!user || user.role !== "ADMIN") {
      res.status(403).json({ success: false, message: "Access denied. Shop owner only." });
      return;
    }

    const shopId = user.shopId ?? user.tenantId;

    // Query filters
    const {
      userId,
      action,
      entity,
      fromDate,
      toDate,
      page = "1",
      limit = "50",
      search,
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { shopId };

    if (userId) where.userId = userId;
    if (action) where.action = { contains: action, mode: "insensitive" };
    if (entity) where.entity = entity;

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (search) {
      where.OR = [
        { userName: { contains: search, mode: "insensitive" } },
        { action: { contains: search, mode: "insensitive" } },
        { entity: { contains: search, mode: "insensitive" } },
        { entityId: { contains: search, mode: "insensitive" } },
        { amountLabel: { contains: search, mode: "insensitive" } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.activityLog.count({ where }),
    ]);

    // Fetch unique users in this shop for filter dropdown
    const staffList = await prisma.activityLog.groupBy({
      by: ["userId", "userName", "userRole"],
      where: { shopId },
      orderBy: { userName: "asc" },
    });

    res.status(200).json({
      success: true,
      data: logs,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
      staff: staffList,
    });
  } catch (error: any) {
    logger.error(`[Logs] Failed to fetch activity logs: ${error.message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /v1/logs/summary — quick stats for the log page header
export const getLogsSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;

    if (!user || user.role !== "ADMIN") {
      res.status(403).json({ success: false, message: "Access denied." });
      return;
    }

    const shopId = user.shopId ?? user.tenantId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalToday, totalAll, topUsers] = await Promise.all([
      prisma.activityLog.count({ where: { shopId, createdAt: { gte: today } } }),
      prisma.activityLog.count({ where: { shopId } }),
      prisma.activityLog.groupBy({
        by: ["userName", "userRole"],
        where: { shopId },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
    ]);

    res.status(200).json({
      success: true,
      data: { totalToday, totalAll, topUsers },
    });
  } catch (error: any) {
    logger.error(`[Logs] Failed to fetch log summary: ${error.message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
