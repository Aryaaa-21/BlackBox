import { IUserDocument } from '../models/User';
import { RegisterInput, LoginInput } from '../validators/auth.validator';
import { hashPassword, comparePassword, signToken } from '../utils/jwt';
import { AppError } from '../middleware/error.middleware';
import { UserRole } from '../types';
import { userService } from './user.service';

export interface AuthResult {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    lastLoginAt?: Date;
    createdAt: Date;
  };
  token: string;
}

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await userService.findUserByEmail(input.email);
    if (existing) {
      throw new AppError(
        'An account with this email already exists',
        409,
        'EMAIL_ALREADY_EXISTS'
      );
    }

    const hashedPassword = await hashPassword(input.password);

    const user = await userService.createUser({
      name: input.name,
      email: input.email,
      passwordHash: hashedPassword,
      // Public registration never provisions elevated accounts. Commander
      // accounts must be created through an already-authorized provisioning
      // path (or the controlled demo seed), not by trusting request input.
      role: 'FIELD_OPERATOR',
      isActive: true,
    });

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      isActive: user.isActive,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await userService.findUserByEmail(input.email, true);
    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      throw new AppError(
        'This account has been deactivated. Contact mission control.',
        403,
        'ACCOUNT_INACTIVE'
      );
    }

    const isMatch = await comparePassword(input.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Update lastLoginAt
    const lastLoginAt = await userService.updateLastLogin(user.id);
    user.lastLoginAt = lastLoginAt;

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      isActive: user.isActive,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  async getUserById(userId: string): Promise<IUserDocument> {
    const user = await userService.findUserById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (!user.isActive) {
      throw new AppError(
        'Account is deactivated',
        403,
        'ACCOUNT_INACTIVE'
      );
    }

    return user;
  }
}

export const authService = new AuthService();
