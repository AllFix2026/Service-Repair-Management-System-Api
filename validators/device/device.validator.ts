import { z } from "zod";

export const deviceListQuerySchema = z.object({
  shopId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  search: z.string().trim().min(1).max(120).optional(),
});

export const createDeviceSchema = z.object({
  shopId: z.string().min(1, "shopId is required"),
  customerId: z.string().min(1, "customerId is required"),
  brand: z.string().trim().min(1, "brand is required"),
  model: z.string().trim().min(1, "model is required"),
  type: z.string().trim().optional(),
  imei: z.string().trim().min(8, "imei must be at least 8 chars").optional(),
  serialNo: z.string().trim().min(2, "serialNo must be at least 2 chars").optional(),
  price: z.number().nonnegative().optional(),
  costPrice: z.number().nonnegative().optional(),
  soldPrice: z.number().nonnegative().optional(),
  photoUrl: z.string().url().optional(),
  status: z.enum(["ACTIVE", "AVAILABLE", "ON_SALE", "SOLD", "IN_SERVICE", "COLLECTED"]).optional(),
});

export const updateDeviceSchema = z
  .object({
    customerId: z.string().min(1).optional(),
    brand: z.string().trim().min(1).optional(),
    model: z.string().trim().min(1).optional(),
    type: z.string().trim().optional(),
    imei: z.string().trim().min(8).optional(),
    serialNo: z.string().trim().min(2).optional(),
    price: z.number().nonnegative().optional(),
    costPrice: z.number().nonnegative().optional(),
    soldPrice: z.number().nonnegative().optional(),
    photoUrl: z.string().url().optional(),
    status: z.enum(["ACTIVE", "AVAILABLE", "ON_SALE", "SOLD", "IN_SERVICE", "COLLECTED"]).optional(),
    autoUpdateCustomer: z.boolean().optional(),
  })
  .refine((payload: Record<string, unknown>) => Object.keys(payload).length > 0, {
    message: "At least one field is required",
  });
