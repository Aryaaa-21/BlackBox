/**
 * Phase 9 — Product Polish & Hackathon Demo
 * Landing Page — First impression operational overview.
 * Immediate 30-second understanding of the BlackBox value proposition.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, ArrowRight, Radio, RefreshCw, Layers, History, Activity } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { ConnectivityIndicator } from '../components/Connectivity/ConnectivityIndicator';
import { demoApi } from '../services/demoApi';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, login } = useAuthStore();
  const [isLaunchingDemo, setIsLaunchingDemo] = useState(false);

  const handleLaunchDemo = async () => {
    setIsLaunchingDemo(true);
    try {
      const res = await demoApi.resetDemo();
      const commanderCreds = res.demoUsers.find((u) => u.role === 'COMMANDER');
      if (commanderCreds) {
        await login(commanderCreds.email, commanderCreds.password);
      }
      if (res.demoMission?.id) {
        navigate(`/missions/${res.demoMission.id}`);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Failed to launch demo from landing page:', err);
      navigate('/login');
    } finally {
      setIsLaunchingDemo(false);
    }
  };

  const scrollToHowItWorks = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-blackbox-bg text-blackbox-text ops-grid selection:bg-blackbox-cyan selection:text-black">
      {/* Header */}
      <header className="border-b border-blackbox-border/80 bg-blackbox-surface/80 px-6 py-4 backdrop-blur-xl flex items-center justify-between">
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
              className="px-4 py-2 rounded-lg bg-blackbox-cyan text-black font-mono text-xs font-bold hover:bg-cyan-300 transition-colors flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,210,255,0.25)]"
            >
              <span>ENTER OPERATIONS</span>
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
              <button
                onClick={handleLaunchDemo}
                disabled={isLaunchingDemo}
                className="px-3.5 py-1.5 rounded-lg bg-blackbox-cyan text-black font-mono text-xs font-bold hover:bg-cyan-300 transition-colors flex items-center gap-1 shadow-[0_0_10px_rgba(0,210,255,0.3)]"
              >
                <span>{isLaunchingDemo ? 'PREPARING...' : 'LIVE DEMO'}</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto flex min-h-[calc(100vh-148px)] max-w-6xl flex-col justify-center px-6 py-16">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blackbox-cyan/25 bg-blackbox-cyan/10 px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-blackbox-cyan">
          <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>MISSION-CRITICAL OFFLINE-FIRST OPERATIONS</span>
        </div>

        <h1 className="mt-7 max-w-4xl text-4xl font-semibold leading-[1.08] tracking-tight text-blackbox-text sm:text-6xl">
          The network can fail. <br />
          <span className="text-blackbox-cyan">
            The operation shouldn&apos;t.
          </span>
        </h1>

        <p className="mt-7 max-w-2xl text-sm leading-7 text-blackbox-textSecondary sm:text-base">
          Keep command centers and field operators coordinated when connectivity disappears.
          Execute tasks locally in IndexedDB, queue mutations offline, reconcile conflicts explicitly,
          and replay missions chronologically.
        </p>

        {/* Primary Action Buttons */}
        <div className="mt-10 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-blackbox-cyan text-black font-mono text-sm font-bold hover:bg-cyan-300 transition-all flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(0,210,255,0.35)]"
            >
              <span>ENTER OPERATIONS</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <button
                onClick={handleLaunchDemo}
                disabled={isLaunchingDemo}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-blackbox-cyan text-black font-mono text-sm font-bold hover:bg-cyan-300 transition-all flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(0,210,255,0.35)]"
              >
                <span>{isLaunchingDemo ? 'INITIALIZING DEMO...' : 'ENTER OPERATIONS (DEMO)'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={scrollToHowItWorks}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-mono text-sm font-medium transition-colors"
              >
                SEE HOW IT WORKS
              </button>
            </>
          )}
        </div>

        {/* 4 Pillars of Resilient Ops */}
        <div id="how-it-works" className="mt-16 grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
          <div className="ops-surface p-5 transition-colors hover:border-blackbox-cyan/35">
            <div className="text-cyan-400 font-mono text-xs uppercase tracking-wider mb-2 font-bold flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" />
              01 // LIVE COORD
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Real-time situational awareness, team dispatching, and bidirectional updates via Socket.IO rooms.
            </p>
          </div>

          <div className="ops-surface p-5 transition-colors hover:border-blackbox-critical/35">
            <div className="text-rose-400 font-mono text-xs uppercase tracking-wider mb-2 font-bold flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" />
              02 // OFFLINE CACHE
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Zero workflow lockouts. Local IndexedDB storage and client-side state machine validate and queue mutations.
            </p>
          </div>

          <div className="ops-surface p-5 transition-colors hover:border-blackbox-warning/35">
            <div className="text-amber-400 font-mono text-xs uppercase tracking-wider mb-2 font-bold flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" />
              03 // SYNC & CONFLICT
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Automatic push sync upon reconnection. Server divergence triggers visible side-by-side conflict resolution.
            </p>
          </div>

          <div className="ops-surface p-5 transition-colors hover:border-blackbox-success/35">
            <div className="text-emerald-400 font-mono text-xs uppercase tracking-wider mb-2 font-bold flex items-center gap-2">
              <History className="w-3.5 h-3.5" />
              04 // MISSION REPLAY
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Forensic timeline playback. Reconstruct exact historical field states from immutable MissionEvents.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-blackbox-border/80 bg-blackbox-surface/70 px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-blackbox-muted gap-2">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-bold">BLACKBOX</span>
          <span>•</span>
          <span>OFFLINE-FIRST OPERATIONS PLATFORM</span>
        </div>
        <div className="text-slate-500">
          {isAuthenticated ? `SESSION: ${user?.name} (${user?.role})` : 'OPERATIONAL STANDBY'}
        </div>
      </footer>
    </div>
  );
};
