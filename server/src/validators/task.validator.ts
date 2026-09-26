import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z
    .string({ required_error: 'Task title is required' })
    .trim()
    .min(2, 'Title must be at least 2 characters')
    .max(200, 'Title cannot exceed 200 characters'),
  description: z
    .string()
    .trim()
    .max(5000, 'Description cannot exceed 5000 characters')
    .optional()
    .default(''),
  priority: z
    .enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], {
      errorMap: () => ({ message: 'Priority must be LOW, MEDIUM, HIGH, or CRITICAL' }),
    })
    .optional()
    .default('MEDIUM'),
  assignedTo: z.string().trim().optional(),
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  })
  .strict({
    message: 'Direct updates to status, timestamps, or system properties are prohibited',
  });

export const assignTaskSchema = z.object({
  userId: z.string({ required_error: 'User ID is required' }).trim().min(1, 'User ID cannot be empty'),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(['PENDING', 'ACTIVE', 'BLOCKED', 'COMPLETED'], {
    errorMap: () => ({ message: 'Status must be PENDING, ACTIVE, BLOCKED, or COMPLETED' }),
  }),
});

export const taskQuerySchema = z.object({
  status: z.enum(['PENDING', 'ACTIVE', 'BLOCKED', 'COMPLETED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  assignedTo: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type AssignTaskInput = z.infer<typeof assignTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type TaskQueryInput = z.infer<typeof taskQuerySchema>;
