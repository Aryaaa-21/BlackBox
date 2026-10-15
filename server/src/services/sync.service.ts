/**
 * Phase 7 — Synchronization Engine
 * Sync Service — processes batched offline mutations from clients.
 *
 * Architecture:
 *   POST /api/v1/sync → SyncController → SyncService → TaskService/etc
 *
 * Rules:
 * - Processes mutations oldest-first (deterministic ordering)
 * - Checks idempotency before executing — no double execution
 * - Detects conflicts using baseUpdatedAt (optimistic concurrency)
 * - Does NOT fail the entire batch if one mutation fails
 * - Returns structured per-mutation results
 * - Creates MissionEvent for every successful mutation
 * - Broadcasts via Socket.IO AFTER successful DB write
 */

import mongoose from 'mongoose';
import { Task } from '../models/Task';
import { Mission } from '../models/Mission';
import { MissionMember } from '../models/MissionMember';
import { AppError } from '../middleware/error.middleware';
import { idempotencyService, mutationFingerprint } from './idempotency.service';
import { conflictService } from './conflict.service';
import { missionEventService } from './missionEvent.service';
import { taskService } from './task.service';
import {
  UserPayload,
  MissionEventType,
  EventTargetType,
  EventSource,
} from '../types';
import { getIO } from '../sockets/socket';
import { updateTaskSchema } from '../validators/task.validator';
import { recordObservationSchema } from '../validators/observation.validator';

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

export class SyncService {
  private readonly inFlightMutations = new Map<string, Promise<MutationResult>>();
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
      console.log(`[SyncService] Processing ${mutation.operationType} (${mutation.mutationId})`);

