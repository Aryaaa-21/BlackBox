import React from 'react';
import { Menu, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { ConnectivityIndicator } from '../Connectivity/ConnectivityIndicator';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';

interface TopbarProps {
  onMobileMenuToggle: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onMobileMenuToggle }) => {
  const { logout, user } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="h-16 bg-blackbox-surface border-b border-blackbox-border px-4 lg:px-6 flex items-center justify-between z-30">
      {/* Left side: Toggles & Title */}
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 rounded-lg text-blackbox-muted hover:text-blackbox-text hover:bg-blackbox-panel transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop sidebar toggle button */}
        <button
          onClick={toggleSidebar}
          className="hidden lg:flex p-2 rounded-lg text-blackbox-muted hover:text-blackbox-text hover:bg-blackbox-panel transition-colors"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-blackbox-muted uppercase tracking-wider hidden sm:inline">
            SYSTEM //
          </span>
          <h1 className="text-sm font-mono font-semibold text-blackbox-text tracking-wide">
            OPERATIONS CONSOLE
          </h1>
        </div>
      </div>

      {/* Right side: Telemetry & Actions */}
      <div className="flex items-center gap-4">
        {/* Live Connectivity Indicator */}
        <ConnectivityIndicator />

        {/* Role badge */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded bg-blackbox-panel border border-blackbox-border text-[11px] font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-blackbox-cyan" />
          <span className="text-blackbox-textSecondary">{user?.role}</span>
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-blackbox-muted hover:text-rose-400 hover:bg-rose-950/20 border border-transparent hover:border-rose-900/30 transition-all"
          title="Sign out of console"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">DISCONNECT</span>
        </button>
      </div>
    </header>
  );
};
