/**
 * Phase 6 — Offline-First Operations
 * useConnectivityWatcher — React hook that wires browser and socket events
 * to the offline store.
 *
 * Mount once at the App root (in main layout or App.tsx).
 * Handles:
 * - navigator.onLine changes
 * - Server health checks (on reconnect / browser online)
 * - Socket connected / disconnected state
 */

import { useEffect, useRef } from 'react';
import { useOfflineStore } from '../offline/offlineStore';
import { useConnectivityStore } from '../store/connectivityStore';
import { socketService } from '../services/socket';

const SERVER_CHECK_THROTTLE_MS = 10_000; // min gap between health checks

export function useConnectivityWatcher(): void {
  const setNetworkAvailable = useOfflineStore((s) => s.setNetworkAvailable);
  const setServerReachable = useOfflineStore((s) => s.setServerReachable);
  const setSocketConnected = useOfflineStore((s) => s.setSocketConnected);
  const refreshPendingCount = useOfflineStore((s) => s.refreshPendingCount);

  const checkServerHealth = useConnectivityStore((s) => s.checkServerHealth);
  const setRealtimeConnected = useConnectivityStore((s) => s.setRealtimeConnected);

  const lastCheckRef = useRef<number>(0);

  const throttledServerCheck = async () => {
    const now = Date.now();
    if (now - lastCheckRef.current < SERVER_CHECK_THROTTLE_MS) return;
    lastCheckRef.current = now;

    const reachable = await checkServerHealth();
    setServerReachable(reachable);
  };

  useEffect(() => {
    // ── Browser network events ──────────────────────────────
    const handleOnline = () => {
      setNetworkAvailable(true);
      // When network returns, check if server is also back
      throttledServerCheck();
    };

    const handleOffline = () => {
      setNetworkAvailable(false);
      setServerReachable(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial state
    setNetworkAvailable(navigator.onLine);

    // ── Socket events ───────────────────────────────────────
    const unsubConn = socketService.subscribe('connection_change', (data) => {
      const { connected } = data as { connected: boolean };
      setSocketConnected(connected);
      setRealtimeConnected(connected);
      if (connected) {
        setServerReachable(true);
        refreshPendingCount();
      }
    });

    const unsubErr = socketService.subscribe('connection_error', () => {
      setSocketConnected(false);
      setRealtimeConnected(false);
      // Don't immediately mark server unreachable — could be transient
      throttledServerCheck();
    });

    const unsubReconnect = socketService.subscribe('reconnect', () => {
      setSocketConnected(true);
      setRealtimeConnected(true);
      setServerReachable(true);
      refreshPendingCount();
    });

    // Initial server check on mount
    throttledServerCheck();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubConn();
      unsubErr();
      unsubReconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
