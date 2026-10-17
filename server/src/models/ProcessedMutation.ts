/**
 * Phase 7 — Synchronization Engine
 * ProcessedMutation — server-side idempotency record.
 *
 * Every successfully processed sync mutation is recorded here.
 * If the same idempotencyKey arrives again, the server returns
 * the original result WITHOUT re-executing the operation.
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IProcessedMutationDocument extends Document {
  idempotencyKey: string;
  userId: string;
  deviceId: string;
  missionId: string;
  operationType: string;
  entityType: string;
  /** Original request ID (possibly local); serverId holds the resolved ID. */
  entityId: string;
  localId?: string;
  serverId?: string;
  result: Record<string, unknown>;
  outcome?: 'SYNCED' | 'CONFLICT';
  /** Absent only on legacy receipts; their payload cannot be verified retroactively. */
  fingerprint?: string;
  createdAt: Date;
}

const ProcessedMutationSchema = new Schema<IProcessedMutationDocument>(
  {
    idempotencyKey: {
      type: String,
      required: [true, 'idempotencyKey is required'],
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
    },
    missionId: {
      type: String,
      required: true,
      index: true,
    },
    operationType: {
      type: String,
      required: true,
    },
    entityType: {
      type: String,
      required: true,
    },
    entityId: {
      type: String,
      required: true,
    },
    localId: {
      type: String,
      default: null,
    },
    serverId: {
      type: String,
      default: null,
    },
    result: {
      type: Schema.Types.Mixed,
      default: {},
    },
    fingerprint: { type: String, index: true },
    outcome: { type: String, enum: ['SYNCED', 'CONFLICT'], default: 'SYNCED' },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = (ret._id as mongoose.Types.ObjectId).toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes for efficient lookup
ProcessedMutationSchema.index({ missionId: 1, createdAt: -1 });
ProcessedMutationSchema.index({ userId: 1, missionId: 1 });
ProcessedMutationSchema.index({ userId: 1, deviceId: 1, missionId: 1, entityType: 1, operationType: 1, localId: 1 });

export const ProcessedMutation = mongoose.model<IProcessedMutationDocument>(
  'ProcessedMutation',
  ProcessedMutationSchema
);
