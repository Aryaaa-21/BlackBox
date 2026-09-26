import { Router } from 'express';
import { missionController } from '../controllers/mission.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  createMissionSchema,
  updateMissionSchema,
  missionQuerySchema,
} from '../validators/mission.validator';

const router = Router();

// All mission routes require authentication
router.use(authenticate);

// 1. Create Mission (COMMANDER only)
router.post(
  '/',
  requireRole('COMMANDER'),
  validateRequest(createMissionSchema),
  (req, res, next) => missionController.create(req, res, next)
);

// 2. Mission Statistics
router.get('/stats', (req, res, next) => missionController.getStats(req, res, next));

// 3. List Accessible Missions
router.get('/', (req, res, next) => missionController.list(req, res, next));

// 4. Mission Detail by ID
router.get('/:missionId', (req, res, next) => missionController.getById(req, res, next));

// 5. Update Mission Details (COMMANDER only)
router.patch(
  '/:missionId',
  requireRole('COMMANDER'),
  validateRequest(updateMissionSchema),
  (req, res, next) => missionController.update(req, res, next)
);

// 6. Start Mission (DRAFT -> ACTIVE, COMMANDER only)
router.post(
  '/:missionId/start',
  requireRole('COMMANDER'),
  (req, res, next) => missionController.start(req, res, next)
);

// 7. Complete Mission (ACTIVE -> COMPLETED, COMMANDER only)
router.post(
  '/:missionId/complete',
  requireRole('COMMANDER'),
  (req, res, next) => missionController.complete(req, res, next)
);

// 8. Cancel Mission (DRAFT/ACTIVE -> CANCELLED, COMMANDER only)
router.post(
  '/:missionId/cancel',
  requireRole('COMMANDER'),
  (req, res, next) => missionController.cancel(req, res, next)
);

export default router;
