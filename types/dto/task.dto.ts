export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: string;
  assignedToUserId?: string;
  dueDate?: string;
  repairId?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  priority?: string;
  assignedToUserId?: string;
  dueDate?: string;
  status?: string;
}

export interface AssignTaskRequest {
  assignedToUserId: string;
}

export interface UpdateTaskStatusRequest {
  status: string;
}

export interface TaskResponse {
  taskId: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignedTo?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}
