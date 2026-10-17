import mongoose, { Document, Schema } from 'mongoose';
import { MemberRole, MemberStatus } from '../types';
import { exposeVersion } from './versioning';

export interface IMissionMemberDocument extends Document {
  id: string;
  version: number;
  missionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId | { id: string; name: string; email: string; role?: string };
  role: MemberRole;
  status: MemberStatus;
  joinedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const MissionMemberSchema = new Schema<IMissionMemberDocument>(
  {
    missionId: {
      type: Schema.Types.ObjectId,
      ref: 'Mission',
      required: [true, 'Mission ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    role: {
      type: String,
      enum: ['COMMANDER', 'FIELD_OPERATOR'],
      default: 'FIELD_OPERATOR',
      required: true,
    },
    status: {
      type: String,
      enum: ['INVITED', 'ACTIVE', 'REMOVED'],
      default: 'ACTIVE',
      required: true,
      index: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
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

// Compound Unique Index: A user cannot be added to the same mission twice (Section 6)
MissionMemberSchema.index({ missionId: 1, userId: 1 }, { unique: true });
MissionMemberSchema.index({ missionId: 1, status: 1 });

exposeVersion(MissionMemberSchema);
export const MissionMember = mongoose.model<IMissionMemberDocument>(
  'MissionMember',
  MissionMemberSchema
);
