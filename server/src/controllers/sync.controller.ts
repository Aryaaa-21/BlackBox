/**
 * Phase 7 — Synchronization Engine
 * Sync Controller — handles HTTP layer for sync and conflict endpoints.
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { syncService } from '../services/sync.service';
import { conflictService } from '../services/conflict.service';
import { sendSuccess, sendError } from '../utils/response';
import {
  SyncBatchSchema,
  ConflictResolutionSchema,
} from '../validators/sync.validator';

export const syncController = {
  /**
   * POST /api/v1/sync
   * Process a batch of offline mutations.
   */
  async syncMutations(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user!;

      // Validate request body
      const parseResult = SyncBatchSchema.safeParse(req.body);
      if (!parseResult.success) {
        sendError(
          res,
          'Invalid sync request',
          'VALIDATION_ERROR',
          400,
          parseResult.error.errors
        );
        return;
      }

      const { mutations } = parseResult.data;

      console.log(
        `[SyncController] Processing ${mutations.length} mutations for user ${user.id}`
      );

      const summary = await syncService.syncMutations(mutations as any, user);

      sendSuccess(res, summary, 200, 'Sync processed');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/sync/conflicts
   * Get all open conflicts for missions the user can access.
   * Commanders see all conflicts; field operators see only their own.
   */
  async getConflicts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user!;
      const { missionId } = req.query as { missionId?: string };

      if (!missionId) {
        sendError(res, 'missionId query parameter is required', 'VALIDATION_ERROR', 400);
        return;
      }

      const conflicts = await conflictService.getMissionConflicts(missionId, user);
      sendSuccess(res, { conflicts }, 200, 'Conflicts retrieved');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/sync/conflicts/:conflictId
   * Get a specific conflict.
   */
  async getConflict(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user!;
      const { conflictId } = req.params;

      const conflict = await conflictService.getConflict(conflictId, user);
      sendSuccess(res, { conflict }, 200, 'Conflict retrieved');
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/sync/conflicts/:conflictId/resolve
   * Resolve a conflict explicitly.
   */
  async resolveConflict(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user!;
      const { conflictId } = req.params;

      const parseResult = ConflictResolutionSchema.safeParse(req.body);
      if (!parseResult.success) {
        sendError(
          res,
          'Invalid resolution request',
          'VALIDATION_ERROR',
          400,
          parseResult.error.errors
        );
        return;
      }

      const { resolution, mergedState, expectedServerUpdatedAt, expectedServerVersion } = parseResult.data;

      const result = await conflictService.resolveConflict(
        conflictId,
        resolution,
        user,
        mergedState,
        expectedServerUpdatedAt,
        expectedServerVersion
      );

      sendSuccess(res, result, 200, 'Conflict resolved');
    } catch (err) {
      next(err);
    }
  },
};
