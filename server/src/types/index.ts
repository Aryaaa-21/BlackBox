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

export type MemberRole = 'COMMANDER' | 'FIELD_OPERATOR';

export type MemberStatus = 'INVITED' | 'ACTIVE' | 'REMOVED';

export type TaskStatus = 'PENDING' | 'ACTIVE' | 'BLOCKED' | 'COMPLETED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface MissionStats {
  total: number;
  active: number;
  draft: number;
  completed: number;
  cancelled: number;
}

export interface TaskStats {
  total: number;
  pending: number;
  active: number;
  blocked: number;
  completed: number;
}

