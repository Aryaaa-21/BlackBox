import { forAccount, http, request, toQueryParams } from './http';
import type {
  CreateMissionInput, Mission, MissionListData, MissionQuery, MissionStats, UpdateMissionInput,
} from '../types';
import { cacheMission, cacheMissions, cacheResponse, cacheResponseKey, getActiveAccountId } from '../db';

export const missionsApi = {
  list: async (query?: MissionQuery) => {
    const accountId = await getActiveAccountId();
    const result = await request<MissionListData>(http.get('/missions', { ...forAccount(accountId), params: toQueryParams(query) }));
    const missions = await cacheMissions(result.missions, accountId);
    const selected = { ...result, missions };
    await cacheResponse(cacheResponseKey('missions', query), selected, accountId);
    return selected;
  },
  get: async (missionId: string) => {
    const accountId = await getActiveAccountId();
    const mission = (await request<{ mission: Mission }>(http.get(`/missions/${missionId}`, forAccount(accountId)))).mission;
    return cacheMission(mission, accountId);
  },
  stats: async () => (await request<{ stats: MissionStats }>(http.get('/missions/stats'))).stats,
  create: async (input: CreateMissionInput) => {
    const accountId = await getActiveAccountId();
    const mission = (await request<{ mission: Mission }>(http.post('/missions', input, forAccount(accountId)))).mission;
    return cacheMission(mission, accountId);
  },
  update: async (missionId: string, input: UpdateMissionInput) => {
    const accountId = await getActiveAccountId();
    const mission = (await request<{ mission: Mission }>(http.patch(`/missions/${missionId}`, input, forAccount(accountId)))).mission;
    return cacheMission(mission, accountId);
  },
  start: async (missionId: string) => {
    const accountId = await getActiveAccountId();
    const mission = (await request<{ mission: Mission }>(http.post(`/missions/${missionId}/start`, undefined, forAccount(accountId)))).mission;
    return cacheMission(mission, accountId);
  },
  complete: async (missionId: string) => {
    const accountId = await getActiveAccountId();
    const mission = (await request<{ mission: Mission }>(http.post(`/missions/${missionId}/complete`, undefined, forAccount(accountId)))).mission;
    return cacheMission(mission, accountId);
  },
  cancel: async (missionId: string) => {
    const accountId = await getActiveAccountId();
    const mission = (await request<{ mission: Mission }>(http.post(`/missions/${missionId}/cancel`, undefined, forAccount(accountId)))).mission;
    return cacheMission(mission, accountId);
  },
};
