/**
 * Phase 6 — Offline-First Operations
 * Task Repository — unified access layer for tasks.
 *
 * All task operations flow through here.
 * - ONLINE → REST API + cache result in IndexedDB
 * - OFFLINE → read/write IndexedDB + enqueue mutation
 *
 * Components and stores call taskRepository.*, never taskApi.* or db.tasks.* directly.
 */

import { db } from './db';
import { mutationQueueRepository } from './mutationQueue.repository';
import { validateTaskTransition } from './validation';
import { isOfflineError } from './errorClassifier';
import { taskApi } from '../services/taskApi';
import type { Task, TaskStatus, TaskPriority } from '../types';
import type { LocalTask, OfflineOperationResult } from './types';

// ============================================================
// HELPERS — convert between LocalTask and Task (UI type)
// ============================================================

function localTaskToTask(lt: LocalTask): Task & { syncState: string; isLocal: boolean } {
  return {
    id: lt.id,
    missionId: lt.missionId,
    title: lt.title,
    description: lt.description,
    priority: lt.priority,
    status: lt.status,
    assignedTo: lt.assignedToId
      ? { id: lt.assignedToId, name: lt.assignedToName ?? '', email: '' }
      : null,
    createdBy: lt.createdById
      ? { id: lt.createdById, name: lt.createdByName ?? '' }
      : lt.createdById,
    startedAt: lt.startedAt,
    completedAt: lt.completedAt,
    blockedAt: lt.blockedAt,
    createdAt: lt.createdAt,
    updatedAt: lt.updatedAt,
    // Extended fields (not in base Task type but carried for UI)
    syncState: lt.syncState,
    isLocal: lt.source === 'LOCAL',
  };
}

function taskToLocalTask(task: Task, missionId: string): LocalTask {
  const missionIdStr = typeof task.missionId === 'string' ? task.missionId : task.missionId.id;
  const assignedToId =
    task.assignedTo && typeof task.assignedTo === 'object' ? task.assignedTo.id : undefined;
  const assignedToName =
    task.assignedTo && typeof task.assignedTo === 'object' ? task.assignedTo.name : undefined;
  const createdById =
    task.createdBy && typeof task.createdBy === 'object' ? task.createdBy.id : String(task.createdBy);
  const createdByName =
    task.createdBy && typeof task.createdBy === 'object' ? task.createdBy.name : undefined;

  return {
    id: task.id,
    localId: task.id,
    serverId: task.id,
    missionId: missionIdStr || missionId,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    assignedToId: assignedToId ?? null,
    assignedToName: assignedToName ?? null,
    createdById,
    createdByName,
    startedAt: task.startedAt ?? null,
    completedAt: task.completedAt ?? null,
    blockedAt: task.blockedAt ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    cachedAt: new Date().toISOString(),
    source: 'SERVER',
    syncState: 'SYNCED',
    baseUpdatedAt: task.updatedAt,
  };
}

// ============================================================
// REPOSITORY
// ============================================================

