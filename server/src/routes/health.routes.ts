import { Router } from 'express';
import { getHealth, getLive, getReady } from '../controllers/health.controller';

const router = Router();

router.get('/', getHealth);
router.get('/live', getLive);
router.get('/ready', getReady);

export default router;
