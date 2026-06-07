import { prisma } from "@/db/prisma";
import { Prisma } from "@prisma/client";
import type { UpdateSettingsInput } from "@/validators/settings/settings.validator";

export type ShopSettingsResponse = {
  shopName: string;
  currency: string;
  taxPercentage: number;
  notificationsEnabled: boolean;
};

export const getShopSettings = async (
  tenantId: string,
  shopId: string,
) => {
  const shop = await prisma.shop.findFirst({
    where: { id: shopId, tenantId },
    include: { settings: true },
  });

  if (!shop) {
    throw { status: 404, code: "NOT_FOUND" };
  }

  return {
    shop: {
      name: shop.name,
      address: shop.address,
      phone: shop.phone,
      email: shop.email,
      website: shop.website,
      taxNumber: shop.taxNumber,
    },
    settings: {
      currency: shop.settings?.currency ?? "LKR",
      timezone: shop.settings?.timezone ?? "(GMT +05:30) Colombo, Sri Lanka",
      language: shop.settings?.language ?? "en",
      taxPercentage: Number(shop.settings?.taxRate ?? 0),
      notificationPreferences: shop.settings?.notificationPreferences ?? {},
      appearance: shop.settings?.appearance ?? {},
      customerTiers: (shop.settings?.appearance as any)?.customerTiers ?? [],
      securityRules: shop.settings?.securityRules ?? {},

    },
    logoUrl: shop.logoUrl,
    subscription: {
      plan: shop.subscriptionPlan || "SINGLE",
      status: shop.subscriptionStatus || "SUSPENDED",
      startDate: shop.subscriptionStartDate,
      endDate: shop.subscriptionEndDate,
    }
  };
};

export const updateShopSettings = async (
  tenantId: string,
  shopId: string,
  data: UpdateSettingsInput,
): Promise<void> => {
  const shopUpdatePayload: Prisma.ShopUpdateInput = {};
  const settingsUpdatePayload: any = {};

  // Shop Profile Fields
  if (data.shopName !== undefined) shopUpdatePayload.name = data.shopName;
  if (data.address !== undefined) shopUpdatePayload.address = data.address;
  if (data.phone !== undefined) shopUpdatePayload.phone = data.phone;
  if (data.email !== undefined) shopUpdatePayload.email = data.email;
  if (data.website !== undefined) shopUpdatePayload.website = data.website;
  if (data.taxNumber !== undefined) shopUpdatePayload.taxNumber = data.taxNumber;
  if (data.logoUrl !== undefined) shopUpdatePayload.logoUrl = data.logoUrl;

  // Settings Fields
  if (data.currency !== undefined) settingsUpdatePayload.currency = data.currency.trim().toUpperCase();
  if (data.timezone !== undefined) settingsUpdatePayload.timezone = data.timezone;
  if (data.taxPercentage !== undefined) settingsUpdatePayload.taxRate = new Prisma.Decimal(data.taxPercentage);
  if (data.notificationPreferences !== undefined) {
    settingsUpdatePayload.notificationPreferences = data.notificationPreferences;
  }
  if (data.notificationsEnabled !== undefined) {
    // If just toggling enabled, merge with existing if possible or set a flag
    settingsUpdatePayload.notificationPreferences = { 
      ...(settingsUpdatePayload.notificationPreferences || {}),
      enabled: data.notificationsEnabled 
    };
  }
  if (data.securityRules !== undefined) settingsUpdatePayload.securityRules = data.securityRules;
  if (data.language !== undefined) settingsUpdatePayload.language = data.language;

  
  const existingShop = await prisma.shop.findFirst({
    where: { id: shopId, tenantId },
    include: { settings: true },
  });

  if (!existingShop) {
    throw { status: 404, code: "NOT_FOUND" };
  }

  // Merge customerTiers into appearance if provided
  if (data.customerTiers !== undefined) {
    const currentAppearance = (existingShop.settings?.appearance as any) || {};
    settingsUpdatePayload.appearance = {
      ...currentAppearance,
      customerTiers: data.customerTiers
    };
  } else if (data.appearance !== undefined) {
    // If appearance is provided directly, merge with existing tiers to preserve them
    const currentTiers = (existingShop.settings?.appearance as any)?.customerTiers || [];
    settingsUpdatePayload.appearance = {
      ...data.appearance,
      customerTiers: currentTiers
    };
  }


  try {
    if (Object.keys(shopUpdatePayload).length > 0) {
      await prisma.shop.update({
        where: { id: shopId },
        data: shopUpdatePayload,
      });
    }

    if (Object.keys(settingsUpdatePayload).length > 0) {
      await prisma.shopSettings.upsert({
        where: { tenantId: shopId },
        create: {
          tenantId: shopId,
          ...settingsUpdatePayload,
        },
        update: settingsUpdatePayload,
      });
    }
  } catch (error: any) {
    if (error.code === "P2025") {
      throw { status: 404, code: "NOT_FOUND" };
    }
    throw error;
  }
};
