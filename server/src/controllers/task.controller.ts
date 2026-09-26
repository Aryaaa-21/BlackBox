import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { taskService } from '../services/task.service';
import { taskQuerySchema } from '../validators/task.validator';
import { sendSuccess } from '../utils/response';

export class TaskController {
  async createTask(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const commanderId = req.user!.id;
      const { missionId } = req.params;

      const task = await taskService.createTask(missionId, commanderId, req.body);
      sendSuccess(res, { task }, 201, 'Task created successfully');
    } catch (error) {
      next(error);
    }
  }

  async getMissionTasks(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { missionId } = req.params;
      const query = taskQuerySchema.parse(req.query);

      const result = await taskService.getMissionTasks(missionId, user, query);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async getTaskById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { taskId } = req.params;

      const task = await taskService.getTaskById(taskId, user);
      sendSuccess(res, { task }, 200);
    } catch (error) {
      next(error);
    }
  }

  async updateTask(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const commanderId = req.user!.id;
      const { taskId } = req.params;

      const task = await taskService.updateTask(taskId, commanderId, req.body);
      sendSuccess(res, { task }, 200, 'Task updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async assignTask(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const commanderId = req.user!.id;
      const { taskId } = req.params;
      const { userId } = req.body;

      const task = await taskService.assignTask(taskId, commanderId, userId);
      sendSuccess(res, { task }, 200, 'Task assigned successfully');
    } catch (error) {
      next(error);
    }
  }

  async unassignTask(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const commanderId = req.user!.id;
      const { taskId } = req.params;

      const task = await taskService.unassignTask(taskId, commanderId);
      sendSuccess(res, { task }, 200, 'Task unassigned successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateTaskStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { taskId } = req.params;
      const { status } = req.body;

      const task = await taskService.updateTaskStatus(taskId, user, status);
      sendSuccess(res, { task }, 200, `Task status updated to ${status}`);
    } catch (error) {
      next(error);
    }
  }

  async getTaskStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const stats = await taskService.getUserTaskStats(user);
      sendSuccess(res, { stats }, 200);
    } catch (error) {
      next(error);
    }
  }

  async getMyTasks(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const tasks = await taskService.getMyAssignedTasks(userId);
      sendSuccess(res, { tasks }, 200);
    } catch (error) {
      next(error);
    }
  }
}

export const taskController = new TaskController();
