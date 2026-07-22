import { z } from "zod";

export const generateShopIdsSchema = z.object({
  shop_name: z.string().min(1, "shop_name is required"),
  owner_email: z.string().email("Invalid email format"),
});

export const registerShopSchema = z.object({
  shop_id: z.string().uuid("shop_id must be a valid UUID"),
  tenant_id: z.string().uuid("tenant_id must be a valid UUID"),
  shop_name: z.string().min(1, "shop_name is required"),
  businessRegistration: z.string().optional(),
  brn: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  branches: z.string().optional(),
  repairTypes: z.array(z.string()).optional(),
  plan: z.string().optional(),
  owner: z.object({
    name: z.string().min(1, "owner name is required"),
    email: z.string().email("Invalid owner email format"),
    password: z.string().min(8, "Password must be at least 8 characters"),
  }),
});

export const sendVerificationSchema = z.object({
  user_id: z.string().min(1, "user_id is required"),
  email: z.string().email("Invalid email format"),
});
export const verifyEmailSchema = z.object({
  token: z.string().min(1, "token is required"),
});