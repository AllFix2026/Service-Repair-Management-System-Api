import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(1, "name is required"),
  phone: z.string().min(1, "phone is required"),
  email: z.string().email("Invalid email format").optional(),
  address: z.string().optional(),
  loyaltyPoints: z.number().optional(),
  tier: z.string().optional(),
  preferences: z.any().optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email("Invalid email format").optional(),
  address: z.string().optional(),
  loyaltyPoints: z.number().optional(),
  tier: z.string().optional(),
  preferences: z.any().optional(),
});


export const searchCustomerSchema = z.object({
  q: z.string().min(1, "Search term is required"),
});