import {
  addTask,
  listTasks,
  getTask,
  editTask,
  assignTaskToTechnician,
  updateStatus,
  removeTask,
} from "@/controllers/task.controller";
import { authorizeRoles } from "@/middlewares/auth.middleware";
import { Router } from "express";

const router = Router();

// Create task
router.post("/", authorizeRoles("ADMIN", "MANAGER"), addTask);

// List tasks
router.get("/", authorizeRoles("ADMIN", "MANAGER", "TECHNICIAN"), listTasks);

// Get task details
router.get("/:taskId", authorizeRoles("ADMIN", "MANAGER", "TECHNICIAN"), getTask);

// Update task
router.put("/:taskId", authorizeRoles("ADMIN", "MANAGER"), editTask);

// Assign task
router.put("/:taskId/assign", authorizeRoles("ADMIN", "MANAGER"), assignTaskToTechnician);

// Update task status
router.put("/:taskId/status", authorizeRoles("ADMIN", "MANAGER", "TECHNICIAN"), updateStatus);

// Delete task
router.delete("/:taskId", authorizeRoles("ADMIN"), removeTask);

export default router;