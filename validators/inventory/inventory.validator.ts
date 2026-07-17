import { z } from "zod";

export const createInventoryItemSchema = z.object({
  partName: z.string().min(1, "Part name is required"),
  partNumber: z.string().optional(),
  category: z.string().optional(),
  compatibleBrands: z.array(z.string()).optional(),
  compatibleModels: z.array(z.string()).optional(),
  supplierName: z.string().optional(),
  quantityInStock: z.number().int().min(0, "Quantity must be >= 0"),
  minimumStockLevel: z.number().int().min(0, "Minimum stock level must be >= 0"),
  unitCost: z.number().min(0, "Unit cost must be >= 0"),
  sellingPrice: z.number().min(0, "Selling price must be >= 0"),
});

export const updateInventoryItemSchema = z.object({
  partName: z.string().min(1).optional(),
  partNumber: z.string().optional(),
  category: z.string().optional(),
  compatibleBrands: z.array(z.string()).optional(),
  compatibleModels: z.array(z.string()).optional(),
  supplierName: z.string().optional(),
  quantityInStock: z.number().int().min(0).optional(),
  minimumStockLevel: z.number().int().min(0).optional(),
  unitCost: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
});

export const createSupplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required"),
  contactName: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  website: z.string().url("Invalid URL").optional().nullable().or(z.literal("")),
  category: z.string().optional().nullable(),
});

export const updateSupplierSchema = z.object({
  name: z.string().min(1).optional(),
  contactName: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  website: z.string().url().optional().nullable().or(z.literal("")),
  category: z.string().optional().nullable(),
  status: z.string().optional(),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "Supplier ID is required"),
  orderNumber: z.string().min(1, "Order number is required"),
  notes: z.string().optional().nullable(),
  expectedDelivery: z.string().datetime().optional().nullable(),
  items: z.array(z.object({
    partId: z.string().optional().nullable(),
    partName: z.string().min(1, "Part name is required"),
    sku: z.string().optional().nullable(),
    quantity: z.number().int().min(1, "Quantity must be at least 1"),
    unitCost: z.number().min(0, "Unit cost must be >= 0"),
  })).min(1, "At least one item is required"),
});

export const updatePurchaseOrderStatusSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "RECEIVED", "CANCELLED"]),
  receivedAt: z.string().datetime().optional().nullable(),
});

export const updatePurchaseOrderSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "RECEIVED", "CANCELLED"]).optional(),
  notes: z.string().optional().nullable(),
  expectedDelivery: z.string().datetime().optional().nullable(),
});