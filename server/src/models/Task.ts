import mongoose, { Document, Schema } from 'mongoose';
import { TaskStatus, TaskPriority } from '../types';
import { exposeVersion } from './versioning';

export interface ITaskDocument extends Document {
  id: string;
  version: number;
  missionId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo?: mongoose.Types.ObjectId | { id: string; name: string; email: string; role?: string } | null;
  createdBy: mongoose.Types.ObjectId | { id: string; name: string; email?: string };
  startedAt?: Date | null;
  completedAt?: Date | null;
  blockedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITaskDocument>(
  {
    missionId: {
      type: Schema.Types.ObjectId,
      ref: 'Mission',
      required: [true, 'Mission ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'BLOCKED', 'COMPLETED'],
      default: 'PENDING',
      required: true,
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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
    blockedAt: {
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

// Compound indexes for optimal operational querying (Section 71)
TaskSchema.index({ missionId: 1, status: 1 });
TaskSchema.index({ missionId: 1, priority: 1 });
TaskSchema.index({ assignedTo: 1, status: 1 });

exposeVersion(TaskSchema);
export const Task = mongoose.model<ITaskDocument>('Task', TaskSchema);
