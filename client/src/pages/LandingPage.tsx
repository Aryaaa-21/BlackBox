import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowRight, Radio } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { ConnectivityIndicator } from '../components/Connectivity/ConnectivityIndicator';

export const LandingPage: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();

  return (
    <div className="min-h-screen bg-blackbox-bg text-blackbox-text flex flex-col justify-between selection:bg-blackbox-cyan selection:text-black">
      {/* Header */}
      <header className="border-b border-blackbox-border/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-blackbox-panel border border-blackbox-cyan/40 flex items-center justify-center shadow-[0_0_12px_rgba(0,210,255,0.25)]">
            <Shield className="w-5 h-5 text-blackbox-cyan" />
          </div>
          <div>
            <span className="font-mono font-bold tracking-widest text-base">BLACKBOX</span>
            <span className="text-[10px] font-mono text-blackbox-muted block uppercase tracking-tight">
              Resilient Operations Platform
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ConnectivityIndicator />
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="px-4 py-2 rounded-lg bg-blackbox-cyan text-black font-mono text-xs font-bold hover:bg-cyan-300 transition-colors flex items-center gap-1.5"
            >
              <span>ENTER CONSOLE</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-3.5 py-1.5 rounded-lg border border-blackbox-border text-blackbox-text hover:bg-blackbox-panel font-mono text-xs transition-colors"
              >
                SIGN IN
              </Link>
              <Link
                to="/register"
                className="px-3.5 py-1.5 rounded-lg bg-blackbox-panel hover:bg-blackbox-panel/80 border border-blackbox-cyan/40 text-blackbox-cyan font-mono text-xs font-semibold transition-colors"
              >
                REGISTER
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blackbox-border bg-blackbox-panel/60 text-xs font-mono text-blackbox-cyanMuted mb-6">
          <Radio className="w-3.5 h-3.5 text-blackbox-cyan animate-pulse" />
          <span>PHASE 1: TECHNICAL ARCHITECTURE & MERN FOUNDATION</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight font-mono text-blackbox-text max-w-3xl mb-6 leading-tight">
          When the network fails, the operation continues.
        </h1>

        <p className="text-sm sm:text-base text-blackbox-muted max-w-2xl mb-10 leading-relaxed">
          BlackBox is an offline-first operations platform designed to keep command centers and field operators
          coordinated when connectivity becomes intermittent, contested, or completely unavailable.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="w-full sm:w-auto px-6 py-3 rounded-lg bg-blackbox-cyan text-black font-mono text-sm font-bold hover:bg-cyan-300 transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,210,255,0.3)]"
            >
              <span>ACCESS COMMAND CONSOLE</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                className="w-full sm:w-auto px-6 py-3 rounded-lg bg-blackbox-cyan text-black font-mono text-sm font-bold hover:bg-cyan-300 transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,210,255,0.3)]"
              >
                <span>GET STARTED // REGISTER OPERATOR</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto px-6 py-3 rounded-lg bg-blackbox-surface hover:bg-blackbox-panel border border-blackbox-border text-blackbox-text font-mono text-sm font-medium transition-colors"
              >
                EXISTING OPERATOR SIGN IN
              </Link>
            </>
          )}
        </div>

        {/* 4 Pillars of Resilient Ops */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full text-left">
          <div className="p-5 rounded-xl bg-blackbox-surface border border-blackbox-border">
            <div className="text-blackbox-cyan font-mono text-xs uppercase tracking-wider mb-2 font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blackbox-cyan" />
              01 // ONLINE
            </div>
            <p className="text-xs text-blackbox-textSecondary">
              Real-time mission coordination, live telemetry, and instant bi-directional command updates via Socket.IO.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-blackbox-surface border border-blackbox-border">
            <div className="text-blackbox-critical font-mono text-xs uppercase tracking-wider mb-2 font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blackbox-critical" />
              02 // OFFLINE
            </div>
            <p className="text-xs text-blackbox-textSecondary">
              Zero interruptions. The operator remains inside the workflow. Critical actions execute locally and queue safely.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-blackbox-surface border border-blackbox-border">
            <div className="text-blackbox-warning font-mono text-xs uppercase tracking-wider mb-2 font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blackbox-warning" />
              03 // RECONNECT
            </div>
            <p className="text-xs text-blackbox-textSecondary">
              Transparent synchronization. Pending mutations are dispatched with deterministic conflict resolution.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-blackbox-surface border border-blackbox-border">
            <div className="text-emerald-400 font-mono text-xs uppercase tracking-wider mb-2 font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              04 // REPLAY
            </div>
            <p className="text-xs text-blackbox-textSecondary">
              Append-only event audit logs permit complete chronological mission reconstruction and forensic analysis.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-blackbox-border/80 px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-blackbox-muted gap-2">
        <div className="flex items-center gap-2">
          <span>BLACKBOX v1.0.0-PHASE1</span>
          <span>•</span>
          <span>MERN STACK ARCHITECTURE</span>
        </div>
        <div>
          {isAuthenticated ? `ACTIVE SESSION: ${user?.name} (${user?.role})` : 'NO ACTIVE SESSION'}
        </div>
      </footer>
    </div>
  );
};
