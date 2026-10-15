import mongoose from 'mongoose';
import { MissionEvent, IMissionEventDocument } from '../models/MissionEvent';
import { Mission } from '../models/Mission';
import { MissionMember } from '../models/MissionMember';
import {
  CreateMissionEventInput,
  EventQueryOptions,
  PaginationMeta,
  UserPayload,
  MissionEventType,
  EventTargetType,
  EventSource,
} from '../types';
import { RecordObservationInput } from '../validators/observation.validator';
import { AppError } from '../middleware/error.middleware';
import { getIO } from '../sockets/socket';

class MissionEventService {
  /**
   * Sensitive keys that must NEVER be persisted in an event payload (Section 15)
   */
  private readonly SENSITIVE_KEYS = new Set([
    'password',
    'passwordhash',
    'password_hash',
    'token',
    'refreshtoken',
    'refresh_token',
    'secret',
    'credentials',
    'authorization',
  ]);

  /**
   * Sanitize payload to strip credentials and redundant sensitive fields
   */
  private sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
    if (!payload || typeof payload !== 'object') {
      return {};
    }

    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (this.SENSITIVE_KEYS.has(key.toLowerCase())) {
        continue;
      }
      if (value !== null && typeof value === 'object' && !(value instanceof Date) && !(value instanceof mongoose.Types.ObjectId)) {
        clean[key] = this.sanitizePayload(value as Record<string, unknown>);
      } else {
        clean[key] = value;
      }
    }
    return clean;
  }

  /**
   * Safely broadcast Socket.IO event to mission room
   */
  private emitSocketEvent(room: string, event: string, data: unknown): void {
    try {
      const io = getIO();
      if (io) {
        io.to(room).emit(event, data);
      }
    } catch {
      // In tests or headless execution where socket is uninitialized, proceed gracefully
    }
  }

  /**
   * Record and broadcast an immutable MissionEvent (Sections 13, 16, 18, 20, 35, 37)
   */
  async createMissionEvent(input: CreateMissionEventInput): Promise<IMissionEventDocument> {
    const {
      missionId,
      actorId,
      eventType,
      targetType,
      targetId,
      payload,
      source,
      clientCreatedAt,
      idempotencyKey,
    } = input;

    if (!mongoose.Types.ObjectId.isValid(missionId)) {
      throw new AppError('Invalid mission ID for event creation', 400, 'INVALID_MISSION_ID');
    }

    if (!mongoose.Types.ObjectId.isValid(actorId)) {
      throw new AppError('Invalid actor ID for event creation', 400, 'INVALID_ACTOR_ID');
    }

    if (!Object.values(MissionEventType).includes(eventType)) {
      throw new AppError(`Invalid event type: ${eventType}`, 400, 'INVALID_EVENT_TYPE');
    }

    if (!Object.values(EventTargetType).includes(targetType)) {
      throw new AppError(`Invalid target type: ${targetType}`, 400, 'INVALID_TARGET_TYPE');
    }

    // Idempotency check: if idempotencyKey supplied and event exists, return existing event (Section 20 & 94)
    if (idempotencyKey && idempotencyKey.trim()) {
      const existing = await MissionEvent.findOne({
        missionId: new mongoose.Types.ObjectId(missionId),
        idempotencyKey: idempotencyKey.trim(),
      }).populate('actorId', 'id name email role');

      if (existing) {
        return existing;
      }
    }

    // Verify target mission exists
    const missionExists = await Mission.exists({ _id: new mongoose.Types.ObjectId(missionId) });
    if (!missionExists) {
      throw new AppError('Target mission does not exist', 404, 'MISSION_NOT_FOUND');
    }

    // Build event with sanitized payload
    const sanitized = this.sanitizePayload(payload);

    const eventData: Record<string, unknown> = {
      missionId: new mongoose.Types.ObjectId(missionId),
      actorId: new mongoose.Types.ObjectId(actorId),
      eventType,
      targetType,
      targetId: targetId && mongoose.Types.ObjectId.isValid(targetId) ? new mongoose.Types.ObjectId(targetId) : null,
      payload: sanitized,
      source: source || 'USER',
      clientCreatedAt: clientCreatedAt || null,
    };

    if (idempotencyKey && idempotencyKey.trim()) {
      eventData.idempotencyKey = idempotencyKey.trim();
    }

    const event = new MissionEvent(eventData);

    await event.save();
    await event.populate('actorId', 'id name email role');

    // Broadcast only AFTER database write succeeds (Section 35 & 37)
    this.emitSocketEvent(`mission:${missionId}`, 'mission:event_created', {
      missionId,
      event: event.toJSON(),
    });

    return event;
  }

  /** Record a user-authored free-form observation after mission access is verified. */
  async recordObservation(
    missionId: string,
    user: UserPayload,
    input: RecordObservationInput
  ): Promise<IMissionEventDocument> {
    const canAccess = await this.canUserAccessMission(missionId, user);
    if (!canAccess) {
      throw new AppError(
        'Access denied. You are not authorized to record observations for this mission.',
        403,
        'MISSION_ACCESS_DENIED'
      );
    }

    return this.createMissionEvent({
      missionId,
      actorId: user.id,
      eventType: MissionEventType.OBSERVATION_RECORDED,
      targetType: EventTargetType.OBSERVATION,
      payload: { text: input.text.trim() },
      source: EventSource.USER,
      clientCreatedAt: input.clientCreatedAt ? new Date(input.clientCreatedAt) : undefined,
      idempotencyKey: input.idempotencyKey,
    });
  }

  /**
   * Check whether a user has access to view a mission's events
   */
  async canUserAccessMission(missionId: string, user: UserPayload): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(missionId)) {
      return false;
    }

    const mission = await Mission.findById(missionId).select('createdBy status');
    if (!mission) {
      return false;
    }

    if (user.role === 'COMMANDER') {
      return mission.createdBy.toString() === user.id;
    }

    const isMember = await MissionMember.exists({
      missionId: mission._id,
      userId: new mongoose.Types.ObjectId(user.id),
      status: 'ACTIVE',
    });
    return Boolean(isMember);
  }

  /**
   * Retrieve paginated immutable event history for a mission (Sections 22, 23, 24, 25, 29)
   */
  async getMissionEvents(
    missionId: string,
    user: UserPayload,
    options: EventQueryOptions = {}
  ): Promise<{ events: IMissionEventDocument[]; pagination: PaginationMeta }> {
    if (!mongoose.Types.ObjectId.isValid(missionId)) {
      throw new AppError('Invalid mission ID format', 400, 'INVALID_MISSION_ID');
    }

    // Authorization: User must be an active member or creator of the mission (Section 25 & 90)
    const canAccess = await this.canUserAccessMission(missionId, user);
    if (!canAccess) {
      throw new AppError(
        'Access denied. You are not authorized to view activity for this mission.',
        403,
        'MISSION_ACCESS_DENIED'
      );
    }

    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 50));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {
      missionId: new mongoose.Types.ObjectId(missionId),
    };

    if (options.eventType && Object.values(MissionEventType).includes(options.eventType)) {
      query.eventType = options.eventType;
    }

    // Deterministic chronological ordering (newest first for feed, deterministic fallback by _id)
    const [events, total] = await Promise.all([
      MissionEvent.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actorId', 'id name email role')
        .exec(),
      MissionEvent.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get single event detail with authorization check
   */
  async getEventById(eventId: string, user: UserPayload): Promise<IMissionEventDocument> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      throw new AppError('Invalid event ID format', 400, 'INVALID_EVENT_ID');
    }

    const event = await MissionEvent.findById(eventId).populate('actorId', 'id name email role');
    if (!event) {
      throw new AppError('Mission event not found', 404, 'EVENT_NOT_FOUND');
    }

    const canAccess = await this.canUserAccessMission(event.missionId.toString(), user);
    if (!canAccess) {
      throw new AppError('Access denied for this mission event', 403, 'MISSION_ACCESS_DENIED');
    }

    return event;
  }
}

export const missionEventService = new MissionEventService();
