import {
  createInventoryItem,
  getInventoryItems,
  getInventoryItemById,
  updateInventoryItem,
  deleteInventoryItem,
  getLowStockItems,
  getInventoryUsage,
  getInventorySummary,
} from "@/services/inventory/inventory.service";
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
} from "@/validators/inventory/inventory.validator";
import type { AuthRequest } from "@/types/auth.types";
import { logger } from "@/config/logger.config";
import { Request, Response } from "express";

// POST /api/v1/inventory
export const addInventoryItem = async (req: Request, res: Response) => {
  const parsed = createInventoryItemSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn(`[addInventoryItem] -> Validation failed: ${parsed.error.message}`);
    return res.status(400).json({ error: "Unable to add item", errors: parsed.error.issues });
  }

  try {
    const auth = (req as AuthRequest).user!;
    const item = await createInventoryItem(parsed.data, auth.tenantId, auth.shopId!);
    return res.status(201).json({ message: "Item added successfully", itemId: item.id });
  } catch (error: any) {
    logger.error(`[addInventoryItem] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ error: "Unable to add item" });
  }
};

// GET /api/v1/inventory
export const listInventoryItems = async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthRequest).user!;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const search = req.query.search ? (req.query.search as string) : undefined;
    const category = req.query.category ? (req.query.category as string) : undefined;
    const status = req.query.status ? (req.query.status as string) : undefined;

    const result = await getInventoryItems(auth.tenantId, auth.shopId!, {
      page,
      limit,
      search,
      category,
      status,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    logger.error(`[listInventoryItems] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ error: "Unable to fetch inventory" });
  }
};

// GET /api/v1/inventory/:itemId
export const getInventoryItem = async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthRequest).user!;
    const itemId = req.params.itemId as string;
    const item = await getInventoryItemById(itemId, auth.tenantId, auth.shopId!);
    return res.status(200).json(item);
  } catch (error: any) {
    logger.error(`[getInventoryItem] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ error: "Item not found" });
  }
};

// PUT /api/v1/inventory/:itemId
export const editInventoryItem = async (req: Request, res: Response) => {
  const parsed = updateInventoryItemSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn(`[editInventoryItem] -> Validation failed: ${parsed.error.message}`);
    return res.status(400).json({ error: "Update failed", errors: parsed.error.issues });
  }

  try {
    const auth = (req as AuthRequest).user!;
    const itemId = req.params.itemId as string;
    await updateInventoryItem(itemId, parsed.data, auth.tenantId, auth.shopId!);
    return res.status(200).json({ message: "Item updated" });
  } catch (error: any) {
    logger.error(`[editInventoryItem] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ error: "Update failed" });
  }
};

// DELETE /api/v1/inventory/:itemId
export const removeInventoryItem = async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthRequest).user!;
    const itemId = req.params.itemId as string;
    await deleteInventoryItem(itemId, auth.tenantId, auth.shopId!);
    return res.status(200).json({ message: "Item removed" });
  } catch (error: any) {
    logger.error(`[removeInventoryItem] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ 
      error: error.message || "Deletion failed" 
    });
  } 
};

// GET /api/v1/inventory/low-stock
export const lowStock = async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthRequest).user!;
    const lowStockItems = await getLowStockItems(auth.tenantId, auth.shopId!);
    return res.status(200).json({ lowStockItems });
  } catch (error: any) {
    logger.error(`[lowStock] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ error: "Unable to fetch low stock items" });
  }
};

// GET /api/v1/inventory/usage
export const usage = async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthRequest).user!;
    const usageReport = await getInventoryUsage(auth.tenantId, auth.shopId!);
    return res.status(200).json({ usageReport });
  } catch (error: any) {
    logger.error(`[usage] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ error: "Unable to generate inventory usage report" });
  }
};

// GET /api/v1/inventory/summary
export const summary = async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthRequest).user!;
    const inventorySummary = await getInventorySummary(auth.tenantId, auth.shopId!);
    return res.status(200).json({ summary: inventorySummary });
  } catch (error: any) {
    logger.error(`[summary] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ error: "Unable to generate inventory summary" });
  }
};