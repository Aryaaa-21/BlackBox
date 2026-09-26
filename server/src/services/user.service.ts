import { User, IUserDocument } from '../models/User';
import { UserRole } from '../types';

export class UserService {
  async findUserById(id: string): Promise<IUserDocument | null> {
    return User.findById(id);
  }

  async findUserByEmail(email: string, includePassword = false): Promise<IUserDocument | null> {
    const query = User.findOne({ email: email.toLowerCase() });
    if (includePassword) {
      query.select('+passwordHash');
    }
    return query.exec();
  }

  async createUser(data: {
    name: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    isActive?: boolean;
  }): Promise<IUserDocument> {
    const user = new User({
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      role: data.role,
      isActive: data.isActive !== undefined ? data.isActive : true,
    });
    return user.save();
  }

  async updateLastLogin(userId: string): Promise<Date> {
    const now = new Date();
    await User.findByIdAndUpdate(userId, { lastLoginAt: now });
    return now;
  }

  isUserActive(user: IUserDocument): boolean {
    return user.isActive === true;
  }
}

export const userService = new UserService();
