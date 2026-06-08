import { Router } from "express";
import * as subscriptionController from "@/controllers/subscription.controller";

import { authenticate, authorizeRoles } from "@/middlewares/auth.middleware";

const router = Router();

// Internal/Cron endpoint - Protect with Admin role
router.get(
  "/check-expiry", 
  authenticate,
  authorizeRoles("ADMIN"),
  subscriptionController.checkSubscriptionExpiry
);

// Shop owner manual renewal
router.post(
  "/renew",
  authenticate,
  authorizeRoles("ADMIN", "MANAGER"),
  subscriptionController.renewSubscription
);

export default router;
