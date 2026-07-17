import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  assignTask,
  updateTaskStatus,
  deleteTask,
} from "@/services/task/task.service";
import {
  createTaskSchema,
  updateTaskSchema,
  assignTaskSchema,
  updateTaskStatusSchema,
} from "@/validators/task/task.validator";
import type { AuthRequest } from "@/types/auth.types";
import { logger } from "@/config/logger.config";
import { Request, Response } from "express";

// POST /api/v1/tasks
export const addTask = async (req: Request, res: Response) => {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn(`[addTask] -> Validation failed: ${parsed.error.message}`);
    return res.status(400).json({ error: "Task creation failed due to missing required fields", errors: parsed.error.issues });
  }

  try {
    const auth = (req as AuthRequest).user!;
    const task = await createTask(parsed.data, auth.tenantId, auth.shopId!, auth.id);
    return res.status(201).json({ message: "Task created successfully", taskId: task.id });
  } catch (error: any) {
    logger.error(`[addTask] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ error: "Task creation failed" });
  }
};

// GET /api/v1/tasks
export const listTasks = async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthRequest).user!;
    const tasks = await getTasks(auth.tenantId, auth.shopId!, auth.id, auth.role);
    return res.status(200).json({ tasks });
  } catch (error: any) {
    logger.error(`[listTasks] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ error: "Unable to retrieve tasks" });
  }
};

// GET /api/v1/tasks/:taskId
export const getTask = async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthRequest).user!;
    const taskId = req.params.taskId as string;
    const task = await getTaskById(taskId, auth.tenantId, auth.shopId!);
    return res.status(200).json(task);
  } catch (error: any) {
    logger.error(`[getTask] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ error: error.message || "Task not found" });
  }
};

// PUT /api/v1/tasks/:taskId
export const editTask = async (req: Request, res: Response) => {
  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn(`[editTask] -> Validation failed: ${parsed.error.message}`);
    return res.status(400).json({ error: "Task update failed", errors: parsed.error.issues });
  }

  try {
    const auth = (req as AuthRequest).user!;
    const taskId = req.params.taskId as string;
    
    // ✅ CHANGED: Pass auth.id and auth.role
    await updateTask(
      taskId, 
      parsed.data, 
      auth.tenantId, 
      auth.shopId!,
      auth.id,        // ✅ ADD: Current user ID
      auth.role       // ✅ ADD: Current user role
    );
    
    return res.status(200).json({ message: "Task updated successfully" });
  } catch (error: any) {
    logger.error(`[editTask] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ error: error.message || "Task update failed" });
  }
};

// PUT /api/v1/tasks/:taskId/assign
export const assignTaskToTechnician = async (req: Request, res: Response) => {
  const parsed = assignTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn(`[assignTaskToTechnician] -> Validation failed: ${parsed.error.message}`);
    return res.status(400).json({ error: "Assignment failed", errors: parsed.error.issues });
  }

  try {
    const auth = (req as AuthRequest).user!;
    const taskId = req.params.taskId as string;
    await assignTask(taskId, parsed.data.assignedToUserId, auth.tenantId, auth.shopId!);
    return res.status(200).json({ message: "Task assigned successfully" });
  } catch (error: any) {
    logger.error(`[assignTaskToTechnician] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ error: error.message || "Technician not found" });
  }
};

// PUT /api/v1/tasks/:taskId/status
export const updateStatus = async (req: Request, res: Response) => {
  const parsed = updateTaskStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn(`[updateStatus] -> Validation failed: ${parsed.error.message}`);
    return res.status(400).json({ error: "Status update failed", errors: parsed.error.issues });
  }

  try {
    const auth = (req as AuthRequest).user!;
    const taskId = req.params.taskId as string;
    
    // ✅ CHANGED: Pass auth.id and auth.role
    await updateTaskStatus(
      taskId, 
      parsed.data.status, 
      auth.tenantId, 
      auth.shopId!,
      auth.id,        // ✅ ADD: Current user ID
      auth.role       // ✅ ADD: Current user role
    );
    
    return res.status(200).json({ message: "Task status updated successfully" });
  } catch (error: any) {
    logger.error(`[updateStatus] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ error: error.message || "Task update failed" });
  }
};

// DELETE /api/v1/tasks/:taskId
export const removeTask = async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthRequest).user!;
    const taskId = req.params.taskId as string;
    await deleteTask(taskId, auth.tenantId, auth.shopId!);
    return res.status(200).json({ message: "Task deleted successfully" });
  } catch (error: any) {
    logger.error(`[removeTask] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ error: error.message || "Unable to delete task" });
  }
};