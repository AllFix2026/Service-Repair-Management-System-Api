import { prisma } from "@/db/prisma";

export const getSuperAdminStats = async () => {
  const [totalShops, totalUsers, pendingRequests] = await Promise.all([
    prisma.shop.count(),
    prisma.user.count(),
    prisma.registrationRequest.count({ where: { status: 'PENDING' } }),
  ]);

  // For "Today's Inquiries", we can count registration requests created today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayInquiries = await prisma.registrationRequest.count({
    where: {
      createdAt: {
        gte: today,
      },
    },
  });

  return {
    totalShops,
    totalUsers,
    pendingRequests,
    todayInquiries,
  };
};

export const getAllShops = async () => {
  return await prisma.shop.findMany({
    include: {
      tenant: true,
      settings: true,
      _count: {
        select: { users: true, repairs: true }
      }
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const updateShopFeatures = async (shopId: string, featureFlags: any) => {
  const updatedSettings = await prisma.shopSettings.upsert({
    where: { tenantId: shopId },
    create: {
      tenantId: shopId,
      featureFlags: featureFlags,
    },
    update: {
      featureFlags: featureFlags,
    },
  });

  try {
    const { invalidateCache } = require("@/utils/cache.util");
    invalidateCache(`shop_settings:${shopId}`);
  } catch (err) {
    // Ignore cache failure if utility is loaded differently
  }

  return updatedSettings;
};

export const getAllUsers = async () => {
  return await prisma.user.findMany({
    select: {
      id: true,
      fullName: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
      shop: {
        select: {
          name: true,
          shopCode: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' },
  });
};
