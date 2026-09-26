import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { setAuthCookie, clearAuthCookie } from '../utils/cookies';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.register(req.body);
      setAuthCookie(res, result.token);
      sendSuccess(res, result, 201, 'User registered successfully');
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body);
      setAuthCookie(res, result.token);
      sendSuccess(res, result, 200, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      clearAuthCookie(res);
      sendSuccess(res, { loggedOut: true }, 200, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  async me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', code: 'UNAUTHORIZED' });
        return;
      }

      const user = await authService.getUserById(req.user.id);
      sendSuccess(res, { user }, 200);
    } catch (error) {
      next(error);
    }
  }

  // Demonstration endpoint to verify role authorization enforcement
  async commanderAction(req: AuthenticatedRequest, res: Response): Promise<void> {
    sendSuccess(
      res,
      {
        action: 'AUTHORIZED_COMMANDER_BROADCAST',
        initiatedBy: req.user?.name,
        timestamp: new Date().toISOString(),
      },
      200,
      'Commander-only action executed successfully'
    );
  }
}

export const authController = new AuthController();
