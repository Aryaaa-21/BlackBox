import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// Search users (e.g. GET /api/v1/users?role=FIELD_OPERATOR) (Section 20 & 21)
router.get('/', (req, res, next) => userController.searchUsers(req, res, next));

export default router;
