import http from 'http';
import { createApp } from './app';
import { config } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { initializeSockets } from './sockets/socket';

const startServer = async () => {
  try {
    console.log('====================================================');
    console.log('       BLACKBOX — RESILIENT OPERATIONS PLATFORM     ');
    console.log('       Phase 1 Foundation Backend                   ');
    console.log('====================================================');

    // 1. Establish Database connection before accepting requests
    await connectDatabase();

    // Auto-initialize demo environment in development if enabled and empty
    if (config.enableDemoMode && process.env.DEMO_PASSWORD) {
      try {
        const { User } = await import('./models/User');
        const { demoService } = await import('./services/demo.service');
        const existingCommander = await User.findOne({ email: 'commander@demo.blackbox.internal' });
        if (!existingCommander) {
          console.log('[Server] Initializing demo environment for development...');
          await demoService.resetDemo();
          console.log('[Server] Demo environment initialized successfully');
        }
      } catch (seedErr: unknown) {
        console.error('[Server] Demo environment initialization warning:', (seedErr as Error).message);
      }
    }

    // 2. Instantiate Express app
    const app = createApp();

    // 3. Create HTTP server
    const httpServer = http.createServer(app);

    // 4. Initialize Socket.IO real-time communication
    initializeSockets(httpServer);

    // 5. Start listening
    const server = httpServer.listen(config.port, () => {
      console.log(`[Server] BlackBox API listening on port ${config.port}`);
      console.log(`[Server] Healthcheck: http://localhost:${config.port}/api/v1/health`);
      console.log(`[Server] Environment: ${config.nodeEnv}`);
    });

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      console.log(`\n[Server] Received ${signal}. Commencing graceful shutdown...`);
      server.close(async () => {
        console.log('[Server] HTTP and Socket.IO server closed');
        await disconnectDatabase();
        console.log('[Server] Graceful shutdown complete');
        process.exit(0);
      });

      // Force exit if shutdown takes longer than 10 seconds
      setTimeout(() => {
        console.error('[Server] Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    process.on('unhandledRejection', (reason: unknown) => {
      console.error('[Server] Unhandled Rejection:', reason);
    });

    process.on('uncaughtException', (err: Error) => {
      console.error('[Server] Uncaught Exception:', err);
      process.exit(1);
    });
  } catch (error) {
    console.error('[Server] Failed to initialize server:', error);
    process.exit(1);
  }
};

startServer();
