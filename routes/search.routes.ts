import { Router } from "express";
import { searchEntities } from "@/controllers/search.controller";

const router = Router();

// GET /api/v1/search
router.get("/", searchEntities);

export default router;
