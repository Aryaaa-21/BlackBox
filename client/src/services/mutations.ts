import { ApiRequestError, forAccount, http, request } from '../api/http';
import {
  cacheTask, createUuid, db, getActiveAccountId, getCachedTask, resolveEntityId,
} from '../db';
import { EventTargetType, MissionEventType, type CreateTaskInput, type MissionEvent, type ObservationInput, type Task, type SyncOperationType } from '../types';
import { connectivity } from './connectivity';
import { enqueueMutation, syncQueuedMutations, type EnqueueMutationInput } from './sync';
import { applyTaskMutation } from './sync-policy';

export interface TaskMutationContext {
  task?: Task;
  actorId?: string;
  offline?: boolean;
}

async function saveMutation(input: EnqueueMutationInput, offline = false) {
  const mutation = await enqueueMutation(input);
  const connection = connectivity.getSnapshot();
  if (!offline && connection.browser !== 'offline' && connection.api !== 'unreachable') {
    // Work is already durable. Transport failures leave the very same record for recovery.
    await syncQueuedMutations().catch(() => undefined);
  }
  const remaining = await db.mutations.get(mutation.mutationId);
  if (await getActiveAccountId() !== mutation.accountId) throw new ApiRequestError({ success: false, code: 'ACCOUNT_CHANGED', message: 'Active account changed while saving' }, 401);
  if (remaining?.status === 'FAILED') {
    throw new ApiRequestError({ success: false, code: remaining.errorCode || 'MUTATION_FAILED', message: remaining.lastError || 'Mutation failed', details: { mutationId: mutation.mutationId } }, 422);
  }
  return mutation;
}

export async function createTaskMutation(missionId: string, input: CreateTaskInput, context: TaskMutationContext = {}): Promise<Task> {
  const actorId = context.actorId || await getActiveAccountId();
  if (!actorId) throw new Error('Sign in before creating a task');
  const now = new Date().toISOString();
  const task: Task = {
    id: `local-${createUuid()}`, missionId, title: input.title, description: input.description || '', priority: input.priority || 'MEDIUM',
    status: 'PENDING', assignedTo: input.assignedTo || null, createdBy: actorId, createdAt: now, updatedAt: now,
  };
  await saveMutation({ missionId, actorId, entityType: 'TASK', entityId: task.id, operationType: 'CREATE_TASK', payload: { ...input }, optimisticEntity: { ...task } }, context.offline);
  return await getCachedTask(task.id, actorId) || task;
}

export async function changeTaskMutation(taskId: string, operationType: SyncOperationType, payload: Record<string, unknown>, context: TaskMutationContext = {}): Promise<Task> {
  const accountId = await getActiveAccountId();
  if (!accountId) throw new Error('Sign in before changing a task');
  let task = await getCachedTask(taskId, accountId) || context.task;
  if (!task) {
    // Existing API callers need not provide context; online callers can prime the task first.
    const id = await resolveEntityId('TASK', taskId, accountId);
    task = (await request<{ task: Task }>(http.get(`/tasks/${id}`, forAccount(accountId)))).task;
    await cacheTask(task, accountId);
  }
  const canonicalId = await resolveEntityId('TASK', taskId, accountId);
  const serverBase = await db.tasks.get(canonicalId);
  const clientCreatedAt = new Date().toISOString();
  const projected = applyTaskMutation({ ...task, id: canonicalId }, { operationType, payload, clientCreatedAt });
  await saveMutation({
    missionId: typeof task.missionId === 'string' ? task.missionId : task.missionId.id,
    actorId: context.actorId || accountId, entityType: 'TASK', entityId: taskId, operationType, payload,
    // A form's rendered version is its concurrency base, even if realtime has
    // since refreshed the cache. Queued predecessors are rebased only on acknowledgement.
    baseUpdatedAt: context.task?.updatedAt || (serverBase?.accountId === accountId ? serverBase.updatedAt : task.updatedAt),
    baseVersion: context.task?.version ?? (serverBase?.accountId === accountId ? serverBase.version : task.version),
    clientCreatedAt,
    optimisticEntity: { ...projected },
  }, context.offline);
  return await getCachedTask(taskId, accountId) || task;
}

export async function recordObservationMutation(missionId: string, input: ObservationInput, offline = false): Promise<MissionEvent> {
  const actorId = await getActiveAccountId();
  if (!actorId) throw new Error('Sign in before recording an observation');
  const previous = input.idempotencyKey ? await db.events.where('idempotencyKey').equals(input.idempotencyKey).filter((event) => event.accountId === actorId).first() : undefined;
  if (previous && (previous.missionId !== missionId || previous.payload.text !== input.text)) throw new Error('An observation key cannot be reused for different work');
  if (previous && previous.source !== 'LOCAL') return previous;
  const now = new Date().toISOString();
  const event: MissionEvent = previous || {
    id: `local-${createUuid()}`, missionId, actorId, eventType: MissionEventType.OBSERVATION_RECORDED,
    targetType: EventTargetType.OBSERVATION, targetId: null, payload: { text: input.text }, source: 'LOCAL',
    clientCreatedAt: input.clientCreatedAt || now, idempotencyKey: input.idempotencyKey || createUuid(), createdAt: now, updatedAt: now,
  };
  const mutation = await saveMutation({ missionId, actorId, entityType: 'EVENT', entityId: event.id, operationType: 'RECORD_OBSERVATION', payload: event.payload, idempotencyKey: event.idempotencyKey!, clientCreatedAt: event.clientCreatedAt!, optimisticEntity: { ...event } }, offline);
  const id = await resolveEntityId('EVENT', mutation.entityId, actorId);
  const cached = await db.events.get(id);
  return cached?.accountId === actorId ? cached : event;
}
