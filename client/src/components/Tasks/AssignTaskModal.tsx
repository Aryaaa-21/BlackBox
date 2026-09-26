import React, { useState } from 'react';
import { UserCheck, X, AlertCircle, UserMinus, Shield } from 'lucide-react';
import { Task, MissionMember } from '../../types';

interface AssignTaskModalProps {
  isOpen: boolean;
  task: Task | null;
  members: MissionMember[];
  onClose: () => void;
  onAssign: (taskId: string, userId: string) => Promise<void>;
  onUnassign: (taskId: string) => Promise<void>;
}

export const AssignTaskModal: React.FC<AssignTaskModalProps> = ({
  isOpen,
  task,
  members,
  onClose,
  onAssign,
  onUnassign,
}) => {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !task) return null;

  // Only active field operators can be assigned tasks (Section 26 & 70)
  const assignableMembers = members.filter(
    (m) => m.role === 'FIELD_OPERATOR' && m.status === 'ACTIVE'
  );

  const currentAssigneeId = task.assignedTo?.id;

  const handleAssign = async () => {
    if (!selectedUserId) {
      setError('Please select an active field operator.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onAssign(task.id, selectedUserId);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to assign operator.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnassign = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onUnassign(task.id);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to unassign task.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-task-modal-title"
    >
      <div className="w-full max-w-md bg-blackbox-surface border border-blackbox-border rounded-xl shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-blackbox-muted hover:text-blackbox-text hover:bg-blackbox-panel transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-cyan-950/60 border border-cyan-800 flex items-center justify-center text-blackbox-cyan">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 id="assign-task-modal-title" className="text-base font-mono font-bold text-blackbox-text">
              TASK DELEGATION
            </h3>
            <p className="text-xs text-blackbox-textSecondary font-mono truncate max-w-xs">
              {task.title}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-semibold text-blackbox-muted mb-2">
              SELECT DEPLOYED OPERATOR
            </label>

            {assignableMembers.length === 0 ? (
              <div className="p-3 text-xs font-mono text-amber-400 bg-amber-950/30 border border-amber-800/60 rounded-lg">
                No active field operators available in this mission. Add operators to the team roster first.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                {assignableMembers.map((member) => {
                  const isCurrent = member.userId.id === currentAssigneeId;
                  const isSelected = selectedUserId === member.userId.id;

                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setSelectedUserId(member.userId.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-cyan-950/40 border-blackbox-cyan text-white'
                          : isCurrent
                          ? 'bg-blackbox-panel border-cyan-800/60 text-blackbox-text'
                          : 'bg-blackbox-panel/60 border-blackbox-border hover:border-zinc-700 text-blackbox-text'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                          {member.userId.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-mono font-medium truncate">
                            {member.userId.name}
                          </div>
                          <div className="text-[10px] font-mono text-blackbox-muted truncate">
                            {member.userId.email}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isCurrent && (
                          <span className="text-[10px] font-mono font-bold text-blackbox-cyan bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
                            ASSIGNED
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 flex items-center gap-1">
                          <Shield className="w-2.5 h-2.5" />
                          OPERATOR
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-blackbox-border/80 flex items-center justify-between">
          {currentAssigneeId ? (
            <button
              type="button"
              onClick={handleUnassign}
              disabled={isSubmitting}
              className="px-3 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800 text-xs font-mono text-rose-300 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <UserMinus className="w-3.5 h-3.5" />
              <span>UNASSIGN</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 rounded-lg bg-blackbox-panel hover:bg-zinc-800 border border-blackbox-border text-xs font-mono text-blackbox-text transition-colors disabled:opacity-50"
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={handleAssign}
              disabled={isSubmitting || !selectedUserId || assignableMembers.length === 0}
              className="px-4 py-2 rounded-lg bg-blackbox-cyan hover:bg-cyan-300 text-black text-xs font-mono font-bold border border-cyan-400 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              {isSubmitting && (
                <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
              )}
              <span>CONFIRM ASSIGNMENT</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
