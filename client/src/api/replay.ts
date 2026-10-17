import { ApiRequestError, forAccount, http, request, toQueryParams } from './http';
import type { MissionEvent, ReplayData, ReplayNormalizedEvent, ReplayQuery } from '../types';
import { cacheEvents, cacheResponse, cacheResponseKey, getActiveAccountId, getCachedEvents, getCachedMission, getCachedResponse } from '../db';
import { authoritativeReplayEvents } from '../services/replay';
import { canUseOfflineCache } from '../services/sync-policy';

function filterReplay(events: ReplayNormalizedEvent[], query?: ReplayQuery): ReplayNormalizedEvent[] {
  const from = query?.from ? Date.parse(query.from) : undefined;
  const to = query?.to ? Date.parse(query.to) : undefined;
  return authoritativeReplayEvents(events).filter((event) => {
    if (!event || typeof event !== 'object') return true;
    const instant = Date.parse(event.createdAt);
    return (from === undefined || instant >= from) && (to === undefined || instant <= to) && (!query?.eventType || event.eventType === query.eventType);
  });
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isPendingEvent(event: unknown): boolean {
  const value = recordValue(event);
  return value.source === 'LOCAL' || value.syncState === 'PENDING';
}

function mergeCachedReplayEvents(snapshot: readonly (MissionEvent | ReplayNormalizedEvent)[], cached: readonly MissionEvent[]): ReplayNormalizedEvent[] {
  // Replay snapshots can lag the durable event cache after an acknowledgement.
  // Merge before filtering so current authoritative rows can fill that gap;
  // normalize/deduplicate here to keep stable IDs and chronological ordering.
  return authoritativeReplayEvents([
    ...snapshot,
    ...cached,
  ].filter((event) => !isPendingEvent(event)).map(normalizeEvent));
}

function countPendingEvents(...groups: (readonly unknown[])[]): number {
  const ids = new Set<string>();
  let withoutId = 0;
  for (const events of groups) for (const event of events) {
    if (!isPendingEvent(event)) continue;
    const id = stringValue(recordValue(event).id);
    if (id) ids.add(id);
    else withoutId++;
  }
  return ids.size + withoutId;
}

async function assertReplayAccount(accountId?: string): Promise<void> {
  if (await getActiveAccountId() !== accountId) throw new ApiRequestError({ success: false, code: 'ACCOUNT_CHANGED', message: 'Active account changed while loading replay' }, 401);
}

function normalizeEvent(event: MissionEvent | ReplayNormalizedEvent): ReplayNormalizedEvent {
  if (!event || typeof event !== 'object') return event as ReplayNormalizedEvent;
  const { actorId, ...historicalEvent } = { ...event, actorId: 'actorId' in event ? event.actorId : recordValue(event.actor).id };
  const payload = recordValue(event.payload);
  const snapshot = recordValue(payload.actor);
  return {
    ...historicalEvent,
    actor: {
      // The cached reference identifies the actor, but its populated user fields
      // describe today's user. Only immutable payload snapshots supply labels.
      id: stringValue(actorId) || stringValue(recordValue(actorId).id) || 'unknown',
      name: stringValue(snapshot.name) || stringValue(payload.actorName) || 'Unknown Operator',
      email: stringValue(snapshot.email) || stringValue(payload.actorEmail),
      role: stringValue(snapshot.role) || stringValue(payload.actorRole),
    },
    syncState: 'SYNCED',
  };
}

function summaryFor(events: ReplayNormalizedEvent[]): ReplayData['summary'] {
  let firstEventAt: string | null = null;
  let lastEventAt: string | null = null;
  let firstInstant = Infinity;
  let lastInstant = -Infinity;
  const counts = new Map<string, number>();
  const memberIds = new Set<string>();
  for (const event of events) {
    const value = recordValue(event);
    const eventType = stringValue(value.eventType);
    if (eventType) counts.set(eventType, (counts.get(eventType) || 0) + 1);
    const actorId = stringValue(recordValue(value.actor).id);
    if (actorId && actorId !== 'unknown') memberIds.add(actorId);
    if (value.targetType === 'MEMBER') {
      const payload = recordValue(value.payload);
      const memberId = stringValue(payload.userId) || stringValue(recordValue(payload.member).userId) || stringValue(value.targetId);
      if (memberId) memberIds.add(memberId);
    }
    const createdAt = stringValue(value.createdAt);
    const instant = createdAt ? Date.parse(createdAt) : NaN;
    if (createdAt && instant < firstInstant) { firstInstant = instant; firstEventAt = createdAt; }
    if (createdAt && instant >= lastInstant) { lastInstant = instant; lastEventAt = createdAt; }
  }
  const durationMs = firstEventAt && lastEventAt ? Math.max(0, lastInstant - firstInstant) : 0;
  const count = (type: string) => counts.get(type) || 0;
  const summary = {
    scope: 'LOADED_HISTORY' as const,
    durationMs, durationFormatted: `${Math.floor(durationMs / 1000)}s`, totalEvents: events.length,
    tasksCreated: count('TASK_CREATED'), tasksCompleted: count('TASK_COMPLETED'), tasksBlocked: count('TASK_BLOCKED'),
    teamMembersCount: memberIds.size,
    conflictsCount: count('SYNC_CONFLICT'), networkLostCount: count('NETWORK_LOST'), observationsCount: count('OBSERVATION_RECORDED'), firstEventAt, lastEventAt,
  };
  return summary;
}

async function getReplayPage(missionId: string, query?: ReplayQuery): Promise<ReplayData> {
  const accountId = await getActiveAccountId();
  const key = cacheResponseKey(`replay:${missionId}`, query);
  try {
    const page = await request<ReplayData>(http.get(`/missions/${missionId}/replay`, { ...forAccount(accountId), params: toQueryParams(query) }));
    // Never import pending local work into a replay snapshot.
    const events = authoritativeReplayEvents(page.events);
    const pendingExcluded = countPendingEvents(await getCachedEvents(missionId, accountId), page.events);
    const result: ReplayData = { ...page, events, pagination: { ...page.pagination, nextCursor: page.pagination.nextCursor || null }, history: { source: 'server', limited: page.pagination.hasMore || Boolean(query?.cursor || query?.from || query?.to || query?.eventType), pendingExcluded, ...(pendingExcluded ? { notice: 'Pending local events are excluded from authoritative replay history.' } : {}) } };
    await cacheResponse(key, result, accountId);
    await cacheEvents(events.filter((event) => event && typeof event.id === 'string' && typeof event.missionId === 'string' && typeof event.createdAt === 'string' && typeof event.actor?.id === 'string' && event.payload && typeof event.payload === 'object').map((event) => ({
      ...event, actorId: event.actor, eventType: event.eventType, targetType: event.targetType, updatedAt: event.createdAt,
    } as MissionEvent)), accountId);
    await assertReplayAccount(accountId);
    return result;
  } catch (error) {
    if (!canUseOfflineCache(error)) throw error;
    await assertReplayAccount(accountId);
    const [page, cachedEvents] = await Promise.all([getCachedResponse<ReplayData>(key, accountId), getCachedEvents(missionId, accountId)]);
    const pendingExcluded = countPendingEvents(cachedEvents);
    const complete = query?.cursor ? undefined : await getCachedResponse<ReplayData>(cacheResponseKey(`replay-history:${missionId}`, query), accountId);
    if (complete) {
      const events = filterReplay(mergeCachedReplayEvents(complete.events, cachedEvents), query);
      await assertReplayAccount(accountId);
      return { ...complete, events, summary: summaryFor(events), history: { ...complete.history, source: 'cache', limited: complete.history?.limited ?? true, pendingExcluded: countPendingEvents(cachedEvents, complete.events), notice: 'Offline: cached authoritative replay history. Pending local events are excluded.' } };
    }
    if (page) {
      const events = filterReplay(mergeCachedReplayEvents(page.events, cachedEvents), query);
      await assertReplayAccount(accountId);
      return { ...page, events, summary: summaryFor(events), history: { source: 'cache', limited: page.pagination.hasMore || Boolean(query?.cursor || query?.from || query?.to || query?.eventType), pendingExcluded: countPendingEvents(cachedEvents, page.events), notice: 'Offline: cached authoritative replay history. Pending local events are excluded.' } };
    }
    // A cursor can only resume a matching cached page, never an arbitrary slice.
    if (query?.cursor) throw error;
    const events = filterReplay(cachedEvents.filter((event) => !isPendingEvent(event)).map(normalizeEvent), query);
    const mission = await getCachedMission(missionId);
    await assertReplayAccount(accountId);
    if (!mission || !events.length) throw error;
    return {
      mission, events, summary: summaryFor(events), pagination: { total: events.length, limit: events.length, hasMore: false, nextCursor: null },
      history: { source: 'cache', limited: true, pendingExcluded, notice: 'Offline: limited cached authoritative events; history completeness is unknown. Pending local events are excluded.' },
    };
  }
}

/** Load every cursor page, or explicitly report the boundary of the loaded history. */
export async function loadReplayHistory(missionId: string, query: ReplayQuery = {}): Promise<ReplayData> {
  const accountId = await getActiveAccountId();
  let page = await getReplayPage(missionId, query);
  let result = page;
  const events = [...page.events];
  const seen = new Set<string>();
  let limited = Boolean(query.cursor || query.from || query.to || query.eventType) || Boolean(page.history?.limited && !page.pagination.hasMore);
  let notice = page.history?.notice;
  let source = page.history?.source || 'server';
  let pendingExcluded = page.history?.pendingExcluded || 0;
  while (page.pagination.hasMore) {
    await assertReplayAccount(accountId);
    const cursor = page.pagination.nextCursor;
    if (!cursor || seen.has(cursor) || seen.size >= 1000) { limited = true; notice = 'Partial history: seek is limited to loaded events because pagination could not continue.'; break; }
    seen.add(cursor);
    try { page = await getReplayPage(missionId, { ...query, cursor }); }
    catch (error) {
      if (!canUseOfflineCache(error)) throw error;
      limited = true; notice = 'Connection interrupted: seek is limited to loaded authoritative history.'; break;
    }
    events.push(...page.events);
    if (page.history?.source === 'cache') source = 'cache';
    pendingExcluded = Math.max(pendingExcluded, page.history?.pendingExcluded || 0);
    result = { ...result, pagination: page.pagination };
  }
  await assertReplayAccount(accountId);
  const loadedEvents = filterReplay(events, query);
  result = { ...result, events: loadedEvents, summary: summaryFor(loadedEvents), pagination: { ...result.pagination, hasMore: page.pagination.hasMore, nextCursor: page.pagination.nextCursor }, history: { source, limited, pendingExcluded, ...(notice ? { notice } : {}) } };
  await cacheResponse(cacheResponseKey(`replay-history:${missionId}`, query), result, accountId);
  return result;
}

export const replayApi = { get: getReplayPage, all: loadReplayHistory };
