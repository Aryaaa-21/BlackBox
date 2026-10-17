/**
 * Phase 9 — Product Polish & Demo Mode
 * Demo Routes — development and hackathon presentation endpoints.
 *
 * All routes are guarded by environment check (config.enableDemoMode).
 */

import { Router } from 'express';
import { demoController } from '../controllers/demo.controller';
import { config } from '../config/env';
import { AppError } from '../middleware/error.middleware';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Middleware: ensure demo mode is explicitly enabled
router.use((_req, _res, next) => {
  if (!config.enableDemoMode) {
    return next(
      new AppError('Demo endpoints are disabled in this environment', 403, 'DEMO_MODE_DISABLED')
    );
  }
  next();
});

/**
 * GET /api/v1/demo/info
 * Get current demo status and demo accounts.
 */
router.get('/info', demoController.getDemoInfo);

/**
 * POST /api/v1/demo/reset
 * Clean demo data and re-seed the "Campus Emergency Operations" mission.
 */
router.post('/reset', authenticate, requireRole('COMMANDER'), demoController.resetDemo);

/**
 * POST /api/v1/demo/trigger-conflict
 * Modify a task on the server while client is offline to demonstrate conflict detection.
 */
router.post(
  '/trigger-conflict',
  authenticate,
  requireRole('COMMANDER'),
  demoController.triggerConflict
);

export default router;
