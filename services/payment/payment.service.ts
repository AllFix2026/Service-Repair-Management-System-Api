import { prisma } from "@/db/prisma";
import { logger } from "@/config/logger.config";
import { sendPaymentConfirmationEmail } from "@/services/email/email.service";
import { 
  SubscriptionPlan, 
  SubscriptionStatus, 
  PaymentMethod, 
  PaymentType, 
  PaymentStatus 
} from "@prisma/client";

export const activateShopSubscription = async (
  tenantId: string,
  plan: SubscriptionPlan,
  amount: number,
  reference: string,
  method: PaymentMethod
) => {
  logger.info(`[activateShopSubscription] -> Activating subscription for tenant: ${tenantId}`);

  // Calculate expiry date (30 days from now)
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update Shop status
    const shop = await tx.shop.update({
      where: { id: tenantId },
      data: {
        subscriptionPlan: plan,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
        isActive: true,
      },
    });

    // 2. Record Payment
    const payment = await tx.payment.create({
      data: {
        tenantId: shop.tenantId,
        shopId: shop.id,
        amount: amount,
        paymentMethod: method,
        paymentType: PaymentType.FULL,
        transactionReference: reference,
        status: PaymentStatus.COMPLETED,
        paymentDate: startDate,
        notes: `Subscription activation for plan: ${plan}`,
      },
    });

    return { shop, payment };
  });

  // 3. Send Confirmation Email (Async)
  const owner = await prisma.user.findFirst({
    where: { tenantId: tenantId, role: "ADMIN" },
  });

  if (owner && owner.email) {
    sendPaymentConfirmationEmail(
      owner.id,
      owner.email,
      amount,
      plan
    ).catch(err => logger.error(`[activateShopSubscription] -> Failed to send email: ${err.message}`));
  }

  return result;
}

export const recordManualPayment = async (
  tenantId: string,
  data: {
    shopId: string;
    amount: number;
    reference: string;
    method: PaymentMethod;
    type: PaymentType;
    repairId?: string;
    customerId?: string;
    receivedByUserId?: string;
    notes?: string;
  }
) => {
  return await prisma.payment.create({
    data: {
      tenantId,
      shopId: data.shopId,
      amount: data.amount,
      paymentMethod: data.method,
      paymentType: data.type,
      transactionReference: data.reference,
      status: PaymentStatus.COMPLETED,
      repairId: data.repairId,
      customerId: data.customerId,
      userId: data.receivedByUserId,
      notes: data.notes,
    },
  });
};
