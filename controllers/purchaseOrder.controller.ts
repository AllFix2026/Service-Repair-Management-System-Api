import { Request, Response } from "express";
import {
  createPurchaseOrder,
  getPurchaseOrders,
  updatePurchaseOrderStatus,
  updatePurchaseOrder,
  deletePurchaseOrder,
} from "@/services/inventory/purchaseOrder.service";
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderStatusSchema,
  updatePurchaseOrderSchema,
} from "@/validators/inventory/inventory.validator";
import type { AuthRequest } from "@/types/auth.types";
import { logger } from "@/config/logger.config";

export const addPurchaseOrder = async (req: Request, res: Response) => {
  const parsed = createPurchaseOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", errors: parsed.error.issues });
  }

  try {
    const auth = (req as AuthRequest).user!;
    const po = await createPurchaseOrder(parsed.data, auth.tenantId, auth.shopId!);
    return res.status(201).json({ message: "Purchase Order created", po });
  } catch (error: any) {
    logger.error(`[addPurchaseOrder] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ error: "Unable to create PO" });
  }
};

export const listPurchaseOrders = async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthRequest).user!;
    const pos = await getPurchaseOrders(auth.tenantId, auth.shopId!);
    return res.status(200).json({ purchaseOrders: pos });
  } catch (error: any) {
    logger.error(`[listPurchaseOrders] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ error: "Unable to fetch POs" });
  }
};

export const updatePOStatus = async (req: Request, res: Response) => {
  const parsed = updatePurchaseOrderStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", errors: parsed.error.issues });
  }

  try {
    const auth = (req as AuthRequest).user!;
    const poId = req.params.poId as string;
    const po = await updatePurchaseOrderStatus(poId, parsed.data, auth.tenantId, auth.shopId!, auth.id);
    return res.status(200).json({ message: `PO status updated to ${parsed.data.status}`, po });
  } catch (error: any) {
    logger.error(`[updatePOStatus] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ error: "Update failed" });
  }
};

export const editPurchaseOrder = async (req: Request, res: Response) => {
  const parsed = updatePurchaseOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", errors: parsed.error.issues });
  }

  try {
    const auth = (req as AuthRequest).user!;
    const poId = req.params.poId as string;
    const po = await updatePurchaseOrder(poId, parsed.data, auth.tenantId, auth.shopId!, auth.id);
    return res.status(200).json({ message: "Purchase Order updated", po });
  } catch (error: any) {
    logger.error(`[editPurchaseOrder] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ error: error.message || "Update failed" });
  }
};

export const removePurchaseOrder = async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthRequest).user!;
    const poId = req.params.poId as string;
    await deletePurchaseOrder(poId, auth.tenantId, auth.shopId!);
    return res.status(200).json({ message: "Purchase Order deleted" });
  } catch (error: any) {
    logger.error(`[removePurchaseOrder] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ error: "Deletion failed" });
  }
};
