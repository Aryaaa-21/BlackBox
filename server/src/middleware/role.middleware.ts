import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, UserRole } from '../types';
import { sendError } from '../utils/response';

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Authentication required', 'UNAUTHORIZED', 401);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError(
        res,
        `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`,
        'FORBIDDEN_ROLE',
        403,
        {
          requiredRoles: allowedRoles,
          userRole: req.user.role,
        }
      );
      return;
    }

    next();
  };
};
