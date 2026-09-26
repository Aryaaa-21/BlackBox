import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { verifyToken } from '../utils/jwt';
import { sendError } from '../utils/response';
import { userService } from '../services/user.service';
import { AUTH_COOKIE_NAME } from '../utils/cookies';

export { requireRole } from './role.middleware';

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // 1. Check HTTP-only cookie first
    if (req.cookies && req.cookies[AUTH_COOKIE_NAME]) {
      token = req.cookies[AUTH_COOKIE_NAME];
    }

    // 2. Fall back to Authorization Bearer header
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      sendError(res, 'Authentication token required', 'UNAUTHORIZED', 401);
      return;
    }

    // 3. Verify JWT token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      sendError(res, 'Invalid or expired authentication token', 'TOKEN_EXPIRED_OR_INVALID', 401);
      return;
    }

    // 4. Verify user exists and is active in database
    const user = await userService.findUserById(decoded.id);
    if (!user) {
      sendError(res, 'User record not found or revoked', 'USER_NOT_FOUND', 401);
      return;
    }

    if (!user.isActive) {
      sendError(res, 'This account has been deactivated', 'ACCOUNT_INACTIVE', 403);
      return;
    }

    // 5. Attach authenticated identity
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      isActive: user.isActive,
    };

    next();
  } catch (error: unknown) {
    const err = error as Error;
    sendError(res, 'Authentication subsystem error', 'AUTH_ERROR', 500, err.message);
  }
};
