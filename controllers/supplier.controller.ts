import { Request, Response } from "express";
import {
  createSupplier,
  getSuppliers,
  updateSupplier,
  deleteSupplier,
} from "@/services/inventory/supplier.service";
import {
  createSupplierSchema,
  updateSupplierSchema,
} from "@/validators/inventory/inventory.validator";
import type { AuthRequest } from "@/types/auth.types";
import { logger } from "@/config/logger.config";

export const addSupplier = async (req: Request, res: Response) => {
  const parsed = createSupplierSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", errors: parsed.error.issues });
  }

  try {
    const auth = (req as AuthRequest).user!;
    const supplier = await createSupplier(parsed.data, auth.tenantId, auth.shopId!);
    return res.status(201).json({ message: "Supplier added successfully", supplier });
  } catch (error: any) {
    logger.error(`[addSupplier] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ error: "Unable to add supplier" });
  }
};

export const listSuppliers = async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthRequest).user!;
    const suppliers = await getSuppliers(auth.tenantId, auth.shopId!);
    return res.status(200).json({ suppliers });
  } catch (error: any) {
    logger.error(`[listSuppliers] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ error: "Unable to fetch suppliers" });
  }
};

export const editSupplier = async (req: Request, res: Response) => {
  const parsed = updateSupplierSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", errors: parsed.error.issues });
  }

  try {
    const auth = (req as AuthRequest).user!;
    const supplierId = req.params.supplierId as string;
    const supplier = await updateSupplier(supplierId, parsed.data, auth.tenantId, auth.shopId!);
    return res.status(200).json({ message: "Supplier updated", supplier });
  } catch (error: any) {
    logger.error(`[editSupplier] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ error: "Update failed" });
  }
};

export const removeSupplier = async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthRequest).user!;
    const supplierId = req.params.supplierId as string;
    await deleteSupplier(supplierId, auth.tenantId, auth.shopId!);
    return res.status(200).json({ message: "Supplier removed" });
  } catch (error: any) {
    logger.error(`[removeSupplier] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ error: "Deletion failed" });
  }
};
