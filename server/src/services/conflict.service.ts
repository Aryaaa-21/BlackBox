/**
 * Phase 7 — Synchronization Engine
 * Conflict Service
 *
 * Creates, retrieves, and resolves sync conflicts.
 * Conflicts are NEVER silently resolved — the user must explicitly choose.
 */

import mongoose from 'mongoose';
import { SyncConflict, ISyncConflictDocument, ConflictResolution } from '../models/SyncConflict';
import { Task } from '../models/Task';
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
import { getIO } from '../sockets/socket';

interface CreateConflictParams {
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

export class ConflictService {
  /**
   * Persist a new conflict record.
   */
  async createConflict(params: CreateConflictParams): Promise<ISyncConflictDocument> {
    const conflict = new SyncConflict({
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
   * KEEP_LOCAL:  re-apply the local change using current server version
   *              (returns a new mutation result, does not bypass concurrency)
   * MERGE:       apply merged state (commander only for complex cases)
   */
  async resolveConflict(
    conflictId: string,
    resolution: ConflictResolution,
    user: UserPayload,
    mergedState?: Record<string, unknown>
  ): Promise<{
    conflict: ISyncConflictDocument;
    entity?: Record<string, unknown>;
    newMutation?: Record<string, unknown>;
  }> {
    if (!mongoose.Types.ObjectId.isValid(conflictId)) {
      throw new AppError('Invalid conflict ID', 400, 'INVALID_ID_FORMAT');
    }

    const conflict = await SyncConflict.findById(conflictId);
    if (!conflict) {
      throw new AppError('Conflict not found', 404, 'CONFLICT_NOT_FOUND');
    }

    await this.assertMissionAccess(conflict.missionId, user);
    this.assertConflictAccess(conflict, user);

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

    let entity: Record<string, unknown> | undefined;
    let newMutation: Record<string, unknown> | undefined;

    if (resolution === 'KEEP_SERVER') {
      // Discard local change — server state is already authoritative
      conflict.status = 'RESOLVED';
      conflict.resolution = 'KEEP_SERVER';
      conflict.resolvedAt = new Date();
      conflict.resolvedByUserId = user.id;
      conflict.resolvedEntityState = conflict.serverState;
      await conflict.save();

      // Record event
      await missionEventService.createMissionEvent({
        missionId: conflict.missionId,
        actorId: user.id,
        eventType: MissionEventType.TASK_UPDATED,
        targetType: EventTargetType.TASK,
        targetId: conflict.entityId,
        payload: {
          conflictId: conflict.id,
          resolution: 'KEEP_SERVER',
          entityType: conflict.entityType,
        },
        source: EventSource.SYSTEM,
      });

      entity = conflict.serverState;
    } else if (resolution === 'KEEP_LOCAL') {
      // Re-apply local change using current server version as the new base
      // This goes through the normal task service to preserve concurrency checks
      const result = await this.applyLocalResolution(conflict, user);
      entity = result;

      conflict.status = 'RESOLVED';
      conflict.resolution = 'KEEP_LOCAL';
      conflict.resolvedAt = new Date();
      conflict.resolvedByUserId = user.id;
      conflict.resolvedEntityState = result;
      await conflict.save();

      newMutation = { applied: true, entity: result };
    } else if (resolution === 'MERGE' && mergedState) {
      // Apply merged state directly (commander-level action)
      const result = await this.applyMergeResolution(conflict, mergedState, user);
      entity = result;

      conflict.status = 'RESOLVED';
      conflict.resolution = 'MERGE';
      conflict.resolvedAt = new Date();
      conflict.resolvedByUserId = user.id;
      conflict.resolvedEntityState = result;
      await conflict.save();

      newMutation = { applied: true, entity: result };
    }

    // Broadcast resolution
    try {
      const io = getIO();
      if (io) {
        io.to(`mission:${conflict.missionId}`).emit('sync:conflict_resolved', {
          conflictId: conflict.id,
          resolution,
          entityType: conflict.entityType,
          entityId: conflict.entityId,
          entity,
        });
      }
    } catch {
      // Non-critical
    }

    return { conflict, entity, newMutation };
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private async applyLocalResolution(
    conflict: ISyncConflictDocument,
    user: UserPayload
  ): Promise<Record<string, unknown>> {
    if (conflict.entityType === 'TASK' && conflict.operationType === 'UPDATE_TASK_STATUS') {
      const task = await Task.findById(conflict.entityId);
      if (!task) {
        throw new AppError('Task no longer exists', 404, 'TASK_NOT_FOUND');
      }

      const localStatus = (conflict.localState as any).status as string;
      if (!localStatus) {
        throw new AppError('Cannot determine local status for resolution', 400, 'INVALID_LOCAL_STATE');
      }

      // Apply using the task service to go through normal validation
      const { taskService } = await import('./task.service');
      const updatedTask = await taskService.updateTaskStatus(
        conflict.entityId,
        user,
        localStatus as any
      );

      return updatedTask.toJSON() as Record<string, unknown>;
    }

    throw new AppError(
      `KEEP_LOCAL resolution not yet implemented for ${conflict.operationType}`,
      400,
      'RESOLUTION_NOT_SUPPORTED'
    );
  }

  private async applyMergeResolution(
    conflict: ISyncConflictDocument,
    mergedState: Record<string, unknown>,
    _user: UserPayload
  ): Promise<Record<string, unknown>> {
    if (conflict.entityType === 'TASK') {
      const task = await Task.findById(conflict.entityId);
      if (!task) {
        throw new AppError('Task no longer exists', 404, 'TASK_NOT_FOUND');
      }

      // Apply only safe-to-merge fields
      if (mergedState.title && typeof mergedState.title === 'string') {
        task.title = mergedState.title;
      }
      if (mergedState.description !== undefined) {
        task.description = mergedState.description as string;
      }
      if (mergedState.priority && typeof mergedState.priority === 'string') {
        task.priority = mergedState.priority as any;
      }

      await task.save();
      await task.populate([
        { path: 'assignedTo', select: 'id name email role' },
        { path: 'createdBy', select: 'id name email role' },
      ]);

      // Broadcast update
      try {
        const io = getIO();
        if (io) {
          io.to(`mission:${conflict.missionId}`).emit('task:updated', {
            missionId: conflict.missionId,
            task,
          });
        }
      } catch {
        // Non-critical
      }

      return task.toJSON() as Record<string, unknown>;
    }

    throw new AppError(
      `MERGE resolution not yet implemented for ${conflict.entityType}`,
      400,
      'RESOLUTION_NOT_SUPPORTED'
    );
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
