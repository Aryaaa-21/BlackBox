import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, MissionEventType } from '../types';
import { missionEventService } from '../services/missionEvent.service';
import { sendSuccess } from '../utils/response';
import { recordObservationSchema } from '../validators/observation.validator';

export class MissionEventController {
  /**
   * GET /api/v1/missions/:missionId/events
   * Paginated retrieval of immutable mission event history
   */
  async listEvents(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { missionId } = req.params;
      const { page, limit, eventType } = req.query;

      const options = {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        eventType: typeof eventType === 'string' && Object.values(MissionEventType).includes(eventType as MissionEventType)
          ? (eventType as MissionEventType)
          : undefined,
      };

      const result = await missionEventService.getMissionEvents(missionId, user, options);

      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/missions/:missionId/events/observations
   * Record a validated free-form field observation.
   */
  async recordObservation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const parseResult = recordObservationSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          message: 'Invalid observation',
          code: 'VALIDATION_ERROR',
          details: parseResult.error.errors,
        });
        return;
      }

      const event = await missionEventService.recordObservation(
        req.params.missionId,
        req.user!,
        parseResult.data
      );
      sendSuccess(res, { event }, 201, 'Observation recorded');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/missions/:missionId/events/:eventId
   * Retrieve a single mission event
   */
  async getEventById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { eventId } = req.params;

      const event = await missionEventService.getEventById(eventId, user);

      sendSuccess(res, { event }, 200);
    } catch (error) {
      next(error);
    }
  }
}

export const missionEventController = new MissionEventController();
