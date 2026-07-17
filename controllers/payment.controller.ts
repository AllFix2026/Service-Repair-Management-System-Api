import { Request, Response } from "express";
import { logger } from "@/config/logger.config";
import * as paymentService from "@/services/payment/payment.service";
import { SubscriptionPlan, PaymentMethod } from "@prisma/client";
import { env } from "@/config/env";
import crypto from "crypto";
import * as payhereService from "@/services/payment/payhere.service";
import * as registrationService from "@/services/registration/registration.service";

export const handleStripeWebhook = async (req: Request, res: Response) => {
  logger.warn("[handleStripeWebhook] -> Webhook received but Stripe is disabled.");
  return res.status(400).json({ success: false, message: "Stripe payments are disabled. Please use PayHere." });
};

export const handlePayHereNotify = async (req: Request, res: Response) => {
  const {
    merchant_id,
    order_id,
    payhere_amount,
    payhere_currency,
    status_code,
    md5sig,
  } = req.body;

  const config = payhereService.getPayHereConfig();
  const secret = config.merchant_secret;

  // Verify signature
  const localMd5sig = crypto
    .createHash("md5")
    .update(
      merchant_id +
      order_id +
      payhere_amount +
      payhere_currency +
      status_code +
      crypto.createHash("md5").update(secret).digest("hex").toUpperCase()
    )
    .digest("hex")
    .toUpperCase();

  if (localMd5sig === md5sig && status_code === "2") {
    logger.info(`[handlePayHereNotify] -> Payment successful for order: ${order_id}`);
    
    // Finalize registration logic
    // This usually involves finding the registration request and creating the tenant/shop
    // For now, we can call the finalize logic in registration service
    try {
      await registrationService.finalizeRegistration(order_id, `PAYHERE_${order_id}`);
    } catch (error: any) {
      logger.error(`[handlePayHereNotify] -> Finalization failed: ${error.message}`);
      return res.status(500).send("Finalization failed");
    }
  } else {
    logger.warn(`[handlePayHereNotify] -> Signature mismatch or failed status: ${status_code}`);
  }

  return res.status(200).send("OK");
};

export const verifyBankTransfer = async (req: Request, res: Response) => {
  const { tenantId, plan, amount, reference, admin_verified } = req.body;

  if (!tenantId || !plan || !amount || admin_verified !== true) {
    return res.status(400).json({ 
      success: false, 
      message: "Missing required verification data (tenantId, plan, amount, admin_verified)" 
    });
  }

  try {
    logger.info(`[verifyBankTransfer] -> Manually activating subscription for tenant: ${tenantId}`);

    await paymentService.activateShopSubscription(
      tenantId,
      plan as SubscriptionPlan,
      amount,
      reference || `BANK_REF_${Date.now()}`,
      PaymentMethod.BANK_TRANSFER
    );

    return res.status(200).json({ 
      success: true, 
      message: "Payment confirmed and subscription activated" 
    });
  } catch (error: any) {
    logger.error(`[verifyBankTransfer] -> Error: ${error.message}`);
    return res.status(500).json({ 
      success: false, 
      message: "Update failed",
      details: error.message
    });
  }
};
