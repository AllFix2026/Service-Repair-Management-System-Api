import { Response } from "express";
import { AuthRequest } from "@/types/auth.types";
import {
  listStaffRoles,
  createStaffRole,
  updateStaffRole,
  deleteStaffRole,
} from "@/services/staff/roles.service";

export const getRoles = async (req: AuthRequest, res: Response) => {
  try {
    const roles = await listStaffRoles(req.user!.tenantId, req.user!.shopId!);
    res.status(200).json({ success: true, data: roles });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addRole = async (req: AuthRequest, res: Response) => {
  try {
    const role = await createStaffRole(req.user!.tenantId, req.user!.shopId!, req.body);
    res.status(201).json({ success: true, data: role });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateRole = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const role = await updateStaffRole(id, req.user!.tenantId, req.body);
    res.status(200).json({ success: true, data: role });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const removeRole = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    await deleteStaffRole(id, req.user!.tenantId);
    res.status(200).json({ success: true, message: "Role deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
