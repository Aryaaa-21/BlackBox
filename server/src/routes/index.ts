import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';

const apiV1Router = Router();

apiV1Router.use('/health', healthRoutes);
apiV1Router.use('/auth', authRoutes);

// Mission routes placeholder for Phase 3
apiV1Router.get('/missions', (_req, res) => {
  res.status(200).json({
    success: true,
    data: [],
    message: 'Missions API endpoint placeholder for Phase 3',
  });
});

export default apiV1Router;
