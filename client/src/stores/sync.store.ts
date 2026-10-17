import { create } from 'zustand';
import { liveQuery } from 'dexie';
import { getCachedOpenConflicts, getMutationStateCounts, getMutationsByStatus } from '../db';
import { enqueueMutation, reconcileConflictResolved, refreshConflicts, resolveQueuedConflict, syncQueuedMutations, retryMutation, discardMutation, type EnqueueMutationInput } from '../services/sync';
import type { ConflictResolutionInput, SyncConflict, SyncSummary } from '../types';
import { mergeAuthoritativeRows } from '../services/authority';

export interface ConflictResolvedEvent {
  conflictId: string;
  version?: number;
  resolution: ConflictResolutionInput['resolution'];
  entityType: string;
  entityId: string;
  entity?: Record<string, unknown>;
}

interface SyncState {
  pendingCount: number;
  failedCount: number;
  conflictCount: number;
  conflicts: SyncConflict[];
  syncing: boolean;
  lastSummary: SyncSummary | null;
  error: string | null;
  enqueue: (input: EnqueueMutationInput) => ReturnType<typeof enqueueMutation>;
  refresh: (missionId: string) => Promise<SyncConflict[]>;
  sync: () => Promise<SyncSummary | undefined>;
  resolve: (conflictId: string, input: ConflictResolutionInput) => Promise<void>;
  retry: (mutationId: string) => Promise<void>;
  discard: (mutationId: string) => Promise<void>;
  retryFailed: () => Promise<void>;
  handleConflictResolved: (event: ConflictResolvedEvent) => Promise<void>;
  refreshPendingCount: () => Promise<number>;
  observeQueue: () => () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  pendingCount: 0,
  failedCount: 0,
  conflictCount: 0,
  conflicts: [],
  syncing: false,
  lastSummary: null,
  error: null,
  enqueue: async (input) => {
    const mutation = await enqueueMutation(input);
    await updateStateFromCache(set);
    return mutation;
  },
  refresh: async (missionId) => {
    const conflicts = await refreshConflicts(missionId);
    await updateStateFromCache(set, conflicts);
    return conflicts;
  },
  sync: async () => {
    set({ syncing: true, error: null });
    try {
      const summary = await syncQueuedMutations();
      await updateStateFromCache(set);
      set({ lastSummary: summary || null });
      return summary;
    } catch (error) {
      await updateStateFromCache(set);
      set({ error: error instanceof Error ? error.message : 'Sync failed' });
      throw error;
    } finally {
      set({ syncing: false });
    }
  },
  resolve: async (conflictId, input) => {
    try {
      await resolveQueuedConflict(conflictId, input);
      const conflicts = useSyncStore.getState().conflicts.filter((conflict) => conflict.id !== conflictId);
      await updateStateFromCache(set, conflicts);
      set({ error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Conflict resolution failed' });
      throw error;
    }
  },
  retry: async (mutationId) => {
    await retryMutation(mutationId);
    await updateStateFromCache(set);
  },
  discard: async (mutationId) => {
    await discardMutation(mutationId);
    await updateStateFromCache(set);
  },
  retryFailed: async () => {
    const failed = await getMutationsByStatus('FAILED');
    await Promise.all(failed.map((mutation) => retryMutation(mutation.mutationId)));
    await updateStateFromCache(set);
  },
  handleConflictResolved: async (event) => {
    await reconcileConflictResolved(event);
    await updateStateFromCache(set);
  },
  refreshPendingCount: async () => {
    const [counts, conflicts] = await Promise.all([getMutationStateCounts(), getCachedOpenConflicts()]);
    set((state) => ({ ...countsToState(counts, conflicts.length), conflicts: mergeAuthoritativeRows(state.conflicts, conflicts) }));
    return counts.pending;
  },
  observeQueue: () => {
    const subscription = liveQuery(async () => ({ counts: await getMutationStateCounts(), conflicts: await getCachedOpenConflicts() })).subscribe({
      next: ({ counts, conflicts }) => set((state) => ({ ...countsToState(counts, conflicts.length), conflicts: mergeAuthoritativeRows(state.conflicts, conflicts) })),
      error: (error: unknown) => set({ error: error instanceof Error ? error.message : 'Unable to read local sync state' }),
    });
    return () => subscription.unsubscribe();
  },
}));

async function updateStateFromCache(
  set: (partial: Partial<SyncState> | ((state: SyncState) => Partial<SyncState>)) => void,
  _conflicts?: SyncConflict[]
): Promise<void> {
  const [counts, cachedConflicts] = await Promise.all([
    getMutationStateCounts(),
    getCachedOpenConflicts(),
  ]);
  set((state) => ({ ...countsToState(counts, cachedConflicts.length), conflicts: mergeAuthoritativeRows(state.conflicts, cachedConflicts) }));
}

function countsToState(counts: { pending: number; failed: number; conflicts: number }, openConflictCount = counts.conflicts): Pick<SyncState, 'pendingCount' | 'failedCount' | 'conflictCount'> {
  return { pendingCount: counts.pending, failedCount: counts.failed, conflictCount: Math.max(counts.conflicts, openConflictCount) };
}
