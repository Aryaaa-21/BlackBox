/**
 * Phase 6 — Offline-First Operations
 * Dexie (IndexedDB) database definition for BlackBox.
 *
 * Single database: blackbox-db
 * Schema versioned for future Phase 7 migration compatibility.
 */

import Dexie, { Table } from 'dexie';
import type {
  LocalMission,
  LocalMissionMember,
  LocalTask,
  LocalMissionEvent,
  PendingMutation,
  DeviceState,
} from './types';

export class BlackBoxDatabase extends Dexie {
  missions!: Table<LocalMission, string>;
  missionMembers!: Table<LocalMissionMember, string>;
  tasks!: Table<LocalTask, string>;
  missionEvents!: Table<LocalMissionEvent, string>;
  mutationQueue!: Table<PendingMutation, string>;
  deviceState!: Table<DeviceState, string>;

  constructor() {
    super('blackbox-db');

    // Version 1 — Phase 6 schema
    this.version(1).stores({
      // Missions: keyed by id, indexed by status and cachedAt
      missions: 'id, status, cachedAt',

      // MissionMembers: keyed by id, indexed by missionId and userId
      missionMembers: 'id, missionId, userId, status',

      // Tasks: keyed by localId (stable client UUID), indexed by missionId + status
      tasks: 'localId, missionId, status, syncState, [missionId+status]',

      // MissionEvents: keyed by id, indexed by missionId + source + syncState
      missionEvents: 'id, missionId, source, syncState, [missionId+syncState], createdAt',

      // MutationQueue: keyed by id, indexed by status, missionId, operationType
      mutationQueue: 'id, status, missionId, entityId, operationType, createdAt',

      // DeviceState: single record keyed by deviceId
      deviceState: 'deviceId',
    });

    // Version 2 — index local events by their stable mutation key so a
    // server acknowledgement can replace the local placeholder without
    // creating a duplicate in the activity feed.
    this.version(2).stores({
      missionEvents: 'id, missionId, source, syncState, idempotencyKey, [missionId+syncState], createdAt',
    });
  }
}

// Singleton instance — one DB for entire app
export const db = new BlackBoxDatabase();

// ============================================================
// DEVICE ID MANAGEMENT
// ============================================================

const DEVICE_ID_KEY = 'blackbox_device_id';

/**
 * Get or create a stable device identifier.
 * Stored in localStorage for fast access; persisted to IndexedDB for audit.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  // Check localStorage first (fast)
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    // Update lastSeenAt in IndexedDB
    await db.deviceState.put({
      deviceId: existing,
      createdAt: existing, // will be overwritten if already there
      lastSeenAt: new Date().toISOString(),
    });
    return existing;
  }

  // Create new device ID
  const deviceId = crypto.randomUUID();
  const now = new Date().toISOString();
  localStorage.setItem(DEVICE_ID_KEY, deviceId);

  await db.deviceState.put({
    deviceId,
    createdAt: now,
    lastSeenAt: now,
  });

  return deviceId;
}

/**
 * Clear user-specific cached data on logout.
 * Does NOT clear mutations by default — warns caller to handle that separately.
 */
export async function clearMissionCache(missionId?: string): Promise<void> {
  if (missionId) {
    await db.missions.delete(missionId);
    await db.missionMembers.where('missionId').equals(missionId).delete();
    await db.tasks.where('missionId').equals(missionId).delete();
    await db.missionEvents.where('missionId').equals(missionId).delete();
  } else {
    await db.missions.clear();
    await db.missionMembers.clear();
    await db.tasks.clear();
    await db.missionEvents.clear();
  }
}

/**
 * Clear all local data (logout scenario).
 * Returns count of pending mutations that would be lost.
 */
export async function clearAllLocalData(): Promise<{ pendingMutations: number }> {
  const pendingMutations = await db.mutationQueue
    .where('status')
    .equals('PENDING')
    .count();

  await db.missions.clear();
  await db.missionMembers.clear();
  await db.tasks.clear();
  await db.missionEvents.clear();
  await db.mutationQueue.clear();
  // Do NOT clear deviceState — keep device identity

  return { pendingMutations };
}

/**
 * Development-only: reset the entire database.
 */
export async function devResetDatabase(): Promise<void> {
  if (import.meta.env.PROD) {
    console.warn('[BlackBox DB] devResetDatabase() called in production — ignored');
    return;
  }
  await db.delete();
  console.log('[BlackBox DB] Database deleted. Reload the app to recreate.');
}
