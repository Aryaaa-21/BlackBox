import { Request, Response } from 'express';
import { isDatabaseConnected } from '../config/database';
import { sendSuccess } from '../utils/response';

export const getHealth = (_req: Request, res: Response): void => {
  const dbConnected = isDatabaseConnected();
  const uptime = process.uptime();

  sendSuccess(
    res,
    {
      status: 'operational',
      database: dbConnected ? 'connected' : 'disconnected',
      realtime: 'ready',
      uptimeSeconds: Math.floor(uptime),
      timestamp: new Date().toISOString(),
      version: '1.0.0-phase1',
    },
    200,
    'BlackBox API is running'
  );
};
