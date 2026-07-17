import { logger } from "@/config/logger.config";

export const createPaymentIntent = async (amount: number, currency: string = 'lkr', metadata: any = {}) => {
  logger.warn(`[Stripe] createPaymentIntent was called but Stripe is disabled.`);
  throw new Error("Stripe payments are disabled. Please use PayHere instead.");
};

export const verifyPaymentIntent = async (paymentIntentId: string, requestId: string) => {
  logger.warn(`[Stripe] verifyPaymentIntent was called but Stripe is disabled.`);
  return false;
};