export const taskRepository = {
  // ============================================================
  // FETCH (always try server, fall back to cache)
  // ============================================================

  async getMissionTasks(
    missionId: string,
    isOperationallyOnline: boolean
  ): Promise<Task[]> {
    if (isOperationallyOnline) {
      try {
        const result = await taskApi.getMissionTasks(missionId);
        const tasks = result.tasks;
        // Cache all fetched tasks
        await Promise.all(tasks.map((t) => taskRepository.cacheTask(t, missionId)));
        return tasks;
      } catch (err) {
        if (isOfflineError(err)) {
          console.log('[TaskRepo] Server unreachable, loading from IndexedDB');
          return taskRepository.getCachedTasks(missionId);
        }
        throw err;
      }
    } else {
      return taskRepository.getCachedTasks(missionId);
    }
  },

  async getCachedTasks(missionId: string): Promise<Task[]> {
    const localTasks = await db.tasks
      .where('missionId')
      .equals(missionId)
      .toArray();

    return localTasks
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((lt) => localTaskToTask(lt) as Task);
  },

  // ============================================================
  // CACHE (server → IndexedDB)
  // ============================================================

  async cacheTask(task: Task, missionId: string): Promise<void> {
    const local = taskToLocalTask(task, missionId);
    await db.tasks.put(local);
  },

  async cacheTasks(tasks: Task[], missionId: string): Promise<void> {
    const locals = tasks.map((t) => taskToLocalTask(t, missionId));
    await db.tasks.bulkPut(locals);
  },

  // ============================================================
  // CREATE TASK
  // ============================================================

  async createTask(
    missionId: string,
    payload: { title: string; description?: string; priority?: TaskPriority },
    actorId: string,
    actorName: string,
    deviceId: string,
    isOperationallyOnline: boolean
  ): Promise<OfflineOperationResult<Task>> {
    if (isOperationallyOnline) {
      try {
        const task = await taskApi.createTask(missionId, payload);
        await taskRepository.cacheTask(task, missionId);
        return { data: task, isLocal: false, syncState: 'SYNCED' };
      } catch (err) {
        if (!isOfflineError(err)) throw err;
        // Fall through to offline path
        console.log('[TaskRepo] Server unreachable during createTask, using offline path');
      }
    }

    // OFFLINE PATH
    const localId = crypto.randomUUID();
    const now = new Date().toISOString();

    const localTask: LocalTask = {
      id: localId,
      localId,
      missionId,
      title: payload.title,
      description: payload.description ?? '',
      priority: payload.priority ?? 'MEDIUM',
      status: 'PENDING',
      assignedToId: null,
      assignedToName: null,
      createdById: actorId,
      createdByName: actorName,
      startedAt: null,
      completedAt: null,
      blockedAt: null,
      createdAt: now,
      updatedAt: now,
      cachedAt: now,
      source: 'LOCAL',
      syncState: 'PENDING',
      baseUpdatedAt: now,
    };

    await db.tasks.add(localTask);

    // Enqueue mutation
    const mutation = mutationQueueRepository.buildMutation({
      missionId,
      operationType: 'CREATE_TASK',
      entityType: 'TASK',
      entityId: localId,
      payload: { ...payload, localId },
      actorId,
      deviceId,
    });
    await mutationQueueRepository.enqueue(mutation);

    const task = localTaskToTask(localTask) as Task;
    console.log(`[TaskRepo] Task created offline: localId=${localId}`);
    return { data: task, isLocal: true, syncState: 'PENDING', mutationId: mutation.id };
  },

  // ============================================================
  // UPDATE TASK STATUS
  // ============================================================

  async updateTaskStatus(
    taskId: string,
    missionId: string,
    newStatus: TaskStatus,
    actorId: string,
    deviceId: string,
    isOperationallyOnline: boolean
  ): Promise<OfflineOperationResult<Task>> {
    // First, validate the transition using local state
    const localTask = await db.tasks.get(taskId);
    if (!localTask) {
      throw new Error(`Task ${taskId} not found in local cache`);
    }

    const transition = validateTaskTransition(localTask.status, newStatus);
    if (!transition.valid) {
      throw new Error(transition.message ?? 'Invalid task status transition');
    }

    if (isOperationallyOnline) {
      try {
        const updated = await taskApi.updateTaskStatus(taskId, newStatus);
        await taskRepository.cacheTask(updated, missionId);
        return { data: updated, isLocal: false, syncState: 'SYNCED' };
      } catch (err) {
        if (!isOfflineError(err)) throw err;
        console.log('[TaskRepo] Server unreachable during updateTaskStatus, using offline path');
      }
    }

    // OFFLINE PATH — apply transition locally
    const now = new Date().toISOString();
    const updates: Partial<LocalTask> = {
      status: newStatus,
      updatedAt: now,
      syncState: 'PENDING',
      baseUpdatedAt: localTask.updatedAt, // capture before-state
    };

    if (newStatus === 'ACTIVE' && localTask.status === 'PENDING') {
      updates.startedAt = now;
    } else if (newStatus === 'COMPLETED') {
      updates.completedAt = now;
    } else if (newStatus === 'BLOCKED') {
      updates.blockedAt = now;
    }

    await db.tasks.update(taskId, updates);

    const updatedLocal = { ...localTask, ...updates };
    const mutation = mutationQueueRepository.buildMutation({
      missionId,
      operationType: 'UPDATE_TASK_STATUS',
      entityType: 'TASK',
      entityId: taskId,
      payload: { status: newStatus },
      actorId,
      deviceId,
      baseUpdatedAt: localTask.updatedAt,
    });
    await mutationQueueRepository.enqueue(mutation);

    console.log(`[TaskRepo] Task ${taskId} status updated offline: ${localTask.status} → ${newStatus}`);
    return {
      data: localTaskToTask(updatedLocal) as Task,
      isLocal: true,
      syncState: 'PENDING',
      mutationId: mutation.id,
    };
  },

  // ============================================================
  // ASSIGN TASK (offline — only if member is cached)
  // ============================================================

  async assignTask(
    taskId: string,
    missionId: string,
    assigneeId: string,
    assigneeName: string,
    actorId: string,
    deviceId: string,
    isOperationallyOnline: boolean
  ): Promise<OfflineOperationResult<Task>> {
    if (isOperationallyOnline) {
      try {
        const updated = await taskApi.assignTask(taskId, assigneeId);
        await taskRepository.cacheTask(updated, missionId);
        return { data: updated, isLocal: false, syncState: 'SYNCED' };
      } catch (err) {
        if (!isOfflineError(err)) throw err;
        console.log('[TaskRepo] Server unreachable during assignTask, using offline path');
      }
    }

    // OFFLINE PATH — only if we have the member cached
    const member = await db.missionMembers
      .where('missionId')
      .equals(missionId)
      .filter((m) => m.userId === assigneeId && m.status === 'ACTIVE')
      .first();

    if (!member) {
      throw new Error('Assignment unavailable offline — team information is not cached or member is inactive.');
    }

    const localTask = await db.tasks.get(taskId);
    if (!localTask) throw new Error(`Task ${taskId} not found in local cache`);

    const now = new Date().toISOString();
    await db.tasks.update(taskId, {
      assignedToId: assigneeId,
      assignedToName: assigneeName,
      updatedAt: now,
      syncState: 'PENDING',
    });

    const mutation = mutationQueueRepository.buildMutation({
      missionId,
      operationType: 'ASSIGN_TASK',
      entityType: 'TASK',
      entityId: taskId,
      payload: { userId: assigneeId },
      actorId,
      deviceId,
    });
    await mutationQueueRepository.enqueue(mutation);

    const updated = await db.tasks.get(taskId);
    return {
      data: localTaskToTask(updated!) as Task,
      isLocal: true,
      syncState: 'PENDING',
      mutationId: mutation.id,
    };
  },

  // ============================================================
  // LOCAL CACHE UTILITIES
  // ============================================================

  /** Update a task in cache after Phase 7 sync */
  async updateCachedTask(taskId: string, updates: Partial<LocalTask>): Promise<void> {
    await db.tasks.update(taskId, updates);
  },

  /** Delete a task from cache */
  async deleteFromCache(taskId: string): Promise<void> {
    await db.tasks.delete(taskId);
  },

  /** Get a single task from cache */
  async getCachedTask(taskId: string): Promise<Task | null> {
    const local = await db.tasks.get(taskId);
    return local ? (localTaskToTask(local) as Task) : null;
  },
};
