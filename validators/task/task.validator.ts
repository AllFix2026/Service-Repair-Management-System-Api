import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
  assignedToUserId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  repairId: z.string().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignedToUserId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  status: z.enum(["pending", "in_progress", "completed", "on_hold"]).optional(),
});

export const assignTaskSchema = z.object({
  assignedToUserId: z.string().min(1, "Technician ID is required"),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "on_hold"]),
});