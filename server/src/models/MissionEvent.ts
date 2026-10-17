import mongoose, { Document, Schema } from 'mongoose';
import { MissionEventType, EventTargetType, EventSource } from '../types';
import { AsyncLocalStorage } from 'node:async_hooks';
import { AppError } from '../middleware/error.middleware';
import { config } from '../config/env';

export interface IMissionEventDocument extends Document {
  missionId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;
  eventType: MissionEventType;
  targetType: EventTargetType;
  targetId?: mongoose.Types.ObjectId | null;
  payload: Record<string, unknown>;
  source: EventSource;
  clientCreatedAt?: Date | null;
  idempotencyKey?: string | null;
  deviceId?: string;
  mutationId?: string;
  /** Original sanitized request hash, excluding server-generated actor metadata. */
  requestFingerprint?: string;
  createdAt: Date;
  updatedAt: Date;
}

const missionEventSchema = new Schema<IMissionEventDocument>(
  {
    missionId: {
      type: Schema.Types.ObjectId,
      ref: 'Mission',
      required: [true, 'Mission ID is required'],
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor ID is required'],
      index: true,
    },
    eventType: {
      type: String,
      enum: {
        values: Object.values(MissionEventType),
        message: 'Invalid mission event type: {VALUE}',
      },
      required: [true, 'Event type is required'],
    },
    targetType: {
      type: String,
      enum: {
        values: Object.values(EventTargetType),
        message: 'Invalid event target type: {VALUE}',
      },
      required: [true, 'Target type is required'],
    },
    targetId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    payload: {
      type: Schema.Types.Mixed,
      default: {},
    },
    source: {
      type: String,
      enum: {
        values: Object.values(EventSource),
        message: 'Invalid event source: {VALUE}',
      },
      default: EventSource.USER,
    },
    clientCreatedAt: {
      type: Date,
      default: null,
    },
    idempotencyKey: {
      type: String,
      required: false,
      trim: true,
    },
    deviceId: { type: String },
    mutationId: { type: String },
    requestFingerprint: { type: String, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        if (ret._id) {
          ret.id = (ret._id as mongoose.Types.ObjectId).toString();
        }
        delete ret._id;
        delete ret.__v;
        delete ret.requestFingerprint;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        if (ret._id) {
          ret.id = (ret._id as mongoose.Types.ObjectId).toString();
        }
        delete ret._id;
        delete ret.__v;
        delete ret.requestFingerprint;
        return ret;
      },
    },
  }
);

const maintenance = new AsyncLocalStorage<boolean>();
const immutable = (): AppError => new AppError('Mission events are immutable', 409, 'MISSION_EVENT_IMMUTABLE');
missionEventSchema.pre('save', function () {
  if (!this.isNew && !maintenance.getStore()) throw immutable();
});
missionEventSchema.pre([
  'updateOne', 'updateMany', 'replaceOne', 'findOneAndUpdate', 'findOneAndReplace',
  'findOneAndDelete', 'deleteOne', 'deleteMany',
], function () {
  if (!maintenance.getStore()) throw immutable();
});
missionEventSchema.pre('deleteOne', { document: true, query: false }, function () {
  if (!maintenance.getStore()) throw immutable();
});
missionEventSchema.pre('bulkWrite', function () {
  if (!maintenance.getStore()) throw immutable();
});

/** Fixture-only bypass; requires NODE_ENV=test at startup. No HTTP/controller entry point. */
export async function withMissionEventTestMaintenance<T>(work: () => PromiseLike<T>): Promise<T> {
  if (config.nodeEnv !== 'test') throw immutable();
  return maintenance.run(true, async () => await work());
}

/** The only production maintenance operation: delete history of verified demo-owned missions. */
export async function deleteDemoMissionEvents(missionIds: mongoose.Types.ObjectId[]): Promise<void> {
  if (!config.enableDemoMode) throw immutable();
  const { User } = await import('./User');
  const { Mission } = await import('./Mission');
  const users = await User.find({ email: /@demo\.blackbox\.internal$/i }).select('_id');
  const verified = await Mission.find({ _id: { $in: missionIds }, createdBy: { $in: users.map((user) => user._id) } }).select('_id');
  if (verified.length !== missionIds.length) throw immutable();
  await maintenance.run(true, async () => {
    await MissionEvent.deleteMany({ missionId: { $in: verified.map((mission) => mission._id) } });
  });
}

// Compound indexes for optimal performance and idempotency protection (Sections 12 & 21)
missionEventSchema.index({ missionId: 1, createdAt: -1 });
missionEventSchema.index({ missionId: 1, createdAt: 1, _id: 1 });
missionEventSchema.index({ missionId: 1, eventType: 1, createdAt: 1, _id: 1 });
missionEventSchema.index({ missionId: 1, actorId: 1 });
missionEventSchema.index(
  { missionId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  }
);

export const MissionEvent = mongoose.model<IMissionEventDocument>(
  'MissionEvent',
  missionEventSchema
);
