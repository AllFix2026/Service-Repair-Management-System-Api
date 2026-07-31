import { Request, Response } from "express";
import * as adminService from "@/services/admin/admin.service";
import { logger } from "@/config/logger.config";

export const getStats = async (req: Request, res: Response) => {
  try {
    const stats = await adminService.getSuperAdminStats();
    return res.status(200).json({ success: true, data: stats });
  } catch (error: any) {
    logger.error(`[AdminController.getStats] -> ${error.message}`);
    return res.status(500).json({ success: false, message: "Failed to fetch admin stats" });
  }
};

export const listShops = async (req: Request, res: Response) => {
  try {
    const shops = await adminService.getAllShops();
    return res.status(200).json({ success: true, data: shops });
  } catch (error: any) {
    logger.error(`[AdminController.listShops] -> ${error.message}`);
    return res.status(500).json({ success: false, message: "Failed to fetch shops" });
  }
};

export const updateShopFeatures = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { featureFlags } = req.body;
    if (!featureFlags) {
      return res.status(400).json({ success: false, message: "featureFlags is required" });
    }
    const settings = await adminService.updateShopFeatures(id, featureFlags);
    return res.status(200).json({ success: true, data: settings });
  } catch (error: any) {
    logger.error(`[AdminController.updateShopFeatures] -> ${error.message}`);
    return res.status(500).json({ success: false, message: "Failed to update shop features" });
  }
};

export const listUsers = async (req: Request, res: Response) => {
  try {
    const users = await adminService.getAllUsers();
    return res.status(200).json({ success: true, data: users });
  } catch (error: any) {
    logger.error(`[AdminController.listUsers] -> ${error.message}`);
    return res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
};
