import mongoose, { Document, Schema } from 'mongoose';
import { MissionStatus, MissionSeverity } from '../types';
import { exposeVersion } from './versioning';

export interface IMissionDocument extends Document {
  id: string;
  version: number;
  eventClock?: number;
  title: string;
  description: string;
  location: string;
  severity: MissionSeverity;
  status: MissionStatus;
  createdBy: mongoose.Types.ObjectId | { id: string; name: string; email?: string };
  startedAt?: Date | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const MissionSchema = new Schema<IMissionDocument>(
  {
    eventClock: { type: Number, select: false },
    title: {
      type: String,
      required: [true, 'Mission title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Mission description is required'],
      trim: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    location: {
      type: String,
      required: [true, 'Mission location is required'],
      trim: true,
      maxlength: [200, 'Location cannot exceed 200 characters'],
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
      required: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
      default: 'DRAFT',
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
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
        delete ret.eventClock;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = (ret._id as mongoose.Types.ObjectId).toString();
        delete ret._id;
        delete ret.__v;
        delete ret.eventClock;
        return ret;
      },
    },
  }
);

// Compound indexes for optimal operational querying (Section 21)
MissionSchema.index({ createdBy: 1, status: 1 });
MissionSchema.index({ status: 1, createdAt: -1 });
MissionSchema.index({ createdAt: -1 });

exposeVersion(MissionSchema);
export const Mission = mongoose.model<IMissionDocument>('Mission', MissionSchema);
