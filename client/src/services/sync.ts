import { syncApi } from '../api/sync';
import {
  cacheConflict, cacheEntity, createUuid, db, deleteCachedEntity, getAccountMutations, getActiveAccountId,
  getCachedConflict, getDeviceId, getIdMappings, preferCachedEntity, type QueuedMutation,
} from '../db';
import type {
  ConflictResolutionInput, SyncConflict, SyncEntityType, SyncMutationResult, SyncOperationType, SyncSummary,
} from '../types';
import { isRetryableFailure, isRetryableResult, mappedEntityId, mutationForTransport, recoverInterruptedMutation, retryDelayMs, selectMutationBatch, stablePayload } from './sync-policy';
import { authoritativeVersion, preferAuthoritative } from './authority';

export interface EnqueueMutationInput {
  missionId: string;
  operationType: SyncOperationType;
  entityType: SyncEntityType;
  entityId: string;
  payload: Record<string, unknown>;
  actorId: string;
  baseUpdatedAt?: string;
  baseVersion?: number;
  clientCreatedAt?: string;
  mutationId?: string;
  idempotencyKey?: string;
  deviceId?: string;
  /** Persist the optimistic entity in the same transaction as its mutation. */
  optimisticEntity?: Record<string, unknown>;
}

export async function enqueueMutation(input: EnqueueMutationInput): Promise<QueuedMutation> {
  const accountId = await requireAccount();
  if (input.actorId !== accountId) throw new Error('Mutation actor does not match the active account');
  const deviceId = input.deviceId || await getDeviceId();
  const createdAt = new Date().toISOString();
  return db.transaction('rw', [db.mutations, db.metadata, db.idMappings, db.tasks, db.events, db.missions, db.members], async () => {
    const byId = input.mutationId ? await db.mutations.get(input.mutationId) : undefined;
    const byKey = input.idempotencyKey ? await db.mutations.where('idempotencyKey').equals(input.idempotencyKey).first() : undefined;
    if (byId && byKey && byId.mutationId !== byKey.mutationId) throw new Error('Mutation identity is already in use');
    const existing = byId || byKey;
    if (existing) {
      if (existing.accountId !== accountId) throw new Error('Mutation belongs to another account');
      if (existing.missionId !== input.missionId || existing.operationType !== input.operationType || existing.entityType !== input.entityType || existing.entityId !== input.entityId || stablePayload(existing.payload) !== stablePayload(input.payload) || (input.baseVersion !== undefined && existing.baseVersion !== input.baseVersion) || (input.idempotencyKey && existing.idempotencyKey !== input.idempotencyKey) || (input.mutationId && existing.mutationId !== input.mutationId) || (input.deviceId && existing.deviceId !== input.deviceId)) {
        throw new Error('A mutation identity cannot be reused for different work');
      }
      return existing;
    }
    const queueOrder = Number((await db.metadata.get('queueSequence'))?.value || 0) + 1;
    const mappings = await getIdMappings(accountId);
    const canonicalId = mappedEntityId(input.entityType, input.entityId, mappings);
    const predecessor = (await getAccountMutations(accountId)).filter((mutation) => mutation.entityType === input.entityType && mappedEntityId(mutation.entityType, mutation.entityId, mappings) === canonicalId).at(-1);
    const { optimisticEntity, ...fields } = input;
    const authoritative = input.entityType === 'TASK' ? await db.tasks.get(canonicalId) : input.entityType === 'MISSION' ? await db.missions.get(canonicalId) : input.entityType === 'MEMBER' ? await db.members.get(canonicalId) : undefined;
    const mutation: QueuedMutation = {
      ...fields, accountId, mutationId: input.mutationId || createUuid(), idempotencyKey: input.idempotencyKey || createUuid(),
      ...(input.baseVersion === undefined && authoritative?.accountId === accountId && authoritative.version !== undefined ? { baseVersion: authoritative.version } : {}),
      deviceId, createdAt, clientCreatedAt: input.clientCreatedAt || createdAt, queueOrder,
      dependsOnMutationId: predecessor?.mutationId, status: 'PENDING', attempts: 0,
    };
    await db.metadata.put({ key: 'queueSequence', value: String(queueOrder) });
    await db.mutations.add(mutation);
    if (optimisticEntity) await cacheEntity(input.entityType, { ...optimisticEntity, ...(input.entityType === 'TASK' ? { localPending: true } : input.entityType === 'EVENT' ? { source: 'LOCAL' } : {}) }, accountId);
    return mutation;
  });
}

