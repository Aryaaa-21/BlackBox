/**
 * Phase 9 — Product Polish & Demo Mode
 * Demo Service — manages demo data initialization, predictable hackathon state reset,
 * and controlled server-side conflict triggering.
 *
 * SAFETY: Only operates on demo users (*@demo.blackbox.internal) and demo missions.
 * Never deletes or impacts real user data.
 */

import mongoose from 'mongoose';
import { hashPassword } from '../utils/jwt';
import { User, IUserDocument } from '../models/User';
import { Mission, IMissionDocument } from '../models/Mission';
import { MissionMember } from '../models/MissionMember';
import { Task, ITaskDocument } from '../models/Task';
import { MissionEvent, deleteDemoMissionEvents } from '../models/MissionEvent';
import { ProcessedMutation } from '../models/ProcessedMutation';
import { SyncConflict } from '../models/SyncConflict';
import { config } from '../config/env';
import { AppError } from '../middleware/error.middleware';
import {
  MissionEventType,
  EventTargetType,
  EventSource,
  UserPayload,
} from '../types';
import { missionEventService } from './missionEvent.service';
import { inUnitOfWork, withUnitOfWork } from './unitOfWork';

export interface DemoUserCredentials {
  name: string;
  email: string;
  role: 'COMMANDER' | 'FIELD_OPERATOR';
  userId?: string;
}

export interface DemoInitResponse {
  message: string;
  demoUsers: DemoUserCredentials[];
  demoMission: {
    id: string;
    title: string;
    location: string;
    severity: string;
    status: string;
  };
  tasksCount: number;
  eventsCount: number;
}

const DEMO_EMAIL_DOMAIN = '@demo.blackbox.internal';
const DEMO_MISSION_TITLE = 'Campus Emergency Operations';

