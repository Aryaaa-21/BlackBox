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

export enum MissionEventType {
  MISSION_CREATED = 'MISSION_CREATED',
  MISSION_UPDATED = 'MISSION_UPDATED',
  MISSION_STARTED = 'MISSION_STARTED',
  MISSION_COMPLETED = 'MISSION_COMPLETED',
  MISSION_CANCELLED = 'MISSION_CANCELLED',

  MEMBER_ASSIGNED = 'MEMBER_ASSIGNED',
  MEMBER_REMOVED = 'MEMBER_REMOVED',
  MEMBER_REACTIVATED = 'MEMBER_REACTIVATED',
  MEMBER_CHECKED_IN = 'MEMBER_CHECKED_IN',

  TASK_CREATED = 'TASK_CREATED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_UNASSIGNED = 'TASK_UNASSIGNED',
  TASK_STARTED = 'TASK_STARTED',
  TASK_BLOCKED = 'TASK_BLOCKED',
  TASK_COMPLETED = 'TASK_COMPLETED',

  OBSERVATION_RECORDED = 'OBSERVATION_RECORDED',

  NETWORK_LOST = 'NETWORK_LOST',
  NETWORK_RESTORED = 'NETWORK_RESTORED',
  SYNC_STARTED = 'SYNC_STARTED',
  SYNC_COMPLETED = 'SYNC_COMPLETED',
  SYNC_CONFLICT = 'SYNC_CONFLICT',
  CONFLICT_RESOLVED = 'CONFLICT_RESOLVED',
}

export enum EventTargetType {
  MISSION = 'MISSION',
  MEMBER = 'MEMBER',
  TASK = 'TASK',
  OBSERVATION = 'OBSERVATION',
  NETWORK = 'NETWORK',
  SYNC = 'SYNC',
}

export enum EventSource {
  USER = 'USER',
  SYSTEM = 'SYSTEM',
  LOCAL = 'LOCAL',
  SERVER = 'SERVER',
}

export interface CreateMissionEventInput {
  missionId: string;
  actorId: string;
  eventType: MissionEventType;
  targetType: EventTargetType;
  targetId?: string;
  payload: Record<string, unknown>;
  source?: EventSource;
  clientCreatedAt?: Date;
  idempotencyKey?: string;
  deviceId?: string;
  mutationId?: string;
}

export interface EventQueryOptions {
  page?: number;
  limit?: number;
  eventType?: MissionEventType;
}
