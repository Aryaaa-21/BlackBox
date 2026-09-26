import { Request } from 'express';

export type UserRole = 'COMMANDER' | 'FIELD_OPERATOR';

export type MissionStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface UserPayload {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  isActive?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  code: string;
  details?: unknown;
}