export class DemoService {
  /**
   * Reset demo data safely and re-seed the standard demo scenario:
   * "Campus Emergency Operations" with 4 users, 5 tasks, and full event history.
   */
  async resetDemo(): Promise<DemoInitResponse> {
    if (!inUnitOfWork()) return withUnitOfWork(() => this.resetDemo());
    if (!config.enableDemoMode) {
      throw new AppError(
        'Demo mode is disabled in this environment',
        403,
        'DEMO_MODE_DISABLED'
      );
    }

    console.log('[DemoService] Initiating controlled demo reset...');

    // 1. Identify existing demo users and missions
    const existingDemoUsers = await User.find({
      email: { $regex: `${DEMO_EMAIL_DOMAIN}$`, $options: 'i' },
    });
    const demoUserIds = existingDemoUsers.map((u) => u._id);

    const existingDemoMissions = await Mission.find({
      // A title is not an ownership boundary. Only missions owned by the
      // dedicated demo accounts may be cleaned up here.
      createdBy: { $in: demoUserIds },
    });
    const demoMissionIds = existingDemoMissions.map((m) => m._id);

    // 2. Clean up demo-specific records only (never touch real user records!)
    if (demoMissionIds.length > 0) {
      await deleteDemoMissionEvents(demoMissionIds);
      await Task.deleteMany({ missionId: { $in: demoMissionIds } });
      await MissionMember.deleteMany({ missionId: { $in: demoMissionIds } });
      await ProcessedMutation.deleteMany({ missionId: { $in: demoMissionIds } });
      await SyncConflict.deleteMany({ missionId: { $in: demoMissionIds } });
      await Mission.deleteMany({ _id: { $in: demoMissionIds } });
    }

    if (demoUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: demoUserIds } });
    }

    // 3. Create fresh demo users with known credentials
    const defaultPassword = process.env.DEMO_PASSWORD?.trim();
    if (!defaultPassword) {
      throw new AppError('DEMO_PASSWORD must be configured before resetting demo data', 500, 'DEMO_PASSWORD_NOT_CONFIGURED');
    }
    const passwordHash = await hashPassword(defaultPassword);

    const demoUsersToCreate = [
      {
        name: 'Commander Marcus Cole',
        email: `commander${DEMO_EMAIL_DOMAIN}`,
        role: 'COMMANDER' as const,
        passwordHash,
      },
      {
        name: 'Arjun Mehta',
        email: `arjun${DEMO_EMAIL_DOMAIN}`,
        role: 'FIELD_OPERATOR' as const,
        passwordHash,
      },
      {
        name: 'Priya Sharma',
        email: `priya${DEMO_EMAIL_DOMAIN}`,
        role: 'FIELD_OPERATOR' as const,
        passwordHash,
      },
      {
        name: 'Rahul Sen',
        email: `rahul${DEMO_EMAIL_DOMAIN}`,
        role: 'FIELD_OPERATOR' as const,
        passwordHash,
      },
    ];

    const createdUsers: IUserDocument[] = await User.insertMany(demoUsersToCreate);
    const commander = createdUsers.find((u) => u.role === 'COMMANDER')!;
    const opArjun = createdUsers.find((u) => u.name === 'Arjun Mehta')!;
    const opPriya = createdUsers.find((u) => u.name === 'Priya Sharma')!;
    const opRahul = createdUsers.find((u) => u.name === 'Rahul Sen')!;

    // 4. Create the standard demo mission: "Campus Emergency Operations"
    const startedAt = new Date(Date.now() - 35 * 60 * 1000); // 35 minutes ago
    const demoMission = await Mission.create({
      title: DEMO_MISSION_TITLE,
      description:
        'Coordinated tactical field operation for simulated emergency response, perimeter security, electrical subsystem verification, and safety status reporting.',
      location: 'Narula Institute Campus',
      severity: 'HIGH',
      status: 'ACTIVE',
      createdBy: commander._id,
      startedAt,
    });

    // 5. Deploy team members to mission
    const memberships = await MissionMember.insertMany([
      {
        missionId: demoMission._id,
        userId: commander._id,
        role: 'COMMANDER',
        status: 'ACTIVE',
        joinedAt: startedAt,
      },
      {
        missionId: demoMission._id,
        userId: opArjun._id,
        role: 'FIELD_OPERATOR',
        status: 'ACTIVE',
        joinedAt: new Date(startedAt.getTime() + 2 * 60 * 1000),
      },
      {
        missionId: demoMission._id,
        userId: opPriya._id,
        role: 'FIELD_OPERATOR',
        status: 'ACTIVE',
        joinedAt: new Date(startedAt.getTime() + 3 * 60 * 1000),
      },
      {
        missionId: demoMission._id,
        userId: opRahul._id,
        role: 'FIELD_OPERATOR',
        status: 'ACTIVE',
        joinedAt: new Date(startedAt.getTime() + 4 * 60 * 1000),
      },
    ]);

    // 6. Create realistic tasks with various statuses
    const taskMainGate = await Task.create({
      missionId: demoMission._id,
      title: 'Inspect Main Gate',
      description: 'Verify access control barrier and log inbound tactical vehicle credentials.',
      priority: 'HIGH',
      status: 'ACTIVE',
      assignedTo: opArjun._id,
      createdBy: commander._id,
      startedAt: new Date(startedAt.getTime() + 8 * 60 * 1000),
    });

    const taskElectrical = await Task.create({
      missionId: demoMission._id,
      title: 'Check Electrical Room',
      description: 'Inspect auxiliary generator circuits and backup battery health telemetry.',
      priority: 'CRITICAL',
      status: 'PENDING',
      assignedTo: opPriya._id,
      createdBy: commander._id,
    });

    const taskMedical = await Task.create({
      missionId: demoMission._id,
      title: 'Verify Medical Station',
      description: 'Audit first-aid supplies and emergency medical equipment readiness.',
      priority: 'HIGH',
      status: 'PENDING',
      assignedTo: opRahul._id,
      createdBy: commander._id,
    });

    const taskAssembly = await Task.create({
      missionId: demoMission._id,
      title: 'Inspect Assembly Area',
      description: 'Confirm designated sector evacuation perimeter is clear of blockages.',
      priority: 'MEDIUM',
      status: 'PENDING',
      assignedTo: null,
      createdBy: commander._id,
    });

    const taskReport = await Task.create({
      missionId: demoMission._id,
      title: 'Report Safety Status',
      description: 'Compile initial situation report and transmit to central operations center.',
      priority: 'LOW',
      status: 'PENDING',
      assignedTo: null,
      createdBy: commander._id,
    });

    // 7. Seed historical MissionEvents for a verifiable replay history
    const baseTime = startedAt.getTime();
    const historicalEvents = [
      {
        missionId: demoMission._id,
        actorId: commander._id,
        eventType: MissionEventType.MISSION_CREATED,
        targetType: EventTargetType.MISSION,
        targetId: demoMission._id,
        payload: { title: demoMission.title, severity: demoMission.severity },
        source: EventSource.USER,
        createdAt: new Date(baseTime),
      },
      {
        missionId: demoMission._id,
        actorId: commander._id,
        eventType: MissionEventType.MISSION_STARTED,
        targetType: EventTargetType.MISSION,
        targetId: demoMission._id,
        payload: { status: 'ACTIVE' },
        source: EventSource.USER,
        createdAt: new Date(baseTime + 1 * 60 * 1000),
      },
      {
        missionId: demoMission._id,
        actorId: commander._id,
        eventType: MissionEventType.MEMBER_ASSIGNED,
        targetType: EventTargetType.MEMBER,
        targetId: opArjun._id,
        payload: { memberName: opArjun.name, role: 'FIELD_OPERATOR' },
        source: EventSource.USER,
        createdAt: new Date(baseTime + 2 * 60 * 1000),
      },
      {
        missionId: demoMission._id,
        actorId: commander._id,
        eventType: MissionEventType.MEMBER_ASSIGNED,
        targetType: EventTargetType.MEMBER,
        targetId: opPriya._id,
        payload: { memberName: opPriya.name, role: 'FIELD_OPERATOR' },
        source: EventSource.USER,
        createdAt: new Date(baseTime + 3 * 60 * 1000),
      },
      {
        missionId: demoMission._id,
        actorId: commander._id,
        eventType: MissionEventType.MEMBER_ASSIGNED,
        targetType: EventTargetType.MEMBER,
        targetId: opRahul._id,
        payload: { memberName: opRahul.name, role: 'FIELD_OPERATOR' },
        source: EventSource.USER,
        createdAt: new Date(baseTime + 4 * 60 * 1000),
      },
      {
        missionId: demoMission._id,
        actorId: commander._id,
        eventType: MissionEventType.TASK_CREATED,
        targetType: EventTargetType.TASK,
        targetId: taskMainGate._id,
        payload: { title: taskMainGate.title, priority: taskMainGate.priority },
        source: EventSource.USER,
        createdAt: new Date(baseTime + 5 * 60 * 1000),
      },
      {
        missionId: demoMission._id,
        actorId: commander._id,
        eventType: MissionEventType.TASK_ASSIGNED,
        targetType: EventTargetType.TASK,
        targetId: taskMainGate._id,
        payload: { taskTitle: taskMainGate.title, assignedToName: opArjun.name },
        source: EventSource.USER,
        createdAt: new Date(baseTime + 6 * 60 * 1000),
      },
      {
        missionId: demoMission._id,
        actorId: opArjun._id,
        eventType: MissionEventType.TASK_STARTED,
        targetType: EventTargetType.TASK,
        targetId: taskMainGate._id,
        payload: { taskTitle: taskMainGate.title, status: 'ACTIVE' },
        source: EventSource.USER,
        createdAt: new Date(baseTime + 8 * 60 * 1000),
      },
      {
        missionId: demoMission._id,
        actorId: commander._id,
        eventType: MissionEventType.TASK_CREATED,
        targetType: EventTargetType.TASK,
        targetId: taskElectrical._id,
        payload: { title: taskElectrical.title, priority: taskElectrical.priority },
        source: EventSource.USER,
        createdAt: new Date(baseTime + 10 * 60 * 1000),
      },
      {
        missionId: demoMission._id,
        actorId: commander._id,
        eventType: MissionEventType.TASK_ASSIGNED,
        targetType: EventTargetType.TASK,
        targetId: taskElectrical._id,
        payload: { taskTitle: taskElectrical.title, assignedToName: opPriya.name },
        source: EventSource.USER,
        createdAt: new Date(baseTime + 11 * 60 * 1000),
      },
      {
        missionId: demoMission._id,
        actorId: commander._id,
        eventType: MissionEventType.TASK_CREATED,
        targetType: EventTargetType.TASK,
        targetId: taskMedical._id,
        payload: { title: taskMedical.title, priority: taskMedical.priority },
        source: EventSource.USER,
        createdAt: new Date(baseTime + 12 * 60 * 1000),
      },
      {
        missionId: demoMission._id,
        actorId: commander._id,
        eventType: MissionEventType.TASK_ASSIGNED,
        targetType: EventTargetType.TASK,
        targetId: taskMedical._id,
        payload: { taskTitle: taskMedical.title, assignedToName: opRahul.name },
        source: EventSource.USER,
        createdAt: new Date(baseTime + 13 * 60 * 1000),
      },
      {
        missionId: demoMission._id,
        actorId: commander._id,
        eventType: MissionEventType.TASK_CREATED,
        targetType: EventTargetType.TASK,
        targetId: taskAssembly._id,
        payload: { title: taskAssembly.title, priority: taskAssembly.priority },
        source: EventSource.USER,
        createdAt: new Date(baseTime + 14 * 60 * 1000),
      },
      {
        missionId: demoMission._id,
        actorId: commander._id,
        eventType: MissionEventType.TASK_CREATED,
        targetType: EventTargetType.TASK,
        targetId: taskReport._id,
        payload: { title: taskReport.title, priority: taskReport.priority },
        source: EventSource.USER,
        createdAt: new Date(baseTime + 15 * 60 * 1000),
      },
      {
        missionId: demoMission._id,
        actorId: opArjun._id,
        eventType: MissionEventType.OBSERVATION_RECORDED,
        targetType: EventTargetType.OBSERVATION,
        payload: { notes: 'North security gate locked; backup diesel generator functioning normally.' },
        source: EventSource.USER,
        createdAt: new Date(baseTime + 18 * 60 * 1000),
      },
    ];

    const tasks = [taskMainGate, taskElectrical, taskMedical, taskAssembly, taskReport];
    const seededEvents = historicalEvents.map((event) => {
      let payload: Record<string, unknown> = { ...event.payload };
      if (event.eventType === MissionEventType.MISSION_CREATED) {
        payload = { ...payload, missionId: demoMission.id, description: demoMission.description,
          location: demoMission.location, status: 'DRAFT', createdBy: commander.id,
          commanderMembershipId: memberships[0].id, version: demoMission.version };
      }
      const task = tasks.find((candidate) => candidate._id.equals(event.targetId));
      if (task && event.eventType === MissionEventType.TASK_CREATED) {
        payload = { ...payload, taskId: task.id, description: task.description, status: 'PENDING',
          assignedTo: task === taskMedical ? opRahul.id : null, createdBy: commander.id, version: task.version };
      }
      if (task && event.eventType === MissionEventType.TASK_ASSIGNED) {
        payload = { ...payload, taskId: task.id, assignedTo: task.assignedTo?.toString(), version: task.version };
      }
      if (task && event.eventType === MissionEventType.TASK_STARTED) {
        payload = { ...payload, taskId: task.id, version: task.version };
      }
      const member = memberships.find((candidate) => candidate.userId.toString() === event.targetId?.toString());
      return { ...event,
        ...(member ? { targetId: member._id } : {}),
        payload: member ? { ...payload, memberId: member.id, userId: member.userId.toString(),
          status: member.status, joinedAt: member.joinedAt, version: member.version } : payload };
    });
    await MissionEvent.insertMany(seededEvents);

    const demoUsers: DemoUserCredentials[] = createdUsers.map((u) => ({
      name: u.name,
      email: u.email,
      role: u.role,
      userId: u._id.toString(),
    }));

    console.log('[DemoService] Demo environment initialized successfully.');

    return {
      message: 'Demo environment reset successfully.',
      demoUsers,
      demoMission: {
        id: demoMission._id.toString(),
        title: demoMission.title,
        location: demoMission.location,
        severity: demoMission.severity,
        status: demoMission.status,
      },
      tasksCount: 5,
      eventsCount: historicalEvents.length,
    };
  }

  /**
   * Intentionally update a task on the server behind the scenes while
   * the client is simulating offline, to demonstrate conflict resolution.
   */
  async triggerSimulatedConflict(missionId?: string): Promise<{ taskId: string; title: string; newServerStatus: string }> {
    if (!inUnitOfWork()) return withUnitOfWork(() => this.triggerSimulatedConflict(missionId));
    if (!config.enableDemoMode) {
      throw new AppError('Demo mode is disabled in this environment', 403, 'DEMO_MODE_DISABLED');
    }

    // Find only the standard mission owned by a demo account. A caller must
    // never be able to point this endpoint at an arbitrary real mission.
    if (missionId && !mongoose.Types.ObjectId.isValid(missionId)) {
      throw new AppError('Invalid demo mission ID', 400, 'INVALID_MISSION_ID');
    }

    const demoUserIds = (
      await User.find({
        email: { $regex: `${DEMO_EMAIL_DOMAIN}$`, $options: 'i' },
      }).select('_id')
    ).map((user) => user._id);

    const demoMission = await Mission.findOne({
      ...(missionId ? { _id: new mongoose.Types.ObjectId(missionId) } : {}),
      title: DEMO_MISSION_TITLE,
      createdBy: { $in: demoUserIds },
    });
    if (!demoMission) {
      throw new AppError('Demo mission not found. Reset demo first.', 404, 'DEMO_MISSION_NOT_FOUND');
    }
    const targetMissionId = demoMission._id.toString();

    // Find a task in this mission to conflict on (e.g. Inspect Main Gate or Check Electrical Room)
    const task = await Task.findOne({
      missionId: new mongoose.Types.ObjectId(targetMissionId),
      title: 'Inspect Main Gate',
    });

    if (!task) {
      throw new AppError('Task for conflict simulation not found.', 404, 'TASK_NOT_FOUND');
    }

    // Server-side update to BLOCKED
    const previousStatus = task.status;
    task.status = 'BLOCKED';
    task.blockedAt = new Date();
    task.updatedAt = new Date();
    await task.save();

    // Log the event through the immutable event service so the normal replay
    // and socket delivery guarantees also apply to the demo divergence.
    await missionEventService.createMissionEvent({
      missionId: task.missionId.toString(),
      actorId: task.createdBy.toString(),
      eventType: MissionEventType.TASK_BLOCKED,
      targetType: EventTargetType.TASK,
      targetId: task._id.toString(),
      payload: {
        taskId: task._id.toString(),
        taskTitle: task.title,
        status: 'BLOCKED',
        reason: 'Simulated server divergence: Emergency security lockout initiated remotely',
        previousStatus,
        version: task.version,
      },
      source: EventSource.SYSTEM,
    });

    console.log(`[DemoService] Triggered simulated server change on Task ${task.title} (status=BLOCKED)`);

    return {
      taskId: task._id.toString(),
      title: task.title,
      newServerStatus: 'BLOCKED',
    };
  }

  /**
   * Get demo mode status and pre-seeded demo mission information.
   */
  async getDemoInfo(): Promise<{
    enabled: boolean;
    demoMissionId?: string;
    demoUsers: { name: string; email: string; role: string }[];
  }> {
    if (!config.enableDemoMode) {
      return { enabled: false, demoUsers: [] };
    }

    const demoUsers = await User.find({
      email: { $regex: `${DEMO_EMAIL_DOMAIN}$`, $options: 'i' },
    }).select('_id');
    const demoMission = await Mission.findOne({
      title: DEMO_MISSION_TITLE,
      createdBy: { $in: demoUsers.map((user) => user._id) },
    }).select('_id');

    return {
      enabled: true,
      demoMissionId: demoMission?._id.toString(),
      demoUsers: [
        { name: 'Commander Marcus Cole', email: `commander${DEMO_EMAIL_DOMAIN}`, role: 'COMMANDER' },
        { name: 'Arjun Mehta', email: `arjun${DEMO_EMAIL_DOMAIN}`, role: 'FIELD_OPERATOR' },
        { name: 'Priya Sharma', email: `priya${DEMO_EMAIL_DOMAIN}`, role: 'FIELD_OPERATOR' },
        { name: 'Rahul Sen', email: `rahul${DEMO_EMAIL_DOMAIN}`, role: 'FIELD_OPERATOR' },
      ],
    };
  }
}

export const demoService = new DemoService();
