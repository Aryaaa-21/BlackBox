import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import missionRoutes from './mission.routes';

const apiV1Router = Router();

apiV1Router.use('/health', healthRoutes);
apiV1Router.use('/auth', authRoutes);
apiV1Router.use('/missions', missionRoutes);

export default apiV1Router;