export async function retryMutation(mutationId: string): Promise<void> {
  const accountId = await requireAccount();
  await db.transaction('rw', db.mutations, async () => {
    const mutation = await db.mutations.get(mutationId);
    if (mutation?.accountId === accountId && mutation.status === 'FAILED') {
      // The attempted wire body and all identity fields deliberately survive retry.
      await db.mutations.update(mutationId, { status: 'PENDING', lastError: undefined, errorCode: undefined, nextAttemptAt: undefined });
    }
  });
}

export async function discardMutation(mutationId: string): Promise<void> {
  const accountId = await requireAccount();
  await db.transaction('rw', db.mutations, db.tasks, db.events, async () => {
    const mutation = await db.mutations.get(mutationId);
    if (mutation?.accountId !== accountId || mutation.status === 'SYNCING' || mutation.status === 'CONFLICT') return;
    await db.mutations.delete(mutationId);
    if (mutation.operationType === 'CREATE_TASK' || mutation.operationType === 'RECORD_OBSERVATION') {
      await deleteCachedEntity(mutation.entityType, mutation.entityId);
      for (const dependent of await getAccountMutations(accountId)) {
        if (dependent.entityId === mutation.entityId && dependent.entityType === mutation.entityType) {
          await db.mutations.update(dependent.mutationId, { status: 'FAILED', retryable: false, errorCode: 'DEPENDENCY_DISCARDED', lastError: 'The local creation this change depends on was discarded' });
        }
      }
    }
  });
}

const SYNC_BATCH_SIZE = 20;
const LEASE_MS = 60_000;
const syncInFlight = new Map<string, Promise<SyncSummary | undefined>>();

export async function syncQueuedMutations(): Promise<SyncSummary | undefined> {
  const accountId = await getActiveAccountId();
  if (!accountId) return undefined;
  let run = syncInFlight.get(accountId);
  if (!run) {
    run = drainQueuedMutations(accountId).finally(() => { syncInFlight.delete(accountId); });
    syncInFlight.set(accountId, run);
  }
  return run;
}

