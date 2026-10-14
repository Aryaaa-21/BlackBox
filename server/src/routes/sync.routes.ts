/**
 * Phase 7 — Synchronization Engine
 * Sync Routes — POST /api/v1/sync and conflict management endpoints.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { syncController } from '../controllers/sync.controller';

const router = Router();

// All sync routes require authentication
router.use(authenticate);

/**
 * POST /api/v1/sync
 * Submit a batch of offline mutations for server processing.
 * Body: { mutations: IncomingMutation[] }
 */
router.post('/', syncController.syncMutations);

/**
 * GET /api/v1/sync/conflicts?missionId=<id>
 * Get open conflicts for a mission.
 */
router.get('/conflicts', syncController.getConflicts);

/**
 * GET /api/v1/sync/conflicts/:conflictId
 * Get a specific conflict.
 */
router.get('/conflicts/:conflictId', syncController.getConflict);

/**
 * POST /api/v1/sync/conflicts/:conflictId/resolve
 * Resolve a conflict explicitly.
 * Body: { resolution: 'KEEP_LOCAL' | 'KEEP_SERVER' | 'MERGE', mergedState?: Record }
 */
router.post('/conflicts/:conflictId/resolve', syncController.resolveConflict);

export default router;
