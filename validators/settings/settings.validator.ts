import { z } from "zod";

export const updateSettingsSchema = z
  .object({
    shopName: z.string().min(1, "shopName cannot be empty").optional(),
    currency: z.string().min(1).optional(),
    timezone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    email: z.string().email().optional().or(z.literal("")).nullable(),
    website: z.string().optional().or(z.literal("")).nullable(),
    taxNumber: z.string().optional().or(z.literal("")).nullable(),
    notificationPreferences: z.record(z.string(), z.any()).optional().nullable(),
    taxPercentage: z.number().min(0).max(100).optional(),
    notificationsEnabled: z.boolean().optional(),
    appearance: z.record(z.string(), z.any()).optional().nullable(),
    securityRules: z.record(z.string(), z.any()).optional().nullable(),
    language: z.string().optional().nullable(),
    customerTiers: z.array(z.any()).optional().nullable(),
    logoUrl: z.string().url().optional().or(z.literal("")).nullable(),

  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
