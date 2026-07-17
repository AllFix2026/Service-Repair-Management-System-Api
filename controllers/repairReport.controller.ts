import { logger } from "@/config/logger.config";
import type { Request, Response } from "express";
import { getRepairReport } from "@/services/reports/repairReport.service";
import { parseReportPeriod } from "@/utils/reportPeriod";
import type { AuthRequest } from "@/types/auth.types";

// GET /api/v1/reports/repairs
export async function getRepairsReport(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  try {
    if (!authReq.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const period = parseReportPeriod(req.query.period);
    const report = await getRepairReport(
      {
        tenantId: authReq.user.tenantId,
        shopId: authReq.user.shopId,
        role: authReq.user.role,
        userId: authReq.user.id,
      },
      period
    );

    return res.status(200).json(report);
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err.status === 400) {
      return res.status(400).json({ error: err.message ?? "Invalid request" });
    }
    logger.error(`[getRepairsReport] ${err?.message ?? error}`);
    return res.status(500).json({ error: "Unable to generate repair report" });
  }
}
