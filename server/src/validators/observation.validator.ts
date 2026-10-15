import { z } from 'zod';

export const recordObservationSchema = z.object({
  text: z
    .string({ required_error: 'Observation text is required' })
    .trim()
    .min(1, 'Observation text is required')
    .max(5000, 'Observation cannot exceed 5000 characters'),
  idempotencyKey: z.string().trim().min(1).optional(),
  clientCreatedAt: z.string().datetime().optional(),
});

export type RecordObservationInput = z.infer<typeof recordObservationSchema>;
