import { Router } from "express";
import { authorizeRoles } from "@/middlewares/auth.middleware";
import { todayRepairs, getPendingRepairs, getAnalytics, seedDashboardData, markRead, clearAll } from "@/controllers/dashboard.controller";

const router = Router();

router.get("/analytics", authorizeRoles("ADMIN", "MANAGER", "TECHNICIAN"), getAnalytics);
router.get("/today-repairs", authorizeRoles("ADMIN", "MANAGER", "TECHNICIAN"), todayRepairs);
router.get("/pending-repairs", authorizeRoles("ADMIN", "MANAGER", "TECHNICIAN"), getPendingRepairs);
router.post("/seed", authorizeRoles("ADMIN", "MANAGER"), seedDashboardData);
router.patch("/notifications/mark-read", authorizeRoles("ADMIN", "MANAGER", "TECHNICIAN"), markRead);
router.patch("/notifications/clear", authorizeRoles("ADMIN", "MANAGER", "TECHNICIAN"), clearAll);

export default router;