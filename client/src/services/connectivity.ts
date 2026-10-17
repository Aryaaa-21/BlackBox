import type { HealthStatus } from '../types';

export type BrowserConnectionState = 'online' | 'offline' | 'unknown';
export type ApiConnectionState = 'reachable' | 'unreachable' | 'unknown';

export interface ConnectivitySnapshot {
  browser: BrowserConnectionState;
  api: ApiConnectionState;
  health?: HealthStatus;
  checkedAt?: string;
}

type Listener = (snapshot: ConnectivitySnapshot) => void;

class ConnectivityMonitor {
  private snapshot: ConnectivitySnapshot = {
    browser: typeof navigator === 'undefined' ? 'unknown' : navigator.onLine ? 'online' : 'offline',
    api: 'unknown',
  };
  private readonly listeners = new Set<Listener>();
  private started = false;
  private consumers = 0;
  private poll?: ReturnType<typeof setInterval>;
  private checkInFlight?: Promise<ConnectivitySnapshot>;
  private readonly onOnline = () => { void this.updateBrowser('online'); };
  private readonly onOffline = () => { void this.updateBrowser('offline'); };

  getSnapshot(): ConnectivitySnapshot { return this.snapshot; }
  subscribe(listener: Listener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  start(): () => void {
    this.consumers++;
    if (!this.started) {
      this.started = true;
      if (typeof window !== 'undefined') {
        window.addEventListener('online', this.onOnline);
        window.addEventListener('offline', this.onOffline);
      }
      this.poll = setInterval(() => { void this.checkApi(); }, 15_000);
      void this.checkApi();
    }
    let stopped = false;
    return () => { if (!stopped) { stopped = true; if (--this.consumers === 0) this.stop(); } };
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    clearInterval(this.poll);
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onOnline);
      window.removeEventListener('offline', this.onOffline);
    }
  }

  checkApi(): Promise<ConnectivitySnapshot> {
    if (this.snapshot.browser === 'offline') return Promise.resolve(this.snapshot);
    if (!this.checkInFlight) {
      this.checkInFlight = (async () => {
        try {
          const { healthApi } = await import('../api/health');
          const health = await healthApi.check();
          this.patch({ api: this.snapshot.browser === 'offline' ? 'unknown' : 'reachable', health, checkedAt: new Date().toISOString() });
        } catch {
          this.patch({ api: this.snapshot.browser === 'offline' ? 'unknown' : 'unreachable', health: undefined, checkedAt: new Date().toISOString() });
        }
        return this.snapshot;
      })().finally(() => { this.checkInFlight = undefined; });
    }
    return this.checkInFlight;
  }

  reportRequestSuccess(): void {
    this.patch({ api: this.snapshot.browser === 'offline' ? 'unknown' : 'reachable', checkedAt: new Date().toISOString() });
  }

  reportRequestFailure(error?: { status?: number }): void {
    // Authentication, validation, and conflict responses prove that the API
    // was reached. Treat only transport/server failures as connectivity loss.
    if (error?.status && error.status < 500) { this.reportRequestSuccess(); return; }
    this.patch({ api: 'unreachable', health: undefined, checkedAt: new Date().toISOString() });
  }

  private async updateBrowser(browser: BrowserConnectionState): Promise<void> {
    this.patch({ browser, api: 'unknown', health: undefined });
    if (browser === 'online') await this.checkApi();
  }

  private patch(patch: Partial<ConnectivitySnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener(this.snapshot));
  }
}

export const connectivity = new ConnectivityMonitor();
