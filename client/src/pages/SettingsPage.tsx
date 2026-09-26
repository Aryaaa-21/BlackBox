import { Settings, HardDrive, Smartphone, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useConnectivityStore } from '../store/connectivityStore';

export const SettingsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { status, systemHealth } = useConnectivityStore();

  const handleClearCache = () => {
    if (confirm('Clear local telemetry cache and re-initialize?')) {
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-blackbox-border">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blackbox-cyan" />
          <span className="text-xs font-mono text-blackbox-cyan uppercase tracking-wider font-semibold">
            SYSTEM // PREFERENCES
          </span>
        </div>
        <h2 className="text-2xl font-bold font-mono text-blackbox-text mt-1">Platform Settings</h2>
        <p className="text-xs text-blackbox-muted mt-0.5">
          Local configuration, PWA installation status, and environment variables.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Environment & Node Settings */}
        <div className="p-6 rounded-xl bg-blackbox-surface border border-blackbox-border space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-blackbox-border">
            <Settings className="w-4 h-4 text-blackbox-cyan" />
            <h3 className="text-sm font-mono font-bold text-blackbox-text">Runtime Environment</h3>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="flex justify-between items-center py-1 border-b border-blackbox-border/50">
              <span className="text-blackbox-muted">VITE_API_URL:</span>
              <span className="text-blackbox-text">
                {import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-blackbox-border/50">
              <span className="text-blackbox-muted">VITE_SOCKET_URL:</span>
              <span className="text-blackbox-text">
                {import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-blackbox-border/50">
              <span className="text-blackbox-muted">API Status:</span>
              <span className="text-blackbox-success">{status}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-blackbox-muted">Server Version:</span>
              <span className="text-blackbox-textSecondary">{systemHealth?.version || 'v1.0.0-phase1'}</span>
            </div>
          </div>
        </div>

        {/* Local Storage & Cache */}
        <div className="p-6 rounded-xl bg-blackbox-surface border border-blackbox-border space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-blackbox-border">
            <HardDrive className="w-4 h-4 text-blackbox-cyan" />
            <h3 className="text-sm font-mono font-bold text-blackbox-text">Local Storage & Cache</h3>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="flex justify-between items-center py-1 border-b border-blackbox-border/50">
              <span className="text-blackbox-muted">Authentication Token:</span>
              <span className="text-blackbox-success">Cached in LocalStorage</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-blackbox-border/50">
              <span className="text-blackbox-muted">Offline Storage Engine:</span>
              <span className="text-blackbox-textSecondary">IndexedDB (Planned Phase 2)</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-blackbox-muted">Active Operator:</span>
              <span className="text-blackbox-text">{user?.name}</span>
            </div>
          </div>

          <button
            onClick={handleClearCache}
            className="w-full mt-2 py-2 px-3 rounded-lg bg-blackbox-panel hover:bg-blackbox-panel/80 border border-blackbox-border text-xs font-mono text-blackbox-text flex items-center justify-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blackbox-cyan" />
            <span>Flush Local Telemetry Cache</span>
          </button>
        </div>

        {/* PWA Information */}
        <div className="p-6 rounded-xl bg-blackbox-surface border border-blackbox-border space-y-4 md:col-span-2">
          <div className="flex items-center gap-2 pb-3 border-b border-blackbox-border">
            <Smartphone className="w-4 h-4 text-blackbox-cyan" />
            <h3 className="text-sm font-mono font-bold text-blackbox-text">PWA Application Configuration</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-3 rounded-lg bg-blackbox-panel border border-blackbox-border">
              <span className="text-blackbox-muted block mb-1">Service Worker:</span>
              <span className="text-blackbox-success font-semibold">Registered (AutoUpdate)</span>
            </div>
            <div className="p-3 rounded-lg bg-blackbox-panel border border-blackbox-border">
              <span className="text-blackbox-muted block mb-1">Web App Manifest:</span>
              <span className="text-blackbox-success font-semibold">Configured</span>
            </div>
            <div className="p-3 rounded-lg bg-blackbox-panel border border-blackbox-border">
              <span className="text-blackbox-muted block mb-1">Installability:</span>
              <span className="text-blackbox-cyan font-semibold">Supported</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
