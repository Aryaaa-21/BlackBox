import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { missionService } from '../services/mission.service';
import { missionQuerySchema } from '../validators/mission.validator';
import { sendSuccess } from '../utils/response';

export class MissionController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const mission = await missionService.createMission(userId, req.body);
      sendSuccess(res, { mission }, 201, 'Mission created successfully');
    } catch (error) {
      next(error);
    }
  }

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const query = missionQuerySchema.parse(req.query);
      const result = await missionService.getUserMissions(user, query);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const mission = await missionService.getMissionById(req.params.missionId, user);
      sendSuccess(res, { mission }, 200);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const mission = await missionService.updateMission(req.params.missionId, userId, req.body);
      sendSuccess(res, { mission }, 200, 'Mission updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async start(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const mission = await missionService.startMission(req.params.missionId, userId);
      sendSuccess(res, { mission }, 200, 'Mission successfully transitioned to ACTIVE');
    } catch (error) {
      next(error);
    }
  }

  async complete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const mission = await missionService.completeMission(req.params.missionId, userId);
      sendSuccess(res, { mission }, 200, 'Mission marked as COMPLETED');
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const mission = await missionService.cancelMission(req.params.missionId, userId);
      sendSuccess(res, { mission }, 200, 'Mission CANCELLED');
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const stats = await missionService.getMissionStats(user);
      sendSuccess(res, { stats }, 200);
    } catch (error) {
      next(error);
    }
  }
}

export const missionController = new MissionController();
