import { forAccount, http, request, toQueryParams } from './http';
import type { EventQuery, EventListData, MissionEvent, ObservationInput } from '../types';
import { cacheEvent, cacheEvents, cacheResponse, cacheResponseKey, getActiveAccountId, getCachedEvents } from '../db';
import { recordObservationMutation } from '../services/mutations';
import { filterEvents } from '../services/cache-policy';

export const eventsApi = {
  list: async (missionId: string, query?: EventQuery) => {
    const accountId = await getActiveAccountId();
    const result = await request<EventListData>(http.get(`/missions/${missionId}/events`, { ...forAccount(accountId), params: toQueryParams(query) }));
    await cacheEvents(result.events, accountId);
    await cacheResponse(cacheResponseKey(`events:${missionId}`, query), result, accountId);
    const ids = new Set(result.events.map((event) => event.id));
    return { ...result, events: filterEvents((await getCachedEvents(missionId, accountId)).filter((event) => ids.has(event.id) || event.source === 'LOCAL'), query) };
  },
  get: async (missionId: string, eventId: string) => {
    const accountId = await getActiveAccountId();
    const event = (await request<{ event: MissionEvent }>(http.get(`/missions/${missionId}/events/${eventId}`, forAccount(accountId)))).event;
    return cacheEvent(event, accountId);
  },
  recordObservation: (missionId: string, input: ObservationInput, offline?: boolean) => recordObservationMutation(missionId, input, offline),
};
