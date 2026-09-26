import React from 'react';
import { Wifi, WifiOff, RefreshCw, Radio } from 'lucide-react';
import { useConnectivityStore } from '../../store/connectivityStore';

export const ConnectivityIndicator: React.FC = () => {
  const { status, networkAvailable, serverReachable, realtimeConnected, latencyMs, checkServerHealth } =
    useConnectivityStore();

  const getStatusConfig = () => {
    switch (status) {
      case 'ONLINE':
        return {
          label: 'ONLINE',
          dotColor: 'bg-blackbox-success shadow-[0_0_8px_#10B981]',
          textColor: 'text-blackbox-success',
          borderColor: 'border-emerald-900/50',
          bgColor: 'bg-emerald-950/20',
          icon: Wifi,
        };
      case 'RECONNECTING':
        return {
          label: 'RECONNECTING',
          dotColor: 'bg-blackbox-warning animate-pulse shadow-[0_0_8px_#F59E0B]',
          textColor: 'text-blackbox-warning',
          borderColor: 'border-amber-900/50',
          bgColor: 'bg-amber-950/20',
          icon: RefreshCw,
        };
      case 'OFFLINE':
      default:
        return {
          label: 'OFFLINE',
          dotColor: 'bg-blackbox-critical shadow-[0_0_8px_#EF4444]',
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
    <div className="flex items-center gap-2">
      {/* Pill Badge */}
      <div
        className={`flex items-center gap-2 px-2.5 py-1 rounded-full border ${config.borderColor} ${config.bgColor} backdrop-blur-sm transition-all duration-200 group relative cursor-pointer`}
        onClick={() => checkServerHealth()}
        title="Click to re-check connectivity"
      >
        <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
        <Icon className={`w-3.5 h-3.5 ${config.textColor} ${status === 'RECONNECTING' ? 'animate-spin' : ''}`} />
        <span className={`text-xs font-mono font-semibold tracking-wider ${config.textColor}`}>
          {config.label}
        </span>

        {/* Latency if online */}
        {status === 'ONLINE' && latencyMs !== null && (
          <span className="text-[10px] font-mono text-blackbox-muted border-l border-blackbox-border pl-1.5">
            {latencyMs}ms
          </span>
        )}

        {/* Dropdown status hover card */}
        <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-blackbox-surface border border-blackbox-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 pointer-events-none">
          <div className="text-[11px] font-mono text-blackbox-textSecondary uppercase tracking-wider mb-2 font-semibold flex items-center justify-between">
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
        </div>
      </div>
    </div>
  );
};

export const OfflineBanner: React.FC = () => {
  const { status, networkAvailable, serverReachable } = useConnectivityStore();

  if (status === 'ONLINE') return null;

  return (
    <div
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
