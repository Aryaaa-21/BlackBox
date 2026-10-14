import React from 'react';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, ShieldCheck } from 'lucide-react';
import { ConnectivityIndicator } from '../Connectivity/ConnectivityIndicator';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';

interface TopbarProps {
  onMobileMenuToggle: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onMobileMenuToggle }) => {
  const { logout, user } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  return (
    <header className="flex min-h-[76px] items-center justify-between border-b border-blackbox-border bg-blackbox-surface/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={onMobileMenuToggle} className="rounded-lg p-2 text-blackbox-muted hover:bg-blackbox-panel hover:text-blackbox-text lg:hidden" aria-label="Open navigation menu">
          <Menu className="h-5 w-5" />
        </button>
        <button onClick={toggleSidebar} className="hidden rounded-lg p-2 text-blackbox-muted hover:bg-blackbox-panel hover:text-blackbox-text lg:flex" title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
        <div className="min-w-0">
          <div className="ops-kicker hidden sm:block">BlackBox / Operations console</div>
          <div className="truncate text-sm font-semibold tracking-wide text-blackbox-text">Operational continuity layer</div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <ConnectivityIndicator />
        <div className="hidden items-center gap-2 border-l border-blackbox-border pl-4 md:flex">
          <ShieldCheck className="h-4 w-4 text-blackbox-cyan" />
          <div className="text-right">
            <div className="text-xs font-semibold text-blackbox-text">{user?.name || 'Operator'}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-blackbox-muted">{user?.role || 'FIELD_OPERATOR'}</div>
          </div>
        </div>
        <button onClick={() => logout()} className="rounded-lg border border-transparent p-2 text-blackbox-muted transition-colors hover:border-blackbox-critical/30 hover:bg-blackbox-critical/10 hover:text-blackbox-critical" title="Sign out" aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};
