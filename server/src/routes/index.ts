import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import missionRoutes from './mission.routes';
import userRoutes from './user.routes';
import taskRoutes from './task.routes';

const apiV1Router = Router();

apiV1Router.use('/health', healthRoutes);
apiV1Router.use('/auth', authRoutes);
apiV1Router.use('/missions', missionRoutes);
apiV1Router.use('/users', userRoutes);
apiV1Router.use('/tasks', taskRoutes);

export default apiV1Router;

