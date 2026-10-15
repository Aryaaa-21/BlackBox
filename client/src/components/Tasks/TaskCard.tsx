import React, { useState } from 'react';
import {
  Play,
  CheckCircle2,
  AlertOctagon,
  RotateCcw,
  UserCheck,
  User,
  AlertTriangle,
  Clock,
  Calendar,
  Edit3,
} from 'lucide-react';
import { Task, TaskStatus, UserRole, MissionMember } from '../../types';
import { TaskStatusBadge } from './TaskStatusBadge';
import { TaskPriorityBadge } from './TaskPriorityBadge';

interface TaskCardProps {
  task: Task;
  isCommander: boolean;
  currentUserId: string;
  currentUserRole?: UserRole;
  missionMembers: MissionMember[];
  onStatusChange: (taskId: string, status: TaskStatus) => Promise<void>;
  onOpenAssignModal: (task: Task) => void;
  onOpenEditModal: (task: Task) => void;
  isUpdating?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isCommander,
  currentUserId,
  currentUserRole,
  missionMembers,
  onStatusChange,
  onOpenAssignModal,
  onOpenEditModal,
  isUpdating = false,
}) => {
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const isAssignedToMe = task.assignedTo?.id === currentUserId;
  const isFieldOperator = currentUserRole === 'FIELD_OPERATOR';

  // Section 88: Check if the assigned operator has been removed from the mission
  const isAssigneeRemoved =
    task.assignedTo &&
    missionMembers.some(
      (m) => m.userId.id === task.assignedTo?.id && m.status === 'REMOVED'
    );

  // Authorization check (Section 32, 54, 55, 86):
  // Commander can execute transitions on mission tasks;
  // Field operator can update ONLY their own assigned tasks.
  const canUpdateStatus = isCommander || (isFieldOperator && isAssignedToMe);

  const handleTransition = async (newStatus: TaskStatus) => {
    setActionInProgress(newStatus);
    try {
      await onStatusChange(task.id, newStatus);
    } finally {
      setActionInProgress(null);
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className={`rounded-blackbox border p-4 transition-all ${
        task.status === 'ACTIVE'
          ? 'bg-blackbox-panel border-blackbox-cyan/35'
          : task.status === 'BLOCKED'
          ? 'bg-blackbox-panel border-blackbox-warning/35'
          : task.status === 'COMPLETED'
          ? 'bg-blackbox-surface/80 border-blackbox-border opacity-80'
          : 'bg-blackbox-panel/65 border-blackbox-border hover:border-blackbox-borderLight'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <TaskPriorityBadge priority={task.priority} />
          <TaskStatusBadge status={task.status} />
          {(task as any).syncState === 'PENDING' && (
            <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/80 border border-amber-600/60 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              PENDING SYNC
            </span>
          )}
          {(task as any).syncState === 'SYNCED' && (
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-800/50 px-2 py-0.5 rounded">
              SYNCED
            </span>
          )}
          {isAssignedToMe && (
            <span className="text-[10px] font-mono font-bold text-blackbox-cyan bg-cyan-950/80 border border-cyan-800 px-2 py-0.5 rounded">
              MY TASK
            </span>
          )}
        </div>

        {/* Commander Assignment Controls */}
        {isCommander && task.status !== 'COMPLETED' && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onOpenEditModal(task)}
              className="text-[11px] font-mono text-zinc-400 hover:text-blackbox-cyan flex items-center gap-1 px-2 py-1 rounded bg-blackbox-surface hover:bg-zinc-800 border border-blackbox-border transition-colors"
              title="Edit task details"
            >
              <Edit3 className="w-3 h-3" />
              <span>EDIT</span>
            </button>
            <button
              onClick={() => onOpenAssignModal(task)}
              className="text-[11px] font-mono text-zinc-400 hover:text-blackbox-cyan flex items-center gap-1 px-2 py-1 rounded bg-blackbox-surface hover:bg-zinc-800 border border-blackbox-border transition-colors"
              title="Assign / Reassign operator"
            >
              <UserCheck className="w-3 h-3" />
              <span>{task.assignedTo ? 'REASSIGN' : 'ASSIGN'}</span>
            </button>
          </div>
        )}
      </div>

      <div className="mb-2">
        <h4 className="text-sm font-mono font-bold text-blackbox-text leading-snug">
          {task.title}
        </h4>
        {task.description && (
          <p className="mt-1 text-xs font-mono text-blackbox-textSecondary line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}
      </div>

      {/* Meta: Assignee + Timestamps */}
      <div className="mt-3 pt-3 border-t border-blackbox-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-blackbox-muted shrink-0" />
          {task.assignedTo ? (
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-300 font-medium">{task.assignedTo.name}</span>
              {isAssigneeRemoved && (
                <span className="text-[10px] text-rose-400 bg-rose-950/60 border border-rose-800 px-1.5 py-0.2 rounded flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  REMOVED
                </span>
              )}
            </div>
          ) : (
            <span className="text-zinc-500 italic">Unassigned (Standby)</span>
          )}
        </div>

        <div className="flex items-center gap-3 text-blackbox-muted">
          {task.status === 'ACTIVE' && task.startedAt && (
            <span className="flex items-center gap-1 text-cyan-400">
              <Clock className="w-3 h-3" />
              Started {formatDate(task.startedAt)}
            </span>
          )}
          {task.status === 'BLOCKED' && task.blockedAt && (
            <span className="flex items-center gap-1 text-amber-400">
              <AlertOctagon className="w-3 h-3" />
              Blocked {formatDate(task.blockedAt)}
            </span>
          )}
          {task.status === 'COMPLETED' && task.completedAt && (
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              Done {formatDate(task.completedAt)}
            </span>
          )}
          {task.status === 'PENDING' && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Created {formatDate(task.createdAt)}
            </span>
          )}
        </div>
      </div>

      {/* State Machine Transition Actions (Sections 23, 55, 83, 84, 85, 89) */}
      {canUpdateStatus && task.status !== 'COMPLETED' && (
        <div className="mt-3.5 pt-3 border-t border-blackbox-border/80 flex items-center justify-end gap-2">
          {task.status === 'PENDING' && (
            <>
              <button
                onClick={() => handleTransition('ACTIVE')}
                disabled={isUpdating || actionInProgress !== null}
                className="px-3 py-1.5 rounded bg-blackbox-cyan hover:bg-cyan-300 text-black text-xs font-mono font-bold border border-cyan-400 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {actionInProgress === 'ACTIVE' ? (
                  <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                <span>START TASK</span>
              </button>
              <button
                onClick={() => handleTransition('BLOCKED')}
                disabled={isUpdating || actionInProgress !== null}
                className="px-2.5 py-1.5 rounded bg-blackbox-surface hover:bg-amber-950/40 text-amber-400 text-xs font-mono border border-blackbox-border hover:border-amber-800 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                <AlertOctagon className="w-3 h-3" />
                <span>BLOCK</span>
              </button>
            </>
          )}

          {task.status === 'ACTIVE' && (
            <>
              <button
                onClick={() => handleTransition('COMPLETED')}
                disabled={isUpdating || actionInProgress !== null}
                className="ops-button-primary px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {actionInProgress === 'COMPLETED' ? (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>COMPLETE</span>
              </button>
              <button
                onClick={() => handleTransition('BLOCKED')}
                disabled={isUpdating || actionInProgress !== null}
                className="px-2.5 py-1.5 rounded bg-blackbox-surface hover:bg-amber-950/40 text-amber-400 text-xs font-mono border border-blackbox-border hover:border-amber-800 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                <AlertOctagon className="w-3 h-3" />
                <span>BLOCK</span>
              </button>
            </>
          )}

          {task.status === 'BLOCKED' && (
            <button
              onClick={() => handleTransition('ACTIVE')}
              disabled={isUpdating || actionInProgress !== null}
              className="px-3 py-1.5 rounded bg-cyan-900 hover:bg-cyan-800 text-cyan-200 text-xs font-mono font-bold border border-cyan-700 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              {actionInProgress === 'ACTIVE' ? (
                <span className="w-3 h-3 border-2 border-cyan-200 border-t-transparent rounded-full animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              <span>RESUME TASK</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
