import { prisma } from "@/db/prisma";
import { CreateTaskRequest, UpdateTaskRequest } from "@/types/dto/task.dto";
import { logger } from "@/config/logger.config";

export const createTask = async (
  data: CreateTaskRequest,
  tenantId: string,
  shopId: string,
  createdByUserId: string
) => {
  logger.info(`[createTask] -> Creating task: ${data.title}`);

  const task = await prisma.task.create({
    data: {
      tenantId,
      shopId,
      title: data.title,
      description: data.description,
      priority: data.priority || "medium",
      assignedToUserId: data.assignedToUserId,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      repairId: data.repairId,
      createdByUserId,
    },
  });

  logger.info(`[createTask] -> Task created: ${task.id}`);
  return task;
};

export const getTasks = async (tenantId: string, shopId: string, userId?: string, role?: string) => {
  logger.info(`[getTasks] -> Fetching tasks for shop: ${shopId}`);

  const where: any = { tenantId, shopId ,deletedAt: null};

  // Technicians see only their assigned tasks
  if (role === "TECHNICIAN" && userId) {
    where.assignedToUserId = userId;
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignedTo: { select: { id: true, fullName: true, email: true } },
      createdBy: { select: { id: true, fullName: true } },
      repair: { select: { id: true, reference: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  logger.info(`[getTasks] -> Found ${tasks.length} tasks`);
  return tasks;
};

export const getTaskById = async (taskId: string, tenantId: string, shopId: string) => {
  logger.info(`[getTaskById] -> Fetching task: ${taskId}`);

  const task = await prisma.task.findFirst({
    where: { id: taskId, tenantId, shopId ,deletedAt: null},
    include: {
      assignedTo: { select: { id: true, fullName: true, email: true } },
      createdBy: { select: { id: true, fullName: true } },
      repair: { select: { id: true, reference: true, status: true } },
    },
  });

  if (!task) {
    logger.warn(`[getTaskById] -> Task not found: ${taskId}`);
    throw { status: 404, message: "Task not found" };
  }

  logger.info(`[getTaskById] -> Task found: ${taskId}`);
  return task;
};

export const updateTask = async (
  taskId: string,
  data: UpdateTaskRequest,
  tenantId: string,
  shopId: string,
  userId: string,      
  userRole: string     
) => {
  logger.info(`[updateTask] -> Updating task: ${taskId} by user ${userId} (${userRole})`);
  
  // Find existing task
  const existing = await prisma.task.findFirst({
    where: { id: taskId, tenantId, shopId },
  });
  
  if (!existing) {
    logger.warn(`[updateTask] -> Task not found: ${taskId}`);
    throw { status: 404, message: "Task not found" };
  }

  //Technician authorization check
  if (userRole === 'TECHNICIAN' && existing.assignedToUserId !== userId) {
    logger.warn(`[updateTask] -> Technician ${userId} attempted to update unassigned task ${taskId}`);
    throw { status: 403, message: "You can only update tasks assigned to you" };
  }

  //  Use updateMany for atomic scoping (prevents race condition)
  const result = await prisma.task.updateMany({
    where: { 
      id: taskId, 
      tenantId,      // Scoped to tenant
      shopId         // Scoped to shop
    },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.assignedToUserId !== undefined && { assignedToUserId: data.assignedToUserId }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
      ...(data.status !== undefined && { status: data.status }),
      updatedAt: new Date(),  //  Explicit updatedAt
    },
  });

  // Check if update succeeded
  if (result.count === 0) {
    logger.warn(`[updateTask] -> Task update failed: ${taskId}`);
    throw { status: 404, message: "Task not found or access denied" };
  }

  // Fetch and return updated task
  const task = await prisma.task.findFirst({
    where: { id: taskId, tenantId, shopId },
    include: {
      assignedTo: { select: { id: true, fullName: true } },
      createdBy: { select: { id: true, fullName: true } },
      repair: true,
    },
  });

  logger.info(`[updateTask] -> Task updated: ${taskId}`);
  return task;
};

export const assignTask = async (
  taskId: string,
  assignedToUserId: string,
  tenantId: string,
  shopId: string
) => {
  logger.info(`[assignTask] -> Assigning task ${taskId} to user ${assignedToUserId}`);

  const task = await prisma.task.findFirst({
    where: { id: taskId, tenantId, shopId },
  });

  if (!task) {
    logger.warn(`[assignTask] -> Task not found: ${taskId}`);
    throw { status: 404, message: "Task not found" };
  }

  const technician = await prisma.user.findFirst({
    where: { id: assignedToUserId, tenantId, shopId },
  });

  if (!technician) {
    logger.warn(`[assignTask] -> Technician not found: ${assignedToUserId}`);
    throw { status: 404, message: "Technician not found" };
  }

  // Use updateMany for atomic scoping
  const result = await prisma.task.updateMany({
    where: { 
      id: taskId, 
      tenantId, 
      shopId 
    },
    data: { 
      assignedToUserId,
      updatedAt: new Date()
    },
  });

  // Check if update succeeded
  if (result.count === 0) {
    logger.warn(`[assignTask] -> Task assignment failed: ${taskId}`);
    throw { status: 404, message: "Task not found or access denied" };
  }

  logger.info(`[assignTask] -> Task assigned successfully`);
};

export const updateTaskStatus = async (
  taskId: string,
  status: string,
  tenantId: string,
  shopId: string,
  userId: string,      // ✅ ADD
  userRole: string     // ✅ ADD
) => {
  logger.info(`[updateTaskStatus] -> Updating task ${taskId} status to ${status} by user ${userId} (${userRole})`);

  const task = await prisma.task.findFirst({
    where: { id: taskId, tenantId, shopId },
  });

  if (!task) {
    logger.warn(`[updateTaskStatus] -> Task not found: ${taskId}`);
    throw { status: 404, message: "Task not found" };
  }

  // Technician authorization check
  if (userRole === 'TECHNICIAN' && task.assignedToUserId !== userId) {
    logger.warn(`[updateTaskStatus] -> Technician ${userId} attempted to update unassigned task ${taskId}`);
    throw { status: 403, message: "You can only update status of tasks assigned to you" };
  }

  // Use updateMany for atomic scoping
  const result = await prisma.task.updateMany({
    where: { 
      id: taskId, 
      tenantId, 
      shopId 
    },
    data: { 
      status,
      updatedAt: new Date()
    },
  });

  // Check if update succeeded
  if (result.count === 0) {
    logger.warn(`[updateTaskStatus] -> Status update failed: ${taskId}`);
    throw { status: 404, message: "Task not found or access denied" };
  }

  logger.info(`[updateTaskStatus] -> Status updated successfully`);
};

export const deleteTask = async (taskId: string, tenantId: string, shopId: string) => {
  logger.info(`[deleteTask] -> Deleting task: ${taskId}`);

  const task = await prisma.task.findFirst({
    where: { id: taskId, tenantId, shopId },
  });

  if (!task) {
    logger.warn(`[deleteTask] -> Task not found: ${taskId}`);
    throw { status: 404, message: "Task not found" };
  }

  // ✅ CHANGED: Use soft delete with updateMany (not hard delete)
  const result = await prisma.task.updateMany({
    where: { 
      id: taskId, 
      tenantId, 
      shopId 
    },
    data: { 
      deletedAt: new Date() 
    },
  });

  // ✅ ADD: Check if delete succeeded
  if (result.count === 0) {
    logger.warn(`[deleteTask] -> Task deletion failed: ${taskId}`);
    throw { status: 404, message: "Task not found or access denied" };
  }

  logger.info(`[deleteTask] -> Task deleted successfully`);
};