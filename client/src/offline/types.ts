/**
 * Phase 6 — Offline-First Operations
 * Local type definitions for IndexedDB-backed offline storage.
 *
 * IMPORTANT: Domain state (e.g. task.status = 'COMPLETED') is NEVER mixed
 * with sync state (e.g. syncState = 'PENDING'). They are kept separate.
 */

import type {
  MissionStatus,
  MissionSeverity,
  TaskStatus,
  TaskPriority,
  MemberRole,
  MemberStatus,
  MissionEventType,
  EventTargetType,
} from '../types';

// ============================================================
// SYNC STATE (orthogonal to domain state)
// ============================================================

export type SyncState = 'LOCAL' | 'PENDING' | 'SYNCED';

export type DataSource = 'SERVER' | 'LOCAL';

// ============================================================
// LOCAL MISSION RECORD
// ============================================================

export interface LocalMission {
  id: string;
  title: string;
  description: string;
  location: string;
  severity: MissionSeverity;
  status: MissionStatus;
  createdBy: string; // userId string
  createdByName?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;

  // Cache metadata
  cachedAt: string;
  source: DataSource;
}

// ============================================================
// LOCAL MISSION MEMBER RECORD
// ============================================================

export interface LocalMissionMember {
  id: string;
  missionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: MemberRole;
  role: MemberRole;
  status: MemberStatus;
  joinedAt?: string | null;
  createdAt: string;
  updatedAt: string;

  // Cache metadata
  cachedAt: string;
}

// ============================================================
// LOCAL TASK RECORD
// ============================================================

export interface LocalTask {
  id: string;
  localId: string;           // stable client UUID (= id for server tasks)
  serverId?: string;         // populated once synced
  missionId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedToId?: string | null;
  assignedToName?: string | null;
  createdById: string;
  createdByName?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  blockedAt?: string | null;
  createdAt: string;
  updatedAt: string;

  // Cache / offline metadata
  cachedAt: string;
  source: DataSource;
  syncState: SyncState;

  // Optimistic conflict support (Phase 7)
  baseUpdatedAt?: string;
}

// ============================================================
// LOCAL MISSION EVENT RECORD
// ============================================================

export interface LocalMissionEvent {
  id: string;            // stable client UUID or server event id
  missionId: string;
  actorId: string;
  actorName?: string;
  eventType: MissionEventType;
  targetType: EventTargetType;
  targetId?: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  clientCreatedAt: string;

  // Sync tracking
  source: DataSource;         // LOCAL | SERVER
  syncState: SyncState;       // LOCAL | PENDING | SYNCED
  idempotencyKey: string;
}

// ============================================================
// MUTATION QUEUE
// ============================================================

export type MutationOperationType =
  | 'CREATE_TASK'
  | 'UPDATE_TASK'
  | 'ASSIGN_TASK'
  | 'UNASSIGN_TASK'
  | 'UPDATE_TASK_STATUS';

export type MutationStatus = 'PENDING' | 'READY_FOR_SYNC' | 'FAILED';

export interface PendingMutation {
  id: string;                        // stable mutation UUID
  missionId: string;
  operationType: MutationOperationType;
  entityType: 'MISSION' | 'MEMBER' | 'TASK' | 'EVENT';
  entityId: string;                  // localId of the entity
  serverId?: string;                 // once entity is synced
  payload: Record<string, unknown>;
  actorId: string;
  deviceId: string;
  idempotencyKey: string;            // NEVER regenerated on retry
  createdAt: string;                 // ISO — queue insertion time
  clientCreatedAt: string;           // ISO — when user performed action
  status: MutationStatus;
  retryCount: number;
  lastAttemptAt?: string;
  errorMessage?: string;

  // Phase 7 conflict support
  baseUpdatedAt?: string;
}

// ============================================================
// DEVICE STATE
// ============================================================

export interface DeviceState {
  deviceId: string;
  createdAt: string;
  lastSeenAt: string;
}

// ============================================================
// CONNECTIVITY MODE
// ============================================================

export type ConnectivityMode = 'ONLINE' | 'OFFLINE' | 'DEGRADED';

// ============================================================
// OFFLINE OPERATION RESULT
// ============================================================

export interface OfflineOperationResult<T> {
  data: T;
  isLocal: boolean;
  syncState: SyncState;
  mutationId?: string;
}

// ============================================================
// TASK TRANSITION VALIDATION
// ============================================================

export type TaskTransitionError =
  | 'INVALID_TRANSITION'
  | 'TASK_NOT_FOUND'
  | 'TASK_ALREADY_COMPLETE';

export interface TaskTransitionResult {
  valid: boolean;
  error?: TaskTransitionError;
  message?: string;
}
