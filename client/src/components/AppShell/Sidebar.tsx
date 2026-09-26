import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Compass, Settings, Shield, User as UserIcon, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';

interface SidebarProps {
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, onMobileClose }) => {
  const { user } = useAuthStore();
  const { sidebarCollapsed } = useAppStore();

  const navItems = [
    { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { name: 'Missions', to: '/missions', icon: Compass },
    { name: 'Settings', to: '/settings', icon: Settings },
  ];

  const content = (
    <aside
      className={`h-full flex flex-col justify-between bg-blackbox-surface border-r border-blackbox-border transition-all duration-300 z-40 ${
        sidebarCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div>
        {/* Logo / Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-blackbox-border">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded bg-blackbox-panel border border-blackbox-cyan/40 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(0,210,255,0.2)]">
              <Shield className="w-4 h-4 text-blackbox-cyan" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col">
                <span className="font-mono font-bold tracking-wider text-sm text-blackbox-text">BLACKBOX</span>
                <span className="text-[10px] font-mono text-blackbox-cyanMuted tracking-tight uppercase">Resilient Ops</span>
              </div>
            )}
          </div>
          {isMobileOpen && (
            <button
              onClick={onMobileClose}
              className="lg:hidden p-1.5 rounded-lg text-blackbox-muted hover:text-blackbox-text hover:bg-blackbox-panel"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onMobileClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blackbox-panel text-blackbox-cyan border border-blackbox-cyan/30'
                      : 'text-blackbox-textSecondary hover:text-blackbox-text hover:bg-blackbox-panel/60 border border-transparent'
                  } ${sidebarCollapsed ? 'justify-center' : ''}`
                }
                title={sidebarCollapsed ? item.name : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span className="font-mono">{item.name}</span>}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Operator Session Info Footer */}
      <div className="p-3 border-t border-blackbox-border">
        <div
          className={`flex items-center gap-3 p-2 rounded-lg bg-blackbox-panel/50 border border-blackbox-border/80 ${
            sidebarCollapsed ? 'justify-center' : ''
          }`}
        >
          <div className="w-7 h-7 rounded-full bg-blackbox-surface border border-blackbox-border flex items-center justify-center shrink-0 text-blackbox-cyan">
            <UserIcon className="w-3.5 h-3.5" />
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-mono font-medium text-blackbox-text truncate">
                {user?.name || 'Operator'}
              </span>
              <span className="text-[10px] font-mono text-blackbox-muted uppercase tracking-wider">
                {user?.role || 'FIELD_OPERATOR'}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop view */}
      <div className="hidden lg:block h-full">{content}</div>

      {/* Mobile drawer backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform lg:hidden transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {content}
      </div>
    </>
  );
};
