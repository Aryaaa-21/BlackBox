/**
 * Phase 7 — Synchronization Engine
 * Conflict Service
 *
 * Creates, retrieves, and resolves sync conflicts.
 * Conflicts are NEVER silently resolved — the user must explicitly choose.
 */

import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import {
  SyncConflict,
  ISyncConflictDocument,
  ConflictResolution,
  IConflictResolutionMutation,
} from '../models/SyncConflict';
import { Task, ITaskDocument } from '../models/Task';
import { AppError } from '../middleware/error.middleware';
import { MissionMember } from '../models/MissionMember';
import { Mission } from '../models/Mission';
import {
  MissionEventType,
  EventTargetType,
  EventSource,
  UserPayload,
} from '../types';
import { missionEventService } from './missionEvent.service';
import { idempotencyService, mutationFingerprint, deterministicFingerprint } from './idempotency.service';
import { getIO } from '../sockets/socket';
import { assignTaskSchema, updateTaskSchema, updateTaskStatusSchema } from '../validators/task.validator';
import { afterCommit, inUnitOfWork, withUnitOfWork } from './unitOfWork';

interface CreateConflictParams {
  requestFingerprint?: string;
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
}

interface ResolutionResult {
  conflict: ISyncConflictDocument;
  entity?: Record<string, unknown>;
  newMutation?: Record<string, unknown>;
}

// Shared by service instances in this process. Each waiter re-reads and checks
// authorization; a concurrent caller never inherits another user's promise.
const inFlightResolutions = new Map<string, Promise<ResolutionResult>>();

export class ConflictService {
  /**
   * Persist a new conflict record.
   */
  async createConflict(params: CreateConflictParams): Promise<ISyncConflictDocument> {
    if (!inUnitOfWork()) return withUnitOfWork(() => this.createConflict(params));
    const existing = await SyncConflict.findOne({ idempotencyKey: params.idempotencyKey });
    if (existing) {
      if (existing.requestFingerprint !== params.requestFingerprint || existing.actorId !== params.actorId ||
        existing.missionId !== params.missionId || existing.deviceId !== params.deviceId ||
        existing.entityId !== params.entityId || existing.operationType !== params.operationType) {
        throw new AppError('Idempotency key was already used for a different conflicting mutation', 409, 'IDEMPOTENCY_KEY_REUSED');
      }
      return existing;
    }
    const conflict = new SyncConflict({
      requestFingerprint: params.requestFingerprint,
      mutationId: params.mutationId,
      idempotencyKey: params.idempotencyKey,
      missionId: params.missionId,
      entityType: params.entityType,
      entityId: params.entityId,
      operationType: params.operationType,
      actorId: params.actorId,
      deviceId: params.deviceId,
      localState: params.localState,
      serverState: params.serverState,
      baseState: params.baseState,
      status: 'OPEN',
      detectedAt: new Date(),
    });

    await conflict.save();

    // Keep conflict detection in the immutable mission history so replay can
    // show why a mutation was stopped instead of only showing the final state.
    await missionEventService.createMissionEvent({
      missionId: params.missionId,
      actorId: params.actorId,
      eventType: MissionEventType.SYNC_CONFLICT,
      targetType: this.getEventTargetType(params.entityType),
      targetId: params.entityId,
      payload: {
        conflictId: conflict.id,
        mutationId: params.mutationId,
        operationType: params.operationType,
        entityType: params.entityType,
        entityId: params.entityId,
        localState: params.localState,
        serverState: params.serverState,
        baseState: params.baseState,
      },
      source: EventSource.SYSTEM,
      idempotencyKey: `sync-conflict:${params.idempotencyKey}`,
      deviceId: params.deviceId,
      mutationId: params.mutationId,
    });

    console.log(
      `[ConflictService] Conflict created: ${conflict.id} (${params.operationType} on ${params.entityType}/${params.entityId})`
    );

    return conflict;
  }

  /**
   * Get all open conflicts for a mission that the user can access.
   */
  async getMissionConflicts(
    missionId: string,
    user: UserPayload
  ): Promise<ISyncConflictDocument[]> {
    await this.assertMissionAccess(missionId, user);

    const query: Record<string, unknown> = { missionId, status: 'OPEN' };

    // Field operators only see their own conflicts
    if (user.role === 'FIELD_OPERATOR') {
      query.actorId = user.id;
    }

    return SyncConflict.find(query).sort({ detectedAt: -1 }).lean<ISyncConflictDocument[]>();
  }

