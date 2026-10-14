/**
 * Phase 7 — Synchronization Engine
 * Sync Store — Zustand store for sync lifecycle state.
 *
 * Single source of truth for:
 * - isSyncing (lock — prevents double-sync)
 * - pendingCount / failedCount / conflictCount
 * - lastSyncAt / lastSyncError
 * - conflicts list (from server)
 */

import { create } from 'zustand';

export type ConflictResolution = 'KEEP_LOCAL' | 'KEEP_SERVER' | 'MERGE';

export interface SyncConflict {
  id: string;
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
  status: 'OPEN' | 'RESOLVED' | 'DISCARDED';
  resolution?: ConflictResolution;
  detectedAt: string;
}

export interface SyncSummary {
  synced: number;
  conflicts: number;
  failed: number;
  duplicates: number;
  remaining: number;
}

interface SyncStoreState {
  // Sync lifecycle
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  conflictCount: number;
  lastSyncStartedAt: string | null;
  lastSyncCompletedAt: string | null;
  lastSyncError: string | null;
  lastSyncSummary: SyncSummary | null;
  currentMutationId: string | null;

  // Conflicts
  conflicts: SyncConflict[];
  isLoadingConflicts: boolean;

  // Actions
  startSync: () => void;
  finishSync: (summary: SyncSummary | null, error?: string) => void;
  setPendingCount: (count: number) => void;
  setFailedCount: (count: number) => void;
  setConflictCount: (count: number) => void;
  setCurrentMutation: (mutationId: string | null) => void;
  setLastSyncError: (error: string | null) => void;
  setConflicts: (conflicts: SyncConflict[]) => void;
  removeConflict: (conflictId: string) => void;
  setIsLoadingConflicts: (loading: boolean) => void;
  reset: () => void;
}

export const useSyncStore = create<SyncStoreState>((set, get) => ({
  isSyncing: false,
  pendingCount: 0,
  failedCount: 0,
  conflictCount: 0,
  lastSyncStartedAt: null,
  lastSyncCompletedAt: null,
  lastSyncError: null,
  lastSyncSummary: null,
  currentMutationId: null,
  conflicts: [],
  isLoadingConflicts: false,

  startSync: () => {
    set({
      isSyncing: true,
      lastSyncStartedAt: new Date().toISOString(),
      lastSyncError: null,
      currentMutationId: null,
    });
  },

  finishSync: (summary: SyncSummary | null, error?: string) => {
    set({
      isSyncing: false,
      lastSyncCompletedAt: new Date().toISOString(),
      lastSyncError: error ?? null,
      lastSyncSummary: summary,
      currentMutationId: null,
      ...(summary
        ? {
            conflictCount: summary.conflicts,
            failedCount: summary.failed,
            pendingCount: summary.remaining,
          }
        : {}),
    });
  },

  setPendingCount: (count: number) => set({ pendingCount: count }),
  setFailedCount: (count: number) => set({ failedCount: count }),
  setConflictCount: (count: number) => set({ conflictCount: count }),
  setCurrentMutation: (mutationId: string | null) => set({ currentMutationId: mutationId }),
  setLastSyncError: (error: string | null) => set({ lastSyncError: error }),

  setConflicts: (conflicts: SyncConflict[]) => {
    set({ conflicts, conflictCount: conflicts.length });
  },

  removeConflict: (conflictId: string) => {
    const updated = get().conflicts.filter((c) => c.id !== conflictId);
    set({ conflicts: updated, conflictCount: updated.length });
  },

  setIsLoadingConflicts: (loading: boolean) => set({ isLoadingConflicts: loading }),

  reset: () => {
    set({
      isSyncing: false,
      pendingCount: 0,
      failedCount: 0,
      conflictCount: 0,
      lastSyncStartedAt: null,
      lastSyncCompletedAt: null,
      lastSyncError: null,
      lastSyncSummary: null,
      currentMutationId: null,
      conflicts: [],
    });
  },
}));
