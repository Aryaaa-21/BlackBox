import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from '../pages/LandingPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { DashboardPage } from '../pages/DashboardPage';
import { MissionsPage } from '../pages/MissionsPage';
import { CreateMissionPage } from '../pages/CreateMissionPage';
import { MissionDetailPage } from '../pages/MissionDetailPage';
import { MissionReplayPage } from '../pages/MissionReplayPage';
import { SettingsPage } from '../pages/SettingsPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import SmokyButtonDemo from '../components/ui/smoky-demo';
import ShaderBackgroundDemo from '../components/ui/demo';
import AuthSwitchDemo from '../components/ui/auth-switch-demo';
import ModernLoginDemo from '../components/ui/modern-login-demo';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleGuard } from './RoleGuard';
import { AppShell } from '../layouts/AppShell';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/demo/smoky-button" element={<SmokyButtonDemo />} />
      <Route path="/demo/shader-background" element={<ShaderBackgroundDemo />} />
      <Route path="/demo/auth-switch" element={<AuthSwitchDemo />} />
      <Route path="/demo/modern-login" element={<ModernLoginDemo />} />

      {/* Protected Routes inside AppShell */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/missions" element={<MissionsPage />} />
        <Route
          path="/missions/new"
          element={
            <RoleGuard allowedRoles={['COMMANDER']}>
              <CreateMissionPage />
            </RoleGuard>
          }
        />
        <Route path="/missions/:missionId" element={<MissionDetailPage />} />
        <Route path="/missions/:missionId/replay" element={<MissionReplayPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* 404 Catch-All */}
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
};
