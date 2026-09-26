export type UserRole = 'COMMANDER' | 'FIELD_OPERATOR';

export type MissionStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export type MissionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SeverityLevel = MissionSeverity;

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MissionCreator {
  id: string;
  name: string;
  email?: string;
  role?: UserRole;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  location: string;
  severity: MissionSeverity;
  status: MissionStatus;
  createdBy: MissionCreator | string;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MissionSummary = Mission;
export type MissionDetail = Mission;

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

export interface MissionFilters {
  status?: MissionStatus;
  severity?: MissionSeverity;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateMissionPayload {
  title: string;
  description: string;
  location: string;
  severity: MissionSeverity;
}

export interface UpdateMissionPayload {
  title?: string;
  description?: string;
  location?: string;
  severity?: MissionSeverity;
}

export type MemberRole = 'COMMANDER' | 'FIELD_OPERATOR';

export type MemberStatus = 'INVITED' | 'ACTIVE' | 'REMOVED';

export interface MissionMember {
  id: string;
  missionId: string;
  userId: {
    id: string;
    name: string;
    email: string;
    role?: UserRole;
  };
  role: MemberRole;
  status: MemberStatus;
  joinedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type TaskStatus = 'PENDING' | 'ACTIVE' | 'BLOCKED' | 'COMPLETED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Task {
  id: string;
  missionId: string | { id: string; title: string; location?: string; status?: MissionStatus; severity?: MissionSeverity };
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo?: { id: string; name: string; email: string; role?: UserRole } | null;
  createdBy: { id: string; name: string; email?: string } | string;
  startedAt?: string | null;
  completedAt?: string | null;
  blockedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskStats {
  total: number;
  pending: number;
  active: number;
  blocked: number;
  completed: number;
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string;
  page?: number;
  limit?: number;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  priority?: TaskPriority;
  assignedTo?: string;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  priority?: TaskPriority;
}

export type ConnectivityStatus = 'ONLINE' | 'OFFLINE' | 'RECONNECTING';

export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated' | 'server_unavailable';

export interface ConnectivityState {
  networkAvailable: boolean; // Device has network access (navigator.onLine)
  serverReachable: boolean;  // BlackBox backend can be pinged
  status: ConnectivityStatus;
  lastCheckedAt: number | null;
  latencyMs: number | null;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  code?: string;
}

export interface ApiError {
  success: false;
  message: string;
  code: string;
  details?: unknown;
}

export interface SystemHealthData {
  status: string;
  database: 'connected' | 'disconnected';
  realtime: 'ready' | 'offline';
  uptimeSeconds: number;
  timestamp: string;
  version: string;
}

// ==========================================
// PHASE 5: EVENT SYSTEM & REAL-TIME TYPES
// ==========================================

export enum MissionEventType {
  MISSION_CREATED = 'MISSION_CREATED',
  MISSION_STARTED = 'MISSION_STARTED',
  MISSION_COMPLETED = 'MISSION_COMPLETED',
  MISSION_CANCELLED = 'MISSION_CANCELLED',

  MEMBER_ASSIGNED = 'MEMBER_ASSIGNED',
  MEMBER_REMOVED = 'MEMBER_REMOVED',
  MEMBER_REACTIVATED = 'MEMBER_REACTIVATED',

  TASK_CREATED = 'TASK_CREATED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_UNASSIGNED = 'TASK_UNASSIGNED',
  TASK_STARTED = 'TASK_STARTED',
  TASK_BLOCKED = 'TASK_BLOCKED',
  TASK_COMPLETED = 'TASK_COMPLETED',

  OBSERVATION_RECORDED = 'OBSERVATION_RECORDED',
}

export enum EventTargetType {
  MISSION = 'MISSION',
  MEMBER = 'MEMBER',
  TASK = 'TASK',
  OBSERVATION = 'OBSERVATION',
}

export enum EventSource {
  USER = 'USER',
  SYSTEM = 'SYSTEM',
}

export interface MissionEventActor {
  id: string;
  name: string;
  email?: string;
  role?: UserRole;
}

export interface MissionEvent {
  id: string;
  missionId: string;
  actorId: MissionEventActor | string;
  eventType: MissionEventType;
  targetType: EventTargetType;
  targetId?: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  clientCreatedAt?: string | null;
  source: EventSource;
  idempotencyKey?: string | null;
}

export interface MissionEventsQueryOptions {
  page?: number;
  limit?: number;
  eventType?: MissionEventType;
}

export interface MissionEventsData {
  events: MissionEvent[];
  pagination: PaginationMeta;
}

export interface MissionEventCreatedPayload {
  missionId: string;
  event: MissionEvent;
}

