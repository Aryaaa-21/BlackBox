import React from 'react';
import { ArrowLeft, Compass } from 'lucide-react';
import { Link } from 'react-router-dom';

export const NotFoundPage: React.FC = () => (
  <div className="min-h-screen bg-blackbox-bg text-blackbox-text">
    <header className="border-b border-blackbox-border bg-blackbox-surface"><div className="mx-auto max-w-6xl px-5 py-5 sm:px-8"><Link to="/" className="font-display text-sm font-bold tracking-[0.18em]">BLACKBOX</Link></div></header>
    <main className="mx-auto grid min-h-[calc(100vh-72px)] max-w-6xl place-items-center px-5 py-12 sm:px-8"><section className="ops-surface w-full max-w-xl p-8 sm:p-10"><div className="ops-kicker text-blackbox-warning">Route unavailable / 404</div><h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.05em]">This coordinate is empty.</h1><p className="mt-4 max-w-md text-sm leading-6 text-blackbox-textSecondary">The requested path is not part of the BlackBox operational workspace.</p><Link to="/" className="ops-button-primary mt-8"><ArrowLeft className="h-4 w-4" />Return to landing</Link><div className="mt-10 flex items-center gap-2 border-t border-blackbox-border pt-4 font-mono text-[10px] text-blackbox-muted"><Compass className="h-3.5 w-3.5" />Check the mission directory or return to the console.</div></section></main>
  </div>
);
