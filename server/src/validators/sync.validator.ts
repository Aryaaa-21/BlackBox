/**
 * Phase 7 — Synchronization Engine
 * Sync Validator — validates incoming sync batch requests.
 */

import { z } from 'zod';

const VALID_OPERATION_TYPES = [
  'CREATE_TASK',
  'UPDATE_TASK',
  'ASSIGN_TASK',
  'UNASSIGN_TASK',
  'UPDATE_TASK_STATUS',
] as const;

const VALID_ENTITY_TYPES = ['MISSION', 'MEMBER', 'TASK', 'EVENT'] as const;

export const MutationSchema = z.object({
  mutationId: z.string().uuid('mutationId must be a UUID'),
  missionId: z.string().min(1, 'missionId is required'),
  operationType: z.enum(VALID_OPERATION_TYPES, {
    errorMap: () => ({ message: 'Invalid operationType' }),
  }),
  entityType: z.enum(VALID_ENTITY_TYPES, {
    errorMap: () => ({ message: 'Invalid entityType' }),
  }),
  entityId: z.string().min(1, 'entityId is required'),
  payload: z.record(z.unknown()),
  actorId: z.string().min(1, 'actorId is required'),
  deviceId: z.string().min(1, 'deviceId is required'),
  clientCreatedAt: z.string().datetime({ message: 'clientCreatedAt must be ISO 8601' }),
  createdAt: z.string().datetime({ message: 'createdAt must be ISO 8601' }),
  idempotencyKey: z.string().min(1, 'idempotencyKey is required'),
  baseUpdatedAt: z.string().datetime({ message: 'baseUpdatedAt must be ISO 8601' }).optional(),
});

export const SyncBatchSchema = z.object({
  mutations: z
    .array(MutationSchema)
    .min(1, 'At least one mutation is required')
    .max(20, 'Maximum 20 mutations per batch'),
});

export type SyncBatchInput = z.infer<typeof SyncBatchSchema>;

export const ConflictResolutionSchema = z.object({
  resolution: z.enum(['KEEP_LOCAL', 'KEEP_SERVER', 'MERGE'], {
    errorMap: () => ({ message: 'resolution must be KEEP_LOCAL, KEEP_SERVER, or MERGE' }),
  }),
  mergedState: z.record(z.unknown()).optional(),
});

export type ConflictResolutionInput = z.infer<typeof ConflictResolutionSchema>;
