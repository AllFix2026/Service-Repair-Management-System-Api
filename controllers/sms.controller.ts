import { Response } from "express";
import { logger } from "@/config/logger.config";
import { sendSms } from "@/services/notification/notification.service";
import { prisma } from "@/db/prisma";
import type { AuthRequest } from "@/types/auth.types";

export const sendStandardSms = async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, shopId } = req.user!;
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ success: false, message: "Missing 'to' or 'message' in request body." });
    }

    const shop = await prisma.shop.findFirst({
      where: { id: shopId!, tenantId },
      select: { name: true }
    });

    const shopName = shop?.name || "Our Shop";
    const finalMessage = `${message}\n\n- ${shopName}`;

    await sendSms(to, finalMessage);

    res.status(200).json({ success: true, message: "SMS sent successfully" });
  } catch (error: any) {
    logger.error(`[sendStandardSms] Error: ${error.message}`);
    res.status(500).json({ success: false, message: "Failed to send SMS" });
  }
};
