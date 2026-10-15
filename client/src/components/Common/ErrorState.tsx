import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  code?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Subsystem Communication Error',
  message = 'An unexpected error occurred while communicating with the BlackBox services.',
  code,
  onRetry,
}) => {
  return (
    <div role="alert" className="p-6 rounded-xl border border-rose-900/40 bg-rose-950/20 text-center flex flex-col items-center justify-center my-4">
      <div className="w-10 h-10 rounded-full bg-rose-900/40 text-blackbox-critical flex items-center justify-center mb-3">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <h4 className="text-sm font-semibold font-mono text-rose-200 mb-1">{title}</h4>
      <p className="text-xs text-rose-300/80 max-w-md mb-3">{message}</p>
      {code && (
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blackbox-surface border border-rose-900/50 text-rose-400 mb-4">
          CODE: {code}
        </span>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex min-h-10 items-center gap-1.5 px-3 rounded-lg bg-blackbox-surface hover:bg-blackbox-panel border border-blackbox-border text-xs font-medium text-blackbox-text transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Operation</span>
        </button>
      )}
    </div>
  );
};
