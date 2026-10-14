/**
 * Phase 9 — Product Polish & Hackathon Demo
 * DemoNetworkController — simulates network loss, degraded connectivity, and restoration
 * using the real BlackBox offline/sync architecture (no fake sync state).
 */

import { useOfflineStore } from '../offline/offlineStore';
import { useConnectivityStore } from '../store/connectivityStore';
import { socketService } from './socket';
import { syncEngine } from './sync/syncEngine';

export type SimulatedNetworkMode = 'LIVE' | 'OFFLINE' | 'DEGRADED';

class DemoNetworkController {
  private mode: SimulatedNetworkMode = 'LIVE';
  private listeners: Set<(mode: SimulatedNetworkMode) => void> = new Set();

  /**
   * Current simulation mode
   */
  getSimulationMode(): SimulatedNetworkMode {
    return this.mode;
  }

  isSimulatedOffline(): boolean {
    return this.mode === 'OFFLINE';
  }

  isSimulatedDegraded(): boolean {
    return this.mode === 'DEGRADED';
  }

  subscribe(callback: (mode: SimulatedNetworkMode) => void): () => void {
    this.listeners.add(callback);
    callback(this.mode);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb(this.mode));
  }

  /**
   * Intentionally simulate complete network loss (OFFLINE)
   * Disconnects sockets, marks offline store and connectivity store as OFFLINE,
   * causing all subsequent user actions to be committed to IndexedDB and queued for sync.
   */
  simulateOffline(): void {
    console.log('[DemoNetworkController] SIMULATING NETWORK LOSS (OFFLINE)');
    this.mode = 'OFFLINE';

    // 1. Mark stores as OFFLINE
    const offlineStore = useOfflineStore.getState();
    const connStore = useConnectivityStore.getState();

    offlineStore.setNetworkAvailable(false);
    offlineStore.setServerReachable(false);
    offlineStore.setSocketConnected(false);

    connStore.setNetworkAvailable(false);
    connStore.setServerReachable(false);
    connStore.setRealtimeConnected(false);

    // 2. Disconnect realtime socket stream
    socketService.disconnect();

    // 3. Dispatch system announcement for accessibility / live UI
    window.dispatchEvent(
      new CustomEvent('blackbox:demo-network-change', {
        detail: { mode: 'OFFLINE', message: 'Simulated network failure. Operations continue offline.' },
      })
    );

    this.notify();
  }

  /**
   * Intentionally simulate degraded network (server unreachable / high latency)
   */
  simulateDegraded(): void {
    console.log('[DemoNetworkController] SIMULATING DEGRADED NETWORK');
    this.mode = 'DEGRADED';

    const offlineStore = useOfflineStore.getState();
    const connStore = useConnectivityStore.getState();

    offlineStore.setNetworkAvailable(true);
    offlineStore.setServerReachable(false);
    offlineStore.setSocketConnected(false);

    connStore.setNetworkAvailable(true);
    connStore.setServerReachable(false);
    connStore.setRealtimeConnected(false);

    socketService.disconnect();

    window.dispatchEvent(
      new CustomEvent('blackbox:demo-network-change', {
        detail: { mode: 'DEGRADED', message: 'Simulated network degradation: Server unreachable.' },
      })
    );

    this.notify();
  }

  /**
   * Restore network to LIVE state.
   * Reconnects socket, restores axios traffic, checks server health,
   * and triggers the real Phase 7 synchronization engine.
   */
  async simulateOnline(): Promise<void> {
    console.log('[DemoNetworkController] RESTORING NETWORK (LIVE)');
    this.mode = 'LIVE';

    const offlineStore = useOfflineStore.getState();
    const connStore = useConnectivityStore.getState();

    // 1. Restore network availability
    offlineStore.setNetworkAvailable(true);
    connStore.setNetworkAvailable(true);

    // 2. Reconnect realtime socket
    const token = localStorage.getItem('blackbox_token') || undefined;
    socketService.connect(token);

    // 3. Ping server health
    const isHealthy = await connStore.checkServerHealth();
    offlineStore.setServerReachable(isHealthy);

    // 4. Trigger Phase 7 sync engine immediately
    console.log('[DemoNetworkController] Triggering Phase 7 sync engine...');
    try {
      await syncEngine.syncPendingMutations();
      await offlineStore.refreshPendingCount();
    } catch (err) {
      console.error('[DemoNetworkController] Sync after reconnection failed:', err);
    }

    window.dispatchEvent(
      new CustomEvent('blackbox:demo-network-change', {
        detail: { mode: 'LIVE', message: 'Connection restored. Synchronization underway.' },
      })
    );

    this.notify();
  }
}

export const demoNetworkController = new DemoNetworkController();
