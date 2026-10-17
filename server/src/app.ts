import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { config } from './config/env';
import apiV1Router from './routes';
import healthRoutes from './routes/health.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

export const createApp = (): Application => {
  const app = express();

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows flexible PWA / local dev setup
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS configuration (enables credentials for HTTP-only cookies)
  const allowedOrigins = config.isProduction
    ? config.corsOrigins
    : [...new Set([...config.corsOrigins, 'http://localhost:5173', 'http://127.0.0.1:5173'])];

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Request logging
  if (config.nodeEnv !== 'test') {
    app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
  }

  // Cookie parsing for secure authentication tokens
  app.use(cookieParser());

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Root health check for quick ping / backward compatibility
  app.use('/api/health', healthRoutes);

  // Versioned API v1 routes
  app.use('/api/v1', apiV1Router);

  // 404 handler
  app.use(notFoundHandler);

  // Centralized error handler
  app.use(errorHandler);

  return app;
};
