import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "@/types/auth.types";
import { prisma } from "@/db/prisma";
import { logger } from "@/config/logger.config";

/**
 * Tenant Middleware — sets the Postgres session variable `app.shop_id`
 * before every authenticated query so that RLS policies can enforce
 * shop isolation at the database engine level.
 *
 * This must run AFTER the authenticate middleware and BEFORE any controller.
 */
export async function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authReq = req as AuthRequest;
  const shopId = authReq.user?.shopId;

  // Skip unauthenticated requests (public routes)
  if (!shopId) {
    return next();
  }

  try {
    // Sanitize shopId to prevent SQL injection (it should be a CUID/UUID)
    if (!/^[a-zA-Z0-9_-]+$/.test(shopId)) {
      logger.error(`[tenantMiddleware] Invalid shopId format: ${shopId}`);
      res.status(400).json({ success: false, message: "Invalid shop context" });
      return;
    }

    // Set the Postgres session variable — RLS policies read this per query
    await prisma.$executeRawUnsafe(`SET LOCAL "app.shop_id" = '${shopId}'`);
    next();
  } catch (err: any) {
    logger.error(`[tenantMiddleware] Failed to set tenant context: ${err.message}`);
    // Don't block the request if the SET fails — app-level filtering still applies
    next();
  }
}
