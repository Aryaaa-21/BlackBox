import { Router } from 'express';
import { missionController } from '../controllers/mission.controller';
import { missionMemberController } from '../controllers/missionMember.controller';
import { taskController } from '../controllers/task.controller';
import { missionEventController } from '../controllers/missionEvent.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  createMissionSchema,
  updateMissionSchema,
} from '../validators/mission.validator';
import { addMemberSchema } from '../validators/missionMember.validator';
import { createTaskSchema } from '../validators/task.validator';

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

// ==========================================
// TEAM MEMBERSHIP ROUTES (Section 19)
// ==========================================

// Add Member to Mission Team (COMMANDER only)
router.post(
  '/:missionId/members',
  requireRole('COMMANDER'),
  validateRequest(addMemberSchema),
  (req, res, next) => missionMemberController.addMember(req, res, next)
);

// List Mission Team Members (Commander & Active Members)
router.get('/:missionId/members', (req, res, next) =>
  missionMemberController.listMembers(req, res, next)
);

// Remove Member from Mission Team (COMMANDER only)
router.delete(
  '/:missionId/members/:userId',
  requireRole('COMMANDER'),
  (req, res, next) => missionMemberController.removeMember(req, res, next)
);

// ==========================================
// MISSION TASK ROUTES (Section 38)
// ==========================================

// Create Task within Mission (COMMANDER only)
router.post(
  '/:missionId/tasks',
  requireRole('COMMANDER'),
  validateRequest(createTaskSchema),
  (req, res, next) => taskController.createTask(req, res, next)
);

// List Tasks within Mission (Commander & Active Members)
router.get('/:missionId/tasks', (req, res, next) =>
  taskController.getMissionTasks(req, res, next)
);

// ==========================================
// MISSION EVENT ROUTES (Phase 5)
// ==========================================

// List Mission Events (Commander & Active Members, Sections 22, 23, 24, 25)
router.get('/:missionId/events', (req, res, next) =>
  missionEventController.listEvents(req, res, next)
);

// Get Single Event Detail by ID
router.get('/:missionId/events/:eventId', (req, res, next) =>
  missionEventController.getEventById(req, res, next)
);

export default router;

