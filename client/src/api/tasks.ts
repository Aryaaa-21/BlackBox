import { forAccount, http, request, toQueryParams } from './http';
import type { CreateTaskInput, Task, TaskQuery, TaskStats, TaskStatus, UpdateTaskInput, MissionTasksData } from '../types';
import { cacheTask, cacheTasks, cacheResponse, cacheResponseKey, getActiveAccountId, getCachedTask, getCachedTasks, getAccountMutations, resolveEntityId } from '../db';
import { changeTaskMutation, createTaskMutation, type TaskMutationContext } from '../services/mutations';
import { filterTasks } from '../services/cache-policy';

export const tasksApi = {
  mission: async (missionId: string, query?: TaskQuery) => {
    const accountId = await getActiveAccountId();
    const result = await request<MissionTasksData>(http.get(`/missions/${missionId}/tasks`, { ...forAccount(accountId), params: toQueryParams(query) }));
    const authoritative = await cacheTasks(result.tasks, accountId);
    await cacheResponse(cacheResponseKey(`tasks:${missionId}`, query), { ...result, tasks: authoritative }, accountId);
    const pending = accountId ? await getAccountMutations(accountId) : [];
    const ids = new Set(result.tasks.map((task) => task.id));
    for (const mutation of pending.filter((entry) => entry.missionId === missionId && entry.entityType === 'TASK')) ids.add(await resolveEntityId('TASK', mutation.entityId, accountId));
    return { ...result, tasks: filterTasks((await getCachedTasks(missionId, accountId)).filter((task) => ids.has(task.id)), query) };
  },
  get: async (taskId: string) => {
    const accountId = await getActiveAccountId();
    const id = await resolveEntityId('TASK', taskId, accountId);
    if (id.startsWith('local-')) {
      const cached = await getCachedTask(taskId, accountId);
      if (cached) return cached;
    }
    const task = (await request<{ task: Task }>(http.get(`/tasks/${id}`, forAccount(accountId)))).task;
    await cacheTask(task, accountId);
    return await getCachedTask(task.id, accountId) || task;
  },
  create: (missionId: string, input: CreateTaskInput, context?: TaskMutationContext) => createTaskMutation(missionId, input, context),
  update: (taskId: string, input: UpdateTaskInput, context?: TaskMutationContext) => changeTaskMutation(taskId, 'UPDATE_TASK', { ...input }, context),
  assign: (taskId: string, userId: string, context?: TaskMutationContext) => changeTaskMutation(taskId, 'ASSIGN_TASK', { userId }, context),
  unassign: (taskId: string, context?: TaskMutationContext) => changeTaskMutation(taskId, 'UNASSIGN_TASK', {}, context),
  updateStatus: (taskId: string, status: TaskStatus, context?: TaskMutationContext) => changeTaskMutation(taskId, 'UPDATE_TASK_STATUS', { status }, context),
  stats: async () => (await request<{ stats: TaskStats }>(http.get('/tasks/stats'))).stats,
  mine: async () => {
    const accountId = await getActiveAccountId();
    const tasks = (await request<{ tasks: Task[] }>(http.get('/tasks/my', forAccount(accountId)))).tasks;
    await cacheTasks(tasks, accountId);
    return Promise.all(tasks.map(async (task) => await getCachedTask(task.id, accountId) || task));
  },
};