  /**
   * Get a single conflict by ID.
   */
  async getConflict(
    conflictId: string,
    user: UserPayload
  ): Promise<ISyncConflictDocument> {
    if (!mongoose.Types.ObjectId.isValid(conflictId)) {
      throw new AppError('Invalid conflict ID', 400, 'INVALID_ID_FORMAT');
    }

    const conflict = await SyncConflict.findById(conflictId).lean<ISyncConflictDocument>();
    if (!conflict) {
      throw new AppError('Conflict not found', 404, 'CONFLICT_NOT_FOUND');
    }

    await this.assertMissionAccess(conflict.missionId, user);
    this.assertConflictAccess(conflict, user);

    return conflict;
  }

  /**
   * Resolve a conflict.
   *
   * KEEP_SERVER: discard local mutation, mark conflict resolved
   * KEEP_LOCAL:  apply a fresh mutation only if the presented version is current
   * MERGE:       apply merged state (commander only for complex cases)
   */
  async resolveConflict(
    conflictId: string,
    resolution: ConflictResolution,
    user: UserPayload,
    mergedState?: Record<string, unknown>,
    expectedServerUpdatedAt?: string,
    expectedServerVersion?: number
  ): Promise<ResolutionResult> {
    if (!mongoose.Types.ObjectId.isValid(conflictId)) {
      throw new AppError('Invalid conflict ID', 400, 'INVALID_ID_FORMAT');
    }

    const key = new mongoose.Types.ObjectId(conflictId).toString();
    const previous = inFlightResolutions.get(key);
    const run = (async () => {
      if (previous) await previous.catch(() => undefined);
      return withUnitOfWork(() => this.performResolution(key, resolution, user, mergedState, expectedServerUpdatedAt, expectedServerVersion));
    })();
    inFlightResolutions.set(key, run);
    try {
      return await run;
    } finally {
      if (inFlightResolutions.get(key) === run) inFlightResolutions.delete(key);
    }
  }

