import { api } from './api';
import {
  ApiResponse,
  MissionEvent,
  MissionEventsData,
  MissionEventsQueryOptions,
} from '../types';

export const missionEventApi = {
  /**
   * POST /api/v1/missions/:missionId/events/observations
   * Record a free-form field observation for a mission.
   */
  async recordObservation(
    missionId: string,
    payload: { text: string; idempotencyKey?: string; clientCreatedAt?: string }
  ): Promise<MissionEvent> {
    const response = await api.post<ApiResponse<{ event: MissionEvent }>>(
      `/missions/${missionId}/events/observations`,
      payload
    );
    return response.data.data.event;
  },

  /**
   * GET /api/v1/missions/:missionId/events
   * Retrieve paginated immutable mission event history
   */
  async getMissionEvents(
    missionId: string,
    options?: MissionEventsQueryOptions
  ): Promise<MissionEventsData> {
    const response = await api.get<ApiResponse<MissionEventsData>>(
      `/missions/${missionId}/events`,
      { params: options }
    );
    return response.data.data;
  },

  /**
   * GET /api/v1/missions/:missionId/events/:eventId
   * Retrieve single mission event details
   */
  async getEventById(missionId: string, eventId: string): Promise<MissionEvent> {
    const response = await api.get<ApiResponse<{ event: MissionEvent }>>(
      `/missions/${missionId}/events/${eventId}`
    );
    return response.data.data.event;
  },
};
