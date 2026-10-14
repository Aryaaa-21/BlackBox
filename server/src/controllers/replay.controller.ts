/**
 * Phase 8 — Mission Replay
 * Replay Controller — HTTP controller for mission replay endpoints.
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { replayService } from '../services/replay.service';
import { AppError } from '../middleware/error.middleware';

export class ReplayController {
  /**
   * GET /api/v1/missions/:missionId/replay
   * Retrieve chronological, normalized replay history and summary for a mission.
   */
  async getMissionReplay(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { missionId } = req.params;
      const user = req.user;

      if (!user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      if (!missionId) {
        throw new AppError('Mission ID is required', 400, 'MISSING_MISSION_ID');
      }

      const { from, to, eventType, limit, cursor } = req.query;

      const replayData = await replayService.getMissionReplay(missionId, user, {
        from: typeof from === 'string' ? from : undefined,
        to: typeof to === 'string' ? to : undefined,
        eventType: typeof eventType === 'string' ? eventType : undefined,
        limit: limit ? Number(limit) : undefined,
        cursor: typeof cursor === 'string' ? cursor : undefined,
      });

      res.status(200).json({
        success: true,
        data: replayData,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const replayController = new ReplayController();
