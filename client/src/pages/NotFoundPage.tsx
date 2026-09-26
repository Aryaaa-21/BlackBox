import React from 'react';
import { Link } from 'react-router-dom';
import { AlertOctagon, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-blackbox-bg flex flex-col items-center justify-center p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-blackbox-panel border border-rose-900/60 text-blackbox-critical flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
        <AlertOctagon className="w-8 h-8" />
      </div>
      <div className="text-xs font-mono text-blackbox-critical uppercase tracking-widest mb-1">
        ERROR // 404
      </div>
      <h1 className="text-3xl font-mono font-bold text-blackbox-text mb-2">
        Operational Coordinate Not Found
      </h1>
      <p className="text-xs text-blackbox-muted max-w-sm mb-8">
        The requested system path does not exist in the BlackBox routing ledger.
      </p>
      <Link
        to="/"
        className="px-4 py-2 rounded-lg bg-blackbox-surface hover:bg-blackbox-panel border border-blackbox-border text-xs font-mono text-blackbox-text flex items-center gap-2 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Safe Coordinate</span>
      </Link>
    </div>
  );
};
