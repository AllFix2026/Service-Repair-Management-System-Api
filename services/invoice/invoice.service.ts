import { prisma } from "@/db/prisma";
import { logger } from "@/config/logger.config";

// Valid PaymentStatus enum values from Prisma schema
const VALID_PAYMENT_STATUSES = ["PENDING", "OVERDUE", "COMPLETED", "FAILED"] as const;

// Map user-friendly status names to database enum values
export const mapStatusToDatabase = (status: string | undefined): string | undefined => {
  if (!status) return undefined;

  const statusUpper = status.toUpperCase();

  // Direct mapping for database values
  if (VALID_PAYMENT_STATUSES.includes(statusUpper as any)) {
    return statusUpper;
  }

  // Mapping for user-friendly names
  const statusMap: Record<string, string> = {
    "PAID": "COMPLETED",
    "PAY": "COMPLETED",
    "COMPLETE": "COMPLETED",
  };

  const mappedStatus = statusMap[statusUpper];
  if (!mappedStatus) {
    throw {
      status: 400,
      message: `Invalid status "${status}". Allowed values: PENDING, OVERDUE, COMPLETED, FAILED`,
    };
  }

  return mappedStatus;
};

// Invoices are derived from the Payment model (linked to Repairs / standalone)
// AND from Device records (device sales / inventory)
export const getInvoices = async (tenantId: string) => {
  logger.info(`[getInvoices] -> Fetching invoices for tenant: ${tenantId}`);

  const [payments, devices] = await Promise.all([
    prisma.payment.findMany({
      where: { tenantId },
      include: {
        repair: {
          include: {
            customer: { select: { name: true, phone: true } },
            device: { select: { brand: true, model: true } },
            technician: { select: { fullName: true } },
            repairPartsUsed: true,
          },
        },
        customer: { select: { name: true, phone: true } },
        shop: { select: { name: true, logoUrl: true } },
      },
      orderBy: { paymentDate: "desc" },
    }),
    prisma.device.findMany({
      where: {
        tenantId,
        status: { in: ["SOLD", "ON_SALE", "COLLECTED"] },
      },
      include: {
        customer: { select: { name: true, phone: true } },
        shop: { select: { name: true, logoUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const paymentInvoices = payments.map((p) => {
    const totalAmount = Number(p.amount);
    const partsCost = p.repair
      ? (p.repair.repairPartsUsed || []).reduce((sum, part) => sum + (part.totalPrice || (part.unitPrice * part.quantityUsed) || 0), 0)
      : totalAmount * 0.6;
    const laborCost = p.repair
      ? Math.max(0, (p.repair.finalCost || p.repair.estimatedCost || totalAmount) - partsCost)
      : totalAmount - partsCost;

    return {
      id: p.id,
      invoiceId: p.repair
        ? `#REP-${p.repair.reference}`
        : `#PAY-${p.id.substring(0, 8).toUpperCase()}`,
      type: p.repair || (p.notes && p.notes.startsWith("Repair:")) ? "client_repair" : "inventory_item",
      name: p.repair?.customer?.name ?? p.customer?.name ?? "Walk-In",
      phone: p.repair?.customer?.phone ?? p.customer?.phone ?? "—",
      amount: totalAmount,
      status:
        (p.status as string) === "COMPLETED"
          ? "Paid"
          : (p.status as string) === "OVERDUE"
          ? "Overdue"
          : (p.status as string) === "PENDING"
          ? "Pending"
          : "Failed",
      date: p.paymentDate.toISOString(),
      staff: p.repair?.technician?.fullName ?? "Admin",
      device: p.repair?.device
        ? `${p.repair.device.brand} ${p.repair.device.model}`
        : "Internal",
      paymentMethod: p.paymentMethod,
      notes: p.notes ?? "",
      transactionReference: p.transactionReference ?? "",
      source: "payment" as const,
      shopName: p.shop?.name ?? null,
      shopLogoUrl: p.shop?.logoUrl ?? null,
      advancePayment: p.repair?.advancePayment ?? 0,
      partsCost,
      laborCost,
    };
  });

  const deviceInvoices = devices.map((d) => {
    const device = d as any;
    return {
      id: `dev-${device.id}`,
      invoiceId: `#DEV-${device.id.substring(0, 8).toUpperCase()}`,
      type: "inventory_item" as const,
      name: device.customer?.name ?? "Walk-In",
      phone: device.customer?.phone ?? "—",
      amount: (device.soldPrice !== null && device.soldPrice !== undefined) ? Number(device.soldPrice) : (device.price ? Number(device.price) : 0),
      status:
        (device.status === "SOLD" || device.status === "COLLECTED")
          ? "Paid"
          : "Pending",
      date: device.createdAt.toISOString(),
      staff: "Admin",
      device: `${device.brand} ${device.model}`,
      paymentMethod: "CASH",
      notes: device.imei ? `IMEI: ${device.imei}` : device.serialNo ? `S/N: ${device.serialNo}` : "",
      transactionReference: device.imei ?? device.serialNo ?? "",
      source: "device" as const,
      shopName: device.shop?.name ?? null,
      shopLogoUrl: device.shop?.logoUrl ?? null,
    };
  });

  return [...paymentInvoices, ...deviceInvoices].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
};

export const generateInvoice = async (repairId: string, tenantId: string) => {
  logger.info(`[generateInvoice] -> Auto-generating invoice for repair: ${repairId}`);

  const repair = await prisma.repair.findFirst({
    where: { id: repairId, tenantId },
    include: {
      customer: true,
      device: true,
      repairPartsUsed: true,
    },
  });

  if (!repair) throw { status: 404, message: "Repair not found" };
  const repairStatus = repair.status as string;
  if (repairStatus !== "PAID" && repairStatus !== "DELIVERED" && repairStatus !== "READY_TO_TAKE") {
    throw { status: 400, message: "Repair job is not completed yet" };
  }

  const existing = await prisma.payment.findFirst({
    where: { repairId, tenantId },
  });
  if (existing) throw { status: 409, message: "Invoice already exists for this repair job" };

  const partsCost = (repair.repairPartsUsed || []).reduce(
    (sum, p) => sum + (p.totalPrice || p.unitPrice * p.quantityUsed || 0),
    0
  );
  const total = repair.finalCost || repair.estimatedCost || 0;

  const payment = await prisma.payment.create({
    data: {
      tenantId,
      shopId: repair.shopId,
      repairId: repair.id,
      customerId: repair.customerId,
      amount: total,
      paymentMethod: "CASH" as any,
      paymentType: "REPAIR" as any,
      status: "COMPLETED" as any,
      notes: `Repair: ${repair.reference || repair.id}`,
    },
  });

  return {
    invoiceNumber: `#REP-${repair.reference || payment.id.substring(0, 8).toUpperCase()}`,
    subtotal: total - partsCost,
    taxAmount: 0,
    total,
  };
};

export const createInvoice = async (
  tenantId: string,
  data: {
    shopId: string;
    repairId?: string;
    customerId?: string;
    amount: number;
    paymentMethod: string;
    paymentType: string;
    status?: string;
    notes?: string;
    transactionReference?: string;
  }
) => {
  logger.info(`[createInvoice] -> Creating invoice for tenant: ${tenantId}`);

  const payment = await prisma.payment.create({
    data: {
      tenantId,
      shopId: data.shopId,
      repairId: data.repairId ?? null,
      customerId: data.customerId ?? null,
      amount: data.amount,
      paymentMethod: data.paymentMethod as any,
      paymentType: data.paymentType as any,
      status: (data.status as any) || "PENDING",
      notes: data.notes ?? null,
      transactionReference: data.transactionReference ?? null,
    },
  });

  logger.info(`[createInvoice] -> Invoice created: ${payment.id}`);
  return payment;
};

export const updateInvoiceStatus = async (
  id: string,
  tenantId: string,
  status?: string,
  amount?: number
) => {
  try {
    logger.info(
      `[updateInvoiceStatus] -> Updating invoice: ${id}, tenantId: ${tenantId}, status: ${status}, amount: ${amount}`
    );

    // Validate and map status
    const mappedStatus = mapStatusToDatabase(status);

    // Validate amount if provided
    if (amount !== undefined && (typeof amount !== "number" || amount < 0)) {
      throw {
        status: 400,
        message: "Amount must be a valid positive number",
      };
    }

    // Check if it's a device invoice (prefixed with "dev-")
    if (id.startsWith("dev-")) {
      const deviceId = id.substring(4); // Remove "dev-" prefix
      const existing = await prisma.device.findFirst({ where: { id: deviceId, tenantId } });
      if (!existing) throw { status: 404, message: "Invoice not found" };

      logger.info(`[updateInvoiceStatus] -> Updating device invoice: ${deviceId}`);

      return prisma.device.update({
        where: { id: deviceId },
        data: {
          ...(mappedStatus && { status: mappedStatus === "COMPLETED" ? "SOLD" : "ON_SALE" }),
          ...(amount !== undefined && { price: amount }),
        },
      });
    }

    // Otherwise, it's a payment invoice
    const existing = await prisma.payment.findFirst({ where: { id, tenantId } });
    if (!existing) {
      logger.warn(`[updateInvoiceStatus] -> Invoice not found: ${id}`);
      throw { status: 404, message: "Invoice not found" };
    }

    logger.info(`[updateInvoiceStatus] -> Updating payment invoice: ${id} with status: ${mappedStatus}`);

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        ...(mappedStatus && { status: mappedStatus as any }),
        ...(amount !== undefined && { amount: amount }),
      },
    });

    logger.info(`[updateInvoiceStatus] -> Successfully updated invoice: ${id}`);
    return updated;
  } catch (error: any) {
    logger.error(
      `[updateInvoiceStatus] -> Error updating invoice: ${error.message}, Stack: ${error.stack}`
    );
    throw error;
  }
};

export const deleteInvoice = async (id: string, tenantId: string) => {
  logger.info(`[deleteInvoice] -> Deleting invoice: ${id}`);

  // Check if it's a device invoice (prefixed with "dev-")
  if (id.startsWith("dev-")) {
    const deviceId = id.substring(4); // Remove "dev-" prefix
    const existing = await prisma.device.findFirst({ where: { id: deviceId, tenantId } });
    if (!existing) throw { status: 404, message: "Invoice not found" };

    await prisma.device.delete({ where: { id: deviceId } });
    return;
  }

  // Otherwise, it's a payment invoice
  const existing = await prisma.payment.findFirst({ where: { id, tenantId } });
  if (!existing) throw { status: 404, message: "Invoice not found" };

  await prisma.payment.delete({ where: { id } });
};

export const getInvoiceSummary = async (tenantId: string) => {
  logger.info(`[getInvoiceSummary] -> Fetching summary for tenant: ${tenantId}`);

  const [total, paid, pending] = await Promise.all([
    prisma.payment.aggregate({ where: { tenantId }, _sum: { amount: true }, _count: true }),
    prisma.payment.aggregate({ where: { tenantId, status: "COMPLETED" }, _sum: { amount: true }, _count: true }),
    prisma.payment.aggregate({ where: { tenantId, status: "PENDING" }, _sum: { amount: true }, _count: true }),
  ]);

  return {
    totalRevenue: Number(total._sum.amount ?? 0),
    totalInvoices: total._count,
    paidAmount: Number(paid._sum.amount ?? 0),
    paidCount: paid._count,
    pendingAmount: Number(pending._sum.amount ?? 0),
    pendingCount: pending._count,
  };
};