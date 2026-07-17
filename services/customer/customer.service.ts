import { prisma } from "@/db/prisma";
import { CreateCustomerRequest, UpdateCustomerRequest } from "@/types/dto/customer.dto";
import { logger } from "@/config/logger.config";

export const createCustomer = async (
  data: CreateCustomerRequest,
  tenantId: string,
  shopId: string
) => {
  logger.info(`[createCustomer] -> Creating customer: ${data.name}`);

  const customer = await prisma.customer.create({
    data: {
      tenantId,
      shopId,
      name: data.name,
      phone: data.phone ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
      loyaltyPoints: data.loyaltyPoints ?? 0,
      tier: data.tier ?? "Regular",
      tags: data.tags ?? [],
      preferences: data.preferences ?? {
        preferredContact: "Phone",
        notifications: { email: true, sms: true, push: true },
        language: "English"
      },
    },
  });

  logger.info(`[createCustomer] -> Customer created: ${customer.id}`);
  return customer;
};

export const searchCustomers = async (
  q: string,
  tenantId: string,
  shopId: string
) => {
  logger.info(`[searchCustomers] -> Searching customers with term: ${q}`);

  const customers = await prisma.customer.findMany({
    where: {
      tenantId,
      shopId,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
    },
  });

  logger.info(`[searchCustomers] -> Found ${customers.length} customers`);
  return customers;
};

export const getCustomers = async (
  tenantId: string, 
  shopId: string,
  page?: number,
  limit?: number
) => {
  logger.info(`[getCustomers] -> Fetching customers for shop: ${shopId} (page: ${page}, limit: ${limit})`);

  const hasPagination = page !== undefined && limit !== undefined;
  const skip = hasPagination ? (page - 1) * limit : undefined;
  const take = hasPagination ? limit : undefined;

  const customers = await prisma.customer.findMany({
    where: { tenantId, shopId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      loyaltyPoints: true,
      tier: true,
      createdAt: true,
      repairs: {
        select: {
          finalCost: true,
          estimatedCost: true,
          createdAt: true,
        }
      }
    },
    orderBy: { createdAt: "desc" },
    ...(hasPagination ? { skip, take } : {}),
  });

  logger.info(`[getCustomers] -> Found ${customers.length} customers`);
  return customers;
};

export const getCustomerById = async (
  customerId: string,
  tenantId: string,
  shopId: string
) => {
  logger.info(`[getCustomerById] -> Fetching customer: ${customerId}`);

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, shopId },
    include: {
      repairs: {
        orderBy: { createdAt: "desc" },
      },
      devices: true,
      payments: {
        orderBy: { paymentDate: "desc" },
      },
      notes: {
        include: {
          user: {
            select: {
              name: true,
              fullName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });


  if (!customer) {
    logger.warn(`[getCustomerById] -> Customer not found: ${customerId}`);
    throw { status: 404, message: "Customer not found" };
  }

  logger.info(`[getCustomerById] -> Customer found: ${customerId}`);
  return customer;
};


export const updateCustomer = async (
  customerId: string,
  data: UpdateCustomerRequest,
  tenantId: string,
  shopId: string
) => {
  logger.info(`[updateCustomer] -> Updating customer: ${customerId}`);

  const existing = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, shopId },
  });

  if (!existing) {
    logger.warn(`[updateCustomer] -> Customer not found: ${customerId}`);
    throw { status: 404, message: "Customer not found" };
  }

  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.phone && { phone: data.phone }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.loyaltyPoints !== undefined && { loyaltyPoints: data.loyaltyPoints }),
      ...(data.tier !== undefined && { tier: data.tier }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.preferences !== undefined && { preferences: data.preferences }),

    },

  });

  logger.info(`[updateCustomer] -> Customer updated: ${customerId}`);
  return customer;
};

export const deleteCustomer = async (
  customerId: string,
  tenantId: string,
  shopId: string
) => {
  logger.info(`[deleteCustomer] -> Deleting customer: ${customerId}`);

  const existing = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, shopId },
    include: {
      _count: {
        select: { repairs: true, devices: true },
      },
    },
  });

  if (!existing) {
    logger.warn(`[deleteCustomer] -> Customer not found: ${customerId}`);
    throw { status: 404, message: "Customer not found" };
  }

  if (existing._count.repairs > 0 || existing._count.devices > 0) {
    logger.warn(`[deleteCustomer] -> Cannot delete customer with ${existing._count.repairs} repairs and ${existing._count.devices} devices`);
    throw {
      status: 400,
      message: `Cannot delete customer with associated repairs (${existing._count.repairs}) or devices (${existing._count.devices})`,
    };
  }

  await prisma.customer.delete({ where: { id: customerId } });

  logger.info(`[deleteCustomer] -> Customer deleted: ${customerId}`);
};

export const addCustomerNote = async (
  customerId: string,
  userId: string,
  text: string,
  tenantId: string,
  shopId: string
) => {
  logger.info(`[addCustomerNote] -> Adding note to customer: ${customerId}`);

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, shopId },
  });

  if (!customer) {
    logger.warn(`[addCustomerNote] -> Customer not found: ${customerId}`);
    throw { status: 404, message: "Customer not found" };
  }

  const note = await prisma.customerNote.create({
    data: {
      customerId,
      userId,
      text,
    },
    include: {
      user: {
        select: {
          name: true,
          fullName: true,
        },
      },
    },
  });

  logger.info(`[addCustomerNote] -> Note added: ${note.id}`);
  return note;
};

export const mergeCustomers = async (
  sourceId: string,
  targetId: string,
  tenantId: string,
  shopId: string
) => {
  logger.info(`[mergeCustomers] -> Merging ${sourceId} into ${targetId}`);

  if (sourceId === targetId) {
    throw { status: 400, message: "Cannot merge a customer into themselves" };
  }

  const [source, target] = await Promise.all([
    prisma.customer.findFirst({ where: { id: sourceId, tenantId, shopId } }),
    prisma.customer.findFirst({ where: { id: targetId, tenantId, shopId } }),
  ]);

  if (!source || !target) {
    throw { status: 404, message: "One or both customers not found" };
  }

  // Use a transaction to ensure atomicity
  await prisma.$transaction([
    // Update Repairs
    prisma.repair.updateMany({
      where: { customerId: sourceId },
      data: { customerId: targetId },
    }),
    // Update Devices
    prisma.device.updateMany({
      where: { customerId: sourceId },
      data: { customerId: targetId },
    }),
    // Update Payments
    prisma.payment.updateMany({
      where: { customerId: sourceId },
      data: { customerId: targetId },
    }),
    // Update Appointments
    prisma.appointment.updateMany({
      where: { customerId: sourceId },
      data: { customerId: targetId },
    }),
    // Update Notes
    prisma.customerNote.updateMany({
      where: { customerId: sourceId },
      data: { customerId: targetId },
    }),
    // Update Loyalty Points (sum them)
    prisma.customer.update({
      where: { id: targetId },
      data: { 
        loyaltyPoints: { increment: source.loyaltyPoints }
      },
    }),
    // Delete source
    prisma.customer.delete({
      where: { id: sourceId },
    }),
  ]);

  logger.info(`[mergeCustomers] -> Merge completed successfully`);
};
