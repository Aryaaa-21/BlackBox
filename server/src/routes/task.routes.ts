import { Router } from 'express';
import { taskController } from '../controllers/task.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  updateTaskSchema,
  assignTaskSchema,
  updateTaskStatusSchema,
} from '../validators/task.validator';

const router = Router();

// All task routes require authentication
router.use(authenticate);

// 1. Task Statistics for current operator/commander (Section 79)
router.get('/stats', (req, res, next) => taskController.getTaskStats(req, res, next));

// 2. Assigned tasks for current field operator ("My Tasks", Section 54)
router.get('/my', (req, res, next) => taskController.getMyTasks(req, res, next));

// 3. Task Detail by ID
router.get('/:taskId', (req, res, next) => taskController.getTaskById(req, res, next));

// 4. Update Task Details (Commander only, Section 35)
router.patch(
  '/:taskId',
  requireRole('COMMANDER'),
  validateRequest(updateTaskSchema),
  (req, res, next) => taskController.updateTask(req, res, next)
);

// 5. Assign Task (Commander only, Section 27)
router.patch(
  '/:taskId/assign',
  requireRole('COMMANDER'),
  validateRequest(assignTaskSchema),
  (req, res, next) => taskController.assignTask(req, res, next)
);

// 6. Unassign Task (Commander only, Section 28)
router.patch(
  '/:taskId/unassign',
  requireRole('COMMANDER'),
  (req, res, next) => taskController.unassignTask(req, res, next)
);

// 7. Update Task Status (Section 31 & 32: Commander or assigned Field Operator)
router.patch(
  '/:taskId/status',
  validateRequest(updateTaskStatusSchema),
  (req, res, next) => taskController.updateTaskStatus(req, res, next)
);

export default router;
