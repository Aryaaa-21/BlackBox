/** Authorized, event-only mission replay in deterministic (createdAt, _id) order. */
import mongoose from 'mongoose';
import { config } from '../config/env';
import { Mission } from '../models/Mission';
import { MissionMember } from '../models/MissionMember';
import { MissionEvent, IMissionEventDocument } from '../models/MissionEvent';
import { AppError } from '../middleware/error.middleware';
import { UserPayload, MissionEventType } from '../types';
import {
  ReplayTuple,
  decodeReplayCursor,
  encodeReplayCursor,
  normalizeReplayPayload,
  validateReplayOptions,
} from './replay.helpers';

export interface ReplayQueryOptions {
  from?: string;
  to?: string;
  eventType?: string;
  limit?: number;
  cursor?: string;
}

export interface ReplayActorInfo {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

export interface ReplayNormalizedEvent {
  id: string;
  missionId: string;
  eventType: string;
  actor: ReplayActorInfo;
  targetType?: string;
  targetId?: string | null;
  targetName?: string;
  payload: Record<string, unknown>;
  createdAt: string;
  clientCreatedAt?: string | null;
  source: string;
  syncState?: 'SYNCED' | 'PENDING';
  idempotencyKey?: string | null;
  deviceId?: string;
  mutationId?: string;
  entityVersion?: number;
}

export interface ReplaySummary {
  scope: 'PAGE';
  durationMs: number;
  durationFormatted: string;
  totalEvents: number;
  tasksCreated: number;
  tasksCompleted: number;
  tasksBlocked: number;
  /** Distinct event actors and member identities observed on this page, not a live roster. */
  teamMembersCount: number;
  conflictsCount: number;
  networkLostCount: number;
  observationsCount: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
}

export interface ReplayDataResponse {
  mission: {
    scope: 'CURRENT_METADATA';
    id: string;
    title: string;
    description: string;
    location: string;
    status: string;
    severity: string;
    createdBy: unknown;
    startedAt?: Date | null;
    completedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
  events: ReplayNormalizedEvent[];
  summary: ReplaySummary;
  pagination: {
    scope: 'FILTERED_HISTORY_THROUGH_HIGH_WATER';
    total: number;
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
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

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function eventTuple(event: Pick<IMissionEventDocument, '_id' | 'createdAt'>): ReplayTuple {
  return { createdAt: event.createdAt.toISOString(), id: String(event._id) };
}

function normalizeEvent(event: IMissionEventDocument): ReplayNormalizedEvent {
  const payload = normalizeReplayPayload(event.payload);
  const actorSnapshot = recordValue(payload.actor);
  // Never populate mutable users/tasks to reconstruct labels. Missing snapshots stay unknown.
  const actor: ReplayActorInfo = {
    id: event.actorId ? String(event.actorId) : 'unknown',
    name: stringValue(actorSnapshot.name) || stringValue(payload.actorName) || 'Unknown Operator',
    email: stringValue(actorSnapshot.email) || stringValue(payload.actorEmail),
    role: stringValue(actorSnapshot.role) || stringValue(payload.actorRole),
  };
  const entitySnapshot = recordValue(payload.task || payload.member || payload.mission || payload.entity);
  const targetName = stringValue(payload.title) || stringValue(payload.taskTitle) ||
    stringValue(payload.memberName) || stringValue(payload.targetName) ||
    stringValue(entitySnapshot.title) || stringValue(entitySnapshot.name);
  const metadata = event as unknown as { deviceId?: unknown; mutationId?: unknown; entityVersion?: unknown };
  const clientCreatedAt = event.clientCreatedAt ? new Date(event.clientCreatedAt) : null;
  return {
    id: String(event._id),
    missionId: String(event.missionId),
    eventType: stringValue(event.eventType) || 'UNKNOWN',
    actor,
    targetType: stringValue(event.targetType),
    targetId: event.targetId ? String(event.targetId) : null,
    targetName,
    payload,
    createdAt: event.createdAt.toISOString(),
    clientCreatedAt: clientCreatedAt && Number.isFinite(clientCreatedAt.getTime()) ? clientCreatedAt.toISOString() : null,
    source: stringValue(event.source) || 'SERVER',
    syncState: 'SYNCED',
    idempotencyKey: stringValue(event.idempotencyKey) || null,
    ...(stringValue(metadata.deviceId) ? { deviceId: metadata.deviceId as string } : {}),
    ...(stringValue(metadata.mutationId) ? { mutationId: metadata.mutationId as string } : {}),
    ...(typeof metadata.entityVersion === 'number' && Number.isSafeInteger(metadata.entityVersion) && metadata.entityVersion >= 0
      ? { entityVersion: metadata.entityVersion } : {}),
  };
}

function summarize(events: ReplayNormalizedEvent[]): ReplaySummary {
  const memberIds = new Set<string>();
  const counts = new Map<string, number>();
  for (const event of events) {
    counts.set(event.eventType, (counts.get(event.eventType) || 0) + 1);
    if (event.actor.id && event.actor.id !== 'unknown') memberIds.add(event.actor.id);
    if (event.targetType === 'MEMBER') {
      const memberId = stringValue(event.payload.userId) || stringValue(recordValue(event.payload.member).userId) || event.targetId;
      if (memberId) memberIds.add(memberId);
    }
  }
  const firstEventAt = events[0]?.createdAt || null;
  const lastEventAt = events[events.length - 1]?.createdAt || null;
  // This is an observed event span, never a duration inferred from today's mission lifecycle.
  const durationMs = firstEventAt && lastEventAt ? Math.max(0, Date.parse(lastEventAt) - Date.parse(firstEventAt)) : 0;
  return {
    scope: 'PAGE',
    durationMs,
    durationFormatted: formatDuration(durationMs),
    totalEvents: events.length,
    tasksCreated: counts.get(MissionEventType.TASK_CREATED) || 0,
    tasksCompleted: counts.get(MissionEventType.TASK_COMPLETED) || 0,
    tasksBlocked: counts.get(MissionEventType.TASK_BLOCKED) || 0,
    teamMembersCount: memberIds.size,
    conflictsCount: counts.get(MissionEventType.SYNC_CONFLICT) || 0,
    networkLostCount: counts.get(MissionEventType.NETWORK_LOST) || 0,
    observationsCount: counts.get(MissionEventType.OBSERVATION_RECORDED) || 0,
    firstEventAt,
    lastEventAt,
  };
}

export class ReplayService {
  /** Mission creator/commander or active member; checked again on every cursor request. */
  async checkReplayAuthorization(missionId: string, user: UserPayload): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(missionId) || !mongoose.Types.ObjectId.isValid(user.id)) return false;
    const mission = await Mission.findById(missionId).select('createdBy');
    if (!mission) return false;
    if (user.role === 'COMMANDER' && String(mission.createdBy) === new mongoose.Types.ObjectId(user.id).toHexString()) return true;
    return Boolean(await MissionMember.exists({
      missionId: new mongoose.Types.ObjectId(missionId),
      userId: new mongoose.Types.ObjectId(user.id),
      status: 'ACTIVE',
    }));
  }

  async getMissionReplay(missionId: string, user: UserPayload, options: ReplayQueryOptions = {}): Promise<ReplayDataResponse> {
    if (!mongoose.Types.ObjectId.isValid(missionId)) {
      throw new AppError('Invalid mission ID format', 400, 'INVALID_MISSION_ID');
    }
    const canonicalMissionId = new mongoose.Types.ObjectId(missionId).toHexString();
    const { filters, limit } = validateReplayOptions(canonicalMissionId, options);
    const cursor = options.cursor === undefined ? null : decodeReplayCursor(options.cursor, filters, config.jwtSecret);

    const mission = await Mission.findById(canonicalMissionId).populate('createdBy', 'id name email role').exec();
    if (!mission) throw new AppError('Mission not found', 404, 'MISSION_NOT_FOUND');
    if (!await this.checkReplayAuthorization(canonicalMissionId, user)) {
      throw new AppError('Access denied. You are not authorized to view replay for this mission.', 403, 'MISSION_ACCESS_DENIED');
    }

    const query: Record<string, unknown> = {
      missionId: new mongoose.Types.ObjectId(canonicalMissionId),
      source: { $ne: 'LOCAL' },
      syncState: { $ne: 'PENDING' },
    };
    if (filters.from || filters.to) {
      query.createdAt = {
        ...(filters.from ? { $gte: new Date(filters.from) } : {}),
        ...(filters.to ? { $lte: new Date(filters.to) } : {}),
      };
    }
    if (filters.eventType !== null) query.eventType = filters.eventType;

    // Anchor every subsequent page to the first request's final matching event.
    // This bounds an append-only history without inventing a snapshot persistence system.
    // syncState exists on some legacy imported rows, not on the current event
    // schema. Preserve this server-built exclusion under global strictQuery.
    const finalEvent = cursor ? null : await MissionEvent.findOne(query).setOptions({ strictQuery: false }).sort({ createdAt: -1, _id: -1 }).select('_id createdAt').exec();
    const highWater = cursor?.highWater || (finalEvent ? eventTuple(finalEvent) : null);
    let events: IMissionEventDocument[] = [];
    let total = 0;
    if (highWater) {
      const upperBound = {
        $or: [
          { createdAt: { $lt: new Date(highWater.createdAt) } },
          { createdAt: new Date(highWater.createdAt), _id: { $lte: new mongoose.Types.ObjectId(highWater.id) } },
        ],
      };
      const boundedQuery = { ...query, $and: [upperBound] };
      const pageQuery = cursor ? {
        ...query,
        $and: [upperBound, {
          $or: [
            { createdAt: { $gt: new Date(cursor.after.createdAt) } },
            { createdAt: new Date(cursor.after.createdAt), _id: { $gt: new mongoose.Types.ObjectId(cursor.after.id) } },
          ],
        }],
      } : boundedQuery;
      [events, total] = await Promise.all([
        MissionEvent.find(pageQuery).setOptions({ strictQuery: false }).sort({ createdAt: 1, _id: 1 }).limit(limit + 1).exec(),
        MissionEvent.countDocuments(boundedQuery).setOptions({ strictQuery: false }),
      ]);
    }
    const hasMore = events.length > limit;
    const pageEvents = events.slice(0, limit);
    const normalizedEvents = pageEvents.map(normalizeEvent);

    return {
      // Compatibility display metadata only: historical state and metrics never read it.
      mission: {
        scope: 'CURRENT_METADATA',
        id: String(mission._id),
        title: mission.title,
        description: mission.description,
        location: mission.location,
        status: mission.status,
        severity: mission.severity,
        createdBy: mission.createdBy,
        startedAt: mission.startedAt,
        completedAt: mission.completedAt,
        createdAt: mission.createdAt,
        updatedAt: mission.updatedAt,
      },
      events: normalizedEvents,
      summary: summarize(normalizedEvents),
      pagination: {
        scope: 'FILTERED_HISTORY_THROUGH_HIGH_WATER',
        total,
        limit,
        hasMore,
        nextCursor: hasMore && highWater
          ? encodeReplayCursor(filters, eventTuple(pageEvents[pageEvents.length - 1]), highWater, config.jwtSecret)
          : null,
      },
    };
  }
}

export const replayService = new ReplayService();
