import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/AppShell/Sidebar';
import { Topbar } from '../components/AppShell/Topbar';
import { OfflineBanner } from '../components/Connectivity/ConnectivityIndicator';
import { useConnectivity } from '../hooks/useConnectivity';

export const AppShell: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Activate connectivity watcher and realtime heartbeat
  useConnectivity();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-blackbox-bg">
      {/* Sidebar Navigation */}
      <Sidebar
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Persistent Topbar */}
        <Topbar onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />

        {/* Global Offline / Reconnecting Alert Banner */}
        <OfflineBanner />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-blackbox-bg">
          <div className="max-w-7xl mx-auto h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
