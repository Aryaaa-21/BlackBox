import { api } from './api';
import {
  ApiResponse,
  MissionEvent,
  MissionEventsData,
  MissionEventsQueryOptions,
} from '../types';

export const missionEventApi = {
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
