import { Request, Response } from "express";
import * as registrationService from "@/services/registration/registration.service";
import { logger } from "@/config/logger.config";
import { registerShopSchema } from "@/validators/shop/shop.validator";

export const requestRegistration = async (req: Request, res: Response) => {
  try {
    const validatedData = registerShopSchema.parse(req.body);
    const result = await registrationService.createRegistrationRequest(validatedData);
    return res.status(201).json(result);
  } catch (error: any) {
    logger.error(`[OnboardingController] Error: ${error.message}`);
    return res.status(error.status || 500).json({ message: error.message || "Internal server error" });
  }
};

export const approveRegistration = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    await registrationService.approveRegistrationRequest(token as string);
    return res.status(200).json({ message: "Registration approved successfully" });
  } catch (error: any) {
    logger.error(`[OnboardingController] Error approving: ${error.message}`);
    return res.status(error.status || 500).json({ message: error.message || "Internal server error" });
  }
};

export const rejectRegistration = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    await registrationService.rejectRegistrationRequest(token as string);
    return res.status(200).json({ success: true, message: "Registration rejected successfully" });
  } catch (error: any) {
    logger.error(`[OnboardingController] Error rejecting: ${error.message}`);
    return res.status(error.status || 500).json({ message: error.message || "Internal server error" });
  }
};

export const cancelRegistration = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await registrationService.cancelRegistrationRequest(id as string);
    return res.status(200).json({ success: true, message: "Registration cancelled successfully" });
  } catch (error: any) {
    logger.error(`[OnboardingController] Error cancelling: ${error.message}`);
    return res.status(error.status || 500).json({ message: error.message || "Internal server error" });
  }
};

export const getStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await registrationService.getRegistrationRequestStatus(id as string);
    return res.json(result);
  } catch (error: any) {
    return res.status(error.status || 500).json({ message: error.message || "Internal server error" });
  }
};

export const listRequests = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const result = await registrationService.getAllRegistrationRequests(status as string);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(error.status || 500).json({ message: error.message || "Internal server error" });
  }
};

import * as payhereService from "@/services/payment/payhere.service";

export const createPayHereParams = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.body;
    const request = await registrationService.getRegistrationRequestStatus(requestId);
    
    if (request.status !== "APPROVED") {
      return res.status(400).json({ message: "Registration not yet approved by admin" });
    }

    const config = payhereService.getPayHereConfig();
    const fee = parseFloat(process.env.REGISTRATION_FEE_LKR || "2500");
    const currency = "LKR";
    
    logger.info(`[PayHere Debug] config: ${JSON.stringify(config)}, fee: ${fee}, currency: ${currency}, requestId: ${requestId}`);
    
    const hash = payhereService.generatePayHereHash(
      config.merchant_id,
      requestId,
      fee,
      currency,
      config.merchant_secret
    );

    logger.info(`[PayHere Debug] Generated Hash: ${hash}`);

    const params = {
      merchant_id: config.merchant_id,
      return_url: `${process.env.FRONTEND_URL}/payment-success`,
      cancel_url: `${process.env.FRONTEND_URL}/payment-cancel`,
      notify_url: `${process.env.BACKEND_URL}/api/v1/payment/payhere-notify`,
      order_id: requestId,
      items: `Subscription: ${request.shopName}`,
      currency,
      amount: fee.toFixed(2),
      hash,
      // User info
      first_name: request.ownerName.split(" ")[0],
      last_name: request.ownerName.split(" ").slice(1).join(" ") || "Owner",
      email: request.ownerEmail,
      phone: "0000000000", // Should be fetched from request.fullData if available
      address: "Address", 
      city: "City",
      country: "Sri Lanka",
      _debug: {
        config,
        fee,
        currency,
        calculatedHash: hash,
        envSecret: process.env.PAYHERE_MERCHANT_SECRET,
        envId: process.env.PAYHERE_MERCHANT_ID,
        envFee: process.env.REGISTRATION_FEE_LKR
      }
    };

    return res.json({ success: true, data: params });
  } catch (error: any) {
    logger.error(`[OnboardingController] Error creating payhere params: ${error.message}`);
    return res.status(500).json({ message: error.message });
  }
};

export const createPaymentIntent = async (req: Request, res: Response) => {
  return res.status(400).json({ 
    success: false, 
    message: "Stripe payments are disabled. Please use PayHere instead." 
  });
};

export const finalizeRegistration = async (req: Request, res: Response) => {
  try {
    const { requestId, paymentIntentId } = req.body;
    const result = await registrationService.finalizeRegistration(requestId, paymentIntentId);
    return res.status(200).json({ message: "Registration successful", result });
  } catch (error: any) {
    logger.error(`[OnboardingController] Error finalizing: ${error.message}`);
    return res.status(error.status || 500).json({ message: error.message || "Internal server error" });
  }
};

export const resendAdminNotification = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await registrationService.resendAdminApprovalEmail(id);
    return res.status(200).json({ message: "Admin notification resent successfully" });
  } catch (error: any) {
    logger.error(`[OnboardingController] Error resending notification: ${error.message}`);
    return res.status(error.status || 500).json({ message: error.message || "Internal server error" });
  }
};

export const registerStaff = async (req: Request, res: Response) => {
  try {
    const result = await registrationService.createStaffMember(req.body);
    return res.status(201).json(result);
  } catch (error: any) {
    logger.error(`[OnboardingController] Error registering staff: ${error.message}`);
    return res.status(error.status || 500).json({ message: error.message || "Internal server error" });
  }
};
