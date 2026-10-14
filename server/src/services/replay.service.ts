/**
 * Phase 8 — Mission Replay
 * Replay Service — backend service for retrieving authorized,
 * chronologically ordered, normalized historical MissionEvent streams
 * and computing verifiable operational summaries.
 */

import mongoose from 'mongoose';
import { Mission } from '../models/Mission';
import { MissionMember } from '../models/MissionMember';
import { MissionEvent, IMissionEventDocument } from '../models/MissionEvent';
import { Task } from '../models/Task';
import { AppError } from '../middleware/error.middleware';
import { UserPayload, MissionEventType } from '../types';

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
}

export interface ReplaySummary {
  durationMs: number;
  durationFormatted: string;
  totalEvents: number;
  tasksCreated: number;
  tasksCompleted: number;
  tasksBlocked: number;
  teamMembersCount: number;
  conflictsCount: number;
  networkLostCount: number;
  observationsCount: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
}

export interface ReplayDataResponse {
  mission: {
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
    total: number;
    limit: number;
    hasMore: boolean;
  };
}

const MAX_REPLAY_EVENTS = 5000;

function formatDuration(ms: number): string {
  if (ms <= 0) return '0 min';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes} min ${seconds}s`;
  }
  return `${seconds}s`;
}

export class ReplayService {
  /**
   * Verify if user is authorized to access replay for this mission.
   * Authorized: Mission Commander (creator) or active Mission Member.
   */
  async checkReplayAuthorization(missionId: string, user: UserPayload): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(missionId)) {
      return false;
    }

    const mission = await Mission.findById(missionId).select('createdBy status');
    if (!mission) {
      return false;
    }

    // Creator / Commander check
    const creatorId =
      (mission.createdBy as any)?._id?.toString() ||
      (mission.createdBy as any)?.id?.toString() ||
      String(mission.createdBy);

    if (user.role === 'COMMANDER' && creatorId === user.id) {
      return true;
    }

    // Active Mission Member check
    const isMember = await MissionMember.exists({
      missionId: new mongoose.Types.ObjectId(missionId),
      userId: new mongoose.Types.ObjectId(user.id),
      status: 'ACTIVE',
    });

    return Boolean(isMember);
  }

  /**
   * Retrieve normalized chronological replay data for a mission.
   */
  async getMissionReplay(
    missionId: string,
    user: UserPayload,
    options: ReplayQueryOptions = {}
  ): Promise<ReplayDataResponse> {
    if (!mongoose.Types.ObjectId.isValid(missionId)) {
      throw new AppError('Invalid mission ID format', 400, 'INVALID_MISSION_ID');
    }

    // Verify mission exists
    const mission = await Mission.findById(missionId)
      .populate('createdBy', 'id name email role')
      .exec();

    if (!mission) {
      throw new AppError('Mission not found', 404, 'MISSION_NOT_FOUND');
    }

    // Authorize user
    const isAuthorized = await this.checkReplayAuthorization(missionId, user);
    if (!isAuthorized) {
      throw new AppError(
        'Access denied. You are not authorized to view replay for this mission.',
        403,
        'MISSION_ACCESS_DENIED'
      );
    }

    // Build event query
    const query: Record<string, unknown> = {
      missionId: new mongoose.Types.ObjectId(missionId),
    };

    if (options.from || options.to) {
      const dateFilter: Record<string, Date> = {};
      if (options.from) {
        dateFilter.$gte = new Date(options.from);
      }
      if (options.to) {
        dateFilter.$lte = new Date(options.to);
      }
      query.createdAt = dateFilter;
    }

    if (options.eventType) {
      query.eventType = options.eventType;
    }

    const limit = Math.min(MAX_REPLAY_EVENTS, Math.max(1, Number(options.limit) || 1000));

    // Execute query with deterministic chronological order: createdAt ASC, _id ASC
    const [events, total] = await Promise.all([
      MissionEvent.find(query)
        .sort({ createdAt: 1, _id: 1 })
        .limit(limit)
        .populate('actorId', 'id name email role')
        .exec(),
      MissionEvent.countDocuments(query),
    ]);

    // Build target lookup cache to resolve task titles or member names where appropriate
    const taskIds = new Set<string>();
    for (const evt of events) {
      if (evt.targetType === 'TASK' && evt.targetId) {
        taskIds.add(evt.targetId.toString());
      }
    }

    const taskTitleMap = new Map<string, string>();
    if (taskIds.size > 0) {
      const tasks = await Task.find({ _id: { $in: Array.from(taskIds) } })
        .select('title')
        .lean()
        .exec();
      for (const t of tasks) {
        taskTitleMap.set(t._id.toString(), t.title);
      }
    }

    // Normalize events
    const normalizedEvents: ReplayNormalizedEvent[] = events.map((evt) => {
      let actor: ReplayActorInfo = {
        id: evt.actorId ? (evt.actorId as any)._id?.toString() || evt.actorId.toString() : 'unknown',
        name: 'Former Operator',
      };

      if (evt.actorId && typeof evt.actorId === 'object' && 'name' in evt.actorId) {
        const userObj = evt.actorId as any;
        actor = {
          id: userObj._id?.toString() || userObj.id || String(evt.actorId),
          name: userObj.name || 'Unknown Operator',
          email: userObj.email,
          role: userObj.role,
        };
      }

      // Resolve target title
      let targetName: string | undefined = undefined;
      if (evt.targetType === 'TASK' && evt.targetId) {
        targetName = taskTitleMap.get(evt.targetId.toString());
      }
      if (!targetName && evt.payload) {
        if (typeof evt.payload.title === 'string') {
          targetName = evt.payload.title;
        } else if (typeof evt.payload.taskTitle === 'string') {
          targetName = evt.payload.taskTitle;
        } else if (typeof evt.payload.memberName === 'string') {
          targetName = evt.payload.memberName;
        }
      }

      return {
        id: evt._id.toString(),
        missionId: evt.missionId.toString(),
        eventType: evt.eventType,
        actor,
        targetType: evt.targetType,
        targetId: evt.targetId ? evt.targetId.toString() : null,
        targetName,
        payload: evt.payload || {},
        createdAt: evt.createdAt.toISOString(),
        clientCreatedAt: evt.clientCreatedAt ? evt.clientCreatedAt.toISOString() : null,
        source: evt.source || 'SERVER',
        syncState: 'SYNCED',
        idempotencyKey: evt.idempotencyKey || null,
      };
    });

    // Compute derived operational metrics
    let tasksCreated = 0;
    let tasksCompleted = 0;
    let tasksBlocked = 0;
    let conflictsCount = 0;
    let networkLostCount = 0;
    let observationsCount = 0;
    const memberIds = new Set<string>();

    for (const evt of normalizedEvents) {
      if (evt.actor && evt.actor.id) {
        memberIds.add(evt.actor.id);
      }
      switch (evt.eventType) {
        case MissionEventType.TASK_CREATED:
          tasksCreated++;
          break;
        case MissionEventType.TASK_COMPLETED:
          tasksCompleted++;
          break;
        case MissionEventType.TASK_BLOCKED:
          tasksBlocked++;
          break;
        case MissionEventType.SYNC_CONFLICT:
          conflictsCount++;
          break;
        case MissionEventType.NETWORK_LOST:
          networkLostCount++;
          break;
        case MissionEventType.OBSERVATION_RECORDED:
          observationsCount++;
          break;
        case MissionEventType.MEMBER_ASSIGNED:
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
    if (mission.startedAt && mission.completedAt) {
      durationMs = new Date(mission.completedAt).getTime() - new Date(mission.startedAt).getTime();
    } else if (firstEventAt && lastEventAt) {
      durationMs = new Date(lastEventAt).getTime() - new Date(firstEventAt).getTime();
    } else if (mission.startedAt) {
      durationMs = Date.now() - new Date(mission.startedAt).getTime();
    }

    const summary: ReplaySummary = {
      durationMs: Math.max(0, durationMs),
      durationFormatted: formatDuration(durationMs),
      totalEvents: total,
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
      mission: {
        id: mission._id.toString(),
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
      summary,
      pagination: {
        total,
        limit,
        hasMore: total > limit,
      },
    };
  }
}

export const replayService = new ReplayService();
