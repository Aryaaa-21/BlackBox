/**
 * Phase 9 — Product Polish & Demo Mode
 * Demo Service — manages demo data initialization, predictable hackathon state reset,
 * and controlled server-side conflict triggering.
 *
 * SAFETY: Only operates on demo users (*@demo.blackbox.internal) and demo missions.
 * Never deletes or impacts real user data.
 */

import mongoose from 'mongoose';
import { hashPassword, signToken } from '../utils/jwt';
import { User, IUserDocument } from '../models/User';
import { Mission, IMissionDocument } from '../models/Mission';
import { MissionMember } from '../models/MissionMember';
import { Task, ITaskDocument } from '../models/Task';
import { MissionEvent } from '../models/MissionEvent';
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

export interface DemoUserCredentials {
  name: string;
  email: string;
  role: 'COMMANDER' | 'FIELD_OPERATOR';
  password: string;
  token?: string;
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
  primaryToken: string; // Commander token for immediate one-click login
}

const DEMO_EMAIL_DOMAIN = '@demo.blackbox.internal';

export class DemoService {
  /**
   * Reset demo data safely and re-seed the standard demo scenario:
   * "Campus Emergency Operations" with 4 users, 5 tasks, and full event history.
   */
  async resetDemo(): Promise<DemoInitResponse> {
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
      $or: [
        { title: 'Campus Emergency Operations' },
        { createdBy: { $in: demoUserIds } },
      ],
    });
    const demoMissionIds = existingDemoMissions.map((m) => m._id);

    // 2. Clean up demo-specific records only (never touch real user records!)
    if (demoMissionIds.length > 0) {
      await Promise.all([
        Task.deleteMany({ missionId: { $in: demoMissionIds } }),
        MissionMember.deleteMany({ missionId: { $in: demoMissionIds } }),
        MissionEvent.deleteMany({ missionId: { $in: demoMissionIds } }),
        ProcessedMutation.deleteMany({ missionId: { $in: demoMissionIds } }),
        SyncConflict.deleteMany({ missionId: { $in: demoMissionIds } }),
        Mission.deleteMany({ _id: { $in: demoMissionIds } }),
      ]);
    }

    if (demoUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: demoUserIds } });
    }

    // 3. Create fresh demo users with known credentials
    const defaultPassword = 'Password123!';
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
      title: 'Campus Emergency Operations',
      description:
        'Coordinated tactical field operation for simulated emergency response, perimeter security, electrical subsystem verification, and safety status reporting.',
      location: 'Narula Institute Campus',
      severity: 'HIGH',
      status: 'ACTIVE',
      createdBy: commander._id,
      startedAt,
    });

    // 5. Deploy team members to mission
    await MissionMember.insertMany([
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

    await MissionEvent.insertMany(historicalEvents);

    // 8. Generate JWT tokens for instant demo login
    const generateToken = (user: IUserDocument): string => {
      const payload: UserPayload = {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: true,
      };
      return signToken(payload);
    };

    const demoUsersWithTokens: DemoUserCredentials[] = createdUsers.map((u) => ({
      name: u.name,
      email: u.email,
      role: u.role,
      password: defaultPassword,
      token: generateToken(u),
      userId: u._id.toString(),
    }));

    const commanderToken = demoUsersWithTokens.find((u) => u.role === 'COMMANDER')!.token!;

    console.log('[DemoService] Demo environment initialized successfully.');

    return {
      message: 'Demo environment reset successfully.',
      demoUsers: demoUsersWithTokens,
      demoMission: {
        id: demoMission._id.toString(),
        title: demoMission.title,
        location: demoMission.location,
        severity: demoMission.severity,
        status: demoMission.status,
      },
      tasksCount: 5,
      eventsCount: historicalEvents.length,
      primaryToken: commanderToken,
    };
  }

  /**
   * Intentionally update a task on the server behind the scenes while
   * the client is simulating offline, to demonstrate conflict resolution.
   */
  async triggerSimulatedConflict(missionId?: string): Promise<{ taskId: string; title: string; newServerStatus: string }> {
    if (!config.enableDemoMode) {
      throw new AppError('Demo mode is disabled in this environment', 403, 'DEMO_MODE_DISABLED');
    }

    // Find the demo mission
    let targetMissionId = missionId;
    if (!targetMissionId) {
      const demoMission = await Mission.findOne({ title: 'Campus Emergency Operations' });
      if (!demoMission) {
        throw new AppError('Demo mission not found. Reset demo first.', 404, 'DEMO_MISSION_NOT_FOUND');
      }
      targetMissionId = demoMission._id.toString();
    }

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

    // Log the event
    await MissionEvent.create({
      missionId: task.missionId,
      actorId: task.createdBy,
      eventType: MissionEventType.TASK_BLOCKED,
      targetType: EventTargetType.TASK,
      targetId: task._id,
      payload: {
        taskTitle: task.title,
        status: 'BLOCKED',
        reason: 'Simulated server divergence: Emergency security lockout initiated remotely',
        previousStatus,
      },
      source: EventSource.SYSTEM,
      createdAt: new Date(),
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

    const demoMission = await Mission.findOne({ title: 'Campus Emergency Operations' }).select('_id');

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
