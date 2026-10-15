/**
 * Phase 7 — Synchronization Engine
 * SyncEngine — main orchestrator for processing the offline mutation queue.
 *
 * RESPONSIBILITIES:
 * 1. Acquire sync lock (prevent concurrent syncs)
 * 2. Verify connectivity (network + server reachable)
 * 3. Load pending mutations from IndexedDB ordered oldest-first
 * 4. Send batch to POST /api/v1/sync
 * 5. Process results per mutation:
 *    SYNCED    → remove from queue, reconcile local cache
 *    DUPLICATE → remove from queue (already done)
 *    CONFLICT  → mark as conflict, save to store
 *    FAILED    → mark failed, schedule retry if retryable
 * 6. Refresh affected server state
 * 7. Release sync lock
 * 8. Continue if more mutations remain (batch limit)
 */

import { api } from '../api';
import { db } from '../../offline/db';
import { mutationQueueRepository } from '../../offline/mutationQueue.repository';
import { useSyncStore } from '../../store/syncStore';
import { useConnectivityStore } from '../../store/connectivityStore';
import { syncRetry } from './syncRetry';
import { missionEventRepository } from '../../offline/missionEvent.repository';
import { useMissionEventStore } from '../../store/missionEventStore';
import type { PendingMutation, MutationStatus } from '../../offline/types';
import type { OutgoingMutation, SyncResponse, MutationResult } from './syncTypes';
import type { LocalTask } from '../../offline/types';
import type { MissionEvent } from '../../types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

const MAX_BATCH_SIZE = 20;
const LOG_PREFIX = '[SyncEngine]';

class SyncEngine {
  private syncLock = false;

  // ============================================================
  // PUBLIC API
  // ============================================================

