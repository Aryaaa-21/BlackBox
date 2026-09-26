import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { missionMemberService } from '../services/missionMember.service';
import { sendSuccess } from '../utils/response';

export class MissionMemberController {
  async addMember(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const commanderId = req.user!.id;
      const { missionId } = req.params;
      const { userId } = req.body;

      const member = await missionMemberService.addMember(missionId, commanderId, userId);
      sendSuccess(res, { member }, 201, 'Operator added to mission team');
    } catch (error) {
      next(error);
    }
  }

  async removeMember(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const commanderId = req.user!.id;
      const { missionId, userId } = req.params;

      const member = await missionMemberService.removeMember(missionId, commanderId, userId);
      sendSuccess(res, { member }, 200, 'Operator removed from mission team');
    } catch (error) {
      next(error);
    }
  }

  async listMembers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { missionId } = req.params;
      const includeRemoved = req.query.includeRemoved === 'true';

      const members = await missionMemberService.getMissionMembers(missionId, user, includeRemoved);
      sendSuccess(res, { members }, 200);
    } catch (error) {
      next(error);
    }
  }
}

export const missionMemberController = new MissionMemberController();
