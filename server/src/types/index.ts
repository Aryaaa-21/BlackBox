import { Request } from 'express';

export type UserRole = 'COMMANDER' | 'FIELD_OPERATOR';

export type MissionStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export type MissionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

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

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface MissionStats {
  total: number;
  active: number;
  draft: number;
  completed: number;
  cancelled: number;
}
