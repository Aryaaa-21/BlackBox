import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { LoadingState } from '../components/Common/LoadingState';

interface ProtectedRouteProps {
  children: React.ReactElement;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, authStatus, authInitialized } = useAuthStore();
  const location = useLocation();

  if (!authInitialized || authStatus === 'checking') {
    return <LoadingState fullScreen message="Checking Operator Credentials..." subtext="Verifying security tokens with BlackBox identity subsystem" />;
  }

  if (!isAuthenticated && authStatus === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};
