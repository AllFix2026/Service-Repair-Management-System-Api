import { prisma } from "@/db/prisma";
import { CreateSupplierRequest, UpdateSupplierRequest } from "@/types/dto/inventory.dto";
import { logger } from "@/config/logger.config";

export const createSupplier = async (
  data: CreateSupplierRequest,
  tenantId: string,
  shopId: string
) => {
  logger.info(`[createSupplier] -> Creating supplier: ${data.name}`);

  const supplier = await prisma.supplier.create({
    data: {
      tenantId,
      shopId,
      name: data.name,
      contactName: data.contactName ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
      website: data.website ?? null,
      category: data.category ?? null,
    },
  });

  return supplier;
};

export const getSuppliers = async (tenantId: string, shopId: string) => {
  logger.info(`[getSuppliers] -> Fetching suppliers for shop: ${shopId}`);

  return await prisma.supplier.findMany({
    where: { tenantId, shopId, status: "ACTIVE" },
    orderBy: { name: "asc" },
  });
};

export const updateSupplier = async (
  supplierId: string,
  data: UpdateSupplierRequest,
  tenantId: string,
  shopId: string
) => {
  logger.info(`[updateSupplier] -> Updating supplier: ${supplierId}`);

  return await prisma.supplier.update({
    where: { id: supplierId },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.contactName !== undefined && { contactName: data.contactName }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.website !== undefined && { website: data.website }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.status && { status: data.status }),
    },
  });
};

export const deleteSupplier = async (supplierId: string, tenantId: string, shopId: string) => {
  logger.info(`[deleteSupplier] -> Soft deleting supplier: ${supplierId}`);

  return await prisma.supplier.updateMany({
    where: { id: supplierId, tenantId, shopId },
    data: { status: "DELETED" },
  });
};
