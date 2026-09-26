import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes/AppRoutes';
import { useAuthStore } from './store/authStore';
import { useOfflineStore } from './offline/offlineStore';
import { useConnectivityWatcher } from './hooks/useConnectivityWatcher';

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

  return <AppRoutes />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
};

export default App;

