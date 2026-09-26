import { useEffect } from 'react';
import { useConnectivityStore } from '../store/connectivityStore';
import { socketService } from '../services/socket';

export const useConnectivity = () => {
  const {
    networkAvailable,
    serverReachable,
    status,
    realtimeConnected,
    latencyMs,
    systemHealth,
    setNetworkAvailable,
    setRealtimeConnected,
    setLatency,
    checkServerHealth,
  } = useConnectivityStore();

  useEffect(() => {
    // 1. Initial health ping
    checkServerHealth();

    // 2. Connect socket service
    socketService.connect();

    // 3. Listen to Socket.IO status changes
    const unsubConnection = socketService.subscribe('connection_change', (data: unknown) => {
      const payload = data as { connected: boolean };
      setRealtimeConnected(payload.connected);
      if (payload.connected) {
        // Ping to measure initial latency
        socketService.ping();
      }
    });

    const unsubLatency = socketService.subscribe('latency', (data: unknown) => {
      const payload = data as { latencyMs: number };
      setLatency(payload.latencyMs);
    });

    // 4. Browser window online / offline event listeners
    const handleOnline = () => {
      console.log('[Connectivity] Browser detected ONLINE event');
      setNetworkAvailable(true);
      // Immediately check if server is reachable upon regaining network
      checkServerHealth();
      socketService.connect();
    };

    const handleOffline = () => {
      console.warn('[Connectivity] Browser detected OFFLINE event');
      setNetworkAvailable(false);
      socketService.disconnect();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 5. Periodic heartbeat check (every 12 seconds)
    const interval = setInterval(() => {
      checkServerHealth();
      if (socketService.getIsConnected()) {
        socketService.ping();
      }
    }, 12000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
      unsubConnection();
      unsubLatency();
    };
  }, [checkServerHealth, setNetworkAvailable, setRealtimeConnected, setLatency]);

  return {
    status,
    networkAvailable,
    serverReachable,
    realtimeConnected,
    latencyMs,
    systemHealth,
    checkNow: checkServerHealth,
  };
};
