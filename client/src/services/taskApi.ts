import { api } from './api';
import {
  ApiResponse,
  Task,
  TaskStats,
  PaginationMeta,
  TaskFilters,
  CreateTaskPayload,
  UpdateTaskPayload,
  TaskStatus,
} from '../types';

export const taskApi = {
  /**
   * Retrieve tasks for a mission with live stats and optional filters (Section 29)
   */
  async getMissionTasks(
    missionId: string,
    filters?: TaskFilters
  ): Promise<{ tasks: Task[]; stats: TaskStats; pagination: PaginationMeta }> {
    const response = await api.get<
      ApiResponse<{ tasks: Task[]; stats: TaskStats; pagination: PaginationMeta }>
    >(`/missions/${missionId}/tasks`, { params: filters });
    return response.data.data;
  },

  /**
   * Retrieve single task details
   */
  async getTask(taskId: string): Promise<Task> {
    const response = await api.get<ApiResponse<{ task: Task }>>(`/tasks/${taskId}`);
    return response.data.data.task;
  },

  /**
   * Create task in mission (Commander only)
   */
  async createTask(missionId: string, payload: CreateTaskPayload): Promise<Task> {
    const response = await api.post<ApiResponse<{ task: Task }>>(
      `/missions/${missionId}/tasks`,
      payload
    );
    return response.data.data.task;
  },

  /**
   * Update task parameters (Commander only)
   */
  async updateTask(taskId: string, payload: UpdateTaskPayload): Promise<Task> {
    const response = await api.patch<ApiResponse<{ task: Task }>>(`/tasks/${taskId}`, payload);
    return response.data.data.task;
  },

  /**
   * Assign task to an active field operator member (Commander only)
   */
  async assignTask(taskId: string, userId: string): Promise<Task> {
    const response = await api.patch<ApiResponse<{ task: Task }>>(`/tasks/${taskId}/assign`, {
      userId,
    });
    return response.data.data.task;
  },

  /**
   * Unassign task (Commander only)
   */
  async unassignTask(taskId: string): Promise<Task> {
    const response = await api.patch<ApiResponse<{ task: Task }>>(`/tasks/${taskId}/unassign`);
    return response.data.data.task;
  },

  /**
   * Transition task status (Commander or assigned Field Operator)
   */
  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
    const response = await api.patch<ApiResponse<{ task: Task }>>(`/tasks/${taskId}/status`, {
      status,
    });
    return response.data.data.task;
  },

  /**
   * Retrieve aggregated task statistics for user dashboard
   */
  async getTaskStats(): Promise<TaskStats> {
    const response = await api.get<ApiResponse<{ stats: TaskStats }>>('/tasks/stats');
    return response.data.data.stats;
  },

  /**
   * Retrieve tasks assigned to the current user (Field Operator "My Tasks")
   */
  async getMyTasks(): Promise<Task[]> {
    const response = await api.get<ApiResponse<{ tasks: Task[] }>>('/tasks/my');
    return response.data.data.tasks;
  },
};
