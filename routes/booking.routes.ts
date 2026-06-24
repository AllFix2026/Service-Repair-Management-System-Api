import { Router } from "express";
import { handleCreateBooking, handleGetBookings, handleUpdateBookingStatus } from "@/controllers/booking.controller";

const router = Router();

// Public route to submit a demo booking
router.post("/", handleCreateBooking);

// Routes for superadmin portal (unprotected as superadmin handles its own auth)
router.get("/", handleGetBookings);
router.patch("/:id/status", handleUpdateBookingStatus);

export default router;
