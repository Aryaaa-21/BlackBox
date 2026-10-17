import { forAccount, http, request } from './http';
import type { MissionMember } from '../types';
import { cacheMember, cacheMembers, cacheResponse, cacheResponseKey, getActiveAccountId } from '../db';

export const membersApi = {
  list: async (missionId: string, includeRemoved = false) => {
    const accountId = await getActiveAccountId();
    const members = (await request<{ members: MissionMember[] }>(http.get(`/missions/${missionId}/members`, { ...forAccount(accountId), params: { includeRemoved } }))).members;
    const selected = await cacheMembers(members, accountId);
    await cacheResponse(cacheResponseKey(`members:${missionId}`, { includeRemoved }), selected, accountId);
    return selected.filter((member) => includeRemoved || member.status !== 'REMOVED');
  },
  add: async (missionId: string, userId: string) => {
    const accountId = await getActiveAccountId();
    const member = (await request<{ member: MissionMember }>(http.post(`/missions/${missionId}/members`, { userId }, forAccount(accountId)))).member;
    return cacheMember(member, accountId);
  },
  remove: async (missionId: string, userId: string) => {
    const accountId = await getActiveAccountId();
    const member = (await request<{ member: MissionMember }>(http.delete(`/missions/${missionId}/members/${userId}`, forAccount(accountId)))).member;
    return cacheMember(member, accountId);
  },
};