async function drainQueuedMutations(accountId: string): Promise<SyncSummary | undefined> {
  // An IndexedDB lease also serializes tabs. A crashed owner expires without losing SYNCING entries.
  const owner = createUuid();
  if (!await acquireLease(owner)) return undefined;
  const heartbeat = setInterval(() => { void renewLease(owner).catch(() => undefined); }, LEASE_MS / 3);
  const aggregate: SyncSummary = { synced: 0, conflicts: 0, failed: 0, duplicates: 0, remaining: 0, results: [] };
  try {
    await db.transaction('rw', db.mutations, db.metadata, async () => {
      const queue = await getAccountMutations(accountId);
      for (const mutation of queue.filter((entry) => entry.status === 'SYNCING')) {
        await db.mutations.put(recoverInterruptedMutation(mutation));
      }
      await db.metadata.put({ key: `sync:${accountId}:startedAt`, value: new Date().toISOString() });
    });
    while (await getActiveAccountId() === accountId) {
      const [queue, mappings] = await Promise.all([getAccountMutations(accountId), getIdMappings(accountId)]);
      let batch = selectMutationBatch(queue, mappings, Date.now(), SYNC_BATCH_SIZE);
      if (!batch.length) break;
      if (!await renewLease(owner)) break;
      const attemptedAt = new Date().toISOString();
      await db.transaction('rw', db.mutations, async () => {
        const claimed: QueuedMutation[] = [];
        for (const selected of batch) {
          // Retry/discard can run between selection and claiming. Never resurrect
          // a discarded entry or overwrite a state transition from another action.
          const mutation = await db.mutations.get(selected.mutationId);
          if (!mutation || mutation.accountId !== accountId || mutation.status !== 'PENDING') continue;
          mutation.wireMutation = mutationForTransport(mutation, mappings);
          mutation.attempts += 1;
          mutation.lastAttemptAt = attemptedAt;
          mutation.status = 'SYNCING';
          await db.mutations.put(mutation);
          claimed.push(mutation);
        }
        batch = claimed;
      });
      if (!batch.length) continue;

      let summary: SyncSummary;
      try {
        summary = await syncApi.submit(batch.map((mutation) => mutation.wireMutation!), accountId);
        if (!summary || !Array.isArray(summary.results)) throw incompleteResponse();
      } catch (error) {
        if (!await renewLease(owner)) return undefined;
        const status = (error as { status?: number })?.status;
        const canRetry = isRetryableFailure(error) || (!status && (error as { code?: string })?.code === 'INCOMPLETE_SYNC_RESPONSE');
        await db.transaction('rw', db.mutations, db.metadata, async () => {
          for (const mutation of batch) {
            const retryable = canRetry && mutation.attempts < 8;
            await db.mutations.update(mutation.mutationId, {
              status: retryable ? 'PENDING' : 'FAILED', retryable,
              nextAttemptAt: retryable ? new Date(Date.now() + retryDelayMs(mutation.attempts)).toISOString() : undefined,
              lastError: error instanceof Error ? error.message : 'Sync request failed',
              errorCode: (error as { code?: string })?.code,
            });
          }
          await db.metadata.put({ key: `sync:${accountId}:lastError`, value: error instanceof Error ? error.message : 'Sync request failed' });
        });
        throw error;
      }

      // A suspended tab may have lost its lease while awaiting the response.
      // Its successor owns recovery; the old tab must not overwrite newer acknowledgements.
      if (!await renewLease(owner)) return undefined;

      let partial = false;
      for (const mutation of batch) {
        const matches = summary.results.filter((result) => result.mutationId === mutation.mutationId && result.idempotencyKey === mutation.idempotencyKey);
        const result = matches.length === 1 ? matches[0] : undefined;
        if (!result || !['SYNCED', 'DUPLICATE', 'CONFLICT', 'FAILED'].includes(result.status)) {
          partial = true;
          await db.mutations.update(mutation.mutationId, { status: mutation.attempts < 8 ? 'PENDING' : 'FAILED', retryable: mutation.attempts < 8, nextAttemptAt: new Date(Date.now() + retryDelayMs(mutation.attempts)).toISOString(), lastError: 'Incomplete sync response' });
          continue;
        }
        if (!await applyMutationResult(mutation, result, accountId)) { partial = true; continue; }
        aggregate.results.push(result);
        if (result.status === 'SYNCED') aggregate.synced++;
        if (result.status === 'DUPLICATE') aggregate.duplicates++;
        if (result.status === 'CONFLICT') aggregate.conflicts++;
        if (result.status === 'FAILED') aggregate.failed++;
      }
      if (partial) throw incompleteResponse();
      await db.metadata.put({ key: `sync:${accountId}:lastSuccessAt`, value: new Date().toISOString() });
      await db.metadata.delete(`sync:${accountId}:lastError`);
    }
    aggregate.remaining = (await getAccountMutations(accountId)).length;
    return aggregate.results.length ? aggregate : undefined;
  } finally {
    clearInterval(heartbeat);
    await db.transaction('rw', db.metadata, async () => {
      if ((await readLease())?.owner === owner) await db.metadata.delete('syncLease');
    });
  }
}

