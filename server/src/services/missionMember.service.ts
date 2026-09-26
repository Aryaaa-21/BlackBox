import mongoose from 'mongoose';
import { MissionMember, IMissionMemberDocument } from '../models/MissionMember';
import { Mission } from '../models/Mission';
import { User } from '../models/User';
import { AppError } from '../middleware/error.middleware';
import { UserPayload, MissionEventType, EventTargetType, EventSource } from '../types';
import { getIO } from '../sockets/socket';
import { missionEventService } from './missionEvent.service';

export class MissionMemberService {
  /**
   * Helper to ensure ID is a valid MongoDB ObjectId
   */
  validateObjectId(id: string, name: string = 'ID'): void {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(`Invalid ${name} format`, 400, 'INVALID_ID_FORMAT');
    }
  }

  /**
   * Safe socket event emission helper
   */
  private emitSocketEvent(room: string, event: string, payload: unknown): void {
    try {
      const io = getIO();
      if (io) {
        io.to(room).emit(event, payload);
      }
    } catch {
      // Ignored if socket not initialized in test runners
    }
  }

  /**
   * Verify if user is the primary commander of the mission
   */
  async isMissionCommander(missionId: string, userId: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(missionId)) return false;
    const mission = await Mission.findById(missionId).select('createdBy');
    if (!mission) return false;
    return mission.createdBy.toString() === userId;
  }

  /**
   * Check if user is an active member of the mission
   */
  async isMissionMember(missionId: string, userId: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(missionId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return false;
    }
    const member = await MissionMember.findOne({
      missionId,
      userId,
      status: 'ACTIVE',
    });
    return Boolean(member);
  }

  /**
   * Retrieve active membership document
   */
  async getMembership(missionId: string, userId: string): Promise<IMissionMemberDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(missionId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return null;
    }
    return MissionMember.findOne({ missionId, userId });
  }

  /**
   * Add a field operator to a mission (Commander only)
   */
  async addMember(
    missionId: string,
    commanderId: string,
    targetUserId: string
  ): Promise<IMissionMemberDocument> {
    this.validateObjectId(missionId, 'Mission ID');
    this.validateObjectId(targetUserId, 'User ID');

    // 1. Verify mission exists
    const mission = await Mission.findById(missionId);
    if (!mission) {
      throw new AppError('Mission not found', 404, 'MISSION_NOT_FOUND');
    }

    // 2. Verify requester is mission commander (Section 9)
    if (mission.createdBy.toString() !== commanderId) {
      throw new AppError(
        'Access denied. Only the mission commander can manage team membership.',
        403,
        'MEMBER_ACCESS_DENIED'
      );
    }

    // Cannot add members if mission is finalized (Section 68)
    if (mission.status === 'COMPLETED' || mission.status === 'CANCELLED') {
      throw new AppError(
        `Cannot add members to a mission in ${mission.status} status`,
        400,
        'MISSION_NOT_OPERATIONAL'
      );
    }

    // 3. Verify target user is not the commander themselves
    if (commanderId === targetUserId) {
      throw new AppError('Cannot add yourself as a field operator', 400, 'INVALID_MEMBER');
    }

    // 4. Verify target user exists and is active
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      throw new AppError('Target user does not exist', 404, 'MEMBER_NOT_FOUND');
    }

    if (targetUser.isActive === false) {
      throw new AppError('Cannot add inactive user to operational team', 400, 'INVALID_MEMBER');
    }

    if (targetUser.role !== 'FIELD_OPERATOR') {
      throw new AppError('Only Field Operators can be assigned to mission team', 400, 'INVALID_MEMBER');
    }

    // 5. Check if membership already exists (Section 6 & 12)
    let membership = await MissionMember.findOne({ missionId, userId: targetUserId });

    if (membership) {
      if (membership.status === 'ACTIVE') {
        throw new AppError('Operator is already an active member of this mission', 409, 'MEMBER_ALREADY_EXISTS');
      }

      // Reactivate removed member (Section 12)
      membership.status = 'ACTIVE';
      membership.joinedAt = new Date();
      await membership.save();
      await membership.populate('userId', 'id name email role');

      // Persist immutable MEMBER_REACTIVATED event (Section 27)
      const reactivatedUserName = (membership.userId as any)?.name || 'Field Operator';
      await missionEventService.createMissionEvent({
        missionId,
        actorId: commanderId,
        eventType: MissionEventType.MEMBER_REACTIVATED,
        targetType: EventTargetType.MEMBER,
        targetId: membership._id.toString(),
        payload: {
          userId: targetUserId,
          userName: reactivatedUserName,
          role: membership.role,
        },
        source: EventSource.USER,
      });

      // Realtime notification
      this.emitSocketEvent(`mission:${missionId}`, 'mission:member_reactivated', {
        missionId,
        member: membership,
      });
      this.emitSocketEvent(`user:${targetUserId}`, 'mission:member_reactivated', {
        missionId,
        member: membership,
      });

      return membership;
    }

    // 6. Create new active membership
    membership = new MissionMember({
      missionId: new mongoose.Types.ObjectId(missionId),
      userId: new mongoose.Types.ObjectId(targetUserId),
      role: 'FIELD_OPERATOR',
      status: 'ACTIVE',
      joinedAt: new Date(),
    });

    await membership.save();
    await membership.populate('userId', 'id name email role');

    // Persist immutable MEMBER_ASSIGNED event (Section 27)
    const addedUserName = (membership.userId as any)?.name || 'Field Operator';
    await missionEventService.createMissionEvent({
      missionId,
      actorId: commanderId,
      eventType: MissionEventType.MEMBER_ASSIGNED,
      targetType: EventTargetType.MEMBER,
      targetId: membership._id.toString(),
      payload: {
        userId: targetUserId,
        userName: addedUserName,
        role: membership.role,
      },
      source: EventSource.USER,
    });

    // Realtime notification
    this.emitSocketEvent(`mission:${missionId}`, 'mission:member_added', {
      missionId,
      member: membership,
    });
    this.emitSocketEvent(`user:${targetUserId}`, 'mission:member_added', {
      missionId,
      member: membership,
    });

    return membership;
  }

  /**
   * Remove a member from the mission (Commander only)
   */
  async removeMember(
    missionId: string,
    commanderId: string,
    targetUserId: string
  ): Promise<IMissionMemberDocument> {
    this.validateObjectId(missionId, 'Mission ID');
    this.validateObjectId(targetUserId, 'User ID');

    // 1. Verify mission exists
    const mission = await Mission.findById(missionId);
    if (!mission) {
      throw new AppError('Mission not found', 404, 'MISSION_NOT_FOUND');
    }

    // 2. Verify requester is mission commander
    if (mission.createdBy.toString() !== commanderId) {
      throw new AppError(
        'Access denied. Only the mission commander can remove team members.',
        403,
        'MEMBER_ACCESS_DENIED'
      );
    }

    // 3. Cannot remove the mission creator (Section 11)
    if (mission.createdBy.toString() === targetUserId) {
      throw new AppError('Cannot remove primary mission commander', 400, 'CANNOT_REMOVE_COMMANDER');
    }

    // 4. Find existing membership
    const membership = await MissionMember.findOne({ missionId, userId: targetUserId });
    if (!membership) {
      throw new AppError('Operator is not a member of this mission', 404, 'MEMBER_NOT_FOUND');
    }

    if (membership.status === 'REMOVED') {
      throw new AppError('Operator is already removed from this mission', 400, 'MEMBER_ALREADY_REMOVED');
    }

    // 5. Soft-delete membership (Section 11: preserve historical audit)
    membership.status = 'REMOVED';
    await membership.save();
    await membership.populate('userId', 'id name email role');

    // Persist immutable MEMBER_REMOVED event (Section 27)
    const removedUserName = (membership.userId as any)?.name || 'Field Operator';
    await missionEventService.createMissionEvent({
      missionId,
      actorId: commanderId,
      eventType: MissionEventType.MEMBER_REMOVED,
      targetType: EventTargetType.MEMBER,
      targetId: membership._id.toString(),
      payload: {
        userId: targetUserId,
        userName: removedUserName,
        role: membership.role,
      },
      source: EventSource.USER,
    });

    // Realtime broadcast
    this.emitSocketEvent(`mission:${missionId}`, 'mission:member_removed', {
      missionId,
      userId: targetUserId,
      member: membership,
    });
    this.emitSocketEvent(`user:${targetUserId}`, 'mission:member_removed', {
      missionId,
      userId: targetUserId,
      member: membership,
    });

    return membership;
  }

  /**
   * Get team members for a mission (Accessible by Commander and Active Members)
   */
  async getMissionMembers(
    missionId: string,
    user: UserPayload,
    includeRemoved: boolean = false
  ): Promise<IMissionMemberDocument[]> {
    this.validateObjectId(missionId, 'Mission ID');

    const mission = await Mission.findById(missionId);
    if (!mission) {
      throw new AppError('Mission not found', 404, 'MISSION_NOT_FOUND');
    }

    // Access control (Section 14 & 15)
    if (user.role === 'COMMANDER') {
      if (mission.createdBy.toString() !== user.id) {
        throw new AppError('Access denied for this mission', 403, 'MISSION_ACCESS_DENIED');
      }
    } else {
      // Field Operator must be an active member of the mission
      const isMember = await this.isMissionMember(missionId, user.id);
      if (!isMember) {
        throw new AppError('Access denied. You are not an active member of this mission.', 403, 'MISSION_ACCESS_DENIED');
      }
    }

    const filter: Record<string, unknown> = { missionId };
    if (!includeRemoved) {
      filter.status = 'ACTIVE';
    }

    const members = await MissionMember.find(filter)
      .populate('userId', 'id name email role')
      .sort({ role: 1, createdAt: 1 })
      .exec();

    return members;
  }

  /**
   * Internal helper to fetch all active members of a mission
   */
  async getActiveMissionMembers(missionId: string): Promise<IMissionMemberDocument[]> {
    return MissionMember.find({ missionId, status: 'ACTIVE' })
      .populate('userId', 'id name email role')
      .exec();
  }
}

export const missionMemberService = new MissionMemberService();
