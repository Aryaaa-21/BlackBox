/** JSON contracts exposed by server/src. Dates are ISO-8601 strings on the wire. */

export type ISODateString = string;

export type UserRole = 'COMMANDER' | 'FIELD_OPERATOR';
export type MissionStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type MissionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type MemberRole = 'COMMANDER' | 'FIELD_OPERATOR';
export type MemberStatus = 'INVITED' | 'ACTIVE' | 'REMOVED';
export type TaskStatus = 'PENDING' | 'ACTIVE' | 'BLOCKED' | 'COMPLETED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  message: string;
  code: string;
  details?: unknown;
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiError;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
}

export interface User extends UserSummary {
  lastLoginAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt?: ISODateString;
}

export type EntityRef<T> = string | T;

export interface Mission {
  id: string;
  version?: number;
  title: string;
  description: string;
  location: string;
  severity: MissionSeverity;
  status: MissionStatus;
  createdBy: EntityRef<UserSummary>;
  startedAt?: ISODateString | null;
  completedAt?: ISODateString | null;
  cancelledAt?: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Task {
  id: string;
  version?: number;
  /** Local view projection only; never an authoritative cache write. */
  localPending?: boolean;
  missionId: EntityRef<Pick<Mission, 'id' | 'title' | 'location' | 'severity' | 'status'>>;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo?: EntityRef<UserSummary> | null;
  createdBy: EntityRef<UserSummary>;
  startedAt?: ISODateString | null;
  completedAt?: ISODateString | null;
  blockedAt?: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface MissionMember {
  id: string;
  version?: number;
  missionId: string;
  userId: EntityRef<UserSummary>;
  role: MemberRole;
  status: MemberStatus;
  joinedAt?: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
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

export type EventSource = 'USER' | 'SYSTEM' | 'LOCAL' | 'SERVER';

export interface MissionEvent {
  id: string;
  missionId: string;
  actorId: EntityRef<UserSummary>;
  eventType: MissionEventType;
  targetType: EventTargetType;
  targetId?: string | null;
  payload: Record<string, unknown>;
  source: EventSource;
  clientCreatedAt?: ISODateString | null;
  idempotencyKey?: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

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

export interface MissionListData {
  missions: Mission[];
  pagination: PaginationMeta;
}

export interface MissionTasksData {
  tasks: Task[];
  stats: TaskStats;
  pagination: PaginationMeta;
}

export interface EventListData {
  events: MissionEvent[];
  pagination: PaginationMeta;
}

export interface AuthResult {
  user: User;
  token: string;
}

export interface CreateMissionInput {
  title: string;
  description: string;
  location: string;
  severity: MissionSeverity;
}

export type UpdateMissionInput = Partial<CreateMissionInput>;

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  assignedTo?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: TaskPriority;
}

export interface ObservationInput {
  text: string;
  idempotencyKey?: string;
  clientCreatedAt?: ISODateString;
}

export interface MissionQuery {
  page?: number;
  limit?: number;
  status?: MissionStatus;
  severity?: MissionSeverity;
  search?: string;
}

export interface TaskQuery {
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string;
  page?: number;
  limit?: number;
}

export interface EventQuery {
  page?: number;
  limit?: number;
  eventType?: MissionEventType;
}

export interface ReplayQuery {
  from?: ISODateString;
  to?: ISODateString;
  eventType?: string;
  limit?: number;
  cursor?: string;
}

export interface ReplayActorInfo {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

export interface ReplayNormalizedEvent {
  id: string;
  missionId: string;
  eventType: string;
  actor: ReplayActorInfo;
  targetType?: string;
  targetId?: string | null;
  targetName?: string;
  payload: Record<string, unknown>;
  createdAt: ISODateString;
  clientCreatedAt?: ISODateString | null;
  source: string;
  syncState?: 'SYNCED' | 'PENDING';
  idempotencyKey?: string | null;
}

export interface ReplaySummary {
  scope?: 'PAGE' | 'LOADED_HISTORY';
  durationMs: number;
  durationFormatted: string;
  totalEvents: number;
  tasksCreated: number;
  tasksCompleted: number;
  tasksBlocked: number;
  teamMembersCount: number;
  conflictsCount: number;
  networkLostCount: number;
  observationsCount: number;
  firstEventAt: ISODateString | null;
  lastEventAt: ISODateString | null;
}

export interface ReplayData {
  mission: Pick<Mission, 'id' | 'title' | 'description' | 'location' | 'status' | 'severity' | 'createdBy'> & {
    startedAt?: ISODateString | null;
    completedAt?: ISODateString | null;
    createdAt: ISODateString;
    updatedAt: ISODateString;
  };
  events: ReplayNormalizedEvent[];
  summary: ReplaySummary;
  pagination: { total: number; limit: number; hasMore: boolean; nextCursor: string | null };
  /** Client transport metadata, never used to reconstruct historical state. */
  history?: { source: 'server' | 'cache'; limited: boolean; pendingExcluded: number; notice?: string };
}

export type SyncOperationType =
  | 'CREATE_TASK'
  | 'UPDATE_TASK'
  | 'ASSIGN_TASK'
  | 'UNASSIGN_TASK'
  | 'UPDATE_TASK_STATUS'
  | 'RECORD_OBSERVATION';
export type SyncEntityType = 'MISSION' | 'MEMBER' | 'TASK' | 'EVENT';

export interface SyncMutation {
  mutationId: string;
  missionId: string;
  operationType: SyncOperationType;
  entityType: SyncEntityType;
  entityId: string;
  payload: Record<string, unknown>;
  actorId: string;
  deviceId: string;
  clientCreatedAt: ISODateString;
  createdAt: ISODateString;
  idempotencyKey: string;
  baseUpdatedAt?: ISODateString;
  baseVersion?: number;
}

export interface SyncBatchInput {
  mutations: SyncMutation[];
}

export type SyncResultStatus = 'SYNCED' | 'CONFLICT' | 'FAILED' | 'DUPLICATE';

export interface SyncMutationResult {
  mutationId: string;
  idempotencyKey: string;
  status: SyncResultStatus;
  entityType?: SyncEntityType;
  localId?: string;
  serverId?: string;
  entity?: Record<string, unknown>;
  /** Client-only causal acknowledgement, before selecting a newer cached entity. */
  acknowledgedBase?: { version?: number; updatedAt?: string };
  conflict?: {
    conflictId: string;
    localState: Record<string, unknown>;
    serverState: Record<string, unknown>;
  };
  errorCode?: string;
  message?: string;
}

export interface SyncSummary {
  synced: number;
  conflicts: number;
  failed: number;
  duplicates: number;
  remaining: number;
  results: SyncMutationResult[];
}

export type ConflictStatus = 'OPEN' | 'RESOLVED' | 'DISCARDED';
export type ConflictResolution = 'KEEP_LOCAL' | 'KEEP_SERVER' | 'MERGE';

export interface SyncConflict {
  id: string;
  version?: number;
  mutationId: string;
  idempotencyKey: string;
  missionId: string;
  entityType: string;
  entityId: string;
  operationType: string;
  actorId: string;
  deviceId: string;
  localState: Record<string, unknown>;
  serverState: Record<string, unknown>;
  baseState?: Record<string, unknown>;
  status: ConflictStatus;
  resolution?: ConflictResolution;
  resolvedAt?: ISODateString | null;
  resolvedByUserId?: string | null;
  resolvedEntityState?: Record<string, unknown> | null;
  detectedAt: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface ConflictResolutionInput {
  resolution: ConflictResolution;
  mergedState?: Record<string, unknown>;
  expectedServerUpdatedAt?: string;
}

export interface ConflictResolutionResult {
  conflict: SyncConflict;
  entity?: Record<string, unknown>;
  newMutation?: Record<string, unknown>;
}

export interface DemoInfo {
  enabled: boolean;
  demoMissionId?: string;
  demoUsers: Array<{ name: string; email: string; role: string }>;
}

export interface DemoReset {
  message: string;
  demoUsers: Array<{
    name: string;
    email: string;
    role: UserRole;
    userId?: string;
  }>;
  demoMission: { id: string; title: string; location: string; severity: string; status: string };
  tasksCount: number;
  eventsCount: number;
}

export interface HealthStatus {
  status: 'operational' | string;
  database: 'connected' | 'disconnected' | string;
  realtime: 'ready' | string;
  uptimeSeconds: number;
  timestamp: ISODateString;
  version: string;
}

export interface SocketWelcome {
  message: string;
  timestamp: ISODateString;
  socketId: string;
  user: Pick<User, 'id' | 'name' | 'role'>;
  room: string;
}
