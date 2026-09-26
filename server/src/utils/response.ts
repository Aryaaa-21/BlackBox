import { Response } from 'express';
import { ApiResponse, ApiErrorResponse } from '../types';

export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode = 200,
  message?: string
): Response => {
  const payload: ApiResponse<T> = {
    success: true,
    data,
    ...(message ? { message } : {}),
  };
  return res.status(statusCode).json(payload);
};

export const sendError = (
  res: Response,
  message: string,
  code = 'INTERNAL_ERROR',
  statusCode = 500,
  details?: unknown
): Response => {
  const payload: ApiErrorResponse = {
    success: false,
    message,
    code,
    ...(details !== undefined ? { details } : {}),
  };
  return res.status(statusCode).json(payload);
};
