import mongoose from 'mongoose';
import { MissionEvent, IMissionEventDocument } from '../models/MissionEvent';
import { Mission } from '../models/Mission';
import { MissionMember } from '../models/MissionMember';
import { User } from '../models/User';
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
import { deterministicFingerprint } from './idempotency.service';
import { afterCommit, inUnitOfWork, withUnitOfWork } from './unitOfWork';

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
  private sanitizePayload(payload: Record<string, unknown>, legacyArrays = false): Record<string, unknown> {
    if (!payload || typeof payload !== 'object') {
      return {};
    }

    const sanitize = (value: unknown): unknown => {
      if (value === null || typeof value !== 'object' ||
        value instanceof Date || value instanceof mongoose.Types.ObjectId) {
        return value;
      }
      if (Array.isArray(value) && !legacyArrays) {
        return value.map(sanitize);
      }
      return Object.fromEntries(Object.entries(value)
        .filter(([key]) => !this.SENSITIVE_KEYS.has(key.toLowerCase()))
        .map(([key, entry]) => [key, sanitize(entry)]));
    };
    return sanitize(payload) as Record<string, unknown>;
  }

  /**
   * Safely broadcast Socket.IO event to mission room
   */
  private emitSocketEvent(room: string, event: string, data: unknown): void {
    const snapshot: unknown = JSON.parse(JSON.stringify(data));
    afterCommit(() => {
      try {
        const io = getIO();
        if (io) {
          io.to(room).emit(event, snapshot);
        }
      } catch {
        // In tests or headless execution where socket is uninitialized, proceed gracefully
      }
    });
  }

  private eventFingerprint(event: Pick<IMissionEventDocument,
    'missionId' | 'actorId' | 'eventType' | 'targetType' | 'targetId' |
    'payload' | 'source' | 'clientCreatedAt' | 'deviceId' | 'mutationId'>): string {
    // actorId can be populated on a replay, but its logical identity is still
    // the user's ObjectId rather than the mutable display-name/profile fields.
    const actor = event.actorId as unknown as { _id?: mongoose.Types.ObjectId };
    return deterministicFingerprint({
      missionId: event.missionId.toString(),
      actorId: (actor._id || event.actorId).toString(),
      eventType: event.eventType,
      targetType: event.targetType,
      targetId: event.targetId?.toString() || null,
      payload: event.payload,
      source: event.source,
      clientCreatedAt: event.clientCreatedAt?.toISOString() || null,
      ...(event.deviceId ? { deviceId: event.deviceId } : {}),
      ...(event.mutationId ? { mutationId: event.mutationId } : {}),
    });
  }

  /**
   * Record and broadcast an immutable MissionEvent (Sections 13, 16, 18, 20, 35, 37)
   */
  async createMissionEvent(input: CreateMissionEventInput): Promise<IMissionEventDocument> {
    if (!inUnitOfWork()) return withUnitOfWork(() => this.createMissionEvent(input));
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

    if (clientCreatedAt && !Number.isFinite(clientCreatedAt.getTime())) {
      throw new AppError('Invalid client timestamp for event creation', 400, 'VALIDATION_ERROR');
    }
    if (targetId && !mongoose.Types.ObjectId.isValid(targetId)) {
      throw new AppError('Invalid target ID for event creation', 400, 'INVALID_ID_FORMAT');
    }

    // Build event with sanitized payload
    const sanitized = this.sanitizePayload(payload);
    const key = idempotencyKey?.trim();
    const eventData = {
      missionId: new mongoose.Types.ObjectId(missionId),
      actorId: new mongoose.Types.ObjectId(actorId),
      eventType,
      targetType,
      targetId: targetId && mongoose.Types.ObjectId.isValid(targetId) ? new mongoose.Types.ObjectId(targetId) : null,
      payload: sanitized,
      source: source || EventSource.USER,
      clientCreatedAt: clientCreatedAt || null,
      ...(key ? { idempotencyKey: key } : {}),
      ...(input.deviceId ? { deviceId: input.deviceId } : {}),
      ...(input.mutationId ? { mutationId: input.mutationId } : {}),
    };

    const expectedFingerprint = this.eventFingerprint(eventData);
    const verifyReplay = (existing: IMissionEventDocument): IMissionEventDocument => {
      // New events hash only the original sanitized request, before the server
      // adds its actor snapshot. A rename/role change must not change its meaning.
      // Legacy events have no hash and may contain the old array-as-object
      // representation; compare it without mutating/backfilling their history.
      const matches = existing.requestFingerprint
        ? existing.requestFingerprint === expectedFingerprint
        : this.eventFingerprint(existing) === expectedFingerprint ||
          this.eventFingerprint(existing) === this.eventFingerprint({
            ...eventData, payload: this.sanitizePayload(payload, true),
          });
      if (!matches) {
        throw new AppError('Idempotency key was already used for a different event', 409, 'IDEMPOTENCY_KEY_REUSED');
      }
      return existing;
    };
    const findExisting = () => MissionEvent.findOne({
      missionId: eventData.missionId,
      idempotencyKey: key,
    }).select('+requestFingerprint');

    if (key) {
      const existing = await findExisting();
      if (existing) {
        // Verify against the retained actor ObjectId before population, which
        // can legitimately produce null after the original actor is deleted.
        verifyReplay(existing);
        await existing.populate('actorId', 'id name email role');
        return existing;
      }
    }

    // Verify target mission exists
    const missionExists = await Mission.exists({ _id: eventData.missionId });
    if (!missionExists) {
      throw new AppError('Target mission does not exist', 404, 'MISSION_NOT_FOUND');
    }

    const actor = await User.findById(eventData.actorId).select('name role');
    if (!actor) {
      throw new AppError('Event actor does not exist', 404, 'ACTOR_NOT_FOUND');
    }
    // Snapshot identity from the authenticated server-side actor record, never
    // from caller labels. Legacy aliases must not become replay fallbacks for
    // spoofed data. Email is optional in replay and unnecessary for attribution.
    const snapshotPayload = { ...sanitized };
    delete snapshotPayload.actorName;
    delete snapshotPayload.actorEmail;
    delete snapshotPayload.actorRole;
    snapshotPayload.actor = { id: actor._id.toString(), name: actor.name, role: actor.role };

    // Serialize causal appends through the mission document. A cross-process
    // writer must retry on the clock's write conflict; each committed event has
    // a strictly greater millisecond, independent of process ObjectId prefixes.
    // The legacy maximum also makes the first append to old history monotonic.
    const previous = await MissionEvent.findOne({ missionId: eventData.missionId }).sort({ createdAt: -1, _id: -1 }).select('createdAt');
    const clock = await Mission.findOneAndUpdate({ _id: eventData.missionId }, [{ $set: {
      eventClock: { $max: [
        { $toLong: '$$NOW' },
        { $add: [{ $ifNull: ['$eventClock', 0] }, 1] },
        (previous?.createdAt.getTime() ?? 0) + 1,
      ] },
    } }], { new: true, timestamps: false }).select('+eventClock');
    if (!clock?.eventClock) throw new AppError('Mission event clock unavailable', 500, 'EVENT_CLOCK_FAILED');
    const event = new MissionEvent({ ...eventData, payload: snapshotPayload,
      requestFingerprint: expectedFingerprint, createdAt: new Date(clock.eventClock) });
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
    if (!inUnitOfWork()) return withUnitOfWork(() => this.recordObservation(missionId, user, input));
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
