import { Router } from "express";
import * as adminController from "@/controllers/admin.controller";

const router = Router();

router.get("/stats", adminController.getStats);
router.get("/shops", adminController.listShops);
router.get("/users", adminController.listUsers);
router.patch("/shops/:id/features", adminController.updateShopFeatures);

export default router;