  private async performResolution(
    conflictId: string,
    resolution: ConflictResolution,
    user: UserPayload,
    mergedState?: Record<string, unknown>,
    expectedServerUpdatedAt?: string,
    expectedServerVersion?: number
  ): Promise<ResolutionResult> {
    if (!['KEEP_SERVER', 'KEEP_LOCAL', 'MERGE'].includes(resolution)) {
      throw new AppError('Invalid conflict resolution', 400, 'VALIDATION_ERROR');
    }

    const conflict = await SyncConflict.findById(conflictId);
    if (!conflict) {
      throw new AppError('Conflict not found', 404, 'CONFLICT_NOT_FOUND');
    }

    await this.assertMissionAccess(conflict.missionId, user);
    this.assertConflictAccess(conflict, user);

    if (resolution === 'MERGE' && user.role !== 'COMMANDER') {
      throw new AppError('Only commanders may merge conflicting task state', 403, 'MERGE_REQUIRES_COMMANDER');
    }

    if (conflict.status === 'RESOLVED' && conflict.resolution === resolution) {
      if (resolution === 'MERGE' && deterministicFingerprint(conflict.resolutionMutation?.payload) !== deterministicFingerprint(updateTaskSchema.parse(mergedState))) {
        throw new AppError('Resolution key cannot be reused with different merged state', 409, 'CONFLICT_RESOLUTION_MISMATCH');
      }
      // Result, event and receipt committed together. Replay the original result
      // even if the task has subsequently advanced.
      return this.resolutionResult(conflict);
    }

    if (conflict.status !== 'OPEN') {
      throw new AppError(
        `Conflict is already ${conflict.status}`,
        409,
        'CONFLICT_ALREADY_RESOLVED'
      );
    }

    if (resolution === 'MERGE' && !mergedState) {
      throw new AppError(
        'mergedState is required for MERGE resolution',
        400,
        'MERGE_STATE_REQUIRED'
      );
    }

    const task = await this.getCurrentTask(conflict);
    let entity: Record<string, unknown>;

    if (resolution === 'KEEP_SERVER') {
      // The detection snapshot is audit evidence, not current server state.
      entity = task.toJSON() as Record<string, unknown>;
    } else {
      const payload = this.resolutionPayload(conflict, resolution, mergedState);
      const baseUpdatedAt = this.assertPresentedVersion(conflict, task, expectedServerUpdatedAt, expectedServerVersion);
      const mutation = await this.prepareResolutionMutation(conflict, resolution, payload, baseUpdatedAt, user, task.version);
      // Saving the durable identity awaits another write. Reject a task change
      // during that wait as well, rather than knowingly using a stale base.
      const currentTask = await this.getCurrentTask(conflict);
      this.assertPresentedVersion(conflict, currentTask, mutation.baseUpdatedAt, mutation.baseVersion);
      entity = await this.applyResolutionMutation(conflict, mutation, currentTask, user);
    }

    conflict.status = 'RESOLVED';
    conflict.resolution = resolution;
    conflict.resolvedAt = new Date();
    conflict.resolvedByUserId = user.id;
    conflict.resolvedEntityState = entity;
    await conflict.save();
    await this.recordResolution(conflict);

    // Broadcast only after the entire resolution and audit/receipt commit.
    const notification = { conflictId: conflict.id, resolution, entityType: conflict.entityType,
      entityId: conflict.entityId, entity };
    afterCommit(() => {
      try {
        const io = getIO();
        if (io) {
          io.to(`mission:${conflict.missionId}`).emit('sync:conflict_resolved', notification);
        }
      } catch {
        // Non-critical
      }
    });

    return this.resolutionResult(conflict);
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private async getCurrentTask(conflict: ISyncConflictDocument): Promise<ITaskDocument> {
    if (conflict.entityType !== 'TASK') {
      throw new AppError(`Resolution not implemented for ${conflict.entityType}`, 400, 'RESOLUTION_NOT_SUPPORTED');
    }
    const task = await Task.findById(conflict.entityId).populate([
      { path: 'assignedTo', select: 'id name email role', ordered: true },
      { path: 'createdBy', select: 'id name email role' },
    ]);
    if (!task) throw new AppError('Task no longer exists', 404, 'TASK_NOT_FOUND');
    if (task.missionId.toString() !== conflict.missionId) {
      throw new AppError('Task does not belong to the conflict mission', 403, 'TASK_MISSION_MISMATCH');
    }
    return task;
  }

  private resolutionPayload(
    conflict: ISyncConflictDocument,
    resolution: 'KEEP_LOCAL' | 'MERGE',
    mergedState?: Record<string, unknown>
  ): Record<string, unknown> {
    const localState = { ...conflict.localState };
    delete localState.entityId;
    if (resolution === 'KEEP_LOCAL' && conflict.operationType === 'UNASSIGN_TASK') return {};

    const parsed = resolution === 'KEEP_LOCAL' && conflict.operationType === 'UPDATE_TASK_STATUS'
      ? updateTaskStatusSchema.safeParse(localState)
      : resolution === 'KEEP_LOCAL' && conflict.operationType === 'ASSIGN_TASK'
        ? assignTaskSchema.safeParse(localState)
        : resolution === 'MERGE' || conflict.operationType === 'UPDATE_TASK'
        ? updateTaskSchema.safeParse(resolution === 'MERGE' ? mergedState : localState)
        : null;
    if (!parsed) {
      throw new AppError(`KEEP_LOCAL resolution not implemented for ${conflict.operationType}`, 400, 'RESOLUTION_NOT_SUPPORTED');
    }
    if (!parsed.success) {
      throw new AppError(parsed.error.errors.map((error) => error.message).join('; '), 400, 'VALIDATION_ERROR');
    }
    return parsed.data;
  }

  private assertPresentedVersion(
    conflict: ISyncConflictDocument,
    task: ITaskDocument,
    expectedServerUpdatedAt?: string,
    expectedServerVersion?: number
  ): string {
    const version = expectedServerVersion ?? (expectedServerUpdatedAt === undefined ? conflict.serverState.version : undefined);
    if (version !== undefined) {
      if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 0) {
        throw new AppError('A valid numeric server version is required', 400, 'VALIDATION_ERROR');
      }
      if (version !== task.version) {
        throw new AppError('Task changed since this conflict was presented; refresh before resolving', 409, 'CONFLICT_STALE_VERSION');
      }
      return task.updatedAt.toISOString();
    }
    const expected = expectedServerUpdatedAt ?? conflict.serverState.updatedAt;
    if (!(typeof expected === 'string' || expected instanceof Date) || !Number.isFinite(new Date(expected).getTime())) {
      throw new AppError('A valid presented server version is required to resolve this conflict', 409, 'CONFLICT_VERSION_REQUIRED');
    }
    if (new Date(expected).getTime() !== task.updatedAt.getTime()) {
      throw new AppError('Task changed since this conflict was presented; refresh before resolving', 409, 'CONFLICT_STALE_VERSION');
    }
    return task.updatedAt.toISOString();
  }