      try {
        const existingRun = this.inFlightMutations.get(mutation.idempotencyKey);
        let result: MutationResult;
        if (existingRun) {
          // A lost response can cause two HTTP requests for the same key at
          // once. Serialize that key so side effects execute only once.
          result = {
            ...(await existingRun),
            mutationId: mutation.mutationId,
            status: 'DUPLICATE',
          };
        } else {
          const run = this.processMutation(mutation, user, idMap);
          this.inFlightMutations.set(mutation.idempotencyKey, run);
          try {
            result = await run;
          } finally {
            this.inFlightMutations.delete(mutation.idempotencyKey);
          }
        }
        results.push(result);

        // Update idMap from CREATE results
        if (result.status === 'SYNCED' && result.localId && result.serverId) {
          idMap.set(result.localId, result.serverId);
        }
      } catch (err: unknown) {
        const error = err as Error;
        console.error(`[SyncService] Unexpected error on mutation ${mutation.mutationId}:`, error.message);
        results.push({
          mutationId: mutation.mutationId,
          idempotencyKey: mutation.idempotencyKey,
          status: 'FAILED',
          errorCode: 'SERVER_ERROR',
          message: error.message || 'Unexpected server error',
        });
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

  /**
   * Process a single mutation.
   */
  private async processMutation(
    mutation: IncomingMutation,
    user: UserPayload,
    idMap: Map<string, string>
  ): Promise<MutationResult> {
    // 1. Idempotency check — has this been processed before?
    const existing = await idempotencyService.checkIdempotency(mutation.idempotencyKey, {
      userId: user.id,
      deviceId: mutation.deviceId,
      missionId: mutation.missionId,
      operationType: mutation.operationType,
      entityType: mutation.entityType,
      entityId: mutation.entityId,
      payload: mutation.payload,
    });
    if (existing) {
      console.log(`[SyncService] DUPLICATE detected: ${mutation.idempotencyKey}`);
      return {
        mutationId: mutation.mutationId,
        idempotencyKey: mutation.idempotencyKey,
        status: 'DUPLICATE',
        localId: existing.localId || undefined,
        serverId: existing.serverId || undefined,
        entity: existing.result,
        message: 'Mutation was already processed',
      };
    }

    // 2. Validate actor matches authenticated user
    if (mutation.actorId !== user.id) {
      return {
        mutationId: mutation.mutationId,
        idempotencyKey: mutation.idempotencyKey,
        status: 'FAILED',
        errorCode: 'ACTOR_MISMATCH',
        message: 'Authenticated user does not match mutation actor',
      };
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
    if (idMap.has(mutation.entityId)) {
      resolvedEntityId = idMap.get(mutation.entityId)!;
      console.log(`[SyncService] Resolved localId ${mutation.entityId} → serverId ${resolvedEntityId}`);
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
    const localId = (payload.localId as string) || mutation.entityId;

    try {
      const task = await taskService.createTask(missionId, user.id, {
        title: payload.title as string,
        description: (payload.description as string) || '',
        priority: (payload.priority as any) || 'MEDIUM',
        assignedTo: payload.assignedTo as string | undefined,
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
      return this.errorToResult(mutation, err as Error);
    }
  }

  private async handleUpdateTaskStatus(
    mutation: IncomingMutation,
    resolvedEntityId: string,
    user: UserPayload
  ): Promise<MutationResult> {
    const { payload, missionId } = mutation;
    const newStatus = payload.status as string;

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

      if (mutation.baseUpdatedAt) {
        const serverTime = new Date(serverTask.updatedAt).toISOString();
        const baseTime = new Date(mutation.baseUpdatedAt).toISOString();
        // Allow 1 second tolerance for timestamp rounding
        const serverMs = new Date(serverTask.updatedAt).getTime();
        const baseMs = new Date(mutation.baseUpdatedAt).getTime();

        if (serverMs > baseMs + 1000) {
          console.log(`[SyncService] CONFLICT detected on ${resolvedEntityId}: server=${serverTime} base=${baseTime}`);

          const conflict = await conflictService.createConflict({
            mutationId: mutation.mutationId,
            idempotencyKey: mutation.idempotencyKey,
            missionId,
            entityType: 'TASK',
            entityId: resolvedEntityId,
            operationType: mutation.operationType,
            actorId: user.id,
            deviceId: mutation.deviceId,
            localState: { ...payload, entityId: resolvedEntityId },
            serverState: serverTask.toJSON() as Record<string, unknown>,
            baseState: { updatedAt: mutation.baseUpdatedAt },
          });

          return {
            mutationId: mutation.mutationId,
            idempotencyKey: mutation.idempotencyKey,
            status: 'CONFLICT',
            entityType: 'TASK',
            localId: mutation.entityId,
            serverId: resolvedEntityId,
            conflict: {
              conflictId: conflict.id,
              localState: { ...payload },
              serverState: serverTask.toJSON() as Record<string, unknown>,
            },
          };
        }
      }

      // Apply the status update
      const updatedTask = await taskService.updateTaskStatus(
        resolvedEntityId,
        user,
        newStatus as any
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
        entityId: resolvedEntityId,
        localId: mutation.entityId,
        serverId: resolvedEntityId,
        result: entity,
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
      return this.errorToResult(mutation, err as Error);
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
      const updatedTask = await taskService.assignTask(
        resolvedEntityId,
        user.id,
        payload.userId as string
      );

      const entity = updatedTask.toJSON() as Record<string, unknown>;

      await idempotencyService.storeResult({
        idempotencyKey: mutation.idempotencyKey,
        userId: user.id,
        deviceId: mutation.deviceId,
        missionId,
        operationType: mutation.operationType,
        entityType: mutation.entityType,
        entityId: resolvedEntityId,
        localId: mutation.entityId,
        serverId: resolvedEntityId,
        result: entity,
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
      return this.errorToResult(mutation, err as Error);
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
      });
      const entity = updatedTask.toJSON() as Record<string, unknown>;

      await idempotencyService.storeResult({
        idempotencyKey: mutation.idempotencyKey,
        userId: user.id,
        deviceId: mutation.deviceId,
        missionId,
        operationType: mutation.operationType,
        entityType: mutation.entityType,
        entityId: resolvedEntityId,
        localId: mutation.entityId,
        serverId: resolvedEntityId,
        result: entity,
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
      return this.errorToResult(mutation, err as Error);
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
        entityId: resolvedEntityId,
        localId: mutation.entityId,
        serverId: resolvedEntityId,
        result: entity,
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
      return this.errorToResult(mutation, err as Error);
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
      return this.errorToResult(mutation, err as Error);
    }
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private async checkMissionAccess(missionId: string, user: UserPayload): Promise<boolean> {
    try {
      if (!mongoose.Types.ObjectId.isValid(missionId)) return false;

      const mission = await Mission.findById(missionId);
      if (!mission) return false;

      if (user.role === 'COMMANDER') {
        return mission.createdBy.toString() === user.id;
      }

      const membership = await MissionMember.findOne({
        missionId,
        userId: new mongoose.Types.ObjectId(user.id),
        status: 'ACTIVE',
      });
      return !!membership;
    } catch {
      return false;
    }
  }

  private async detectTaskConflict(
    mutation: IncomingMutation,
    taskId: string,
    localState: Record<string, unknown>
  ): Promise<MutationResult | null> {
    if (!mutation.baseUpdatedAt) return null;

    const serverTask = await Task.findById(taskId);
    if (!serverTask) return null;

    const serverMs = new Date(serverTask.updatedAt).getTime();
    const baseMs = new Date(mutation.baseUpdatedAt).getTime();
    if (serverMs <= baseMs + 1000) return null;

    const conflict = await conflictService.createConflict({
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
      baseState: { updatedAt: mutation.baseUpdatedAt },
    });

    return {
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
  }

  private errorToResult(mutation: IncomingMutation, err: Error): MutationResult {
    const appError = err as AppError;
    const statusCode = (appError as any).statusCode || 500;

    let errorCode = (appError as any).code || 'SERVER_ERROR';

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
