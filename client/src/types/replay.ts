/**
 * Phase 8 — Mission Replay
 * Type Definitions — models for replay events, timeline, reconstructed state,
 * playback engine, and presentation models.
 */

import { MissionStatus, TaskStatus, MissionEventType } from './index';

export interface ReplayActorInfo {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

export interface ReplayEvent {
  id: string;
  missionId: string;
  eventType: MissionEventType | string;
  actor: ReplayActorInfo;
  targetType?: string;
  targetId?: string | null;
  targetName?: string;
  payload: Record<string, unknown>;
  createdAt: string;
  clientCreatedAt?: string | null;
  source: 'SERVER' | 'LOCAL' | 'SYSTEM' | string;
  syncState?: 'SYNCED' | 'PENDING';
  idempotencyKey?: string | null;
}

export interface ReplaySummary {
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
  firstEventAt: string | null;
  lastEventAt: string | null;
}

export interface ReplayMember {
  id: string;
  userId: string;
  name: string;
  email?: string;
  role?: string;
  status: 'ACTIVE' | 'REMOVED';
  checkedIn?: boolean;
  joinedAt: string;
}

export interface ReplayTaskHistoryItem {
  eventType: string;
  timestamp: string;
  actorName: string;
  details?: string;
}

export interface ReplayTask {
  id: string;
  title: string;
  description?: string;
  priority?: string;
  status: TaskStatus;
  assignedTo?: { id: string; name: string } | null;
  history: ReplayTaskHistoryItem[];
  startedAt?: string;
  completedAt?: string;
  blockedAt?: string;
  blockedReason?: string;
}

export interface ReplayObservation {
  id: string;
  recordedBy: string;
  recordedByName: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface ReplayConflict {
  id: string;
  taskId?: string;
  taskTitle?: string;
  localState?: Record<string, unknown>;
  serverState?: Record<string, unknown>;
  resolution?: string;
  detectedAt: string;
  resolvedAt?: string;
}

export interface ReplayMissionState {
  missionStatus: MissionStatus;
  missionTitle: string;
  members: ReplayMember[];
  tasks: ReplayTask[];
  observations: ReplayObservation[];
  conflicts: ReplayConflict[];
  connectivity: 'ONLINE' | 'OFFLINE';
  activeTaskCount: number;
  completedTaskCount: number;
  blockedTaskCount: number;
  pendingTaskCount: number;
  teamMemberCount: number;
}

export type ReplayCategoryFilter =
  | 'ALL'
  | 'MISSION'
  | 'TASKS'
  | 'TEAM'
  | 'OBSERVATIONS'
  | 'NETWORK'
  | 'SYNC';

export interface ReplayFilters {
  category: ReplayCategoryFilter;
  actorId?: string;
  search?: string;
}

export interface ReplayEventViewModel {
  id: string;
  eventType: string;
  category: ReplayCategoryFilter;
  title: string;
  description: string;
  actorName: string;
  actorRole?: string;
  timestamp: string;
  formattedTime: string;
  source: string;
  syncState?: 'SYNCED' | 'PENDING';
  isLocal: boolean;
  isConflict: boolean;
  isNetwork: boolean;
  badgeColor: {
    bg: string;
    text: string;
    border: string;
    dot: string;
  };
  targetName?: string;
  details?: Record<string, unknown>;
}

export interface ReplayApiResponse {
  success: boolean;
  data: {
    mission: {
      id: string;
      title: string;
      description: string;
      location: string;
      status: MissionStatus;
      severity: string;
      createdBy: unknown;
      startedAt?: string | null;
      completedAt?: string | null;
      createdAt: string;
      updatedAt: string;
    };
    events: ReplayEvent[];
    summary: ReplaySummary;
    pagination: {
      total: number;
      limit: number;
      hasMore: boolean;
    };
  };
}
