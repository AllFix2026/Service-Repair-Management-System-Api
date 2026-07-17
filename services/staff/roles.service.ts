import { prisma } from "@/db/prisma";

export const listStaffRoles = async (tenantId: string, shopId: string) => {
  return await prisma.staffRole.findMany({
    where: { tenantId, shopId },
    orderBy: { createdAt: "asc" },
  });
};

export const createStaffRole = async (tenantId: string, shopId: string, data: { name: string; color: string; description?: string }) => {
  return await prisma.staffRole.create({
    data: {
      tenantId,
      shopId,
      ...data,
    },
  });
};

export const updateStaffRole = async (id: string, tenantId: string, data: { name?: string; color?: string; description?: string }) => {
  return await prisma.staffRole.update({
    where: { id, tenantId },
    data,
  });
};

export const deleteStaffRole = async (id: string, tenantId: string) => {
  return await prisma.staffRole.delete({
    where: { id, tenantId },
  });
};
