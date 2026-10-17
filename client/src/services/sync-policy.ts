import type { QueuedMutation, EntityIdMapping, MutationQueueStatus } from '../db';
import type { SyncMutation, Task } from '../types';

/** Retrying a write is separate from permission to show a stale cached read. */
export function isRetryableFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { status, code } = error as { status?: number; code?: string };
  if (status) return status === 408 || status === 425 || status === 429 || status >= 500;
  return ['NETWORK_ERROR', 'ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK', 'INCOMPLETE_SYNC_RESPONSE'].includes(code || '');
}

export function canUseOfflineCache(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { status, code } = error as { status?: number; code?: string };
  return status === undefined && ['NETWORK_ERROR', 'ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'].includes(code || '');
}

export function isRetryableResult(code?: string): boolean {
  return ['SERVER_ERROR', 'INTERNAL_ERROR', 'INTERNAL_SERVER_ERROR', 'NETWORK_ERROR', 'TIMEOUT', 'RATE_LIMITED', 'SERVICE_UNAVAILABLE', 'UNRESOLVED_LOCAL_ID'].includes(code || '');
}

export function retryDelayMs(attempts: number): number {
  return Math.min(60_000, 1_000 * 2 ** Math.min(Math.max(attempts - 1, 0), 6));
}

export function recoverInterruptedMutation(mutation: QueuedMutation): QueuedMutation {
  return mutation.status === 'SYNCING' ? { ...mutation, status: 'PENDING', nextAttemptAt: undefined, lastError: 'Recovering interrupted sync' } : mutation;
}

/** Successful/explicitly discarded entries leave the active queue atomically. */
export function assertQueueTransition(from: MutationQueueStatus, to: MutationQueueStatus): void {
  const allowed: Record<MutationQueueStatus, MutationQueueStatus[]> = {
    PENDING: ['SYNCING', 'FAILED'],
    SYNCING: ['PENDING', 'FAILED', 'CONFLICT'],
    FAILED: ['PENDING'],
    CONFLICT: ['FAILED'], // server conflict disappeared: manual review, never automatic replay
  };
  if (from !== to && !allowed[from]?.includes(to)) throw new Error(`Invalid queue transition ${from} -> ${to}`);
}

export function stablePayload(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stablePayload).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stablePayload(item)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

export function compareQueuedMutations(a: QueuedMutation, b: QueuedMutation): number {
  if (a.queueOrder !== undefined && b.queueOrder !== undefined) return a.queueOrder - b.queueOrder;
  if (a.entityType === b.entityType && a.entityId === b.entityId && a.entityId.startsWith('local-')) {
    if (a.operationType === 'CREATE_TASK' && b.operationType !== 'CREATE_TASK') return -1;
    if (b.operationType === 'CREATE_TASK' && a.operationType !== 'CREATE_TASK') return 1;
  }
  return a.createdAt.localeCompare(b.createdAt) || a.mutationId.localeCompare(b.mutationId);
}

export function mappedEntityId(entityType: string, entityId: string, mappings: EntityIdMapping[]): string {
  return mappings.find((mapping) => mapping.entityType === entityType && mapping.localId === entityId)?.serverId || entityId;
}

/** One ready entry per entity: failed/conflicted/delayed predecessors block only their own chain. */
export function selectMutationBatch(queue: QueuedMutation[], mappings: EntityIdMapping[], now: number, limit = 20): QueuedMutation[] {
  const seen = new Set<string>();
  const ready: QueuedMutation[] = [];
  for (const mutation of [...queue].sort(compareQueuedMutations)) {
    const entityId = mappedEntityId(mutation.entityType, mutation.entityId, mappings);
    const key = `${mutation.entityType}:${entityId}`;
    if (seen.has(key)) continue;
    if (mutation.dependsOnMutationId && queue.some((entry) => entry.mutationId === mutation.dependsOnMutationId)) continue;
    seen.add(key);
    if (mutation.status !== 'PENDING' || (mutation.nextAttemptAt && Date.parse(mutation.nextAttemptAt) > now)) continue;
    if (mutation.entityType === 'TASK' && mutation.operationType !== 'CREATE_TASK' && entityId.startsWith('local-')) continue;
    ready.push(mutation);
    if (ready.length >= limit) break;
  }
  return ready;
}

/** The wire snapshot is persisted before sending, and must never change on a retry. */
export function mutationForTransport(mutation: QueuedMutation, mappings: EntityIdMapping[]): SyncMutation {
  if (mutation.wireMutation) return mutation.wireMutation;
  return {
    mutationId: mutation.mutationId, idempotencyKey: mutation.idempotencyKey, deviceId: mutation.deviceId,
    missionId: mutation.missionId, operationType: mutation.operationType, entityType: mutation.entityType,
    entityId: mappedEntityId(mutation.entityType, mutation.entityId, mappings), payload: mutation.payload,
    actorId: mutation.actorId, createdAt: mutation.createdAt, clientCreatedAt: mutation.clientCreatedAt,
    ...(mutation.baseUpdatedAt ? { baseUpdatedAt: mutation.baseUpdatedAt } : {}),
    ...(mutation.baseVersion !== undefined ? { baseVersion: mutation.baseVersion } : {}),
  };
}

export function applyTaskMutation(task: Task, mutation: Pick<QueuedMutation, 'operationType' | 'payload' | 'clientCreatedAt'>): Task {
  const { payload, operationType, clientCreatedAt } = mutation;
  const updated = { ...task, updatedAt: clientCreatedAt };
  if (operationType === 'UPDATE_TASK') {
    if (typeof payload.title === 'string') updated.title = payload.title;
    if (typeof payload.description === 'string') updated.description = payload.description;
    if (typeof payload.priority === 'string') updated.priority = payload.priority as Task['priority'];
  }
  if (operationType === 'ASSIGN_TASK') updated.assignedTo = payload.userId as string;
  if (operationType === 'UNASSIGN_TASK') updated.assignedTo = null;
  if (operationType === 'UPDATE_TASK_STATUS') {
    updated.status = payload.status as Task['status'];
    if (payload.status === 'ACTIVE') updated.startedAt = task.startedAt || clientCreatedAt;
    if (payload.status === 'BLOCKED') updated.blockedAt = clientCreatedAt;
    if (payload.status === 'COMPLETED') updated.completedAt = clientCreatedAt;
  }
  return updated;
}
