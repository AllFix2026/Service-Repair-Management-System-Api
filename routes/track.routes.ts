import { Router } from "express";
import { getPublicInvoiceByRef } from "@/controllers/track.controller";

const router = Router();

// Public route — no authentication required
router.get("/:ref", getPublicInvoiceByRef);

export default router;
