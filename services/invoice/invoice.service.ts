import { prisma } from "@/db/prisma";
import { logger } from "@/config/logger.config";

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
        p.status === "COMPLETED"
          ? "Paid"
          : p.status === "PENDING"
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
        (d.status === "SOLD" || d.status === "COLLECTED")
          ? "Paid"
          : "Pending",
      date: d.createdAt.toISOString(),
      staff: "Admin",
      device: `${d.brand} ${d.model}`,
      paymentMethod: "CASH",
      notes: d.imei ? `IMEI: ${d.imei}` : d.serialNo ? `S/N: ${d.serialNo}` : "",
      transactionReference: d.imei ?? d.serialNo ?? "",
      source: "device" as const,
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
  logger.info(`[updateInvoiceStatus] -> Updating invoice: ${id} to status: ${status}, amount: ${amount}`);

  const existing = await prisma.payment.findFirst({ where: { id, tenantId } });
  if (!existing) throw { status: 404, message: "Invoice not found" };

  return prisma.payment.update({
    where: { id },
    data: {
      ...(status && { status: status as any }),
      ...(amount !== undefined && { amount: amount }),
    },
  });
};

export const deleteInvoice = async (id: string, tenantId: string) => {
  logger.info(`[deleteInvoice] -> Deleting invoice: ${id}`);

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