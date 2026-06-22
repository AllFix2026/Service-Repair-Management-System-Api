import { prisma } from "@/db/prisma";

type DeviceCreateInput = {
  shopId: string;
  customerId: string;
  brand: string;
  model: string;
  type?: string;
  imei?: string;
  serialNo?: string;
  price?: number;
  status?: "ACTIVE" | "AVAILABLE" | "ON_SALE" | "SOLD" | "IN_SERVICE" | "COLLECTED";
};

type DeviceUpdateInput = {
  customerId?: string;
  brand?: string;
  model?: string;
  type?: string;
  imei?: string;
  serialNo?: string;
  price?: number;
  status?: "ACTIVE" | "AVAILABLE" | "ON_SALE" | "SOLD" | "IN_SERVICE" | "COLLECTED";
  autoUpdateCustomer?: boolean;
};

const deviceSelect = {
  id: true,
  tenantId: true,
  shopId: true,
  customerId: true,
  brand: true,
  model: true,
  type: true,
  imei: true,
  serialNo: true,
  price: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

const deviceWithCustomerSelect = {
  ...deviceSelect,
  customer: {
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
    },
  },
} as const;

const deviceWithHistorySelect = {
  ...deviceWithCustomerSelect,
  repairs: {
    select: {
      id: true,
      status: true,
      issue: true,
      diagnosis: true,
      estimatedCost: true,
      finalCost: true,
      createdAt: true,
      updatedAt: true,
      shop: {
        select: {
          id: true,
          name: true,
          shopCode: true,
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      },
      technician: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc" as const,
    },
  },
} as const;

export const getTenantDevices = async (
  tenantId: string,
  filters?: {
    shopId?: string;
    customerId?: string;
    search?: string;
  },
) => {
  const where = {
    tenantId,
    ...(filters?.shopId ? { shopId: filters.shopId } : {}),
    ...(filters?.customerId ? { customerId: filters.customerId } : {}),
    ...(filters?.search
      ? {
          OR: [
            { brand: { contains: filters.search, mode: "insensitive" as const } },
            { model: { contains: filters.search, mode: "insensitive" as const } },
            { imei: { contains: filters.search, mode: "insensitive" as const } },
            { serialNo: { contains: filters.search, mode: "insensitive" as const } },
            {
              customer: {
                is: {
                  name: { contains: filters.search, mode: "insensitive" as const },
                },
              },
            },
          ],
        }
      : {}),
  };

  return prisma.device.findMany({
    where,
    select: deviceWithCustomerSelect,
    orderBy: { updatedAt: "desc" },
  });
};

export const getTenantDeviceById = async (id: string, tenantId: string) => {
  const device = await prisma.device.findFirst({
    where: { id, tenantId },
    select: deviceWithHistorySelect,
  });

  if (!device) {
    throw { status: 404, message: "Device not found" };
  }

  return device;
};

import { sendSms } from "@/services/notification/notification.service";

export const createTenantDevice = async (tenantId: string, data: DeviceCreateInput) => {
  // Keep tenant boundaries strict by validating related entities first.
  const [shop, customer] = await Promise.all([
    prisma.shop.findFirst({ where: { id: data.shopId, tenantId }, select: { id: true, name: true, address: true, city: true, phone: true } }),
    prisma.customer.findFirst({ where: { id: data.customerId, tenantId }, select: { id: true, shopId: true } }),
  ]);

  if (!shop) {
    throw { status: 400, message: "Shop does not belong to tenant" };
  }

  if (!customer) {
    throw { status: 400, message: "Customer does not belong to tenant" };
  }

  if (customer.shopId !== data.shopId) {
    throw { status: 400, message: "Customer does not belong to the provided shop" };
  }

  try {
    const device = await prisma.device.create({
      data: {
        tenantId,
        shopId: data.shopId,
        customerId: data.customerId,
        brand: data.brand,
        model: data.model,
        type: data.type,
        imei: data.imei,
        serialNo: data.serialNo,
        price: data.price,
        status: data.status,
      },
      select: deviceWithCustomerSelect,
    });

    // Send SMS notification
    if (device.customer?.phone) {
      const shopName = shop?.name || "Our Shop";
      const addressParts = [shop?.address, shop?.city].filter(Boolean).join(", ");
      const shopContact = shop?.phone ? `\nContact: ${shop.phone}` : "";
      const shopFooter = `\n${shopName}${addressParts ? `\n${addressParts}` : ""}${shopContact}`;
      const message = `Hi ${device.customer.name},\nYour device (${device.brand} ${device.model}) has been successfully registered in our system.${shopFooter}`;
      await sendSms(device.customer.phone, message).catch(err => {
        console.error("Non-fatal: Failed to send SMS on device creation:", err);
      });
    }

    return device;
  } catch (error: any) {
    if (error.code === "P2002") {
      throw { status: 409, message: "A device with this IMEI already exists for this shop" };
    }
    throw error;
  }
};

export const updateTenantDevice = async (id: string, tenantId: string, data: DeviceUpdateInput) => {
  const existing = await prisma.device.findFirst({
    where: { id, tenantId },
    select: { id: true, shopId: true, status: true },
  });

  if (!existing) {
    throw { status: 404, message: "Device not found" };
  }

  if (data.customerId) {
    // Reassignment is allowed only inside the same tenant + shop.
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, tenantId },
      select: { id: true, shopId: true },
    });

    if (!customer) {
      throw { status: 400, message: "Customer does not belong to tenant" };
    }

    if (customer.shopId !== existing.shopId) {
      throw { status: 400, message: "Customer does not belong to the device shop" };
    }
  }

  try {
    const { autoUpdateCustomer, ...updateData } = data;

    const device = await prisma.device.update({
      where: { id: existing.id },
      data: updateData,
      select: deviceWithCustomerSelect,
    });

    if (autoUpdateCustomer && data.status && device.customer?.phone) {
      const shop = await prisma.shop.findFirst({ where: { id: existing.shopId }, select: { name: true, address: true, city: true, phone: true } });
      const shopName = shop?.name || "Our Shop";
      const statusText = data.status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
      const addressParts = [shop?.address, shop?.city].filter(Boolean).join(", ");
      const shopContact = shop?.phone ? `\nContact: ${shop.phone}` : "";
      const shopFooter = `\n${shopName}${addressParts ? `\n${addressParts}` : ""}${shopContact}`;
      let message = `Hi ${device.customer.name},\nYour device (${device.brand} ${device.model}) status has been updated to: ${statusText}.${shopFooter}`;
      
      if (data.status === 'SOLD') {
        message = `Hi ${device.customer.name},\nYour device (${device.brand} ${device.model}) is sold, you can collect your cash.${shopFooter}`;
      }
      
      await sendSms(device.customer.phone, message).catch((err) => {
        console.error("Non-fatal: Failed to send SMS on device status update:", err);
      });
    }

    return device;
  } catch (error: any) {
    if (error.code === "P2002") {
      throw { status: 409, message: "A device with this IMEI already exists for this shop" };
    }
    throw error;
  }
};

export const deleteTenantDevice = async (id: string, tenantId: string): Promise<void> => {
  const device = await prisma.device.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      _count: {
        select: {
          repairs: true,
        },
      },
    },
  });

  if (!device) {
    throw { status: 404, message: "Device not found" };
  }

  // Preserve repair history by preventing deletion when historical repairs exist.
  if (device._count.repairs > 0) {
    throw { status: 409, message: "Cannot delete device with repair history" };
  }

  await prisma.device.delete({ where: { id: device.id } });
};
