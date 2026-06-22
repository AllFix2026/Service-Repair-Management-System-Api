import { Router } from "express";
import { getPublicInvoiceByRef, getPublicDeviceById } from "@/controllers/track.controller";

const router = Router();

// Public route — no authentication required
router.get("/:ref", getPublicInvoiceByRef);
router.get("/device/:id", getPublicDeviceById);

export default router;
