import { Router } from "express";
import { getActivityLogs, getLogsSummary } from "@/controllers/activityLog.controller";

const router = Router();

// Both routes are already protected by global authenticate + tenantMiddleware in routes/index.ts
router.get("/", getActivityLogs);
router.get("/summary", getLogsSummary);

export default router;
