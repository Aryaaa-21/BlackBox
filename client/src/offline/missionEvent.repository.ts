/**
 * Phase 6 — Offline-First Operations
 * MissionEvent Repository — unified access for event caching.
 *
 * Online  → REST API → update IndexedDB
 * Offline → IndexedDB read + create local events for offline mutations
 *
 * Events are append-only (never deleted or updated after creation).
 */

import { db } from './db';
import { isOfflineError } from './errorClassifier';
import { missionEventApi } from '../services/missionEventApi';
import type { MissionEvent, MissionEventType, EventTargetType, EventSource } from '../types';
import type { LocalMissionEvent } from './types';

// ============================================================
// HELPERS
// ============================================================

function serverEventToLocal(event: MissionEvent): LocalMissionEvent {
  const actorId =
    event.actorId && typeof event.actorId === 'object' ? event.actorId.id : String(event.actorId);
  const actorName =
    event.actorId && typeof event.actorId === 'object' ? event.actorId.name : undefined;

  return {
    id: event.id,
    missionId: event.missionId,
    actorId,
    actorName,
    eventType: event.eventType,
    targetType: event.targetType,
    targetId: event.targetId ?? null,
    payload: event.payload,
    createdAt: event.createdAt,
    clientCreatedAt: event.clientCreatedAt ?? event.createdAt,
    source: 'SERVER',
    syncState: 'SYNCED',
    idempotencyKey: event.idempotencyKey ?? crypto.randomUUID(),
  };
}

export function localEventToMissionEvent(local: LocalMissionEvent): MissionEvent {
  return {
    id: local.id,
    missionId: local.missionId,
    actorId: local.actorName
      ? { id: local.actorId, name: local.actorName }
      : local.actorId,
    eventType: local.eventType,
    targetType: local.targetType,
    targetId: local.targetId,
    payload: local.payload,
    createdAt: local.createdAt,
    clientCreatedAt: local.clientCreatedAt,
    source: local.source as unknown as EventSource,
    idempotencyKey: local.idempotencyKey,
    // Extra Phase 6 fields carried for UI rendering
    ...(local.syncState !== 'SYNCED' ? { syncState: local.syncState } : {}),
  };
}

// ============================================================
// EVENT REPOSITORY
// ============================================================

export const missionEventRepository = {
  // ============================================================
  // FETCH (server events — paginated)
  // ============================================================

  async fetchAndCache(
    missionId: string,
    isOperationallyOnline: boolean,
    limit = 100
  ): Promise<MissionEvent[]> {
    if (isOperationallyOnline) {
      try {
        const data = await missionEventApi.getMissionEvents(missionId, { limit, page: 1 });
        await missionEventRepository.cacheServerEvents(data.events);
        return data.events;
      } catch (err) {
        if (isOfflineError(err)) {
          console.log('[EventRepo] Server unreachable, loading cached events');
          return missionEventRepository.getAllEvents(missionId);
        }
        throw err;
      }
    } else {
      return missionEventRepository.getAllEvents(missionId);
    }
  },

  // ============================================================
  // GET ALL (server + local, merged and sorted newest-first)
  // ============================================================

  async getAllEvents(missionId: string): Promise<MissionEvent[]> {
    const locals = await db.missionEvents
      .where('missionId')
      .equals(missionId)
      .toArray();

    return locals
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(localEventToMissionEvent);
  },

  // ============================================================
  // CACHE SERVER EVENTS
  // ============================================================

  async cacheServerEvents(events: MissionEvent[]): Promise<void> {
    const locals = events.map(serverEventToLocal);
    await db.missionEvents.bulkPut(locals);
  },

  // ============================================================
  // CREATE LOCAL EVENT (for offline mutations)
  // ============================================================

  async createLocalEvent(params: {
    missionId: string;
    actorId: string;
    actorName: string;
    eventType: MissionEventType;
    targetType: EventTargetType;
    targetId?: string | null;
    payload: Record<string, unknown>;
    idempotencyKey: string;
  }): Promise<MissionEvent> {
    const now = new Date().toISOString();
    const localEvent: LocalMissionEvent = {
      id: crypto.randomUUID(),
      missionId: params.missionId,
      actorId: params.actorId,
      actorName: params.actorName,
      eventType: params.eventType,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      payload: params.payload,
      createdAt: now,
      clientCreatedAt: now,
      source: 'LOCAL',
      syncState: 'PENDING',
      idempotencyKey: params.idempotencyKey,
    };

    await db.missionEvents.add(localEvent);
    console.log(`[EventRepo] Local event created: ${params.eventType} (PENDING)`);
    return localEventToMissionEvent(localEvent);
  },

  // ============================================================
  // MARK LOCAL EVENT SYNCED (Phase 7 will call this)
  // ============================================================

  async markEventSynced(localEventId: string, serverEventId?: string): Promise<void> {
    const updates: Partial<LocalMissionEvent> = { syncState: 'SYNCED', source: 'SERVER' };
    if (serverEventId) updates.id = serverEventId;
    await db.missionEvents.update(localEventId, updates);
  },

  // ============================================================
  // COUNT PENDING LOCAL EVENTS
  // ============================================================

  async countPendingLocal(missionId: string): Promise<number> {
    const all = await db.missionEvents
      .where('missionId')
      .equals(missionId)
      .toArray();
    return all.filter((e) => e.syncState === 'PENDING').length;
  },
};
