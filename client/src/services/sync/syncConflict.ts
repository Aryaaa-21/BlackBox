/**
 * Phase 7 — Synchronization Engine
 * Sync Conflict — frontend conflict management utilities.
 * Talks to the server conflict endpoints; also manages local conflict state.
 */

import { api } from '../api';
import { SyncConflict, useSyncStore } from '../../store/syncStore';
import type { ConflictResolution } from '../../store/syncStore';
import { db } from '../../offline/db';
import { mutationQueueRepository } from '../../offline/mutationQueue.repository';
import { useTaskStore } from '../../store/taskStore';
import type { Task } from '../../types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface ConflictsResponse {
  conflicts: SyncConflict[];
}

interface ResolveResponse {
  conflict: SyncConflict;
  entity?: Record<string, unknown>;
}

// Re-export for convenience
export type { ConflictResolution };

export const syncConflict = {
  /**
   * Load open conflicts for a mission from the server.
   * Updates the sync store conflict list.
   */
  async loadMissionConflicts(missionId: string): Promise<SyncConflict[]> {
    const store = useSyncStore.getState();
    store.setIsLoadingConflicts(true);

    try {
      const response = await api.get<ApiResponse<ConflictsResponse>>(
        `/sync/conflicts?missionId=${missionId}`
      );
      const conflicts = response.data.data.conflicts;
      store.setConflicts(conflicts);
      return conflicts;
    } catch (err) {
      console.error('[SyncConflict] Failed to load conflicts:', err);
      return [];
    } finally {
      store.setIsLoadingConflicts(false);
    }
  },

  /**
   * Resolve a conflict on the server and update local store.
   */
  async resolveConflict(
    conflictId: string,
    resolution: 'KEEP_LOCAL' | 'KEEP_SERVER' | 'MERGE',
    mergedState?: Record<string, unknown>
  ): Promise<{ entity?: Record<string, unknown> }> {
    const conflict = useSyncStore.getState().conflicts.find((item) => item.id === conflictId);
    const response = await api.post<ApiResponse<ResolveResponse>>(
      `/sync/conflicts/${conflictId}/resolve`,
      { resolution, mergedState }
    );

    const { entity } = response.data.data;

    if (entity && conflict?.entityType === 'TASK') {
      const assignedTo = entity.assignedTo;
      await db.tasks.update(conflict.entityId, {
        title: entity.title as string | undefined,
        description: entity.description as string | undefined,
        priority: entity.priority as any,
        status: entity.status as any,
        assignedToId:
          typeof assignedTo === 'object' && assignedTo !== null
            ? String((assignedTo as Record<string, unknown>).id ?? '')
            : (assignedTo as string | null | undefined) ?? null,
        assignedToName:
          typeof assignedTo === 'object' && assignedTo !== null
            ? String((assignedTo as Record<string, unknown>).name ?? '')
            : null,
        updatedAt: (entity.updatedAt as string) || new Date().toISOString(),
        baseUpdatedAt: (entity.updatedAt as string) || new Date().toISOString(),
        syncState: 'SYNCED',
        source: 'SERVER',
        cachedAt: new Date().toISOString(),
      });
      useTaskStore.getState().handleTaskUpdated(entity as unknown as Task);
    }

    // The failed optimistic mutation has now been explicitly resolved and
    // must not be retried with its old baseUpdatedAt.
    if (conflict) await mutationQueueRepository.remove(conflict.mutationId);

    // Remove from local conflict list
    useSyncStore.getState().removeConflict(conflictId);

    console.log(`[SyncConflict] Conflict ${conflictId} resolved: ${resolution}`);

    return { entity };
  },
};
