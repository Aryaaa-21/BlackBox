import { z } from 'zod';

export const addMemberSchema = z.object({
  userId: z.string({ required_error: 'User ID is required' }).trim().min(1, 'User ID cannot be empty'),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;
