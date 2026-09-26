import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import { config } from '../config/env';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error(`[Error] ${err.name}: ${err.message}`);

  if (err instanceof AppError) {
    sendError(res, err.message, err.code, err.statusCode, err.details);
    return;
  }

  // Handle Mongoose duplicate key error (11000)
  if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000) {
    sendError(res, 'A record with that value already exists', 'DUPLICATE_ENTRY', 409);
    return;
  }

  // Handle Mongoose ValidationError
  if (err.name === 'ValidationError') {
    sendError(res, err.message, 'VALIDATION_ERROR', 400);
    return;
  }

  // Generic internal server error
  const message = config.isProduction
    ? 'An unexpected error occurred on the server'
    : err.message || 'Internal Server Error';

  sendError(
    res,
    message,
    'INTERNAL_SERVER_ERROR',
    500,
    config.isProduction ? undefined : err.stack
  );
};

export const notFoundHandler = (req: Request, res: Response): void => {
  sendError(
    res,
    `Cannot ${req.method} ${req.originalUrl} - Route not found`,
    'ROUTE_NOT_FOUND',
    404
  );
};
