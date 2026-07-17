import { getFeatureFlagsHandler, patchFeatureFlagHandler } from "@/controllers/featureFlags.controller";
import { getSettings, updateSettings } from "@/controllers/settings.controller";
import { authorizeRoles } from "@/middlewares/auth.middleware";
import { Router } from "express";

const router = Router();

router.get("/", authorizeRoles("ADMIN", "MANAGER", "TECHNICIAN"), getSettings);
router.put("/", authorizeRoles("ADMIN", "MANAGER"), updateSettings);
router.get("/features", authorizeRoles("ADMIN", "MANAGER"), getFeatureFlagsHandler);
router.patch("/features/:flagName", authorizeRoles("ADMIN", "MANAGER"), patchFeatureFlagHandler);

export default router;
