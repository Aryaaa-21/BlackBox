import { create } from 'zustand';

interface AppState {
  applicationInitialized: boolean;
  sidebarCollapsed: boolean;
  globalLoading: boolean;
  setInitialized: (initialized: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setGlobalLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  applicationInitialized: false,
  sidebarCollapsed: false,
  globalLoading: false,

  setInitialized: (initialized: boolean) => set({ applicationInitialized: initialized }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed: boolean) => set({ sidebarCollapsed: collapsed }),
  setGlobalLoading: (loading: boolean) => set({ globalLoading: loading }),
}));
