import mongoose from 'mongoose';
import { Task, ITaskDocument } from '../models/Task';
import { Mission } from '../models/Mission';
import { User } from '../models/User';
import { MissionMember } from '../models/MissionMember';
import { AppError } from '../middleware/error.middleware';
import { UserPayload, TaskStatus, TaskStats, PaginationMeta, MissionEventType, EventTargetType, EventSource } from '../types';
import {
  CreateTaskInput,
  UpdateTaskInput,
  TaskQueryInput,
} from '../validators/task.validator';
import { getIO } from '../sockets/socket';
import { missionEventService } from './missionEvent.service';

export class TaskService {
  /**
   * Helper to ensure ID is a valid MongoDB ObjectId
   */
  validateObjectId(id: string, name: string = 'ID'): void {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(`Invalid ${name} format`, 400, 'INVALID_ID_FORMAT');
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
      // Ignored if socket not initialized in test runners
    }
  }

  /**
   * Priority sort weighting helper
   */
  private getPriorityWeight(priority: string): number {
    switch (priority) {
      case 'CRITICAL':
        return 4;
      case 'HIGH':
        return 3;
      case 'MEDIUM':
        return 2;
      case 'LOW':
        return 1;
      default:
        return 0;
    }
  }

  /**
   * Verify whether a user can be assigned to a task within a mission (Section 70)
   */
  async validateAssignee(missionId: string, userId: string): Promise<void> {
    this.validateObjectId(userId, 'Assignee ID');

    // 1. User exists and is active
    const user = await User.findById(userId);
    if (!user || user.isActive === false) {
      throw new AppError('Assignee does not exist or is inactive', 400, 'TASK_INVALID_ASSIGNEE');
    }

    // 2. User must have role FIELD_OPERATOR (Section 26)
    if (user.role !== 'FIELD_OPERATOR') {
      throw new AppError(
        'Tasks can only be assigned to Field Operators',
        400,
        'TASK_INVALID_ASSIGNEE'
      );
    }

    // 3. User must be an active member of this mission (Section 26 & 70)
    const membership = await MissionMember.findOne({
      missionId,
      userId,
      status: 'ACTIVE',
    });

    if (!membership) {
      throw new AppError(
        'Assignee must be an active member of this mission',
        400,
        'TASK_INVALID_ASSIGNEE'
      );
    }
  }

  /**
   * Create Task (Commander only, Section 24)
   */
  async createTask(
    missionId: string,
    commanderId: string,
    input: CreateTaskInput
  ): Promise<ITaskDocument> {
    this.validateObjectId(missionId, 'Mission ID');

    // 1. Verify mission exists
    const mission = await Mission.findById(missionId);
    if (!mission) {
      throw new AppError('Mission not found', 404, 'MISSION_NOT_FOUND');
    }

    // 2. Verify commander owns mission (Section 24)
    if (mission.createdBy.toString() !== commanderId) {
      throw new AppError(
        'Access denied. Only the mission commander can create tasks.',
        403,
        'TASK_ACCESS_DENIED'
      );
    }

    // 3. Verify mission is operational (DRAFT or ACTIVE) (Section 25 & 68)
    if (mission.status === 'COMPLETED' || mission.status === 'CANCELLED') {
      throw new AppError(
        `Cannot create tasks for a mission in ${mission.status} status`,
        400,
        'MISSION_NOT_OPERATIONAL'
      );
    }

    // 4. Validate assignee if provided
    let assignedToObjectId: mongoose.Types.ObjectId | null = null;
    if (input.assignedTo) {
      await this.validateAssignee(missionId, input.assignedTo);
      assignedToObjectId = new mongoose.Types.ObjectId(input.assignedTo);
    }

    // 5. Create task
    const task = new Task({
      missionId: new mongoose.Types.ObjectId(missionId),
      title: input.title,
      description: input.description || '',
      priority: input.priority || 'MEDIUM',
      status: 'PENDING',
      assignedTo: assignedToObjectId,
      createdBy: new mongoose.Types.ObjectId(commanderId),
    });

    await task.save();
    await task.populate([
      { path: 'assignedTo', select: 'id name email role' },
      { path: 'createdBy', select: 'id name email role' },
    ]);

    // Persist immutable TASK_CREATED event (Section 28)
    await missionEventService.createMissionEvent({
      missionId,
      actorId: commanderId,
      eventType: MissionEventType.TASK_CREATED,
      targetType: EventTargetType.TASK,
      targetId: task._id.toString(),
      payload: {
        taskId: task._id.toString(),
        title: task.title,
        priority: task.priority,
        status: task.status,
      },
      source: EventSource.USER,
    });

    // 6. Broadcast event (Section 61)
    this.emitSocketEvent(`mission:${missionId}`, 'task:created', {
      missionId,
      task,
    });
    if (input.assignedTo) {
      this.emitSocketEvent(`user:${input.assignedTo}`, 'task:assigned', {
        missionId,
        task,
      });
    }

    return task;
  }

  /**
   * Get mission tasks (Section 29)
   */
  async getMissionTasks(
    missionId: string,
    user: UserPayload,
    query: TaskQueryInput
  ): Promise<{
    tasks: ITaskDocument[];
    stats: TaskStats;
    pagination: PaginationMeta;
  }> {
    this.validateObjectId(missionId, 'Mission ID');

    // 1. Verify mission exists
    const mission = await Mission.findById(missionId);
    if (!mission) {
      throw new AppError('Mission not found', 404, 'MISSION_NOT_FOUND');
    }

    // 2. Verify user has access to mission
    if (user.role === 'COMMANDER') {
      if (mission.createdBy.toString() !== user.id) {
        throw new AppError('Access denied for this mission', 403, 'MISSION_ACCESS_DENIED');
      }
    } else {
      const isMember = await MissionMember.exists({
        missionId,
        userId: new mongoose.Types.ObjectId(user.id),
        status: 'ACTIVE',
      });
      if (!isMember) {
        throw new AppError('Access denied. You are not an active member of this mission.', 403, 'MISSION_ACCESS_DENIED');
      }
    }

    // 3. Build query filters
    const filter: Record<string, unknown> = { missionId };
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.assignedTo) {
      this.validateObjectId(query.assignedTo, 'Assignee ID');
      filter.assignedTo = new mongoose.Types.ObjectId(query.assignedTo);
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    // 4. Fetch tasks and calculate live stats (Section 82)
    const [tasks, total, statsAggregation] = await Promise.all([
      Task.find(filter)
        .populate([
          { path: 'assignedTo', select: 'id name email role' },
          { path: 'createdBy', select: 'id name email role' },
        ])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Task.countDocuments(filter),
      Task.aggregate([
        { $match: { missionId: new mongoose.Types.ObjectId(missionId) } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
            active: { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] } },
            blocked: { $sum: { $cond: [{ $eq: ['$status', 'BLOCKED'] }, 1, 0] } },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
          },
        },
      ]),
    ]);

    // Sort by priority (Section 58)
    tasks.sort((a, b) => {
      const weightDiff = this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority);
      if (weightDiff !== 0) return weightDiff;
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (b.status === 'ACTIVE' && a.status !== 'ACTIVE') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const stats: TaskStats = statsAggregation[0] || {
      total: 0,
      pending: 0,
      active: 0,
      blocked: 0,
      completed: 0,
    };

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      tasks,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get single task by ID (Section 30)
   */
  async getTaskById(taskId: string, user: UserPayload): Promise<ITaskDocument> {
    this.validateObjectId(taskId, 'Task ID');

    const task = await Task.findById(taskId).populate([
      { path: 'assignedTo', select: 'id name email role' },
      { path: 'createdBy', select: 'id name email role' },
    ]);

    if (!task) {
      throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    }

    // Verify mission access
    const mission = await Mission.findById(task.missionId);
    if (!mission) {
      throw new AppError('Mission not found', 404, 'MISSION_NOT_FOUND');
    }

    if (user.role === 'COMMANDER') {
      if (mission.createdBy.toString() !== user.id) {
        throw new AppError('Access denied for this task', 403, 'TASK_ACCESS_DENIED');
      }
    } else {
      const isMember = await MissionMember.exists({
        missionId: task.missionId,
        userId: new mongoose.Types.ObjectId(user.id),
        status: 'ACTIVE',
      });
      if (!isMember) {
        throw new AppError('Access denied. You are not a member of this mission.', 403, 'TASK_ACCESS_DENIED');
      }
    }

    return task;
  }

  /**
   * Update task parameters (Commander only, Section 35)
   */
  async updateTask(
    taskId: string,
    commanderId: string,
    input: UpdateTaskInput
  ): Promise<ITaskDocument> {
    this.validateObjectId(taskId, 'Task ID');

    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    }

    const mission = await Mission.findById(task.missionId);
    if (!mission || mission.createdBy.toString() !== commanderId) {
      throw new AppError(
        'Access denied. Only the mission commander can edit task parameters.',
        403,
        'TASK_ACCESS_DENIED'
      );
    }

    if (mission.status === 'COMPLETED' || mission.status === 'CANCELLED') {
      throw new AppError('Cannot modify tasks in finalized missions', 400, 'MISSION_NOT_OPERATIONAL');
    }

    if (task.status === 'COMPLETED') {
      throw new AppError('Completed tasks cannot be edited', 400, 'TASK_INVALID_STATUS_TRANSITION');
    }

    if (input.title) task.title = input.title;
    if (input.description !== undefined) task.description = input.description;
    if (input.priority) task.priority = input.priority;

    await task.save();
    await task.populate([
      { path: 'assignedTo', select: 'id name email role' },
      { path: 'createdBy', select: 'id name email role' },
    ]);

    // Persist immutable TASK_UPDATED event (Section 28)
    await missionEventService.createMissionEvent({
      missionId: task.missionId.toString(),
      actorId: commanderId,
      eventType: MissionEventType.TASK_UPDATED,
      targetType: EventTargetType.TASK,
      targetId: task._id.toString(),
      payload: {
        taskId: task._id.toString(),
        title: task.title,
        priority: task.priority,
      },
      source: EventSource.USER,
    });

    this.emitSocketEvent(`mission:${task.missionId}`, 'task:updated', {
      missionId: task.missionId.toString(),
      task,
    });

    return task;
  }

  /**
   * Assign task to an active field operator (Commander only, Section 26 & 27)
   */
  async assignTask(
    taskId: string,
    commanderId: string,
    targetUserId: string
  ): Promise<ITaskDocument> {
    this.validateObjectId(taskId, 'Task ID');
    this.validateObjectId(targetUserId, 'Assignee ID');

    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    }

    const mission = await Mission.findById(task.missionId);
    if (!mission || mission.createdBy.toString() !== commanderId) {
      throw new AppError(
        'Access denied. Only the mission commander can assign tasks.',
        403,
        'TASK_ACCESS_DENIED'
      );
    }

    if (mission.status === 'COMPLETED' || mission.status === 'CANCELLED') {
      throw new AppError('Cannot assign tasks in finalized missions', 400, 'MISSION_NOT_OPERATIONAL');
    }

    if (task.status === 'COMPLETED') {
      throw new AppError('Completed tasks cannot be reassigned', 400, 'TASK_INVALID_STATUS_TRANSITION');
    }

    // Validate assignee belongs to mission and is an active field operator (Section 70)
    await this.validateAssignee(mission.id, targetUserId);

    task.assignedTo = new mongoose.Types.ObjectId(targetUserId);
    await task.save();
    await task.populate([
      { path: 'assignedTo', select: 'id name email role' },
      { path: 'createdBy', select: 'id name email role' },
    ]);

    const assigneeName = (task.assignedTo as any)?.name || 'Operator';
    // Persist immutable TASK_ASSIGNED event (Section 28)
    await missionEventService.createMissionEvent({
      missionId: task.missionId.toString(),
      actorId: commanderId,
      eventType: MissionEventType.TASK_ASSIGNED,
      targetType: EventTargetType.TASK,
      targetId: task._id.toString(),
      payload: {
        taskId: task._id.toString(),
        title: task.title,
        assignedTo: targetUserId,
        assigneeName,
      },
      source: EventSource.USER,
    });

    // Real-time broadcast (Section 61)
    this.emitSocketEvent(`mission:${task.missionId}`, 'task:assigned', {
      missionId: task.missionId.toString(),
      task,
    });
    this.emitSocketEvent(`user:${targetUserId}`, 'task:assigned', {
      missionId: task.missionId.toString(),
      task,
    });

    return task;
  }

  /**
   * Unassign task (Commander only, Section 28)
   */
  async unassignTask(taskId: string, commanderId: string): Promise<ITaskDocument> {
    this.validateObjectId(taskId, 'Task ID');

    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    }

    const mission = await Mission.findById(task.missionId);
    if (!mission || mission.createdBy.toString() !== commanderId) {
      throw new AppError(
        'Access denied. Only the mission commander can unassign tasks.',
        403,
        'TASK_ACCESS_DENIED'
      );
    }

    if (mission.status === 'COMPLETED' || mission.status === 'CANCELLED') {
      throw new AppError('Cannot unassign tasks in finalized missions', 400, 'MISSION_NOT_OPERATIONAL');
    }

    task.assignedTo = null;
    await task.save();
    await task.populate([
      { path: 'assignedTo', select: 'id name email role' },
      { path: 'createdBy', select: 'id name email role' },
    ]);

    // Persist immutable TASK_UNASSIGNED event (Section 28)
    await missionEventService.createMissionEvent({
      missionId: task.missionId.toString(),
      actorId: commanderId,
      eventType: MissionEventType.TASK_UNASSIGNED,
      targetType: EventTargetType.TASK,
      targetId: task._id.toString(),
      payload: {
        taskId: task._id.toString(),
        title: task.title,
      },
      source: EventSource.USER,
    });

    this.emitSocketEvent(`mission:${task.missionId}`, 'task:unassigned', {
      missionId: task.missionId.toString(),
      task,
    });

    return task;
  }

  /**
   * Update Task Status with strict state machine and authorization (Section 23, 31, 32, 33)
   */
  async updateTaskStatus(
    taskId: string,
    user: UserPayload,
    newStatus: TaskStatus
  ): Promise<ITaskDocument> {
    this.validateObjectId(taskId, 'Task ID');

    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    }

    const mission = await Mission.findById(task.missionId);
    if (!mission) {
      throw new AppError('Mission not found', 404, 'MISSION_NOT_FOUND');
    }

    // 1. Mission must be operational (Section 68)
    if (mission.status === 'COMPLETED' || mission.status === 'CANCELLED') {
      throw new AppError(
        `Cannot update tasks for a mission in ${mission.status} status`,
        400,
        'MISSION_NOT_OPERATIONAL'
      );
    }

    // 2. Authorization check (Section 32, 67, 69)
    if (user.role === 'COMMANDER') {
      // Commander must own the mission
      if (mission.createdBy.toString() !== user.id) {
        throw new AppError(
          'Access denied. You do not command this mission.',
          403,
          'TASK_ACCESS_DENIED'
        );
      }
    } else {
      // Field Operator: Must be active member AND task must be assigned to them
      const isMember = await MissionMember.exists({
        missionId: task.missionId,
        userId: new mongoose.Types.ObjectId(user.id),
        status: 'ACTIVE',
      });

      if (!isMember) {
        throw new AppError(
          'Access denied. You are not an active member of this mission.',
          403,
          'TASK_ACCESS_DENIED'
        );
      }

      if (!task.assignedTo || task.assignedTo.toString() !== user.id) {
        throw new AppError(
          'Access denied. You can only update tasks assigned to your callsign.',
          403,
          'TASK_ACCESS_DENIED'
        );
      }
    }

    // 3. Strict State Machine transitions (Section 23 & 66)
    const currentStatus = task.status;
    const now = new Date();

    if (currentStatus === newStatus) {
      return task; // No-op
    }

    if (currentStatus === 'PENDING') {
      if (newStatus === 'ACTIVE') {
        task.status = 'ACTIVE';
        task.startedAt = now;
      } else if (newStatus === 'BLOCKED') {
        task.status = 'BLOCKED';
        task.blockedAt = now;
      } else {
        throw new AppError(
          `Invalid task state transition from ${currentStatus} to ${newStatus}`,
          400,
          'TASK_INVALID_STATUS_TRANSITION'
        );
      }
    } else if (currentStatus === 'ACTIVE') {
      if (newStatus === 'COMPLETED') {
        task.status = 'COMPLETED';
        task.completedAt = now;
      } else if (newStatus === 'BLOCKED') {
        task.status = 'BLOCKED';
        task.blockedAt = now;
      } else {
        throw new AppError(
          `Invalid task state transition from ${currentStatus} to ${newStatus}`,
          400,
          'TASK_INVALID_STATUS_TRANSITION'
        );
      }
    } else if (currentStatus === 'BLOCKED') {
      if (newStatus === 'ACTIVE') {
        task.status = 'ACTIVE';
        task.startedAt = now; // Resume task (Section 85)
      } else {
        throw new AppError(
          `Invalid task state transition from ${currentStatus} to ${newStatus}`,
          400,
          'TASK_INVALID_STATUS_TRANSITION'
        );
      }
    } else if (currentStatus === 'COMPLETED') {
      // Completed tasks cannot transition (Section 23)
      throw new AppError(
        'Completed tasks cannot be modified',
        400,
        'TASK_INVALID_STATUS_TRANSITION'
      );
    }

    await task.save();
    await task.populate([
      { path: 'assignedTo', select: 'id name email role' },
      { path: 'createdBy', select: 'id name email role' },
    ]);

    let eventType: MissionEventType = MissionEventType.TASK_STARTED;
    if (newStatus === 'BLOCKED') {
      eventType = MissionEventType.TASK_BLOCKED;
    } else if (newStatus === 'COMPLETED') {
      eventType = MissionEventType.TASK_COMPLETED;
    }

    // Persist immutable TASK_STARTED / TASK_BLOCKED / TASK_COMPLETED event (Section 28)
    await missionEventService.createMissionEvent({
      missionId: task.missionId.toString(),
      actorId: user.id,
      eventType,
      targetType: EventTargetType.TASK,
      targetId: task._id.toString(),
      payload: {
        taskId: task._id.toString(),
        title: task.title,
        status: newStatus,
      },
      source: EventSource.USER,
    });

    // Broadcast status change (Section 61)
    this.emitSocketEvent(`mission:${task.missionId}`, 'task:status_changed', {
      missionId: task.missionId.toString(),
      task,
    });
    if (task.assignedTo) {
      const assignedId =
        typeof task.assignedTo === 'object' && 'id' in task.assignedTo
          ? (task.assignedTo as { id: string }).id
          : String(task.assignedTo);
      this.emitSocketEvent(`user:${assignedId}`, 'task:status_changed', {
        missionId: task.missionId.toString(),
        task,
      });
    }
    this.emitSocketEvent(`user:${mission.createdBy}`, 'task:status_changed', {
      missionId: task.missionId.toString(),
      task,
    });

    return task;
  }

  /**
   * User dashboard task statistics aggregation (Section 79)
   */
  async getUserTaskStats(user: UserPayload): Promise<TaskStats> {
    const filter: Record<string, unknown> = {};

    if (user.role === 'COMMANDER') {
      // Tasks for missions commanded by user
      const missions = await Mission.find({ createdBy: new mongoose.Types.ObjectId(user.id) }).select('_id');
      const missionIds = missions.map((m) => m._id);
      filter.missionId = { $in: missionIds };
    } else {
      // Tasks assigned to this field operator
      filter.assignedTo = new mongoose.Types.ObjectId(user.id);
    }

    const [total, pending, active, blocked, completed] = await Promise.all([
      Task.countDocuments(filter),
      Task.countDocuments({ ...filter, status: 'PENDING' }),
      Task.countDocuments({ ...filter, status: 'ACTIVE' }),
      Task.countDocuments({ ...filter, status: 'BLOCKED' }),
      Task.countDocuments({ ...filter, status: 'COMPLETED' }),
    ]);

    return {
      total,
      pending,
      active,
      blocked,
      completed,
    };
  }

  /**
   * Get all tasks assigned to the current user across active missions (for Field Operator "My Tasks")
   */
  async getMyAssignedTasks(userId: string): Promise<ITaskDocument[]> {
    this.validateObjectId(userId, 'User ID');

    // Get active mission IDs where operator is an active member
    const activeMemberships = await MissionMember.find({
      userId: new mongoose.Types.ObjectId(userId),
      status: 'ACTIVE',
    }).select('missionId');

    const missionIds = activeMemberships.map((m) => m.missionId);

    const tasks = await Task.find({
      assignedTo: new mongoose.Types.ObjectId(userId),
      missionId: { $in: missionIds },
    })
      .populate([
        { path: 'missionId', select: 'id title location severity status' },
        { path: 'assignedTo', select: 'id name email role' },
        { path: 'createdBy', select: 'id name email role' },
      ])
      .sort({ createdAt: -1 })
      .exec();

    // Sort by priority then status
    tasks.sort((a, b) => {
      const weightDiff = this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority);
      if (weightDiff !== 0) return weightDiff;
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (b.status === 'ACTIVE' && a.status !== 'ACTIVE') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return tasks;
  }
}

export const taskService = new TaskService();