  private async prepareResolutionMutation(
    conflict: ISyncConflictDocument,
    resolution: 'KEEP_LOCAL' | 'MERGE',
    payload: Record<string, unknown>,
    baseUpdatedAt: string,
    user: UserPayload,
    baseVersion: number
  ): Promise<IConflictResolutionMutation> {
    const existing = conflict.resolutionMutation;
    if (existing) {
      // A retry can reuse the identity, but must not give it a new meaning.
      if (existing.resolution !== resolution || existing.actorId !== user.id ||
          existing.baseUpdatedAt !== baseUpdatedAt || (existing.baseVersion !== undefined && existing.baseVersion !== baseVersion) || deterministicFingerprint(existing.payload) !== deterministicFingerprint(payload)) {
        throw new AppError('A different resolution mutation has already been prepared for this conflict', 409, 'CONFLICT_RESOLUTION_MISMATCH');
      }
      return existing;
    }
    const now = new Date().toISOString();
    const mutation: IConflictResolutionMutation = {
      mutationId: randomUUID(),
      idempotencyKey: `conflict-resolution:${randomUUID()}`,
      missionId: conflict.missionId,
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      operationType: resolution === 'MERGE' ? 'UPDATE_TASK' : conflict.operationType,
      actorId: user.id,
      deviceId: conflict.deviceId,
      payload,
      baseUpdatedAt,
      baseVersion,
      clientCreatedAt: now,
      createdAt: now,
      resolution,
    };
    conflict.resolutionMutation = mutation;
    await conflict.save();
    return mutation;
  }

  private async applyResolutionMutation(
    conflict: ISyncConflictDocument,
    mutation: IConflictResolutionMutation,
    task: ITaskDocument,
    user: UserPayload
  ): Promise<Record<string, unknown>> {
    const { taskService } = await import('./task.service');
    const metadata = { idempotencyKey: mutation.idempotencyKey, clientCreatedAt: mutation.clientCreatedAt,
      mutationId: mutation.mutationId, deviceId: mutation.deviceId };
    let updatedTask: ITaskDocument;
    if (mutation.operationType === 'UPDATE_TASK_STATUS') {
      const { status } = updateTaskStatusSchema.parse(mutation.payload);
      // Preserve the existing explicit BLOCKED/PENDING -> ACTIVE -> COMPLETED
      // path, with a distinct audit key for each actual state transition.
      if (status === 'COMPLETED' && (task.status === 'BLOCKED' || task.status === 'PENDING')) {
        const activatedTask = await taskService.updateTaskStatus(conflict.entityId, user, 'ACTIVE', {
          ...metadata, idempotencyKey: `${mutation.idempotencyKey}:activate`,
        });
        const currentTask = await this.getCurrentTask(conflict);
        this.assertPresentedVersion(conflict, currentTask, activatedTask.updatedAt.toISOString(), activatedTask.version);
      }
      updatedTask = await taskService.updateTaskStatus(conflict.entityId, user, status, metadata);
    } else if (mutation.operationType === 'UPDATE_TASK') {
      updatedTask = await taskService.updateTask(conflict.entityId, user.id, updateTaskSchema.parse(mutation.payload), metadata);
    } else if (mutation.operationType === 'ASSIGN_TASK') {
      updatedTask = await taskService.assignTask(conflict.entityId, user.id, assignTaskSchema.parse(mutation.payload).userId, metadata);
    } else {
      updatedTask = await taskService.unassignTask(conflict.entityId, user.id, metadata);
    }
    return updatedTask.toJSON() as Record<string, unknown>;
  }

  private resolutionResult(conflict: ISyncConflictDocument): ResolutionResult {
    const entity = conflict.resolvedEntityState ?? undefined;
    return {
      conflict,
      entity,
      newMutation: conflict.resolution !== 'KEEP_SERVER' && conflict.resolutionMutation
        ? { ...conflict.resolutionMutation, applied: true, entity }
        : undefined,
    };
  }

