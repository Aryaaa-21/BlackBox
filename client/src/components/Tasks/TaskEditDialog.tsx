import React, { useEffect, useState } from 'react';
import { AlertCircle, Edit3, X } from 'lucide-react';
import { Task, TaskPriority, UpdateTaskPayload } from '../../types';

interface TaskEditDialogProps {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
  onUpdateTask: (taskId: string, payload: UpdateTaskPayload) => Promise<void>;
}

export const TaskEditDialog: React.FC<TaskEditDialogProps> = ({
  isOpen,
  task,
  onClose,
  onUpdateTask,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !task) return;
    setTitle(task.title);
    setDescription(task.description);
    setPriority(task.priority);
    setError(null);
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onUpdateTask(task.id, {
        title: title.trim(),
        description: description.trim(),
        priority,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-task-dialog-title"
    >
      <div className="w-full max-w-lg bg-blackbox-surface border border-blackbox-border rounded-xl shadow-2xl p-6 relative">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-blackbox-muted hover:text-blackbox-text hover:bg-blackbox-panel transition-colors disabled:opacity-50"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-cyan-950/60 border border-cyan-800 flex items-center justify-center text-blackbox-cyan">
            <Edit3 className="w-4 h-4" />
          </div>
          <div>
            <h3 id="edit-task-dialog-title" className="text-base font-mono font-bold text-blackbox-text">
              EDIT MISSION TASK
            </h3>
            <p className="text-xs text-blackbox-textSecondary font-mono">Changes save locally when offline.</p>
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
            <label className="block text-xs font-mono font-semibold text-blackbox-muted mb-1.5">TASK TITLE *</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              className="w-full px-3.5 py-2 bg-blackbox-panel border border-blackbox-border rounded-lg text-xs font-mono text-blackbox-text focus:outline-none focus:border-blackbox-cyan focus:ring-1 focus:ring-blackbox-cyan"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-semibold text-blackbox-muted mb-1.5">DESCRIPTION</label>
            <textarea
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={5000}
              className="w-full px-3.5 py-2 bg-blackbox-panel border border-blackbox-border rounded-lg text-xs font-mono text-blackbox-text focus:outline-none focus:border-blackbox-cyan focus:ring-1 focus:ring-blackbox-cyan resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-semibold text-blackbox-muted mb-1.5">PRIORITY LEVEL</label>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as TaskPriority)}
              className="w-full px-3.5 py-2 bg-blackbox-panel border border-blackbox-border rounded-lg text-xs font-mono text-blackbox-text focus:outline-none focus:border-blackbox-cyan"
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>

          <div className="pt-4 border-t border-blackbox-border/80 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-blackbox-panel hover:bg-zinc-800 border border-blackbox-border text-xs font-mono text-blackbox-text"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-4 py-2 rounded-lg bg-blackbox-cyan hover:bg-cyan-300 text-black text-xs font-mono font-bold border border-cyan-400 disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting && <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />}
              SAVE TASK
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
