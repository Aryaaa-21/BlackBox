import mongoose, { Document, Schema } from 'mongoose';
import { MissionStatus } from '../types';

export interface IMissionDocument extends Document {
  id: string;
  title: string;
  description: string;
  location: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: MissionStatus;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MissionSchema = new Schema<IMissionDocument>(
  {
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
    },
    location: {
      type: String,
      required: [true, 'Mission location is required'],
      trim: true,
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
  }
);

export const Mission = mongoose.model<IMissionDocument>('Mission', MissionSchema);