  private async recordResolution(conflict: ISyncConflictDocument): Promise<void> {
    const mutation = conflict.resolutionMutation;
    if (conflict.resolution !== 'KEEP_SERVER' && mutation && conflict.resolvedEntityState) {
      const identity = {
        userId: mutation.actorId,
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
      await idempotencyService.storeResult({
        ...identity,
        idempotencyKey: mutation.idempotencyKey,
        localId: conflict.entityId,
        serverId: conflict.entityId,
        result: conflict.resolvedEntityState,
        fingerprint: mutationFingerprint(identity),
      });
    } else if (conflict.resolution === 'KEEP_SERVER' && conflict.resolvedEntityState) {
      // Discarding local state has an atomic acknowledgement too, without
      // presenting it as a new client mutation or changing the task version.
      const identity = {
        userId: conflict.resolvedByUserId!, deviceId: conflict.deviceId,
        missionId: conflict.missionId, operationType: 'RESOLVE_CONFLICT',
        entityType: conflict.entityType, entityId: conflict.entityId,
        payload: { conflictId: conflict.id, resolution: 'KEEP_SERVER' },
        clientCreatedAt: conflict.resolvedAt!.toISOString(),
      };
      await idempotencyService.storeResult({
        ...identity, idempotencyKey: `conflict-resolution:keep-server:${conflict.id}`,
        localId: conflict.entityId, serverId: conflict.entityId,
        result: conflict.resolvedEntityState, fingerprint: mutationFingerprint(identity),
      });
    }
    await missionEventService.createMissionEvent({
      missionId: conflict.missionId,
      actorId: conflict.resolvedByUserId!,
      eventType: MissionEventType.CONFLICT_RESOLVED,
      targetType: this.getEventTargetType(conflict.entityType),
      targetId: conflict.entityId,
      payload: {
        conflictId: conflict.id,
        mutationId: conflict.mutationId,
        idempotencyKey: conflict.idempotencyKey,
        resolution: conflict.resolution,
        entityType: conflict.entityType,
        entityId: conflict.entityId,
        localState: conflict.localState,
        serverState: conflict.serverState,
        resolvedEntityState: conflict.resolvedEntityState,
        resolutionMutation: conflict.resolution === 'KEEP_SERVER' ? undefined : mutation,
      },
      source: EventSource.SYSTEM,
      idempotencyKey: `conflict-resolved:${conflict.id}`,
      deviceId: mutation?.deviceId || conflict.deviceId,
      mutationId: mutation?.mutationId || conflict.mutationId,
    });
  }

  private getEventTargetType(entityType: string): EventTargetType {
    if (entityType === 'TASK') return EventTargetType.TASK;
    if (entityType === 'MISSION') return EventTargetType.MISSION;
    if (entityType === 'MEMBER') return EventTargetType.MEMBER;
    if (entityType === 'EVENT') return EventTargetType.OBSERVATION;
    return EventTargetType.SYNC;
  }

  private async assertMissionAccess(missionId: string, user: UserPayload): Promise<void> {
    const mission = await Mission.findById(missionId);
    if (!mission) {
      throw new AppError('Mission not found', 404, 'MISSION_NOT_FOUND');
    }

    if (user.role === 'COMMANDER') {
      if (mission.createdBy.toString() !== user.id) {
        throw new AppError('Access denied for this mission', 403, 'MISSION_ACCESS_DENIED');
      }
    } else {
      const isMember = await MissionMember.exists({
        missionId,
        userId: new mongoose.Types.ObjectId(user.id),
        status: 'ACTIVE',
      });
      if (!isMember) {
        throw new AppError('Access denied for this mission', 403, 'MISSION_ACCESS_DENIED');
      }
    }
  }

  private assertConflictAccess(
    conflict: ISyncConflictDocument,
    user: UserPayload
  ): void {
    // Commanders can resolve any conflict in their mission
    // Field operators can only resolve their own conflicts
    if (user.role === 'FIELD_OPERATOR' && conflict.actorId !== user.id) {
      throw new AppError('Access denied for this conflict', 403, 'CONFLICT_ACCESS_DENIED');
    }
  }
}

export const conflictService = new ConflictService();
