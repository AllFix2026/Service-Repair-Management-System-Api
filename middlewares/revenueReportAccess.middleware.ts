import { getFlags } from "@/services/cache/cache";
import type { AuthRequest } from "@/types/auth.types";
import type { NextFunction, Response } from "express";

/** ADMIN always; MANAGER only when `advanced_reports` is enabled for the tenant. */
export async function revenueReportAccess(req: AuthRequest, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  if (user.role === "ADMIN") {
    return next();
  }

  if (user.role === "MANAGER") {
    const flags = await getFlags(user.tenantId);
    if (flags.advanced_reports === true) {
      return next();
    }
    return res.status(403).json({ error: "FEATURE_NOT_ENABLED" });
  }

  return res.status(403).json({ success: false, message: "Insufficient permissions" });
}
