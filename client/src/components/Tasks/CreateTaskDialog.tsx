import React, { useState } from 'react';
import { PlusCircle, X, AlertCircle } from 'lucide-react';
import { TaskPriority, MissionMember, CreateTaskPayload } from '../../types';

interface CreateTaskDialogProps {
  isOpen: boolean;
  missionId: string;
  members: MissionMember[];
  onClose: () => void;
  onCreateTask: (payload: CreateTaskPayload) => Promise<void>;
}

export const CreateTaskDialog: React.FC<CreateTaskDialogProps> = ({
  isOpen,
  members,
  onClose,
  onCreateTask,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Only active field operators from this mission (Section 52)
  const assignableMembers = members.filter(
    (m) => m.role === 'FIELD_OPERATOR' && m.status === 'ACTIVE'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onCreateTask({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        assignedTo: assignedTo || undefined,
      });
      // Reset form
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setAssignedTo('');
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create operational task.';
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
      aria-labelledby="create-task-dialog-title"
    >
      <div className="w-full max-w-lg bg-blackbox-surface border border-blackbox-border rounded-xl shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-blackbox-muted hover:text-blackbox-text hover:bg-blackbox-panel transition-colors disabled:opacity-50"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-cyan-950/60 border border-cyan-800 flex items-center justify-center text-blackbox-cyan">
            <PlusCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 id="create-task-dialog-title" className="text-base font-mono font-bold text-blackbox-text">
              CREATE MISSION TASK
            </h3>
            <p className="text-xs text-blackbox-textSecondary font-mono">
              Define operational objective and delegate to field team
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-semibold text-blackbox-muted mb-1.5">
              TASK TITLE *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Secure Perimeter Sector Alpha"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 bg-blackbox-panel border border-blackbox-border rounded-lg text-xs font-mono text-blackbox-text placeholder:text-blackbox-muted focus:outline-none focus:border-blackbox-cyan focus:ring-1 focus:ring-blackbox-cyan transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-semibold text-blackbox-muted mb-1.5">
              DESCRIPTION
            </label>
            <textarea
              rows={3}
              placeholder="Operational instructions, specific zone details, checkpoints..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 bg-blackbox-panel border border-blackbox-border rounded-lg text-xs font-mono text-blackbox-text placeholder:text-blackbox-muted focus:outline-none focus:border-blackbox-cyan focus:ring-1 focus:ring-blackbox-cyan transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-semibold text-blackbox-muted mb-1.5">
                PRIORITY LEVEL
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3.5 py-2 bg-blackbox-panel border border-blackbox-border rounded-lg text-xs font-mono text-blackbox-text focus:outline-none focus:border-blackbox-cyan focus:ring-1 focus:ring-blackbox-cyan transition-colors"
              >
                <option value="LOW">LOW — Routine execution</option>
                <option value="MEDIUM">MEDIUM — Standard priority</option>
                <option value="HIGH">HIGH — Urgent focus</option>
                <option value="CRITICAL">CRITICAL — Immediate action</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono font-semibold text-blackbox-muted mb-1.5">
                DELEGATE TO (OPTIONAL)
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3.5 py-2 bg-blackbox-panel border border-blackbox-border rounded-lg text-xs font-mono text-blackbox-text focus:outline-none focus:border-blackbox-cyan focus:ring-1 focus:ring-blackbox-cyan transition-colors"
              >
                <option value="">Unassigned (Standby)</option>
                {assignableMembers.map((member) => (
                  <option key={member.id} value={member.userId.id}>
                    {member.userId.name} ({member.userId.email})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-blackbox-border/80 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-blackbox-panel hover:bg-zinc-800 border border-blackbox-border text-xs font-mono text-blackbox-text transition-colors disabled:opacity-50"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-4 py-2 rounded-lg bg-blackbox-cyan hover:bg-cyan-300 text-black text-xs font-mono font-bold border border-cyan-400 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              {isSubmitting && (
                <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
              )}
              <span>CREATE TASK</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
