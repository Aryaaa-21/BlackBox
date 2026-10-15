import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, Radio } from 'lucide-react';
import { useConnectivityStore } from '../../store/connectivityStore';

import { useSyncStore } from '../../store/syncStore';
import { AlertTriangle } from 'lucide-react';

export const ConnectivityIndicator: React.FC = () => {
  const { status, networkAvailable, serverReachable, realtimeConnected, latencyMs, checkServerHealth } =
    useConnectivityStore();
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const conflicts = useSyncStore((s) => s.conflicts);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  const getStatusConfig = () => {
    // 1. Conflict priority
    if (conflicts.length > 0) {
      return {
        label: `CONFLICT (${conflicts.length})`,
         dotColor: 'bg-blackbox-critical animate-pulse',
         textColor: 'text-blackbox-textSecondary',
         borderColor: 'border-blackbox-critical/70',
         bgColor: 'bg-blackbox-critical/15',
        icon: AlertTriangle,
      };
    }

    // 2. Syncing in progress
    if (isSyncing) {
      return {
        label: 'SYNCING',
         dotColor: 'bg-blackbox-cyan animate-ping',
         textColor: 'text-blackbox-cyan',
         borderColor: 'border-blackbox-cyan/60',
         bgColor: 'bg-blackbox-cyan/15',
        icon: RefreshCw,
      };
    }

    // 3. Regular connectivity states
    switch (status) {
      case 'ONLINE':
        return {
          label: 'LIVE',
         dotColor: 'bg-blackbox-success',
          textColor: 'text-blackbox-success',
          borderColor: 'border-emerald-900/50',
          bgColor: 'bg-emerald-950/20',
          icon: Wifi,
        };
      case 'RECONNECTING':
        return {
          label: 'DEGRADED',
         dotColor: 'bg-blackbox-warning animate-pulse',
          textColor: 'text-blackbox-warning',
          borderColor: 'border-amber-900/50',
          bgColor: 'bg-amber-950/20',
          icon: RefreshCw,
        };
      case 'OFFLINE':
      default:
        return {
          label: 'OFFLINE',
         dotColor: 'bg-blackbox-critical',
          textColor: 'text-blackbox-critical',
          borderColor: 'border-rose-900/50',
          bgColor: 'bg-rose-950/20',
          icon: WifiOff,
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className="relative flex items-center gap-2">
      {/* Pill Badge */}
      <button
        type="button"
        className={`flex items-center gap-2 px-2.5 py-1 rounded-full border ${config.borderColor} ${config.bgColor} backdrop-blur-sm transition-all duration-200 group relative cursor-pointer`}
        onClick={() => { setIsOpen((open) => !open); void checkServerHealth(); }}
        title="Click to re-check connectivity"
        aria-label={`Connectivity: ${config.label}. Check connection details.`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
        <Icon className={`w-3.5 h-3.5 ${config.textColor} ${status === 'RECONNECTING' ? 'animate-spin' : ''}`} />
        <span className={`text-[11px] font-mono font-semibold tracking-[0.12em] ${config.textColor}`}>
          {config.label}
        </span>

        {/* Latency if online */}
        {status === 'ONLINE' && latencyMs !== null && (
          <span className="text-[10px] font-mono text-blackbox-muted border-l border-blackbox-border pl-1.5">
            {latencyMs}ms
          </span>
        )}

      </button>

      {/* Dropdown status detail is a sibling of the button so the control remains semantic. */}
      {isOpen && <div role="dialog" aria-label="Connectivity details" className="absolute right-0 top-full mt-3 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-blackbox-border bg-blackbox-elevated p-4 text-left shadow-blackbox-panel z-50 animate-fade-in">
          <div className="mb-3 flex items-center justify-between text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-blackbox-textSecondary">
            <span>Link Telemetry</span>
            <Radio className="w-3 h-3 text-blackbox-cyan" />
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-blackbox-muted">Local Network:</span>
              <span className={`font-mono font-medium ${networkAvailable ? 'text-blackbox-success' : 'text-blackbox-critical'}`}>
                {networkAvailable ? 'AVAILABLE' : 'OFFLINE'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-blackbox-muted">Backend Server:</span>
              <span className={`font-mono font-medium ${serverReachable ? 'text-blackbox-success' : 'text-blackbox-critical'}`}>
                {serverReachable ? 'REACHABLE' : 'UNREACHABLE'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-blackbox-muted">Socket.IO Stream:</span>
              <span className={`font-mono font-medium ${realtimeConnected ? 'text-blackbox-cyan' : 'text-blackbox-muted'}`}>
                {realtimeConnected ? 'CONNECTED' : 'STANDBY'}
              </span>
            </div>
            {latencyMs !== null && (
              <div className="flex justify-between items-center">
                <span className="text-blackbox-muted">RTT Latency:</span>
                <span className="font-mono text-blackbox-text">{latencyMs} ms</span>
              </div>
            )}
          </div>
      </div>}
    </div>
  );
};

export const OfflineBanner: React.FC = () => {
  const { status, networkAvailable, serverReachable } = useConnectivityStore();

  if (status === 'ONLINE') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full py-1.5 px-4 text-xs font-mono flex items-center justify-between border-b transition-colors duration-300 ${
        status === 'OFFLINE'
          ? 'bg-rose-950/40 border-rose-900/60 text-rose-300'
          : 'bg-amber-950/40 border-amber-900/60 text-amber-300'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
        <span className="font-bold uppercase tracking-wider">{status} MODE:</span>
        <span>
          {!networkAvailable
            ? 'No network connection detected. Operating in local-resilience mode.'
            : !serverReachable
            ? 'Network available, but BlackBox API is unreachable. Reconnecting...'
            : 'Synchronizing connection...'}
        </span>
      </div>
      <div className="text-[11px] opacity-80 hidden md:block">
        Local actions will be queued and synchronized upon reconnection
      </div>
    </div>
  );
};
