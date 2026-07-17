import type { Response } from "express";
import type { AuthRequest } from "@/types/auth.types";
import { logger } from "@/config/logger.config";
import {
  getAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
} from "@/services/appointment/appointment.service";

export const listAppointments = async (req: AuthRequest, res: Response) => {
  try {
    const appointments = await getAppointments(req.user!.tenantId);
    return res.status(200).json({ success: true, data: appointments });
  } catch (error: any) {
    logger.error(`[listAppointments] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ success: false, message: "Unable to fetch appointments" });
  }
};

export const addAppointment = async (req: AuthRequest, res: Response) => {
  try {
    const { shopId, customerId, technicianId, repairId, scheduledAt, duration, notes, type } = req.body;
    if (!shopId || !scheduledAt) {
      return res.status(400).json({ success: false, message: "shopId and scheduledAt are required" });
    }
    const appointment = await createAppointment(req.user!.tenantId, {
      shopId,
      customerId,
      technicianId,
      repairId,
      scheduledAt: new Date(scheduledAt),
      duration: duration ? Number(duration) : undefined,
      notes,
      type
    });

    return res.status(201).json({ success: true, data: appointment });
  } catch (error: any) {
    logger.error(`[addAppointment] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ success: false, message: "Unable to create appointment" });
  }
};

export const patchAppointment = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const appointment = await updateAppointment(id, req.user!.tenantId, req.body);
    return res.status(200).json({ success: true, data: appointment });
  } catch (error: any) {
    logger.error(`[patchAppointment] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ success: false, message: "Unable to update appointment" });
  }
};

export const removeAppointment = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    await deleteAppointment(id, req.user!.tenantId);
    return res.status(200).json({ success: true, message: "Appointment deleted" });
  } catch (error: any) {
    logger.error(`[removeAppointment] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ success: false, message: "Unable to delete appointment" });
  }
};
