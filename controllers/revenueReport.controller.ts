import { logger } from "@/config/logger.config";
import { getRevenueReport } from "@/services/reports/revenueReport.service";
import type { AuthRequest } from "@/types/auth.types";
import { resolveRevenueDateWindow } from "@/utils/revenueReportRange";
import type { Request, Response } from "express";

// GET /api/v1/reports/revenue
export async function getRevenueReportHandler(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  try {
    if (!authReq.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const window = resolveRevenueDateWindow(req.query);
    const report = await getRevenueReport(
      {
        tenantId: authReq.user.tenantId,
        shopId: authReq.user.shopId,
      },
      window
    );

    return res.status(200).json(report);
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err.status === 400) {
      return res.status(400).json({ error: err.message ?? "Invalid request" });
    }
    logger.error(`[getRevenueReport] ${err?.message ?? error}`);
    return res.status(500).json({ error: "Unable to generate revenue report" });
  }
}
