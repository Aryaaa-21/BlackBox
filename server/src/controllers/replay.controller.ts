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

      const queryString = (name: string): string | undefined => {
        const value = req.query[name];
        if (value === undefined) return undefined;
        if (typeof value !== 'string') {
          throw new AppError(`Replay ${name} must be supplied once as a string`, 400, 'INVALID_REPLAY_QUERY');
        }
        return value;
      };
      const from = queryString('from');
      const to = queryString('to');
      const eventType = queryString('eventType');
      const cursor = queryString('cursor');
      const limit = queryString('limit');
      if (limit !== undefined && !/^\d+$/.test(limit)) {
        throw new AppError('Replay limit must be a positive integer', 400, 'INVALID_REPLAY_LIMIT');
      }

      const replayData = await replayService.getMissionReplay(missionId, user, {
        from,
        to,
        eventType,
        limit: limit === undefined ? undefined : Number(limit),
        cursor,
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
