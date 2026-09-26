import mongoose from 'mongoose';
import { Mission, IMissionDocument } from '../models/Mission';
import { AppError } from '../middleware/error.middleware';
import { UserPayload, MissionStats, PaginationMeta } from '../types';
import { CreateMissionInput, UpdateMissionInput, MissionQueryInput } from '../validators/mission.validator';
import { getIO } from '../sockets/socket';

export class MissionService {
  /**
   * Helper to ensure ID is a valid MongoDB ObjectId
   */
  validateObjectId(id: string): void {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid mission ID format', 400, 'INVALID_MISSION_ID');
    }
  }

  /**
   * Helper to emit socket events safely
   */
  private emitSocketEvent(room: string, event: string, payload: unknown): void {
    try {
      const io = getIO();
      if (io) {
        io.to(room).emit(event, payload);
      }
    } catch {
      // Sockets might not be initialized in isolated unit test runners
    }
  }

  /**
   * Create Mission (Commander only)
   */
  async createMission(userId: string, input: CreateMissionInput): Promise<IMissionDocument> {
    const mission = new Mission({
      title: input.title,
      description: input.description,
      location: input.location,
      severity: input.severity,
      status: 'DRAFT',
      createdBy: new mongoose.Types.ObjectId(userId),
    });

    await mission.save();
    await mission.populate('createdBy', 'id name email role');

    // Real-time broadcast
    this.emitSocketEvent(`user:${userId}`, 'mission:created', mission);

    return mission;
  }

  /**
   * Get accessible missions for authenticated user
   */
  async getUserMissions(
    user: UserPayload,
    query: MissionQueryInput
  ): Promise<{ missions: IMissionDocument[]; pagination: PaginationMeta }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    // Filter construction
    const filter: Record<string, unknown> = {};

    if (user.role === 'COMMANDER') {
      // Commander sees missions they created
      filter.createdBy = new mongoose.Types.ObjectId(user.id);
    } else {
      // Field Operator sees operational/accessible missions in deployment
      // (Future Phase 4 will refine team member assignment lookup)
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.severity) {
      filter.severity = query.severity;
    }

    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { location: { $regex: query.search, $options: 'i' } },
      ];
    }

    const [missions, total] = await Promise.all([
      Mission.find(filter)
        .populate('createdBy', 'id name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Mission.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      missions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieve single mission by ID with access verification
   */
  async getMissionById(missionId: string, user: UserPayload): Promise<IMissionDocument> {
    this.validateObjectId(missionId);

    const mission = await Mission.findById(missionId).populate('createdBy', 'id name email role');

    if (!mission) {
      throw new AppError('Mission not found', 404, 'MISSION_NOT_FOUND');
    }

    // Access control: If commander, must own the mission
    const creatorId =
      typeof mission.createdBy === 'object' && '_id' in mission.createdBy
        ? (mission.createdBy as { _id: mongoose.Types.ObjectId })._id.toString()
        : mission.createdBy.toString();

    if (user.role === 'COMMANDER' && creatorId !== user.id) {
      throw new AppError('Access denied. You do not have clearance for this mission.', 403, 'MISSION_ACCESS_DENIED');
    }

    return mission;
  }

  /**
   * Check if user is authorized to join the mission room
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

    // Field operators are permitted to observe active unit missions
    return true;
  }

  /**
   * Edit mission details (Commander/Owner only)
   */
  async updateMission(
    missionId: string,
    userId: string,
    input: UpdateMissionInput
  ): Promise<IMissionDocument> {
    this.validateObjectId(missionId);

    const mission = await Mission.findById(missionId);
    if (!mission) {
      throw new AppError('Mission not found', 404, 'MISSION_NOT_FOUND');
    }

    if (mission.createdBy.toString() !== userId) {
      throw new AppError('Access denied. Only the mission creator can edit details.', 403, 'MISSION_ACCESS_DENIED');
    }

    // Cannot edit completed or cancelled missions
    if (mission.status === 'COMPLETED' || mission.status === 'CANCELLED') {
      throw new AppError(
        `Cannot edit mission in ${mission.status} status`,
        400,
        'MISSION_INVALID_STATUS'
      );
    }

    if (input.title) mission.title = input.title;
    if (input.description) mission.description = input.description;
    if (input.location) mission.location = input.location;
    if (input.severity) mission.severity = input.severity;

    await mission.save();
    await mission.populate('createdBy', 'id name email role');

    // Realtime broadcast to mission room and creator
    this.emitSocketEvent(`mission:${missionId}`, 'mission:updated', mission);
    this.emitSocketEvent(`user:${userId}`, 'mission:updated', mission);

    return mission;
  }

  /**
   * Start Mission (DRAFT -> ACTIVE)
   */
  async startMission(missionId: string, userId: string): Promise<IMissionDocument> {
    this.validateObjectId(missionId);

    const mission = await Mission.findById(missionId);
    if (!mission) {
      throw new AppError('Mission not found', 404, 'MISSION_NOT_FOUND');
    }

    if (mission.createdBy.toString() !== userId) {
      throw new AppError('Access denied. Only the mission creator can start this mission.', 403, 'MISSION_ACCESS_DENIED');
    }

    // State machine check
    if (mission.status === 'ACTIVE') {
      throw new AppError('Mission is already active', 400, 'MISSION_ALREADY_ACTIVE');
    }
    if (mission.status === 'COMPLETED') {
      throw new AppError('Completed missions cannot be restarted', 400, 'MISSION_ALREADY_COMPLETED');
    }
    if (mission.status === 'CANCELLED') {
      throw new AppError('Cancelled missions cannot be started', 400, 'MISSION_ALREADY_CANCELLED');
    }
    if (mission.status !== 'DRAFT') {
      throw new AppError(
        `Invalid lifecycle transition from ${mission.status} to ACTIVE`,
        400,
        'MISSION_INVALID_STATUS'
      );
    }

    // Atomic update
    mission.status = 'ACTIVE';
    mission.startedAt = new Date();
    await mission.save();
    await mission.populate('createdBy', 'id name email role');

    // Broadcast lifecycle event
    this.emitSocketEvent(`mission:${missionId}`, 'mission:started', mission);
    this.emitSocketEvent(`user:${userId}`, 'mission:started', mission);

    return mission;
  }

  /**
   * Complete Mission (ACTIVE -> COMPLETED)
   */
  async completeMission(missionId: string, userId: string): Promise<IMissionDocument> {
    this.validateObjectId(missionId);

    const mission = await Mission.findById(missionId);
    if (!mission) {
      throw new AppError('Mission not found', 404, 'MISSION_NOT_FOUND');
    }

    if (mission.createdBy.toString() !== userId) {
      throw new AppError('Access denied. Only the mission creator can complete this mission.', 403, 'MISSION_ACCESS_DENIED');
    }

    // State machine check
    if (mission.status === 'COMPLETED') {
      throw new AppError('Mission is already completed', 400, 'MISSION_ALREADY_COMPLETED');
    }
    if (mission.status === 'CANCELLED') {
      throw new AppError('Cancelled missions cannot be completed', 400, 'MISSION_ALREADY_CANCELLED');
    }
    if (mission.status === 'DRAFT') {
      throw new AppError('Cannot complete a draft mission. Mission must first be active.', 400, 'MISSION_INVALID_STATUS');
    }
    if (mission.status !== 'ACTIVE') {
      throw new AppError(
        `Invalid lifecycle transition from ${mission.status} to COMPLETED`,
        400,
        'MISSION_INVALID_STATUS'
      );
    }

    mission.status = 'COMPLETED';
    mission.completedAt = new Date();
    await mission.save();
    await mission.populate('createdBy', 'id name email role');

    // Broadcast lifecycle event
    this.emitSocketEvent(`mission:${missionId}`, 'mission:completed', mission);
    this.emitSocketEvent(`user:${userId}`, 'mission:completed', mission);

    return mission;
  }

  /**
   * Cancel Mission (DRAFT or ACTIVE -> CANCELLED)
   */
  async cancelMission(missionId: string, userId: string): Promise<IMissionDocument> {
    this.validateObjectId(missionId);

    const mission = await Mission.findById(missionId);
    if (!mission) {
      throw new AppError('Mission not found', 404, 'MISSION_NOT_FOUND');
    }

    if (mission.createdBy.toString() !== userId) {
      throw new AppError('Access denied. Only the mission creator can cancel this mission.', 403, 'MISSION_ACCESS_DENIED');
    }

    // State machine check
    if (mission.status === 'CANCELLED') {
      throw new AppError('Mission is already cancelled', 400, 'MISSION_ALREADY_CANCELLED');
    }
    if (mission.status === 'COMPLETED') {
      throw new AppError('Completed missions cannot be cancelled', 400, 'MISSION_ALREADY_COMPLETED');
    }

    mission.status = 'CANCELLED';
    mission.cancelledAt = new Date();
    await mission.save();
    await mission.populate('createdBy', 'id name email role');

    // Broadcast lifecycle event
    this.emitSocketEvent(`mission:${missionId}`, 'mission:cancelled', mission);
    this.emitSocketEvent(`user:${userId}`, 'mission:cancelled', mission);

    return mission;
  }

  /**
   * Real mission statistics calculated from MongoDB
   */
  async getMissionStats(user: UserPayload): Promise<MissionStats> {
    const filter: Record<string, unknown> = {};
    if (user.role === 'COMMANDER') {
      filter.createdBy = new mongoose.Types.ObjectId(user.id);
    }

    const [total, active, draft, completed, cancelled] = await Promise.all([
      Mission.countDocuments(filter),
      Mission.countDocuments({ ...filter, status: 'ACTIVE' }),
      Mission.countDocuments({ ...filter, status: 'DRAFT' }),
      Mission.countDocuments({ ...filter, status: 'COMPLETED' }),
      Mission.countDocuments({ ...filter, status: 'CANCELLED' }),
    ]);

    return {
      total,
      active,
      draft,
      completed,
      cancelled,
    };
  }
}

export const missionService = new MissionService();
