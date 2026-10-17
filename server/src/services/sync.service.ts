/**
 * Phase 7 — Synchronization Engine
 * Sync Service — processes batched offline mutations from clients.
 *
 * Architecture:
 *   POST /api/v1/sync → SyncController → SyncService → TaskService/etc
 *
 * Rules:
 * - Processes mutations oldest-first (deterministic ordering)
 * - Replays durable receipts and serializes same-key requests in this process
 * - Detects conflicts using baseVersion, with legacy baseUpdatedAt compatibility
 * - Does NOT fail the entire batch if one mutation fails
 * - Returns structured per-mutation results
 * - Creates MissionEvent for every successful mutation
 * - Commits entity, event and receipt atomically; broadcasts only after commit
 */

import mongoose from 'mongoose';
import { config } from '../config/env';
import { Task } from '../models/Task';
import { Mission } from '../models/Mission';
import { MissionMember } from '../models/MissionMember';
import { SyncConflict } from '../models/SyncConflict';
import { AppError } from '../middleware/error.middleware';
import { idempotencyService, IdempotencyIdentity, mutationFingerprint } from './idempotency.service';
import { conflictService } from './conflict.service';
import { missionEventService } from './missionEvent.service';
import { taskService } from './task.service';
import {
  UserPayload,
  MissionEventType,
  EventTargetType,
  EventSource,
} from '../types';
import {
  assignTaskSchema,
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from '../validators/task.validator';
import { recordObservationSchema } from '../validators/observation.validator';
import { withUnitOfWork } from './unitOfWork';

// ============================================================
// TYPES
// ============================================================

export type SyncResultStatus = 'SYNCED' | 'CONFLICT' | 'FAILED' | 'DUPLICATE';

export interface IncomingMutation {
  mutationId: string;
  missionId: string;
  operationType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  actorId: string;
  deviceId: string;
  clientCreatedAt: string;
  createdAt: string;
  idempotencyKey: string;
  baseUpdatedAt?: string;
  baseVersion?: number;
}

export interface MutationResult {
  mutationId: string;
  idempotencyKey: string;
  status: SyncResultStatus;
  entityType?: string;
  localId?: string;
  serverId?: string;
  entity?: Record<string, unknown>;
  conflict?: {
    conflictId: string;
    localState: Record<string, unknown>;
    serverState: Record<string, unknown>;
  };
  errorCode?: string;
  message?: string;
}

export interface SyncSummary {
  synced: number;
  conflicts: number;
  failed: number;
  duplicates: number;
  remaining: number;
  results: MutationResult[];
}

const MAX_BATCH_SIZE = 20;
class FailedMutation extends Error {
  constructor(readonly result: MutationResult) { super(result.message); }
}

export class SyncService {
  private readonly inFlightMutations = new Map<string, {
    fingerprint: string;
    result: Promise<MutationResult>;
  }>();
  /**
   * Process a batch of pending mutations from a client.
   * Mutations are sorted oldest-first before processing.
   * Each mutation is processed independently — one failure does not block others
   * UNLESS there is a dependency (e.g. ASSIGN_TASK after offline CREATE_TASK).
   */
  async syncMutations(
    mutations: IncomingMutation[],
    user: UserPayload
  ): Promise<SyncSummary> {
    // Enforce batch size limit
    const batch = mutations.slice(0, MAX_BATCH_SIZE);

    // Sort oldest-first (deterministic ordering)
    batch.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    console.log(`[SyncService] Starting sync: ${batch.length} mutations for user ${user.id}`);

    const results: MutationResult[] = [];
    // localId → serverId mapping, built as we process CREATE operations
    const idMap = new Map<string, string>();

    for (const mutation of batch) {
      if (!config.isProduction) console.debug(`[SyncService] mutation=${mutation.mutationId} operation=${mutation.operationType} entity=${mutation.entityId} state=PROCESSING`);

      try {
        const result = await this.runSerialized(mutation, user, idMap);
        results.push(result);

        // A replayed CREATE is just as useful as a fresh CREATE for dependents.
        if ((result.status === 'SYNCED' || result.status === 'DUPLICATE') &&
          result.localId && result.serverId) {
          idMap.set(this.localMapKey(mutation, result.localId), result.serverId);
          idMap.set(this.localMapKey(mutation, mutation.entityId), result.serverId);
        }
      } catch (err: unknown) {
        const error = err as Error;
        console.error(`[SyncService] Unexpected error on mutation ${mutation.mutationId}:`, error.message);
        results.push(this.errorToResult(mutation, error));
      }
    }

    const summary: SyncSummary = {
      synced: results.filter((r) => r.status === 'SYNCED').length,
      conflicts: results.filter((r) => r.status === 'CONFLICT').length,
      failed: results.filter((r) => r.status === 'FAILED').length,
      duplicates: results.filter((r) => r.status === 'DUPLICATE').length,
      remaining: Math.max(0, mutations.length - MAX_BATCH_SIZE),
      results,
    };

    console.log(
      `[SyncService] Sync complete: synced=${summary.synced} conflicts=${summary.conflicts} failed=${summary.failed} duplicates=${summary.duplicates}`
    );

    return summary;
  }

  private async runSerialized(
    mutation: IncomingMutation,
    user: UserPayload,
    idMap: Map<string, string>
  ): Promise<MutationResult> {
    if (mutation.actorId !== user.id) {
      throw new AppError('Authenticated user does not match mutation actor', 400, 'ACTOR_MISMATCH');
    }
    // A retained receipt is not permission to read protected data after removal.
    if (!await this.checkMissionAccess(mutation.missionId, user)) {
      throw new AppError('You no longer have access to this mission', 403, 'MISSION_ACCESS_DENIED');
    }

    const identity = this.mutationIdentity(mutation, user);
    const fingerprint = mutationFingerprint(identity);
    const existingRun = this.inFlightMutations.get(mutation.idempotencyKey);
    if (existingRun) {
      const previous = await existingRun.result;
      // Waiting is not proof this was the same request. Validate both the
      // in-flight identity and the durable receipt before replaying anything.
      if (existingRun.fingerprint !== fingerprint) {
        throw new AppError('Idempotency key was already used for a different mutation', 409, 'IDEMPOTENCY_KEY_REUSED');
      }
      await idempotencyService.checkIdempotency(mutation.idempotencyKey, identity);
      return {
        ...previous,
        mutationId: mutation.mutationId,
        status: previous.status === 'SYNCED' ? 'DUPLICATE' : previous.status,
      };
    }

    const run = {
      fingerprint,
      result: withUnitOfWork(async () => {
        const result = await this.processMutation(mutation, user, idMap);
        // FAILED is a transport result, never permission to commit earlier writes.
        if (result.status === 'FAILED') throw new FailedMutation(result);
        return result;
      })
        .catch((error: Error) => this.errorToResult(mutation, error)),
    };
    this.inFlightMutations.set(mutation.idempotencyKey, run);
    try {
      return await run.result;
    } finally {
      this.inFlightMutations.delete(mutation.idempotencyKey);
    }
  }

  /**
   * Process a single mutation.
   */
  private async processMutation(
    mutation: IncomingMutation,
    user: UserPayload,
    idMap: Map<string, string>
  ): Promise<MutationResult> {
    // 1. Idempotency check — has this been processed before?
    const existing = await idempotencyService.checkIdempotency(
      mutation.idempotencyKey,
      this.mutationIdentity(mutation, user)
    );
    if (existing) {
      if (existing.outcome === 'CONFLICT') {
        return {
          mutationId: mutation.mutationId, idempotencyKey: mutation.idempotencyKey, status: 'CONFLICT',
          entityType: existing.entityType, localId: existing.localId || mutation.entityId,
          serverId: existing.serverId || undefined,
          conflict: existing.result as unknown as NonNullable<MutationResult['conflict']>,
        };
      }
      if (!config.isProduction) console.debug(`[SyncService] mutation=${mutation.mutationId} state=DUPLICATE`);
      return {
        mutationId: mutation.mutationId,
        idempotencyKey: mutation.idempotencyKey,
        status: 'DUPLICATE',
        entityType: existing.entityType,
        localId: existing.localId || undefined,
        serverId: existing.serverId || undefined,
        entity: existing.result,
        message: existing.fingerprint
          ? 'Mutation was already processed'
          : 'Mutation was already processed (legacy receipt: original payload cannot be verified)',
      };
    }

    const priorConflict = await SyncConflict.findOne({ idempotencyKey: mutation.idempotencyKey });
    if (priorConflict) {
      if (priorConflict.requestFingerprint !== mutationFingerprint(this.mutationIdentity(mutation, user))) {
        throw new AppError('Idempotency key was already used for a different conflicting mutation', 409, 'IDEMPOTENCY_KEY_REUSED');
      }
      return {
        mutationId: mutation.mutationId, idempotencyKey: mutation.idempotencyKey, status: 'CONFLICT',
        entityType: priorConflict.entityType, localId: mutation.entityId, serverId: priorConflict.entityId,
        conflict: { conflictId: priorConflict.id, localState: priorConflict.localState, serverState: priorConflict.serverState },
      };
    }

    // 2. Validate operation/entity pairing even for internal callers that do
    // not pass through the HTTP batch validator.
    const expectedEntity = mutation.operationType === 'RECORD_OBSERVATION' ? 'EVENT' : 'TASK';
    const taskOperations = ['CREATE_TASK', 'UPDATE_TASK_STATUS', 'ASSIGN_TASK', 'UNASSIGN_TASK', 'UPDATE_TASK'];
    if (mutation.operationType !== 'RECORD_OBSERVATION' && !taskOperations.includes(mutation.operationType)) {
      return {
        mutationId: mutation.mutationId,
        idempotencyKey: mutation.idempotencyKey,
        status: 'FAILED',
        errorCode: 'UNKNOWN_OPERATION',
        message: `Unknown operationType: ${mutation.operationType}`,
      };
    }
    if (mutation.entityType !== expectedEntity) {
      throw new AppError(`${mutation.operationType} requires entityType ${expectedEntity}`, 400, 'VALIDATION_ERROR');
    }
    if (!mutation.payload || typeof mutation.payload !== 'object' || Array.isArray(mutation.payload)) {
      throw new AppError('Mutation payload must be an object', 400, 'VALIDATION_ERROR');
    }
    if (mutation.baseUpdatedAt !== undefined &&
      (typeof mutation.baseUpdatedAt !== 'string' || !Number.isFinite(Date.parse(mutation.baseUpdatedAt)))) {
      throw new AppError('baseUpdatedAt must be a valid timestamp', 400, 'VALIDATION_ERROR');
    }
    if (mutation.baseVersion !== undefined && (!Number.isSafeInteger(mutation.baseVersion) || mutation.baseVersion < 0)) {
      throw new AppError('baseVersion must be a non-negative safe integer', 400, 'VALIDATION_ERROR');
    }
    if (typeof mutation.clientCreatedAt !== 'string' || !Number.isFinite(Date.parse(mutation.clientCreatedAt))) {
      throw new AppError('clientCreatedAt must be a valid timestamp', 400, 'VALIDATION_ERROR');
    }

    // 3. Validate mission access
    const hasMissionAccess = await this.checkMissionAccess(mutation.missionId, user);
    if (!hasMissionAccess) {
      return {
        mutationId: mutation.mutationId,
        idempotencyKey: mutation.idempotencyKey,
        status: 'FAILED',
        errorCode: 'MISSION_ACCESS_DENIED',
        message: 'You no longer have access to this mission',
      };
    }

    // 4. Resolve entityId: if the entity was created offline, map localId → serverId
    let resolvedEntityId = mutation.entityId;
    if (mutation.operationType !== 'CREATE_TASK' && mutation.entityType === 'TASK') {
      const mapped = idMap.get(this.localMapKey(mutation, mutation.entityId)) ||
        await idempotencyService.resolveLocalId({
          userId: user.id,
          deviceId: mutation.deviceId,
          missionId: mutation.missionId,
          entityType: mutation.entityType,
          localId: mutation.entityId,
        });
      if (mapped) {
        resolvedEntityId = mapped;
        idMap.set(this.localMapKey(mutation, mutation.entityId), mapped);
      }
    }

    // 5. Dispatch to the appropriate handler
    switch (mutation.operationType) {
      case 'CREATE_TASK':
        return this.handleCreateTask(mutation, resolvedEntityId, user);
      case 'UPDATE_TASK_STATUS':
        return this.handleUpdateTaskStatus(mutation, resolvedEntityId, user);
      case 'ASSIGN_TASK':
        return this.handleAssignTask(mutation, resolvedEntityId, user);
      case 'UNASSIGN_TASK':
        return this.handleUnassignTask(mutation, resolvedEntityId, user);
      case 'UPDATE_TASK':
        return this.handleUpdateTask(mutation, resolvedEntityId, user);
      case 'RECORD_OBSERVATION':
        return this.handleRecordObservation(mutation, user);
      default:
        return {
          mutationId: mutation.mutationId,
          idempotencyKey: mutation.idempotencyKey,
          status: 'FAILED',
          errorCode: 'UNKNOWN_OPERATION',
          message: `Unknown operationType: ${mutation.operationType}`,
        };
    }
  }

  // ============================================================
  // MUTATION HANDLERS
  // ============================================================

  private async handleCreateTask(
    mutation: IncomingMutation,
    _resolvedEntityId: string,
    user: UserPayload
  ): Promise<MutationResult> {
    const { payload, missionId } = mutation;

    try {
      const { localId: requestedLocalId, ...input } = payload;
      const parsed = createTaskSchema.strict().safeParse(input);
      if (!parsed.success) {
        throw new AppError(parsed.error.errors.map((error) => error.message).join('; '), 400, 'VALIDATION_ERROR');
      }
      if (requestedLocalId !== undefined && (typeof requestedLocalId !== 'string' || !requestedLocalId.trim())) {
        throw new AppError('localId must be a non-empty string', 400, 'VALIDATION_ERROR');
      }
      const localId = (requestedLocalId as string | undefined) || mutation.entityId;
      const task = await taskService.createTask(missionId, user.id, parsed.data, {
        idempotencyKey: mutation.idempotencyKey,
        clientCreatedAt: mutation.clientCreatedAt,
        deviceId: mutation.deviceId,
        mutationId: mutation.mutationId,
      });

      const entity = task.toJSON() as Record<string, unknown>;
      const serverId = task._id.toString();

      // Store idempotency
      await idempotencyService.storeResult({
        idempotencyKey: mutation.idempotencyKey,
        userId: user.id,
        deviceId: mutation.deviceId,
        missionId,
        operationType: mutation.operationType,
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        localId,
        serverId,
        result: entity,
        fingerprint: mutationFingerprint(this.mutationIdentity(mutation, user)),
      });

      return {
        mutationId: mutation.mutationId,
        idempotencyKey: mutation.idempotencyKey,
        status: 'SYNCED',
        entityType: 'TASK',
        localId,
        serverId,
        entity,
      };
    } catch (err: unknown) {
      throw err;
    }
  }

  private async handleUpdateTaskStatus(
    mutation: IncomingMutation,
    resolvedEntityId: string,
    user: UserPayload
  ): Promise<MutationResult> {
    const { payload, missionId } = mutation;

    // Check if entity ID is still a local (unresolved) ID
    if (resolvedEntityId.startsWith('local-') || !mongoose.Types.ObjectId.isValid(resolvedEntityId)) {
      return {
        mutationId: mutation.mutationId,
        idempotencyKey: mutation.idempotencyKey,
        status: 'FAILED',
        errorCode: 'UNRESOLVED_LOCAL_ID',
        message: `Task ${resolvedEntityId} has not been created on the server yet`,
      };
    }

    try {
      const parsed = updateTaskStatusSchema.strict().safeParse(payload);
      if (!parsed.success) {
        throw new AppError(parsed.error.errors.map((error) => error.message).join('; '), 400, 'VALIDATION_ERROR');
      }
      // Conflict detection: compare baseUpdatedAt to server's updatedAt
      const serverTask = await Task.findById(resolvedEntityId);
      if (!serverTask) {
        return {
          mutationId: mutation.mutationId,
          idempotencyKey: mutation.idempotencyKey,
          status: 'FAILED',
          errorCode: 'TASK_NOT_FOUND',
          message: 'Task no longer exists on the server',
        };
      }
      if (serverTask.missionId.toString() !== missionId) {
        return {
          mutationId: mutation.mutationId,
          idempotencyKey: mutation.idempotencyKey,
          status: 'FAILED',
          errorCode: 'TASK_MISSION_MISMATCH',
          message: 'Task does not belong to the target mission',
        };
      }

      const conflict = await this.detectTaskConflict(mutation, resolvedEntityId, parsed.data);
      if (conflict) return conflict;

      // Apply the status update
      const updatedTask = await taskService.updateTaskStatus(
        resolvedEntityId,
        user,
        parsed.data.status,
        {
          idempotencyKey: mutation.idempotencyKey,
          clientCreatedAt: mutation.clientCreatedAt,
          deviceId: mutation.deviceId,
          mutationId: mutation.mutationId,
        }
      );

      const entity = updatedTask.toJSON() as Record<string, unknown>;

      // Store idempotency
      await idempotencyService.storeResult({
        idempotencyKey: mutation.idempotencyKey,
        userId: user.id,
        deviceId: mutation.deviceId,
        missionId,
        operationType: mutation.operationType,
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        localId: mutation.entityId,
        serverId: resolvedEntityId,
        result: entity,
        fingerprint: mutationFingerprint(this.mutationIdentity(mutation, user)),
      });

      return {
        mutationId: mutation.mutationId,
        idempotencyKey: mutation.idempotencyKey,
        status: 'SYNCED',
        entityType: 'TASK',
        localId: mutation.entityId,
        serverId: resolvedEntityId,
        entity,
      };
    } catch (err: unknown) {
      throw err;
    }
  }

  private async handleAssignTask(
    mutation: IncomingMutation,
    resolvedEntityId: string,
    user: UserPayload
  ): Promise<MutationResult> {
    const { payload, missionId } = mutation;

    if (!mongoose.Types.ObjectId.isValid(resolvedEntityId)) {
      return {
        mutationId: mutation.mutationId,
        idempotencyKey: mutation.idempotencyKey,
        status: 'FAILED',
        errorCode: 'UNRESOLVED_LOCAL_ID',
        message: 'Task has not been created on the server yet',
      };
    }

    try {
      const parsed = assignTaskSchema.strict().safeParse(payload);
      if (!parsed.success) {
        throw new AppError(parsed.error.errors.map((error) => error.message).join('; '), 400, 'VALIDATION_ERROR');
      }
      const task = await Task.findById(resolvedEntityId);
      if (!task || task.missionId.toString() !== missionId) {
        return {
          mutationId: mutation.mutationId,
          idempotencyKey: mutation.idempotencyKey,
          status: 'FAILED',
          errorCode: 'TASK_MISSION_MISMATCH',
          message: 'Task does not belong to the target mission',
        };
      }
      const conflict = await this.detectTaskConflict(mutation, resolvedEntityId, parsed.data);
      if (conflict) return conflict;

      const updatedTask = await taskService.assignTask(
        resolvedEntityId,
        user.id,
        parsed.data.userId,
        {
          idempotencyKey: mutation.idempotencyKey,
          clientCreatedAt: mutation.clientCreatedAt,
          deviceId: mutation.deviceId,
          mutationId: mutation.mutationId,
        }
      );

      const entity = updatedTask.toJSON() as Record<string, unknown>;

      await idempotencyService.storeResult({
        idempotencyKey: mutation.idempotencyKey,
        userId: user.id,
        deviceId: mutation.deviceId,
        missionId,
        operationType: mutation.operationType,
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        localId: mutation.entityId,
        serverId: resolvedEntityId,
        result: entity,
        fingerprint: mutationFingerprint(this.mutationIdentity(mutation, user)),
      });

      return {
        mutationId: mutation.mutationId,
        idempotencyKey: mutation.idempotencyKey,
        status: 'SYNCED',
        entityType: 'TASK',
        localId: mutation.entityId,
        serverId: resolvedEntityId,
        entity,
      };
    } catch (err: unknown) {
      throw err;
    }
  }

  private async handleUnassignTask(
    mutation: IncomingMutation,
    resolvedEntityId: string,
    user: UserPayload
  ): Promise<MutationResult> {
    const { missionId } = mutation;

    if (!mongoose.Types.ObjectId.isValid(resolvedEntityId)) {
      return {
        mutationId: mutation.mutationId,
        idempotencyKey: mutation.idempotencyKey,
        status: 'FAILED',
        errorCode: 'UNRESOLVED_LOCAL_ID',
        message: 'Task has not been created on the server yet',
      };
    }

    try {
      const task = await Task.findById(resolvedEntityId);
      if (!task || task.missionId.toString() !== missionId) {
        return {
          mutationId: mutation.mutationId,
          idempotencyKey: mutation.idempotencyKey,
          status: 'FAILED',
          errorCode: 'TASK_NOT_FOUND',
          message: 'Task does not belong to the target mission',
        };
      }

      const conflict = await this.detectTaskConflict(mutation, resolvedEntityId, {});
      if (conflict) return conflict;

      const updatedTask = await taskService.unassignTask(resolvedEntityId, user.id, {
        idempotencyKey: mutation.idempotencyKey,
        clientCreatedAt: mutation.clientCreatedAt,
        deviceId: mutation.deviceId,
        mutationId: mutation.mutationId,
      });
      const entity = updatedTask.toJSON() as Record<string, unknown>;

      await idempotencyService.storeResult({
        idempotencyKey: mutation.idempotencyKey,
        userId: user.id,
        deviceId: mutation.deviceId,
        missionId,
        operationType: mutation.operationType,
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        localId: mutation.entityId,
        serverId: resolvedEntityId,
        result: entity,
        fingerprint: mutationFingerprint(this.mutationIdentity(mutation, user)),
      });

      return {
        mutationId: mutation.mutationId,
        idempotencyKey: mutation.idempotencyKey,
        status: 'SYNCED',
        entityType: 'TASK',
        localId: mutation.entityId,
        serverId: resolvedEntityId,
        entity,
      };
    } catch (err: unknown) {
      throw err;
    }
  }

  private async handleUpdateTask(
    mutation: IncomingMutation,
    resolvedEntityId: string,
    user: UserPayload
  ): Promise<MutationResult> {
    const { payload, missionId } = mutation;

    if (!mongoose.Types.ObjectId.isValid(resolvedEntityId)) {
      return {
        mutationId: mutation.mutationId,
        idempotencyKey: mutation.idempotencyKey,
        status: 'FAILED',
        errorCode: 'UNRESOLVED_LOCAL_ID',
        message: 'Task has not been created on the server yet',
      };
    }

    try {
      const parsed = updateTaskSchema.safeParse(payload);
      if (!parsed.success) {
        return {
          mutationId: mutation.mutationId,
          idempotencyKey: mutation.idempotencyKey,
          status: 'FAILED',
          errorCode: 'VALIDATION_ERROR',
          message: parsed.error.errors.map((error) => error.message).join('; '),
        };
      }

      const task = await Task.findById(resolvedEntityId);
      if (!task || task.missionId.toString() !== missionId) {
        return {
          mutationId: mutation.mutationId,
          idempotencyKey: mutation.idempotencyKey,
          status: 'FAILED',
          errorCode: 'TASK_NOT_FOUND',
          message: 'Task does not belong to the target mission',
        };
      }

      const conflict = await this.detectTaskConflict(mutation, resolvedEntityId, parsed.data);
      if (conflict) return conflict;

      const updatedTask = await taskService.updateTask(
        resolvedEntityId,
        user.id,
        parsed.data,
        {
          idempotencyKey: mutation.idempotencyKey,
          clientCreatedAt: mutation.clientCreatedAt,
          deviceId: mutation.deviceId,
          mutationId: mutation.mutationId,
        }
      );

      const entity = updatedTask.toJSON() as Record<string, unknown>;

      await idempotencyService.storeResult({
        idempotencyKey: mutation.idempotencyKey,
        userId: user.id,
        deviceId: mutation.deviceId,
        missionId,
        operationType: mutation.operationType,
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        localId: mutation.entityId,
        serverId: resolvedEntityId,
        result: entity,
        fingerprint: mutationFingerprint(this.mutationIdentity(mutation, user)),
      });

      return {
        mutationId: mutation.mutationId,
        idempotencyKey: mutation.idempotencyKey,
        status: 'SYNCED',
        entityType: 'TASK',
        localId: mutation.entityId,
        serverId: resolvedEntityId,
        entity,
      };
    } catch (err: unknown) {
      throw err;
    }
  }

  private async handleRecordObservation(
    mutation: IncomingMutation,
    user: UserPayload
  ): Promise<MutationResult> {
    const parsed = recordObservationSchema.safeParse({
      ...(mutation.payload || {}),
      idempotencyKey: mutation.idempotencyKey,
      clientCreatedAt: mutation.clientCreatedAt,
    });
    if (!parsed.success || mutation.entityType !== 'EVENT') {
      return {
        mutationId: mutation.mutationId,
        idempotencyKey: mutation.idempotencyKey,
        status: 'FAILED',
        errorCode: 'VALIDATION_ERROR',
        message: parsed.success
          ? 'Observation mutations must use entityType EVENT'
          : parsed.error.errors.map((error) => error.message).join('; '),
      };
    }

    try {
      const event = await missionEventService.createMissionEvent({
        missionId: mutation.missionId,
        actorId: user.id,
        eventType: MissionEventType.OBSERVATION_RECORDED,
        targetType: EventTargetType.OBSERVATION,
        payload: { text: parsed.data.text },
        source: EventSource.USER,
        clientCreatedAt: new Date(mutation.clientCreatedAt),
        idempotencyKey: mutation.idempotencyKey,
        deviceId: mutation.deviceId,
        mutationId: mutation.mutationId,
      });
      const entity = event.toJSON() as Record<string, unknown>;
      const serverId = event._id.toString();

      await idempotencyService.storeResult({
        idempotencyKey: mutation.idempotencyKey,
        userId: user.id,
        deviceId: mutation.deviceId,
        missionId: mutation.missionId,
        operationType: mutation.operationType,
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        localId: mutation.entityId,
        serverId,
        result: entity,
        fingerprint: mutationFingerprint(this.mutationIdentity(mutation, user)),
      });

      return {
        mutationId: mutation.mutationId,
        idempotencyKey: mutation.idempotencyKey,
        status: 'SYNCED',
        entityType: 'EVENT',
        localId: mutation.entityId,
        serverId,
        entity,
      };
    } catch (err: unknown) {
      throw err;
    }
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private mutationIdentity(mutation: IncomingMutation, user: UserPayload): IdempotencyIdentity {
    return {
      userId: user.id,
      deviceId: mutation.deviceId,
      missionId: mutation.missionId,
      operationType: mutation.operationType,
      entityType: mutation.entityType,
      entityId: mutation.entityId,
      payload: mutation.payload,
      baseUpdatedAt: mutation.baseUpdatedAt,
      baseVersion: mutation.baseVersion,
      clientCreatedAt: mutation.clientCreatedAt,
    };
  }

  private localMapKey(mutation: IncomingMutation, localId: string): string {
    return JSON.stringify([mutation.actorId, mutation.deviceId, mutation.missionId, mutation.entityType, localId]);
  }

  // The in-process serializer is only an optimization. Mongo transactions and
  // unique retained receipts are the cross-process execution boundary.

  private async checkMissionAccess(missionId: string, user: UserPayload): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(missionId)) return false;
    // Database outages are retryable server failures, not permanent revocation.
    const mission = await Mission.findById(missionId);
    if (!mission) return false;
    if (user.role === 'COMMANDER') return mission.createdBy.toString() === user.id;
    return !!await MissionMember.findOne({ missionId, userId: new mongoose.Types.ObjectId(user.id), status: 'ACTIVE' });
  }

  private async detectTaskConflict(
    mutation: IncomingMutation,
    taskId: string,
    localState: Record<string, unknown>
  ): Promise<MutationResult | null> {
    if (mutation.baseVersion === undefined && !mutation.baseUpdatedAt) return null;

    const serverTask = await Task.findById(taskId);
    if (!serverTask) return null;

    const serverMs = new Date(serverTask.updatedAt).getTime();
    const baseMs = mutation.baseUpdatedAt ? new Date(mutation.baseUpdatedAt).getTime() : 0;
    const stale = mutation.baseVersion !== undefined
      ? serverTask.version !== mutation.baseVersion
      : serverMs > baseMs;
    if (!stale) return null;

    const conflict = await conflictService.createConflict({
      requestFingerprint: mutationFingerprint(this.mutationIdentity(mutation, { id: mutation.actorId } as UserPayload)),
      mutationId: mutation.mutationId,
      idempotencyKey: mutation.idempotencyKey,
      missionId: mutation.missionId,
      entityType: 'TASK',
      entityId: taskId,
      operationType: mutation.operationType,
      actorId: mutation.actorId,
      deviceId: mutation.deviceId,
      localState: { ...localState, entityId: taskId },
      serverState: serverTask.toJSON() as Record<string, unknown>,
      baseState: { updatedAt: mutation.baseUpdatedAt, ...(mutation.baseVersion !== undefined ? { version: mutation.baseVersion } : {}) },
    });

    const result: MutationResult = {
      mutationId: mutation.mutationId,
      idempotencyKey: mutation.idempotencyKey,
      status: 'CONFLICT',
      entityType: 'TASK',
      localId: mutation.entityId,
      serverId: taskId,
      conflict: {
        conflictId: conflict.id,
        localState: { ...localState },
        serverState: serverTask.toJSON() as Record<string, unknown>,
      },
    };
    // A conflict also claims the global request key. Without this shared unique
    // receipt, a success and a conflict in different missions could both commit
    // under one key because their audit records live in separate collections.
    await idempotencyService.storeResult({
      idempotencyKey: mutation.idempotencyKey,
      userId: mutation.actorId, deviceId: mutation.deviceId, missionId: mutation.missionId,
      operationType: mutation.operationType, entityType: mutation.entityType, entityId: mutation.entityId,
      localId: mutation.entityId, serverId: taskId, outcome: 'CONFLICT',
      result: { ...result.conflict! },
      fingerprint: mutationFingerprint(this.mutationIdentity(mutation, { id: mutation.actorId } as UserPayload)),
    });
    return result;
  }

  private errorToResult(mutation: IncomingMutation, err: Error): MutationResult {
    if (err instanceof FailedMutation) return err.result;
    const appError = err as AppError;
    const statusCode = appError.statusCode || 500;

    let errorCode = appError.code || (statusCode === 400 || err.name === 'ValidationError'
      ? 'VALIDATION_ERROR'
      : 'SERVER_ERROR');

    if (statusCode === 403) errorCode = 'PERMISSION_DENIED';
    else if (statusCode === 404) errorCode = 'NOT_FOUND';
    else if (statusCode === 400) errorCode = errorCode || 'VALIDATION_ERROR';

    return {
      mutationId: mutation.mutationId,
      idempotencyKey: mutation.idempotencyKey,
      status: 'FAILED',
      errorCode,
      message: err.message || 'Operation failed',
    };
  }
}

export const syncService = new SyncService();
