import { createRepair, deleteRepair, getRepairById, getRepairs, updateRepair, addNote } from "@/controllers/repair.controller";
import { Router } from "express";
import { authorizeRoles } from "@/middlewares/auth.middleware";

const router = Router();

router.get("/", authorizeRoles("ADMIN", "MANAGER", "TECHNICIAN"), getRepairs);
router.get("/:id", authorizeRoles("ADMIN", "MANAGER", "TECHNICIAN"), getRepairById);
router.post("/", authorizeRoles("ADMIN", "MANAGER", "TECHNICIAN"), createRepair);
router.post("/:id/notes", authorizeRoles("ADMIN", "MANAGER", "TECHNICIAN"), addNote);
router.patch("/:id", authorizeRoles("ADMIN", "MANAGER", "TECHNICIAN"), updateRepair);
router.delete("/:id", authorizeRoles("ADMIN", "MANAGER"), deleteRepair);

export default router;