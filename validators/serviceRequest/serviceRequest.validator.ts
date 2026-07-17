import { z } from "zod";

export const createServiceRequestSchema = z.object({
  body: z.object({
    requestType: z.enum(["repair", "buy", "sell", "accessory", "other"]),
    deviceType: z.string().optional(),
    description: z.string().min(10, "Description must be at least 10 characters"),
    imageUrls: z.array(z.string().url()).optional(),
    aiCategory: z.string().optional(),
    aiBudgetMin: z.number().int().optional(),
    aiBudgetMax: z.number().int().optional(),
    customerBudgetMin: z.number().int(),
    customerBudgetMax: z.number().int(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    locationText: z.string().optional(),
    customerName: z.string().min(2, "Name is required"),
    customerPhone: z.string().min(9, "Valid phone number is required"),
    customerEmail: z.string().email().optional().or(z.literal("")),
  }),
});

export const acceptServiceRequestSchema = z.object({
  body: z.object({
    quotedAmount: z.number().int().positive("Quote must be a positive number"),
    message: z.string().optional(),
  }),
});

export const confirmOfferSchema = z.object({
  body: z.object({
    offerId: z.string().uuid("Invalid offer ID"),
    fulfillment: z.enum(["walkin", "delivery"]),
    phone: z.string(),
  }),
});

export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>["body"];
export type AcceptServiceRequestInput = z.infer<typeof acceptServiceRequestSchema>["body"];
export type ConfirmOfferInput = z.infer<typeof confirmOfferSchema>["body"];
