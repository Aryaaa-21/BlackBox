import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes/AppRoutes';
import { useAuthStore } from './store/authStore';
import { useOfflineStore } from './offline/offlineStore';
import { useConnectivityWatcher } from './hooks/useConnectivityWatcher';

import { DemoControls } from './components/Demo/DemoControls';

const isDemoEnabled = import.meta.env.VITE_ENABLE_DEMO_MODE !== 'false';

const AppInner: React.FC = () => {
  const { initializeAuth } = useAuthStore();
  const initializeOffline = useOfflineStore((s) => s.initialize);

  // Phase 6: mount connectivity watcher (bridges browser + socket events → offline store)
  useConnectivityWatcher();

  useEffect(() => {
    // Validate session and initialize authentication state on launch
    initializeAuth();
    // Phase 6: initialize device ID and load pending mutation count
    initializeOffline();
  }, [initializeAuth, initializeOffline]);

  return (
    <div className="min-h-screen w-full bg-blackbox-bg">
      <div className="flex min-h-screen flex-col">
        <AppRoutes />
        {isDemoEnabled && <DemoControls />}
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
};

export default App;
