import React, { useState } from 'react';
import { AlertCircle, ClipboardPenLine } from 'lucide-react';

interface ObservationComposerProps {
  onRecord: (text: string) => Promise<{ isLocal: boolean }>;
}

export const ObservationComposer: React.FC<ObservationComposerProps> = ({ onRecord }) => {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'PENDING' | 'SYNCED' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) {
      setError('Observation text is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await onRecord(text.trim());
      setText('');
      setStatus(result.isLocal ? 'PENDING' : 'SYNCED');
      window.setTimeout(() => setStatus(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to record observation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-blackbox-surface border border-blackbox-border rounded-xl p-4 shadow-lg">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardPenLine className="w-4 h-4 text-blackbox-cyan" />
          <h2 className="text-sm font-mono font-bold text-blackbox-text uppercase tracking-wider">Field report</h2>
      </div>

      {error && (
        <div className="mb-3 p-2.5 rounded-lg bg-rose-950/40 border border-rose-800 text-xs font-mono text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={4}
          maxLength={5000}
          placeholder="Emergency security lockout detected at Main Gate..."
          className="w-full px-3 py-2.5 rounded-lg bg-blackbox-bg border border-blackbox-border text-xs font-mono text-blackbox-text placeholder:text-blackbox-muted focus:outline-none focus:border-blackbox-cyan focus:ring-1 focus:ring-blackbox-cyan resize-none"
        />
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-mono min-h-4">
            {status === 'PENDING' && <span className="text-blackbox-warning">LOCAL / PENDING</span>}
            {status === 'SYNCED' && <span className="text-blackbox-info">RECORDED</span>}
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !text.trim()}
            className="px-3.5 py-2 rounded-lg bg-blackbox-cyan hover:bg-cyan-300 text-black text-xs font-mono font-bold border border-cyan-400 disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSubmitting && <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />}
            RECORD
          </button>
        </div>
      </form>
    </div>
  );
};
