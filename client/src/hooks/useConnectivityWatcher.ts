/**
 * Phase 6 — Offline-First Operations
 * Phase 7 — Synchronization Engine Integration
 *
 * useConnectivityWatcher — React hook that wires browser and socket events
 * to the offline store AND triggers the Phase 7 sync engine on reconnect.
 *
 * Mount once at the App root (in main layout or App.tsx).
 */

import { useEffect, useRef } from 'react';
import { useOfflineStore } from '../offline/offlineStore';
import { useConnectivityStore } from '../store/connectivityStore';
import { socketService } from '../services/socket';
import { syncEngine } from '../services/sync/syncEngine';

const SERVER_CHECK_THROTTLE_MS = 10_000; // min gap between health checks

export function useConnectivityWatcher(): void {
  const setNetworkAvailable = useOfflineStore((s) => s.setNetworkAvailable);
  const setServerReachable = useOfflineStore((s) => s.setServerReachable);
  const setSocketConnected = useOfflineStore((s) => s.setSocketConnected);
  const refreshPendingCount = useOfflineStore((s) => s.refreshPendingCount);

  const checkServerHealth = useConnectivityStore((s) => s.checkServerHealth);
  const setRealtimeConnected = useConnectivityStore((s) => s.setRealtimeConnected);

  const lastCheckRef = useRef<number>(0);
  const wasOfflineRef = useRef<boolean>(false);

  const throttledServerCheck = async () => {
    const now = Date.now();
    if (now - lastCheckRef.current < SERVER_CHECK_THROTTLE_MS) return;
    lastCheckRef.current = now;

    const reachable = await checkServerHealth();
    setServerReachable(reachable);

    // If we just came back online after being offline, trigger sync
    if (reachable && wasOfflineRef.current) {
      wasOfflineRef.current = false;
      console.log('[ConnectivityWatcher] Server reachable again — triggering sync');
      // Small delay to let socket re-establish before syncing
      setTimeout(() => {
        syncEngine.syncPendingMutations().catch((err) => {
          console.error('[ConnectivityWatcher] Sync trigger failed:', err);
        });
      }, 1500);
    }
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
      wasOfflineRef.current = true;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial state
    setNetworkAvailable(navigator.onLine);
    if (!navigator.onLine) {
      wasOfflineRef.current = true;
    }

    // ── Socket events ───────────────────────────────────────
    const unsubConn = socketService.subscribe('connection_change', (data) => {
      const { connected } = data as { connected: boolean };
      setSocketConnected(connected);
      setRealtimeConnected(connected);
      if (connected) {
        setServerReachable(true);
        refreshPendingCount();

        // Trigger sync on socket reconnect if we were offline
        if (wasOfflineRef.current) {
          wasOfflineRef.current = false;
          console.log('[ConnectivityWatcher] Socket reconnected — triggering sync');
          setTimeout(() => {
            syncEngine.syncPendingMutations().catch((err) => {
              console.error('[ConnectivityWatcher] Sync trigger failed:', err);
            });
          }, 500);
        }
      } else {
        wasOfflineRef.current = true;
      }
    });

    const unsubErr = socketService.subscribe('connection_error', () => {
      setSocketConnected(false);
      setRealtimeConnected(false);
      wasOfflineRef.current = true;
      // Don't immediately mark server unreachable — could be transient
      throttledServerCheck();
    });

    const unsubReconnect = socketService.subscribe('reconnect', () => {
      setSocketConnected(true);
      setRealtimeConnected(true);
      setServerReachable(true);
      refreshPendingCount();

      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        console.log('[ConnectivityWatcher] Socket auto-reconnected — triggering sync');
        setTimeout(() => {
          syncEngine.syncPendingMutations().catch((err) => {
            console.error('[ConnectivityWatcher] Sync trigger failed:', err);
          });
        }, 500);
      }
    });

    // Initial server check on mount
    throttledServerCheck();

    // Also trigger sync on app startup if online
    if (navigator.onLine) {
      setTimeout(() => {
        syncEngine.syncPendingMutations().catch((err) => {
          console.error('[ConnectivityWatcher] Startup sync failed:', err);
        });
      }, 3000); // 3s grace period for socket connection
    }

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
