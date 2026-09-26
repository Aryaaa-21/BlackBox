import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { User } from '../models/User';
import { sendSuccess } from '../utils/response';

export class UserController {
  async searchUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { role, search } = req.query;

      const filter: Record<string, unknown> = { isActive: true };

      if (role && (role === 'COMMANDER' || role === 'FIELD_OPERATOR')) {
        filter.role = role;
      }

      if (search && typeof search === 'string' && search.trim()) {
        const regex = { $regex: search.trim(), $options: 'i' };
        filter.$or = [{ name: regex }, { email: regex }];
      }

      // Safe field projection: Never return passwordHash or security secrets (Section 20 & 21)
      const users = await User.find(filter)
        .select('id name email role isActive')
        .sort({ name: 1 })
        .limit(50)
        .exec();

      sendSuccess(res, { users }, 200);
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
