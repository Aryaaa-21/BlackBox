/**
 * Phase 8 — Mission Replay
 * Replay API Service — retrieves authorized chronological replay data from backend,
 * with IndexedDB fallback when offline.
 */

import { api } from './api';
import { ReplayApiResponse, ReplayEvent, ReplaySummary } from '../types/replay';
import { missionEventRepository } from '../offline/missionEvent.repository';
import { missionRepository } from '../offline/mission.repository';
import { isOfflineError } from '../offline/errorClassifier';

export interface ReplayFetchOptions {
  from?: string;
  to?: string;
  eventType?: string;
  limit?: number;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0 min';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes} min ${seconds}s`;
  return `${seconds}s`;
}

export const replayApi = {
  /**
   * Fetch complete mission replay data from server.
   * If server is offline/unreachable, gracefully builds replay stream from IndexedDB cache.
   */
  async getMissionReplay(
    missionId: string,
    options?: ReplayFetchOptions
  ): Promise<ReplayApiResponse['data']> {
    const params = new URLSearchParams();
    if (options?.from) params.set('from', options.from);
    if (options?.to) params.set('to', options.to);
    if (options?.eventType) params.set('eventType', options.eventType);
    if (options?.limit) params.set('limit', String(options.limit));

    const url = `/missions/${missionId}/replay${params.toString() ? `?${params.toString()}` : ''}`;

    try {
      const response = await api.get<ReplayApiResponse>(url);
      return response.data.data;
    } catch (err) {
      if (isOfflineError(err)) {
        console.warn('[ReplayApi] Network unavailable, falling back to local IndexedDB events');
        return replayApi.buildLocalReplay(missionId);
      }
      throw err;
    }
  },

  /**
   * Reconstruct replay data from IndexedDB cache if running offline.
   */
  async buildLocalReplay(missionId: string): Promise<ReplayApiResponse['data']> {
    const [cachedMission, localEvents] = await Promise.all([
      missionRepository.getCachedMission(missionId),
      missionEventRepository.getAllEvents(missionId),
    ]);

    // Ascending chronological order
    const sorted = [...localEvents].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const normalizedEvents: ReplayEvent[] = sorted.map((evt) => {
      const actorName =
        typeof evt.actorId === 'object' && evt.actorId !== null
          ? evt.actorId.name
          : 'Operator';
      const actorId =
        typeof evt.actorId === 'object' && evt.actorId !== null
          ? evt.actorId.id
          : String(evt.actorId || 'unknown');

      return {
        id: evt.id,
        missionId: evt.missionId,
        eventType: evt.eventType,
        actor: {
          id: actorId,
          name: actorName,
        },
        targetType: evt.targetType,
        targetId: evt.targetId ?? null,
        targetName: typeof evt.payload?.title === 'string' ? evt.payload.title : undefined,
        payload: evt.payload || {},
        createdAt: evt.createdAt,
        clientCreatedAt: evt.clientCreatedAt ?? null,
        source: (evt as any).source || 'LOCAL',
        syncState: (evt as any).syncState || 'SYNCED',
        idempotencyKey: evt.idempotencyKey ?? null,
      };
    });

    let tasksCreated = 0;
    let tasksCompleted = 0;
    let tasksBlocked = 0;
    let conflictsCount = 0;
    let networkLostCount = 0;
    let observationsCount = 0;
    const memberIds = new Set<string>();

    for (const evt of normalizedEvents) {
      if (evt.actor.id) memberIds.add(evt.actor.id);
      switch (evt.eventType) {
        case 'TASK_CREATED':
          tasksCreated++;
          break;
        case 'TASK_COMPLETED':
          tasksCompleted++;
          break;
        case 'TASK_BLOCKED':
          tasksBlocked++;
          break;
        case 'SYNC_CONFLICT':
          conflictsCount++;
          break;
        case 'NETWORK_LOST':
          networkLostCount++;
          break;
        case 'OBSERVATION_RECORDED':
          observationsCount++;
          break;
        case 'MEMBER_ASSIGNED':
          if (evt.targetId) memberIds.add(evt.targetId);
          break;
      }
    }

    const firstEventAt = normalizedEvents.length > 0 ? normalizedEvents[0].createdAt : null;
    const lastEventAt =
      normalizedEvents.length > 0
        ? normalizedEvents[normalizedEvents.length - 1].createdAt
        : null;

    let durationMs = 0;
    if (firstEventAt && lastEventAt) {
      durationMs = new Date(lastEventAt).getTime() - new Date(firstEventAt).getTime();
    }

    const summary: ReplaySummary = {
      durationMs,
      durationFormatted: formatDuration(durationMs),
      totalEvents: normalizedEvents.length,
      tasksCreated,
      tasksCompleted,
      tasksBlocked,
      teamMembersCount: memberIds.size,
      conflictsCount,
      networkLostCount,
      observationsCount,
      firstEventAt,
      lastEventAt,
    };

    return {
      mission: cachedMission || {
        id: missionId,
        title: 'Mission (Offline Cached)',
        description: '',
        location: 'Unknown',
        status: 'ACTIVE',
        severity: 'MEDIUM',
        createdBy: 'Unknown',
        startedAt: firstEventAt,
        completedAt: null,
        createdAt: firstEventAt || new Date().toISOString(),
        updatedAt: lastEventAt || new Date().toISOString(),
      },
      events: normalizedEvents,
      summary,
      pagination: {
        total: normalizedEvents.length,
        limit: normalizedEvents.length,
        hasMore: false,
      },
    };
  },
};