  /**
   * Attempt to synchronize all pending mutations.
   * Idempotent — safe to call multiple times.
   * Uses a lock to prevent concurrent runs.
   */
  async syncPendingMutations(): Promise<void> {
    // Guard: don't start if already syncing
    if (this.syncLock) {
      console.log(`${LOG_PREFIX} Already syncing — skipping`);
      return;
    }

    // Guard: connectivity check
    const connectivityStore = useConnectivityStore.getState();
    if (!connectivityStore.serverReachable) {
      console.log(`${LOG_PREFIX} Server not reachable — deferring sync`);
      return;
    }

    // Acquire lock
    this.syncLock = true;
    const syncStore = useSyncStore.getState();
    syncStore.startSync();

    console.log(`${LOG_PREFIX} Starting sync cycle`);

    try {
      await this.runSyncCycle();
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`${LOG_PREFIX} Sync cycle error:`, error.message);
      syncStore.finishSync(null, error.message);
    } finally {
      this.syncLock = false;
    }
  }

  /**
   * Check if a sync is currently in progress.
   */
  isSyncing(): boolean {
    return this.syncLock;
  }

  /**
   * Manually retry a specific failed mutation.
   */
  async retryMutation(mutationId: string): Promise<void> {
    const mutation = await mutationQueueRepository.getById(mutationId);
    if (!mutation) {
      console.warn(`${LOG_PREFIX} Mutation ${mutationId} not found for retry`);
      return;
    }

    // Reset status to PENDING so it gets picked up on next sync
    await db.mutationQueue.update(mutationId, {
      status: 'PENDING' as MutationStatus,
      retryCount: 0,
      errorMessage: undefined,
      lastAttemptAt: undefined,
    });

    console.log(`${LOG_PREFIX} Mutation ${mutationId} reset for retry`);

    // Trigger a sync cycle
    await this.syncPendingMutations();
  }

  // ============================================================
  // SYNC CYCLE
  // ============================================================

  private async runSyncCycle(): Promise<void> {
    const syncStore = useSyncStore.getState();

    // Load all pending mutations, oldest first
    const pending = await mutationQueueRepository.getPending();

    if (pending.length === 0) {
      console.log(`${LOG_PREFIX} No pending mutations`);
      syncStore.finishSync({ synced: 0, conflicts: 0, failed: 0, duplicates: 0, remaining: 0 });
      return;
    }

    console.log(`${LOG_PREFIX} Pending mutations: ${pending.length}`);
    syncStore.setPendingCount(pending.length);

    // Take first batch
    const batch = pending.slice(0, MAX_BATCH_SIZE);
    const remaining = Math.max(0, pending.length - MAX_BATCH_SIZE);

    // Convert to wire format
    const outgoing: OutgoingMutation[] = batch.map((m) => ({
      mutationId: m.id,
      missionId: m.missionId,
      operationType: m.operationType,
      entityType: m.entityType,
      entityId: m.entityId,
      payload: m.payload,
      actorId: m.actorId,
      deviceId: m.deviceId,
      clientCreatedAt: m.clientCreatedAt,
      createdAt: m.createdAt,
      idempotencyKey: m.idempotencyKey,
      baseUpdatedAt: m.baseUpdatedAt,
    }));

    // Send to server
    let syncResponse: SyncResponse;
    try {
      const response = await api.post<ApiResponse<SyncResponse>>('/sync', {
        mutations: outgoing,
      });
      syncResponse = response.data.data;
    } catch (err: unknown) {
      const error = err as any;
      console.error(`${LOG_PREFIX} Sync API call failed:`, error?.message);

      // If network error — keep all as PENDING (do not mark as failed)
      if (error?.code === 'NETWORK_UNAVAILABLE' || error?.code === 'ECONNREFUSED') {
        console.log(`${LOG_PREFIX} Network error — mutations kept as PENDING`);
        syncStore.finishSync(null, 'Network unavailable');
        return;
      }

      // Other server error — finish with error
      syncStore.finishSync(null, error?.message || 'Sync request failed');
      return;
    }

    console.log(
      `${LOG_PREFIX} Server responded: synced=${syncResponse.synced} conflicts=${syncResponse.conflicts} failed=${syncResponse.failed} duplicates=${syncResponse.duplicates}`
    );

    // Process each result
    await this.processResults(syncResponse.results, batch);

    const finalSummary: SyncResponse = {
      ...syncResponse,
      remaining,
    };

    syncStore.finishSync(finalSummary);

    // If there are more mutations (exceeded batch size), continue
    if (remaining > 0) {
      console.log(`${LOG_PREFIX} Continuing sync — ${remaining} mutations remain`);
      this.syncLock = false; // Release lock so the recursive call can acquire it
      await this.syncPendingMutations();
    }
  }

  // ============================================================
  // RESULT PROCESSING
  // ============================================================

  private async processResults(
    results: MutationResult[],
    batch: PendingMutation[]
  ): Promise<void> {
    // Build a map for fast lookup
    const mutationById = new Map(batch.map((m) => [m.id, m]));

    for (const result of results) {
      const mutation = mutationById.get(result.mutationId);
      if (!mutation) {
        console.warn(`${LOG_PREFIX} Result for unknown mutation: ${result.mutationId}`);
        continue;
      }

      try {
        switch (result.status) {
          case 'SYNCED':
            await this.handleSynced(result, mutation);
            break;
          case 'DUPLICATE':
            await this.handleDuplicate(result, mutation);
            break;
          case 'CONFLICT':
            await this.handleConflict(result, mutation);
            break;
          case 'FAILED':
            await this.handleFailed(result, mutation);
            break;
        }
      } catch (err: unknown) {
        const error = err as Error;
        console.error(
          `${LOG_PREFIX} Error processing result for ${result.mutationId}:`,
          error.message
        );
      }
    }
  }

  private async handleSynced(result: MutationResult, mutation: PendingMutation): Promise<void> {
    console.log(
      `${LOG_PREFIX} SYNCED: ${mutation.operationType} / ${mutation.id}`
    );

    // 1. Events use their idempotency key to replace the local placeholder.
    if (mutation.entityType === 'EVENT') {
      await this.reconcileLocalEvents(mutation.idempotencyKey, result.entity);
    } else {
      // 2. Reconcile local ID → server ID if this was a CREATE
      if (result.localId && result.serverId && result.localId !== result.serverId) {
        await this.reconcileLocalId(
          result.localId,
          result.serverId,
          mutation.missionId,
          result.entity
        );
      } else if (result.entity) {
        // 3. Update cached entity with server-authoritative state
        await this.updateCachedEntity(result, mutation);
      }

      // Task local events are linked by the mutation idempotency key.
      await this.reconcileLocalEvents(mutation.idempotencyKey, result.entity);
    }

    // 4. Remove mutation from queue
    await mutationQueueRepository.remove(mutation.id);
  }

  private async handleDuplicate(
    result: MutationResult,
    mutation: PendingMutation
  ): Promise<void> {
    console.log(`${LOG_PREFIX} DUPLICATE: ${mutation.id} — removing from queue`);

    if (mutation.entityType === 'EVENT') {
      await this.reconcileLocalEvents(mutation.idempotencyKey, result.entity);
    } else if (result.serverId && mutation.entityId !== result.serverId) {
      await this.reconcileLocalId(mutation.entityId, result.serverId, mutation.missionId, result.entity);
    } else if (result.entity) {
      await this.updateCachedEntity(result, mutation);
    }

    await mutationQueueRepository.remove(mutation.id);
  }

  private async handleConflict(
    result: MutationResult,
    mutation: PendingMutation
  ): Promise<void> {
    console.log(
      `${LOG_PREFIX} CONFLICT: ${mutation.id} (conflictId=${result.conflict?.conflictId})`
    );

    // Mark mutation as CONFLICT in queue (keep it so user can see it)
    await db.mutationQueue.update(mutation.id, {
      status: 'FAILED' as MutationStatus, // Use FAILED to surface in UI
      errorMessage: `CONFLICT: ${result.conflict?.conflictId || 'unknown'}`,
      lastAttemptAt: new Date().toISOString(),
    });

    // Mark associated task as CONFLICT in IndexedDB
    if (result.entityType === 'TASK' && result.serverId) {
      await db.tasks.update(result.serverId, {
        syncState: 'PENDING', // Will be reconciled on conflict resolution
      });
    }

    // Update sync store with conflict info
    const syncStore = useSyncStore.getState();
    const conflictCount = syncStore.conflictCount + 1;
    syncStore.setConflictCount(conflictCount);
  }

  private async handleFailed(result: MutationResult, mutation: PendingMutation): Promise<void> {
    console.log(
      `${LOG_PREFIX} FAILED: ${mutation.id} (${result.errorCode}): ${result.message}`
    );

    const isRetryable = syncRetry.isRetryableError(result.errorCode);
    const newRetryCount = mutation.retryCount + 1;
    const shouldRetry = isRetryable && syncRetry.shouldRetry(newRetryCount);

    if (shouldRetry) {
      const delay = syncRetry.calculateDelay(newRetryCount);
      console.log(
        `${LOG_PREFIX} Scheduling retry for ${mutation.id} in ${delay}ms (attempt ${newRetryCount})`
      );

      await db.mutationQueue.update(mutation.id, {
        retryCount: newRetryCount,
        lastAttemptAt: new Date().toISOString(),
        errorMessage: result.message,
      });

      // Schedule retry (non-blocking)
      setTimeout(async () => {
        // Reset to PENDING for next sync cycle
        await db.mutationQueue.update(mutation.id, {
          status: 'PENDING' as MutationStatus,
        });
      }, delay);
    } else {
      // Permanently failed — mark and surface to user
      await db.mutationQueue.update(mutation.id, {
        status: 'FAILED' as MutationStatus,
        retryCount: newRetryCount,
        lastAttemptAt: new Date().toISOString(),
        errorMessage: result.message || result.errorCode || 'Operation failed',
      });

      useSyncStore.getState().setFailedCount(useSyncStore.getState().failedCount + 1);
    }
  }

  // ============================================================
  // LOCAL RECONCILIATION
  // ============================================================

  /**
   * Reconcile a local ID (offline-created UUID) with the server ID (MongoDB ObjectId).
   * Updates the task in IndexedDB and removes the old record.
   */
  private async reconcileLocalId(
    localId: string,
    serverId: string,
    _missionId: string,
    serverEntity?: Record<string, unknown>
  ): Promise<void> {
    console.log(`${LOG_PREFIX} Reconciling localId=${localId} → serverId=${serverId}`);

    const existingLocal = await db.tasks.get(localId);
    if (!existingLocal) {
      console.warn(`${LOG_PREFIX} Local task ${localId} not found for reconciliation`);
      return;
    }

    // Build the authoritative record from server data
    const now = new Date().toISOString();
    const reconciledTask: LocalTask = {
      ...existingLocal,
      id: serverId,
      localId,
      serverId,
      syncState: 'SYNCED',
      source: 'SERVER',
      cachedAt: now,
      ...(serverEntity
        ? {
            title: (serverEntity.title as string) || existingLocal.title,
            description: (serverEntity.description as string) ?? existingLocal.description,
            priority: (serverEntity.priority as any) || existingLocal.priority,
            status: (serverEntity.status as any) || existingLocal.status,
            createdAt: (serverEntity.createdAt as string) || existingLocal.createdAt,
            updatedAt: (serverEntity.updatedAt as string) || now,
          }
        : {}),
    };

    // Put the server-ID record and delete the local-ID record
    await db.tasks.put(reconciledTask);
    if (localId !== serverId) {
      await db.tasks.delete(localId);
    }

    // Update any pending mutations that still reference the local ID
    const dependentMutations = await db.mutationQueue
      .where('entityId')
      .equals(localId)
      .toArray();

    for (const dep of dependentMutations) {
      await db.mutationQueue.update(dep.id, {
        entityId: serverId,
        serverId,
      });
    }

    console.log(`${LOG_PREFIX} Reconciled ${localId} → ${serverId} (${dependentMutations.length} dependent mutations updated)`);
  }

  /**
   * Update a cached entity with server-authoritative data after sync.
   */
  private async updateCachedEntity(
    result: MutationResult,
    mutation: PendingMutation
  ): Promise<void> {
    if (result.entityType !== 'TASK' || !result.entity) return;

    const taskId = result.serverId || mutation.entityId;
    const serverEntity = result.entity;

    const now = new Date().toISOString();
    await db.tasks.update(taskId, {
      status: (serverEntity.status as any) || undefined,
      title: (serverEntity.title as string) || undefined,
      description: serverEntity.description !== undefined
        ? (serverEntity.description as string)
        : undefined,
      priority: (serverEntity.priority as any) || undefined,
      assignedToId: this.getAssignedToId(serverEntity),
      assignedToName: this.getAssignedToName(serverEntity),
      updatedAt: (serverEntity.updatedAt as string) || now,
      syncState: 'SYNCED',
      source: 'SERVER',
      cachedAt: now,
      baseUpdatedAt: (serverEntity.updatedAt as string) || now,
    });
  }

  /**
   * Mark local events associated with a mutation as SYNCED.
   */
  private async reconcileLocalEvents(
    idempotencyKey: string,
    serverEntity?: Record<string, unknown>
  ): Promise<void> {
    try {
      const localEvents = await db.missionEvents
        .where('idempotencyKey')
        .equals(idempotencyKey)
        .toArray();

      for (const event of localEvents) {
        if (serverEntity?.eventType) {
          await missionEventRepository.reconcileServerEvent(
            idempotencyKey,
            serverEntity as unknown as MissionEvent
          );
          useMissionEventStore.getState().replaceEvent(
            event.id,
            serverEntity as unknown as MissionEvent
          );
          break;
        } else {
          await db.missionEvents.update(event.id, {
            syncState: 'SYNCED',
            source: 'SERVER',
          });
        }
      }

      if (localEvents.length > 0) {
        console.log(`${LOG_PREFIX} Reconciled ${localEvents.length} local event(s) for key ${idempotencyKey}`);
      }
    } catch (err) {
      // Non-critical — events are display-only
      console.warn(`${LOG_PREFIX} Event reconciliation warning:`, err);
    }
  }

  private getAssignedToId(serverEntity: Record<string, unknown>): string | null {
    const assignedTo = serverEntity.assignedTo;
    if (!assignedTo) return null;
    if (typeof assignedTo === 'string') return assignedTo;
    if (typeof assignedTo === 'object') {
      const record = assignedTo as Record<string, unknown>;
      return String(record.id ?? record._id ?? '');
    }
    return null;
  }

  private getAssignedToName(serverEntity: Record<string, unknown>): string | null {
    const assignedTo = serverEntity.assignedTo;
    if (!assignedTo || typeof assignedTo !== 'object') return null;
    return String((assignedTo as Record<string, unknown>).name ?? '');
  }
}

// Singleton
export const syncEngine = new SyncEngine();
