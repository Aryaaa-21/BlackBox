/**
 * Phase 7 — Synchronization Engine
 * SyncConflict — server-side conflict record.
 *
 * Created when a sync mutation's baseUpdatedAt does not match the
 * server's current entity updatedAt, indicating concurrent modification.
 *
 * Conflicts are NEVER silently resolved. The user must explicitly choose:
 *   KEEP_SERVER | KEEP_LOCAL | MERGE
 */

import mongoose, { Document, Schema } from 'mongoose';

export type ConflictStatus = 'OPEN' | 'RESOLVED' | 'DISCARDED';
export type ConflictResolution = 'KEEP_LOCAL' | 'KEEP_SERVER' | 'MERGE';

export interface ISyncConflictDocument extends Document {
  id: string;
  mutationId: string;
  idempotencyKey: string;
  missionId: string;
  entityType: string;
  entityId: string;
  operationType: string;
  actorId: string;
  deviceId: string;
  localState: Record<string, unknown>;
  serverState: Record<string, unknown>;
  baseState?: Record<string, unknown>;
  status: ConflictStatus;
  resolution?: ConflictResolution;
  resolvedAt?: Date | null;
  resolvedByUserId?: string | null;
  resolvedEntityState?: Record<string, unknown> | null;
  detectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SyncConflictSchema = new Schema<ISyncConflictDocument>(
  {
    mutationId: {
      type: String,
      required: [true, 'mutationId is required'],
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: [true, 'idempotencyKey is required'],
    },
    missionId: {
      type: String,
      required: [true, 'missionId is required'],
      index: true,
    },
    entityType: {
      type: String,
      required: true,
    },
    entityId: {
      type: String,
      required: true,
      index: true,
    },
    operationType: {
      type: String,
      required: true,
    },
    actorId: {
      type: String,
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
    },
    localState: {
      type: Schema.Types.Mixed,
      required: true,
    },
    serverState: {
      type: Schema.Types.Mixed,
      required: true,
    },
    baseState: {
      type: Schema.Types.Mixed,
      default: null,
    },
    status: {
      type: String,
      enum: ['OPEN', 'RESOLVED', 'DISCARDED'],
      default: 'OPEN',
      required: true,
      index: true,
    },
    resolution: {
      type: String,
      enum: ['KEEP_LOCAL', 'KEEP_SERVER', 'MERGE'],
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedByUserId: {
      type: String,
      default: null,
    },
    resolvedEntityState: {
      type: Schema.Types.Mixed,
      default: null,
    },
    detectedAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = (ret._id as mongoose.Types.ObjectId).toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
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

// Compound indexes
SyncConflictSchema.index({ missionId: 1, status: 1 });
SyncConflictSchema.index({ missionId: 1, actorId: 1, status: 1 });
SyncConflictSchema.index({ missionId: 1, detectedAt: -1 });
SyncConflictSchema.index({ idempotencyKey: 1 }, { unique: true });

export const SyncConflict = mongoose.model<ISyncConflictDocument>(
  'SyncConflict',
  SyncConflictSchema
);
