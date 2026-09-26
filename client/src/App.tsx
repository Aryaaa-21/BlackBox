import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes/AppRoutes';
import { useAuthStore } from './store/authStore';

export const App: React.FC = () => {
  const { initializeAuth } = useAuthStore();

  useEffect(() => {
    // Validate session and initialize authentication state on launch
    initializeAuth();
  }, [initializeAuth]);

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
};

export default App;
