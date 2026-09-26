/**
 * Phase 6 — Offline-First Operations
 * Mission Repository — unified access for mission + member caching.
 *
 * Online  → REST API → update IndexedDB
 * Offline → IndexedDB read (cached snapshot)
 *
 * Member management (add/remove) is server-only for Phase 6.
 * Read access to cached members is available offline.
 */

import { db } from './db';
import { isOfflineError } from './errorClassifier';
import { missionApi } from '../services/missionApi';
import { teamApi } from '../services/teamApi';
import type { Mission, MissionMember } from '../types';
import type { LocalMission, LocalMissionMember } from './types';

// ============================================================
// HELPERS
// ============================================================

function missionToLocal(mission: Mission): LocalMission {
  const createdById =
    mission.createdBy && typeof mission.createdBy === 'object'
      ? mission.createdBy.id
      : String(mission.createdBy);
  const createdByName =
    mission.createdBy && typeof mission.createdBy === 'object'
      ? mission.createdBy.name
      : undefined;

  return {
    id: mission.id,
    title: mission.title,
    description: mission.description,
    location: mission.location,
    severity: mission.severity,
    status: mission.status,
    createdBy: createdById,
    createdByName,
    startedAt: mission.startedAt ?? null,
    completedAt: mission.completedAt ?? null,
    cancelledAt: mission.cancelledAt ?? null,
    createdAt: mission.createdAt,
    updatedAt: mission.updatedAt,
    cachedAt: new Date().toISOString(),
    source: 'SERVER',
  };
}

function localToMission(local: LocalMission): Mission {
  return {
    id: local.id,
    title: local.title,
    description: local.description,
    location: local.location,
    severity: local.severity,
    status: local.status,
    createdBy: { id: local.createdBy, name: local.createdByName ?? '' },
    startedAt: local.startedAt,
    completedAt: local.completedAt,
    cancelledAt: local.cancelledAt,
    createdAt: local.createdAt,
    updatedAt: local.updatedAt,
  };
}

function memberToLocal(member: MissionMember): LocalMissionMember {
  return {
    id: member.id,
    missionId: member.missionId,
    userId: member.userId.id,
    userName: member.userId.name,
    userEmail: member.userId.email,
    userRole: member.userId.role ?? 'FIELD_OPERATOR',
    role: member.role,
    status: member.status,
    joinedAt: member.joinedAt ?? null,
    createdAt: member.createdAt ?? new Date().toISOString(),
    updatedAt: member.updatedAt ?? new Date().toISOString(),
    cachedAt: new Date().toISOString(),
  };
}

function localToMember(local: LocalMissionMember): MissionMember {
  return {
    id: local.id,
    missionId: local.missionId,
    userId: {
      id: local.userId,
      name: local.userName,
      email: local.userEmail,
      role: local.userRole,
    },
    role: local.role,
    status: local.status,
    joinedAt: local.joinedAt,
    createdAt: local.createdAt,
    updatedAt: local.updatedAt,
  };
}

// ============================================================
// MISSION REPOSITORY
// ============================================================

export const missionRepository = {
  // ============================================================
  // FETCH MISSION
  // ============================================================

  async getMission(
    missionId: string,
    isOperationallyOnline: boolean
  ): Promise<Mission> {
    if (isOperationallyOnline) {
      try {
        const mission = await missionApi.getMission(missionId);
        await missionRepository.cacheMission(mission);
        return mission;
      } catch (err) {
        if (isOfflineError(err)) {
          console.log('[MissionRepo] Server unreachable, loading cached mission');
          const cached = await missionRepository.getCachedMission(missionId);
          if (cached) return cached;
        }
        throw err;
      }
    } else {
      const cached = await missionRepository.getCachedMission(missionId);
      if (!cached) throw new Error('Mission unavailable offline — this mission has not been cached yet.');
      return cached;
    }
  },

  async getCachedMission(missionId: string): Promise<Mission | null> {
    const local = await db.missions.get(missionId);
    return local ? localToMission(local) : null;
  },

  async cacheMission(mission: Mission): Promise<void> {
    await db.missions.put(missionToLocal(mission));
  },

  async updateCachedMission(missionId: string, updates: Partial<LocalMission>): Promise<void> {
    await db.missions.update(missionId, updates);
  },

  // ============================================================
  // FETCH MEMBERS
  // ============================================================

  async getMembers(
    missionId: string,
    isOperationallyOnline: boolean,
    includeRemoved?: boolean
  ): Promise<MissionMember[]> {
    if (isOperationallyOnline) {
      try {
        const members = await teamApi.getMissionMembers(missionId, includeRemoved);
        await missionRepository.cacheMembers(missionId, members);
        return members;
      } catch (err) {
        if (isOfflineError(err)) {
          console.log('[MissionRepo] Server unreachable, loading cached members');
          return missionRepository.getCachedMembers(missionId);
        }
        throw err;
      }
    } else {
      return missionRepository.getCachedMembers(missionId);
    }
  },

  async getCachedMembers(missionId: string): Promise<MissionMember[]> {
    const locals = await db.missionMembers
      .where('missionId')
      .equals(missionId)
      .filter((m) => m.status !== 'REMOVED')
      .toArray();
    return locals.map(localToMember);
  },

  async cacheMembers(missionId: string, members: MissionMember[]): Promise<void> {
    // Delete stale records for this mission then re-insert
    await db.missionMembers.where('missionId').equals(missionId).delete();
    const locals = members.map(memberToLocal);
    await db.missionMembers.bulkPut(locals);
  },

  async cacheMember(member: MissionMember): Promise<void> {
    await db.missionMembers.put(memberToLocal(member));
  },

  // ============================================================
  // CACHE THE FULL MISSION WORKSPACE (online → IndexedDB snapshot)
  // ============================================================

  async cacheWorkspace(
    mission: Mission,
    members: MissionMember[]
  ): Promise<void> {
    await missionRepository.cacheMission(mission);
    await missionRepository.cacheMembers(mission.id, members);
    console.log(`[MissionRepo] Cached workspace for mission ${mission.id} (${members.length} members)`);
  },

  // ============================================================
  // CHECK IF MISSION IS CACHED
  // ============================================================

  async isCached(missionId: string): Promise<boolean> {
    const count = await db.missions.where('id').equals(missionId).count();
    return count > 0;
  },

  async getCachedAt(missionId: string): Promise<string | null> {
    const local = await db.missions.get(missionId);
    return local?.cachedAt ?? null;
  },
};
