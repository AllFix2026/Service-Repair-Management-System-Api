import { Router } from "express";
import { authenticate } from "@/middlewares/auth.middleware";
import { validateRequest } from "@/middlewares/validate.middleware";
import {
  createServiceRequest,
  trackServiceRequest,
  confirmOffer,
  aiSuggest,
  getShopServiceRequests,
  makeOffer,
} from "@/controllers/serviceRequest.controller";
import {
  createServiceRequestSchema,
  acceptServiceRequestSchema,
  confirmOfferSchema,
} from "@/validators/serviceRequest/serviceRequest.validator";

const router = Router();

// ─── Public Routes (No Auth Required) ───────────────────────────────────────
router.post("/", validateRequest(createServiceRequestSchema), createServiceRequest);
router.get("/:id/track", trackServiceRequest);
router.post("/:id/confirm", validateRequest(confirmOfferSchema), confirmOffer);
router.post("/ai-suggest", aiSuggest);

// ─── Protected Routes (Requires Shop Authentication) ────────────────────────
// Use the standard authenticate middleware. The main router in routes/index.ts
// should probably mount this router *before* the global authenticate block
// because this router has mixed public and private routes.
router.get("/shop", authenticate, getShopServiceRequests);
router.post("/:id/offer", authenticate, validateRequest(acceptServiceRequestSchema), makeOffer);

export default router;
