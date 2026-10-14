import mongoose, { Document, Schema } from 'mongoose';
import { MissionEventType, EventTargetType, EventSource } from '../types';

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
        return ret;
      },
    },
  }
);

// Compound indexes for optimal performance and idempotency protection (Sections 12 & 21)
missionEventSchema.index({ missionId: 1, createdAt: -1 });
missionEventSchema.index({ missionId: 1, createdAt: 1, _id: 1 });
missionEventSchema.index({ missionId: 1, eventType: 1 });
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
