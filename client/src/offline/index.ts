/**
 * Phase 6 — Offline-First Operations
 * Public API for the offline module.
 */

export { db, getOrCreateDeviceId, clearMissionCache, clearAllLocalData } from './db';
export { mutationQueueRepository } from './mutationQueue.repository';
export { taskRepository } from './task.repository';
export { missionRepository } from './mission.repository';
export { missionEventRepository } from './missionEvent.repository';
export { useOfflineStore } from './offlineStore';
export { validateTaskTransition, isTaskStart, isTaskComplete, isTaskBlock } from './validation';
export { classifyApiError, isOfflineError } from './errorClassifier';
export type {
  LocalMission,
  LocalMissionMember,
  LocalTask,
  LocalMissionEvent,
  PendingMutation,
  DeviceState,
  SyncState,
  DataSource,
  ConnectivityMode,
  OfflineOperationResult,
  MutationOperationType,
  MutationStatus,
} from './types';
