import { Request, Response } from "express";
import { logger } from "@/config/logger.config";
import { createDemoBooking, getAllDemoBookings, updateDemoBookingStatus } from "@/services/booking/booking.service";

export const handleCreateBooking = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, date, time, notes } = req.body;
    
    if (!name || !email || !date || !time) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const booking = await createDemoBooking({ name, email, phone, date, time, notes });
    
    res.status(201).json({ success: true, booking });
  } catch (error: any) {
    logger.error(`[handleCreateBooking] -> Error: ${error.message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const handleGetBookings = async (req: Request, res: Response) => {
  try {
    const bookings = await getAllDemoBookings();
    res.status(200).json({ success: true, bookings });
  } catch (error: any) {
    logger.error(`[handleGetBookings] -> Error: ${error.message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const handleUpdateBookingStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required" });
    }

    const updated = await updateDemoBookingStatus(String(id), status);
    res.status(200).json({ success: true, booking: updated });
  } catch (error: any) {
    logger.error(`[handleUpdateBookingStatus] -> Error: ${error.message}`);
    res.status(error.status || 500).json({ success: false, message: error.message || "Internal server error" });
  }
};
