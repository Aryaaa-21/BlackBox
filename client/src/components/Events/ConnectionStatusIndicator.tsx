import React, { useEffect, useState } from 'react';
import { socketService } from '../../services/socket';

interface ConnectionStatusIndicatorProps {
  className?: string;
}

export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
  className = '',
}) => {
  const [isConnected, setIsConnected] = useState<boolean>(socketService.getIsConnected());
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);

  useEffect(() => {
    setIsConnected(socketService.getIsConnected());

    const unsubConn = socketService.subscribe('connection_change', (data) => {
      const payload = data as { connected: boolean };
      setIsConnected(payload.connected);
      if (payload.connected) {
        setIsReconnecting(false);
      }
    });

    const unsubErr = socketService.subscribe('connection_error', () => {
      setIsConnected(false);
      setIsReconnecting(true);
    });

    const unsubReconnect = socketService.subscribe('reconnect', () => {
      setIsConnected(true);
      setIsReconnecting(false);
    });

    return () => {
      unsubConn();
      unsubErr();
      unsubReconnect();
    };
  }, []);

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-mono tracking-wider border transition-colors ${
        isConnected
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
          : isReconnecting
          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
      } ${className}`}
      title={
        isConnected
          ? 'Real-time WebSocket uplink active'
          : isReconnecting
          ? 'Attempting to restore WebSocket uplink...'
          : 'WebSocket uplink disconnected'
      }
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isConnected
            ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
            : isReconnecting
            ? 'bg-amber-400'
            : 'bg-zinc-500'
        }`}
      />
      <span>
        {isConnected ? 'LIVE' : isReconnecting ? 'RECONNECTING' : 'OFFLINE'}
      </span>
    </div>
  );
};