async function applyMutationResult(mutation: QueuedMutation, result: SyncMutationResult, accountId: string): Promise<boolean> {
  return db.transaction('rw', [db.mutations, db.idMappings, db.tasks, db.events, db.members, db.missions, db.conflicts], async () => {
    if (result.status === 'SYNCED' || result.status === 'DUPLICATE') {
      const serverId = result.serverId || (typeof result.entity?.id === 'string' ? result.entity.id : undefined);
      if (!serverId || typeof result.entity?.id !== 'string' || result.entity.id !== serverId || (result.entityType && result.entityType !== mutation.entityType)) {
        await db.mutations.update(mutation.mutationId, { status: mutation.attempts < 8 ? 'PENDING' : 'FAILED', retryable: mutation.attempts < 8, nextAttemptAt: new Date(Date.now() + retryDelayMs(mutation.attempts)).toISOString(), lastError: 'Sync acknowledgement is missing the authoritative entity' });
        return false;
      }
      if (serverId && mutation.entityId !== serverId) {
        await db.idMappings.put({ accountId, entityType: mutation.entityType, localId: mutation.entityId, serverId, mutationId: mutation.mutationId, updatedAt: new Date().toISOString() });
        await deleteCachedEntity(mutation.entityType, mutation.entityId);
      }
      if (result.entity) await cacheEntity(mutation.entityType, result.entity, accountId);
      await rebaseDependents(mutation.mutationId, result.acknowledgedBase || result.entity, accountId);
      // Mapping, cache replacement, dependency acknowledgement and queue deletion commit together.
      await db.mutations.delete(mutation.mutationId);
    } else if (result.status === 'CONFLICT') {
      if (!result.conflict?.conflictId) {
        await db.mutations.update(mutation.mutationId, { status: mutation.attempts < 8 ? 'PENDING' : 'FAILED', retryable: mutation.attempts < 8, nextAttemptAt: new Date(Date.now() + retryDelayMs(mutation.attempts)).toISOString(), lastError: 'Sync response is missing conflict details' });
        return false;
      }
      await db.mutations.update(mutation.mutationId, { status: 'CONFLICT', retryable: false, nextAttemptAt: undefined, lastError: result.message || 'Conflict requires resolution' });
      if (result.conflict?.conflictId) {
        const now = new Date().toISOString();
        await cacheConflict({
          id: result.conflict.conflictId, mutationId: mutation.mutationId, idempotencyKey: mutation.idempotencyKey,
          missionId: mutation.missionId, entityType: mutation.entityType, entityId: result.serverId || mutation.entityId,
          operationType: mutation.operationType, actorId: mutation.actorId, deviceId: mutation.deviceId,
          localState: result.conflict.localState, serverState: result.conflict.serverState, status: 'OPEN',
          detectedAt: now, createdAt: now, updatedAt: now,
        }, accountId);
      }
    } else {
      const retryable = isRetryableResult(result.errorCode) && mutation.attempts < 8;
      await db.mutations.update(mutation.mutationId, {
        status: retryable ? 'PENDING' : 'FAILED', retryable, errorCode: result.errorCode,
        nextAttemptAt: retryable ? new Date(Date.now() + retryDelayMs(mutation.attempts)).toISOString() : undefined,
        lastError: result.message || result.errorCode || 'Mutation failed',
      });
    }
    return true;
  });
}

async function rebaseDependents(mutationId: string, entity: Record<string, unknown> | undefined, accountId: string): Promise<void> {
  if (!entity) return;
  for (const dependent of await getAccountMutations(accountId)) {
    if (dependent.dependsOnMutationId === mutationId && !dependent.wireMutation && dependent.attempts === 0) {
      await db.mutations.update(dependent.mutationId, {
        ...(typeof entity.updatedAt === 'string' ? { baseUpdatedAt: entity.updatedAt } : {}),
        ...(typeof entity.version === 'number' ? { baseVersion: entity.version } : {}),
      });
    }
  }
}

export async function refreshConflicts(missionId: string): Promise<SyncConflict[]> {
  const accountId = await requireAccount();
  const conflicts = await syncApi.conflicts(missionId, accountId);
  const cached = await db.conflicts.where('missionId').equals(missionId).filter((conflict) => conflict.accountId === accountId && conflict.status === 'OPEN').toArray();
  const serverIds = new Set(conflicts.map((conflict) => conflict.id));
  for (const previous of cached.filter((conflict) => !serverIds.has(conflict.id))) {
    try {
      const authoritative = await syncApi.conflict(previous.id, accountId);
      if (authoritative.status === 'OPEN') conflicts.push(authoritative);
      else await reconcileResolution(authoritative, authoritative.resolvedEntityState || undefined, accountId);
    } catch (error) {
      // Absence from the open list alone is not an acknowledgement of resolution.
      if ((error as { status?: number })?.status === 404) {
        await db.transaction('rw', db.conflicts, db.mutations, async () => {
          await cacheConflict({ ...previous, status: 'DISCARDED' }, accountId);
          const mutation = await db.mutations.get(previous.mutationId);
          if (mutation?.accountId === accountId) await db.mutations.update(mutation.mutationId, { status: 'FAILED', retryable: false, errorCode: 'CONFLICT_NOT_FOUND', lastError: 'Server conflict no longer exists; review before retrying' });
        });
      } else if (isRetryableFailure(error)) conflicts.push(previous);
      else throw error;
    }
  }
  await db.transaction('rw', db.conflicts, async () => {
    for (let index = 0; index < conflicts.length; index++) conflicts[index] = await cacheConflict(conflicts[index], accountId);
  });
  return await getActiveAccountId() === accountId ? conflicts.filter((conflict) => conflict.status === 'OPEN') : [];
}

