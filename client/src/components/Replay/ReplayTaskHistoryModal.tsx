/**
 * Phase 8 — Mission Replay
 * ReplayTaskHistoryModal — displays the recorded lifecycle transitions of a selected task
 * up to the current replay point.
 */

import React from 'react';
import { X, CheckCircle, Clock, AlertCircle, Play, UserCheck, Shield } from 'lucide-react';
import { ReplayTask } from '../../types/replay';

interface ReplayTaskHistoryModalProps {
  task: ReplayTask | null;
  onClose: () => void;
}

export const ReplayTaskHistoryModal: React.FC<ReplayTaskHistoryModalProps> = ({
  task,
  onClose,
}) => {
  if (!task) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-blackbox-surface border border-blackbox-border rounded-xl shadow-2xl p-6 relative space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-blackbox-border">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-mono font-bold text-blackbox-text uppercase tracking-wider">
              Task Lifecycle Trace
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-blackbox-panel text-blackbox-muted hover:text-blackbox-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Task Title & Current Replay Status */}
        <div className="p-3 rounded-lg bg-blackbox-bg border border-blackbox-border space-y-1">
          <div className="text-xs font-mono text-blackbox-muted">TASK IDENTIFIER: {task.id}</div>
          <div className="text-sm font-mono font-bold text-cyan-300">{task.title}</div>
          {task.description && (
            <p className="text-xs font-mono text-blackbox-textSecondary">{task.description}</p>
          )}
          <div className="flex items-center gap-3 pt-1 text-xs font-mono">
            <span>Status: <span className="font-bold text-blackbox-text">{task.status}</span></span>
            <span>Priority: <span className="font-bold text-amber-400">{task.priority || 'MEDIUM'}</span></span>
            <span>Assigned: <span className="font-bold text-indigo-400">{task.assignedTo?.name || 'Unassigned'}</span></span>
          </div>
        </div>

        {/* Timeline of Recorded Transitions */}
        <div className="space-y-3">
          <div className="text-xs font-mono font-bold uppercase tracking-wider text-blackbox-muted">
            Recorded Transition History ({task.history.length})
          </div>

          <div className="max-h-[260px] overflow-y-auto space-y-3 pr-1 divide-y divide-blackbox-border/40">
            {task.history.map((step, idx) => (
              <div key={idx} className="pt-2 first:pt-0 flex items-start gap-3 text-xs font-mono">
                <div className="mt-0.5">
                  {step.eventType === 'TASK_COMPLETED' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : step.eventType === 'TASK_BLOCKED' ? (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  ) : step.eventType === 'TASK_STARTED' ? (
                    <Play className="w-4 h-4 text-cyan-400" />
                  ) : step.eventType === 'TASK_ASSIGNED' ? (
                    <UserCheck className="w-4 h-4 text-indigo-400" />
                  ) : (
                    <Shield className="w-4 h-4 text-zinc-400" />
                  )}
                </div>

                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blackbox-text">{step.eventType.replace(/_/g, ' ')}</span>
                    <span className="text-[10px] text-blackbox-muted">
                      {new Date(step.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="text-blackbox-muted text-[11px]">Operator: {step.actorName}</div>
                  {step.details && (
                    <div className="text-blackbox-textSecondary text-[11px]">{step.details}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-blackbox-border">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blackbox-panel hover:bg-zinc-800 text-xs font-mono text-blackbox-text border border-blackbox-border transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
