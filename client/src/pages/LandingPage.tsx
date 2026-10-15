import React, { useState } from 'react';
import { Activity, ArrowRight, History, Layers3, Radio, RefreshCw, Shield } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { ConnectivityIndicator } from '../components/Connectivity/ConnectivityIndicator';
import { demoApi } from '../services/demoApi';

const capabilities = [
  { icon: Radio, title: 'Coordinate live', copy: 'Mission rooms, task ownership, and Socket.IO updates stay in one operational view.' },
  { icon: Layers3, title: 'Keep working offline', copy: 'IndexedDB keeps the working set available and queues supported changes locally.' },
  { icon: RefreshCw, title: 'Reconcile explicitly', copy: 'Sync status, pending mutations, and conflicts remain visible when the link returns.' },
  { icon: History, title: 'Review the record', copy: 'Replay the chronological mission event stream to understand what changed and when.' },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, login } = useAuthStore();
  const [isLaunchingDemo, setIsLaunchingDemo] = useState(false);

  const handleLaunchDemo = async () => {
    setIsLaunchingDemo(true);
    try {
      const result = await demoApi.resetDemo();
      const commander = result.demoUsers.find((candidate) => candidate.role === 'COMMANDER');
      if (commander) await login(commander.email, commander.password);
      navigate(result.demoMission?.id ? `/missions/${result.demoMission.id}` : '/dashboard');
    } catch (error) {
      console.error('Failed to launch demo from landing page:', error);
      navigate('/login');
    } finally {
      setIsLaunchingDemo(false);
    }
  };

  return (
    <div className="min-h-screen bg-blackbox-bg text-blackbox-text">
      <header className="border-b border-blackbox-border bg-blackbox-surface">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label="BlackBox home">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-blackbox-cyan/60 bg-blackbox-panel text-blackbox-cyan">
              <Shield className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-display text-sm font-bold tracking-[0.18em]">BLACKBOX</span>
              <span className="mt-0.5 block text-[11px] text-blackbox-muted">Continuity for field operations</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <ConnectivityIndicator />
            {isAuthenticated ? (
              <Link to="/dashboard" className="ops-button-primary"><span>Open console</span><ArrowRight className="h-4 w-4" /></Link>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link to="/login" className="ops-button-quiet">Sign in</Link>
                <Link to="/register" className="ops-button-primary">Create account</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1440px] gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-24 lg:pt-24">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 border-l-2 border-blackbox-cyan pl-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-blackbox-textSecondary">
              <Activity className="h-3.5 w-3.5 text-blackbox-cyan" aria-hidden="true" />
              Offline-first mission coordination
            </div>
            <h1 className="max-w-4xl font-display text-5xl font-bold leading-[0.98] tracking-[-0.06em] text-blackbox-text sm:text-7xl">
              Keep the mission moving when the network does not.
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-blackbox-textSecondary sm:text-lg">
              BlackBox gives commanders and field operators one durable workspace for dispatch, observation, sync, and replay.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              {isAuthenticated ? (
                <Link to="/dashboard" className="ops-button-primary min-h-12 px-6">Enter operations <ArrowRight className="h-4 w-4" /></Link>
              ) : (
                <button type="button" onClick={handleLaunchDemo} disabled={isLaunchingDemo} className="ops-button-primary min-h-12 px-6">
                  {isLaunchingDemo ? 'Preparing demo…' : 'Launch live demo'} <ArrowRight className="h-4 w-4" />
                </button>
              )}
              <a href="#capabilities" className="ops-button-quiet min-h-12 px-6">See the operating model</a>
            </div>
            <p className="mt-5 font-mono text-[11px] text-blackbox-muted">
              {isAuthenticated ? `Signed in as ${user?.name ?? 'operator'}` : 'Local work remains actionable. Supported changes sync when the link returns.'}
            </p>
          </div>

          <div className="border-l border-blackbox-border pl-6 sm:pl-8 lg:mb-2">
            <div className="mb-5 flex items-center justify-between border-b border-blackbox-border pb-4">
              <span className="ops-kicker">Operational model</span>
              <span className="font-mono text-[10px] text-blackbox-muted">BB / 01</span>
            </div>
            <div className="space-y-0">
              {['Dispatch', 'Execute locally', 'Reconcile', 'Replay'].map((step, index) => (
                <div key={step} className="flex items-center gap-4 border-b border-blackbox-border py-4 last:border-b-0">
                  <span className="font-mono text-xs text-blackbox-cobalt">0{index + 1}</span>
                  <span className="font-display text-lg font-semibold text-blackbox-text">{step}</span>
                  <span className="ml-auto h-px w-10 bg-blackbox-borderLight" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="capabilities" className="border-y border-blackbox-border bg-blackbox-surface">
          <div className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8">
            <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div><div className="ops-kicker">What stays connected</div><h2 className="mt-2 font-display text-2xl font-bold tracking-tight">A compact operating surface for uncertain conditions.</h2></div>
              <span className="font-mono text-[11px] text-blackbox-muted">No synthetic telemetry. Real client state only.</span>
            </div>
            <div className="grid gap-px overflow-hidden border border-blackbox-border bg-blackbox-border sm:grid-cols-2 lg:grid-cols-4">
              {capabilities.map(({ icon: Icon, title, copy }) => (
                <article key={title} className="bg-blackbox-surface p-5">
                  <Icon className="h-5 w-5 text-blackbox-cobalt" aria-hidden="true" />
                  <h3 className="mt-8 font-display text-base font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-blackbox-textSecondary">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-[1440px] flex-col gap-2 px-5 py-6 font-mono text-[10px] text-blackbox-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>BLACKBOX / RESILIENT OPERATIONS PLATFORM</span>
        <span>{isAuthenticated ? `SESSION / ${user?.role ?? 'OPERATOR'}` : 'STATUS / READY FOR DEPLOYMENT'}</span>
      </footer>
    </div>
  );
};
