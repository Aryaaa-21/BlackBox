import { z } from 'zod';

export const createMissionSchema = z.object({
  title: z
    .string({ required_error: 'Mission title is required' })
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title cannot exceed 200 characters'),
  description: z
    .string({ required_error: 'Mission description is required' })
    .trim()
    .min(5, 'Description must be at least 5 characters')
    .max(5000, 'Description cannot exceed 5000 characters'),
  location: z
    .string({ required_error: 'Mission location is required' })
    .trim()
    .min(2, 'Location must be at least 2 characters')
    .max(200, 'Location cannot exceed 200 characters'),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], {
    errorMap: () => ({ message: 'Severity must be one of: LOW, MEDIUM, HIGH, CRITICAL' }),
  }),
});

export const updateMissionSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().min(5).max(5000).optional(),
    location: z.string().trim().min(2).max(200).optional(),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  })
  .strict({
    message: 'Direct lifecycle/system field updates (status, createdBy, timestamps) are prohibited',
  });

export const missionQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  search: z.string().trim().optional(),
});

export type CreateMissionInput = z.infer<typeof createMissionSchema>;
export type UpdateMissionInput = z.infer<typeof updateMissionSchema>;
export type MissionQueryInput = z.infer<typeof missionQuerySchema>;