export async function resolveQueuedConflict(conflictId: string, input: ConflictResolutionInput) {
  const accountId = await requireAccount();
  const result = await syncApi.resolve(conflictId, input, accountId);
  await reconcileResolution(result.conflict, result.entity, accountId);
  return result;
}

export async function reconcileConflictResolved(input: {
  conflictId: string;
  resolution: ConflictResolutionInput['resolution'];
  entityType: string;
  entityId: string;
  entity?: Record<string, unknown>;
  version?: number;
}): Promise<SyncConflict | undefined> {
  const accountId = await requireAccount();
  let conflict = await getCachedConflict(input.conflictId);
  try { conflict = await syncApi.conflict(input.conflictId, accountId); }
  catch (error) {
    if (!isRetryableFailure(error)) throw error;
    // A versionless delayed socket receipt is not permission to overwrite a
    // versioned conflict or release its blocked mutations. Await a server read.
    if (conflict && ((input.version !== undefined && (authoritativeVersion(conflict) ?? -1) < input.version) || (input.version === undefined && authoritativeVersion(conflict) === undefined))) {
      conflict = { ...conflict, ...(input.version !== undefined ? { version: input.version } : {}), status: 'RESOLVED', resolution: input.resolution, resolvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    }
  }
  if (conflict) await reconcileResolution(conflict, input.entity, accountId);
  else if (input.entity) await cacheEntity(input.entityType as SyncEntityType, input.entity, accountId);
  return conflict;
}

async function reconcileResolution(conflict: SyncConflict, entity: Record<string, unknown> | undefined, accountId: string): Promise<void> {
  await db.transaction('rw', [db.conflicts, db.mutations, db.tasks, db.events, db.members, db.missions], async () => {
    conflict = await cacheConflict(conflict, accountId);
    const acknowledgedEntity = conflict.resolvedEntityState || entity || conflict.serverState;
    const snapshot = conflict.resolvedEntityState;
    if (snapshot && typeof snapshot.id === 'string') {
      entity = entity && typeof entity.id === 'string' ? preferAuthoritative(entity as { id: string; version?: number }, snapshot as { id: string; version?: number }) : snapshot;
    }
    if (entity) {
      await cacheEntity(conflict.entityType as SyncEntityType, entity, accountId);
      entity = await preferCachedEntity(conflict.entityType as SyncEntityType, entity, accountId);
    }
    const mutation = await db.mutations.get(conflict.mutationId);
    if (mutation?.accountId === accountId && conflict.status !== 'OPEN') {
      await rebaseDependents(mutation.mutationId, acknowledgedEntity, accountId);
      await db.mutations.delete(mutation.mutationId);
    }
  });
}

async function requireAccount(): Promise<string> {
  const accountId = await getActiveAccountId();
  if (!accountId) throw new Error('Sign in before changing cached operations');
  return accountId;
}

function incompleteResponse(): Error & { code: string } {
  return Object.assign(new Error('Sync response did not include every submitted mutation'), { code: 'INCOMPLETE_SYNC_RESPONSE' });
}

async function readLease(): Promise<{ owner: string; expiresAt: number } | undefined> {
  const record = await db.metadata.get('syncLease');
  try { return record ? JSON.parse(record.value) : undefined; } catch { return undefined; }
}

async function acquireLease(owner: string): Promise<boolean> {
  return db.transaction('rw', db.metadata, async () => {
    const lease = await readLease();
    if (lease && lease.expiresAt > Date.now()) return false;
    await db.metadata.put({ key: 'syncLease', value: JSON.stringify({ owner, expiresAt: Date.now() + LEASE_MS }) });
    return true;
  });
}

async function renewLease(owner: string): Promise<boolean> {
  return db.transaction('rw', db.metadata, async () => {
    if ((await readLease())?.owner !== owner) return false;
    await db.metadata.put({ key: 'syncLease', value: JSON.stringify({ owner, expiresAt: Date.now() + LEASE_MS }) });
    return true;
  });
}
