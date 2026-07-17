import { getRepairsReport } from "@/controllers/repairReport.controller";
import { getCustomersReport } from "@/controllers/customerReport.controller";
import { getInventoryReportHandler } from "@/controllers/inventoryReport.controller";
import { getRevenueReportHandler } from "@/controllers/revenueReport.controller";
import { getTechnicianReportHandler } from "@/controllers/technicianReport.controller";
import { authorizeRoles } from "@/middlewares/auth.middleware";
import { revenueReportAccess } from "@/middlewares/revenueReportAccess.middleware";
import { Router } from "express";

const router = Router();

router.get("/repairs", authorizeRoles("ADMIN", "MANAGER", "TECHNICIAN"), getRepairsReport);
router.get("/technician", authorizeRoles("ADMIN", "MANAGER"), getTechnicianReportHandler);
router.get("/customers", authorizeRoles("ADMIN", "MANAGER"), getCustomersReport);
router.get(
  "/inventory",
  authorizeRoles("ADMIN", "MANAGER", "TECHNICIAN"),
  getInventoryReportHandler
);
router.get(
  "/revenue",
  authorizeRoles("ADMIN", "MANAGER"),
  revenueReportAccess,
  getRevenueReportHandler
);

export default router;
