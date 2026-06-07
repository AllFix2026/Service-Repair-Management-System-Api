import { Request, Response } from "express";
import { logger } from "@/config/logger.config";
import * as subscriptionService from "@/services/subscription/subscription.service";

/**
 * Controller to trigger manual subscription expiry check (Internal/Admin only)
 */
export const checkSubscriptionExpiry = async (req: Request, res: Response) => {
  logger.info(`[checkSubscriptionExpiry] -> Running manual expiry check trigger`);

  try {
    const result = await subscriptionService.checkAndSuspendExpiredSubscriptions();

    return res.status(200).json({ 
      success: true, 
      message: `${result.count} subscriptions processed`,
      affectedCount: result.count 
    });
  } catch (error: any) {
    logger.error(`[checkSubscriptionExpiry] -> Trigger failed: ${error.message}`);
    return res.status(500).json({ 
      success: false, 
      message: "Scheduler trigger failed",
      details: error.message
    });
  }
};

/**
 * Controller to manually renew or upgrade subscription
 */
export const renewSubscription = async (req: Request, res: Response) => {
  try {
    const authReq = req as any;
    const shopId = authReq.user?.shopId;
    const tenantId = authReq.user?.tenantId;
    
    if (!shopId || !tenantId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { plan } = req.body;
    
    // Calculate new end date (30 days from now)
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    // Import prisma locally if not imported globally in this file
    const { prisma } = require("@/db/prisma");

    await prisma.shop.update({
      where: { id: shopId },
      data: {
        subscriptionPlan: plan || "SINGLE",
        subscriptionStatus: "ACTIVE",
        subscriptionStartDate: new Date(),
        subscriptionEndDate: endDate
      }
    });

    return res.status(200).json({
      success: true,
      message: "Subscription successfully renewed/updated",
      data: {
        plan: plan || "SINGLE",
        status: "ACTIVE",
        endDate
      }
    });
  } catch (error: any) {
    logger.error(`[renewSubscription] -> Failed: ${error.message}`);
    return res.status(500).json({ success: false, message: "Failed to renew subscription" });
  }
};
