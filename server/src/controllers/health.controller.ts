import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { assertTransactionsSupported, isDatabaseConnected } from '../config/database';
import { sendError, sendSuccess } from '../utils/response';

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

export const getLive = (_req: Request, res: Response): void => {
  sendSuccess(res, { status: 'alive', uptimeSeconds: Math.floor(process.uptime()), timestamp: new Date().toISOString() }, 200, 'BlackBox API is running');
};

export const getReady = async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!isDatabaseConnected() || !mongoose.connection.db) throw new Error('database unavailable');
    await mongoose.connection.db.command({ ping: 1 });
    await assertTransactionsSupported();
    sendSuccess(res, { status: 'ready', database: 'connected', transactions: 'supported', timestamp: new Date().toISOString() }, 200, 'BlackBox API is ready');
  } catch {
    sendError(res, 'BlackBox API is not ready', 'NOT_READY', 503);
  }
};
