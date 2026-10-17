import { create } from 'zustand';
import { connectivity, type ConnectivitySnapshot } from '../services/connectivity';

interface ConnectivityState extends ConnectivitySnapshot {
  start: () => () => void;
  checkApi: () => Promise<ConnectivitySnapshot>;
}

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  ...connectivity.getSnapshot(),
  start: () => {
    const unsubscribe = connectivity.subscribe((snapshot) => set(snapshot));
    const stop = connectivity.start();
    return () => { unsubscribe(); stop(); };
  },
  checkApi: async () => {
    const snapshot = await connectivity.checkApi();
    set(snapshot);
    return snapshot;
  },
}));
