import React from 'react';
import { Database, HardDrive, RefreshCw, Settings, Smartphone, UserRound } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useConnectivityStore } from '../store/connectivityStore';

export const SettingsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { status, serverReachable, systemHealth } = useConnectivityStore();
  const reloadWorkspace = () => { if (window.confirm('Reload the local workspace? Server data will not be changed.')) window.location.reload(); };
  const row = (label: string, value: React.ReactNode) => <div className="flex flex-col gap-1 border-b border-blackbox-border/70 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm text-blackbox-muted">{label}</span><span className="break-all font-mono text-xs text-blackbox-text">{value}</span></div>;
  return (
    <div className="ops-page space-y-6">
      <header className="ops-page-header"><div><div className="flex items-center gap-2 text-blackbox-cyan"><Settings className="h-4 w-4" /><span className="ops-kicker text-blackbox-cyan">System preferences</span></div><h1 className="ops-page-title">Settings</h1><p className="ops-page-subtitle">Review the current runtime and local continuity layer for this device.</p></div></header>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="ops-surface p-5 sm:p-6" aria-labelledby="runtime-heading"><div className="mb-4 flex items-center gap-2 border-b border-blackbox-border pb-4"><Database className="h-4 w-4 text-blackbox-cobalt" /><h2 id="runtime-heading" className="font-display text-lg font-semibold">Runtime</h2></div>{row('API endpoint', import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1')}{row('Realtime endpoint', import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000')}{row('Network status', status)}{row('API reachability', serverReachable ? 'REACHABLE' : 'UNREACHABLE')}{row('Server version', systemHealth?.version || 'Unknown')}</section>
        <section className="ops-surface p-5 sm:p-6" aria-labelledby="local-heading"><div className="mb-4 flex items-center gap-2 border-b border-blackbox-border pb-4"><HardDrive className="h-4 w-4 text-blackbox-cobalt" /><h2 id="local-heading" className="font-display text-lg font-semibold">Local continuity</h2></div>{row('Operator', user?.name || 'Unknown')}{row('Role', user?.role || 'Unknown')}{row('Session', user ? 'Authenticated' : 'Unavailable')}{row('Offline store', 'IndexedDB')}{row('Queue behavior', 'Supported changes sync on reconnect')}<button type="button" onClick={reloadWorkspace} className="ops-button-quiet mt-5 w-full"><RefreshCw className="h-4 w-4" />Reload local workspace</button></section>
      </div>
      <section className="ops-surface p-5 sm:p-6" aria-labelledby="shell-heading"><div className="mb-4 flex items-center gap-2 border-b border-blackbox-border pb-4"><Smartphone className="h-4 w-4 text-blackbox-cobalt" /><h2 id="shell-heading" className="font-display text-lg font-semibold">Application shell</h2></div><div className="grid gap-3 md:grid-cols-3"><div className="border border-blackbox-border bg-blackbox-panel p-4"><span className="ops-kicker">Service worker</span><p className="mt-2 text-sm text-blackbox-textSecondary">Configured by the existing PWA build.</p></div><div className="border border-blackbox-border bg-blackbox-panel p-4"><span className="ops-kicker">Manifest</span><p className="mt-2 text-sm text-blackbox-textSecondary">Available for the installed client shell.</p></div><div className="border border-blackbox-border bg-blackbox-panel p-4"><span className="ops-kicker">Current operator</span><p className="mt-2 flex items-center gap-2 text-sm text-blackbox-textSecondary"><UserRound className="h-4 w-4 text-blackbox-cobalt" />{user?.name || 'Not signed in'}</p></div></div></section>
    </div>
  );
};
