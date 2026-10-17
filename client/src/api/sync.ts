import { http, request, toQueryParams } from './http';
import type {
  ConflictResolutionInput, ConflictResolutionResult, SyncBatchInput, SyncConflict, SyncMutation, SyncSummary,
} from '../types';
import { cacheConflict, db, getActiveAccountId, preferCachedEntity } from '../db';
import { preferAuthoritative } from '../services/authority';

async function accountConfig(accountId?: string) {
  if (!accountId) return {};
  if (await getActiveAccountId() !== accountId) throw Object.assign(new Error('Active account changed'), { status: 401, code: 'ACCOUNT_CHANGED' });
  const session = await db.sessions.get(accountId);
  return { blackboxAccountId: accountId, ...(session?.token ? { headers: { Authorization: `Bearer ${session.token}` } } : {}) };
}

export const syncApi = {
  submit: async (mutations: SyncMutation[], accountId?: string) => {
    const summary = await request<SyncSummary>(http.post('/sync', { mutations } satisfies SyncBatchInput, await accountConfig(accountId)));
    if (!summary || !Array.isArray(summary.results)) return summary;
    return { ...summary, results: await Promise.all(summary.results.map(async (result) => {
      const entityType = result.entityType || mutations.find((mutation) => mutation.mutationId === result.mutationId)?.entityType;
      return result.entity && entityType ? {
        ...result,
        acknowledgedBase: {
          ...(typeof result.entity.version === 'number' ? { version: result.entity.version } : {}),
          ...(typeof result.entity.updatedAt === 'string' ? { updatedAt: result.entity.updatedAt } : {}),
        },
        entity: await preferCachedEntity(entityType, result.entity, accountId),
      } : result;
    })) };
  },
  conflicts: async (missionId: string, accountId?: string) => {
    const conflicts = (await request<{ conflicts: SyncConflict[] }>(http.get('/sync/conflicts', { ...await accountConfig(accountId), params: toQueryParams({ missionId }) }))).conflicts;
    return (await Promise.all(conflicts.map((conflict) => cacheConflict(conflict, accountId)))).filter((conflict) => conflict.status === 'OPEN');
  },
  conflict: async (conflictId: string, accountId?: string) => cacheConflict((await request<{ conflict: SyncConflict }>(http.get(`/sync/conflicts/${conflictId}`, await accountConfig(accountId)))).conflict, accountId),
  resolve: async (conflictId: string, input: ConflictResolutionInput, accountId?: string) => {
    const result = await request<ConflictResolutionResult>(http.post(`/sync/conflicts/${conflictId}/resolve`, input, await accountConfig(accountId)));
    accountId ??= await getActiveAccountId();
    const previous = await db.conflicts.get(result.conflict.id);
    const conflict = preferAuthoritative(previous?.accountId === accountId ? previous : undefined, result.conflict);
    // Persistence and releasing dependent work remain atomic in reconcileResolution.
    return { ...result, conflict, ...(result.entity ? { entity: await preferCachedEntity(conflict.entityType as SyncMutation['entityType'], result.entity, accountId) } : {}) };
  },
};
