import React from 'react';
import { NavLink } from 'react-router-dom';
import { Compass, LayoutDashboard, Settings, Shield, User as UserIcon, X } from 'lucide-react';
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
    { name: 'Dashboard', detail: 'Operational overview', to: '/dashboard', icon: LayoutDashboard },
    { name: 'Missions', detail: 'Mission directory', to: '/missions', icon: Compass },
    { name: 'Settings', detail: 'Account controls', to: '/settings', icon: Settings },
  ];

  const content = (
      <aside aria-label="Primary navigation" className={`flex h-full flex-col border-r border-blackbox-border bg-blackbox-surface transition-all duration-300 z-40 ${sidebarCollapsed ? 'w-[76px]' : 'w-[264px]'}`}>
      <div>
        <div className="flex h-[76px] items-center justify-between border-b border-blackbox-border px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blackbox-cyan/35 bg-blackbox-panel text-blackbox-cyan">
              <Shield className="h-[18px] w-[18px]" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
             <div className="font-display text-sm font-bold tracking-[0.22em] text-blackbox-text">BLACKBOX</div>
                <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-blackbox-muted">Resilient operations</div>
              </div>
            )}
          </div>
          {isMobileOpen && (
            <button onClick={onMobileClose} className="rounded-lg p-1.5 text-blackbox-muted hover:bg-blackbox-panel hover:text-blackbox-text lg:hidden" aria-label="Close navigation">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {!sidebarCollapsed && (
          <div className="mx-4 mt-5 rounded-lg border border-blackbox-border bg-blackbox-panel/60 px-3 py-2.5">
            <div className="ops-kicker">Mission control</div>
            <div className="mt-1 text-xs leading-5 text-blackbox-textSecondary">Maintain continuity when the link goes down.</div>
          </div>
        )}

        <nav className="space-y-1.5 p-4" aria-label="Primary navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={`${item.name}-${item.to}`}
                to={item.to}
                onClick={onMobileClose}
                className={({ isActive }) => `group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${isActive ? 'border-blackbox-cyan/25 bg-blackbox-cyan/10 text-blackbox-cyan' : 'border-transparent text-blackbox-textSecondary hover:border-blackbox-border hover:bg-blackbox-panel hover:text-blackbox-text'} ${sidebarCollapsed ? 'justify-center' : ''}`}
                title={sidebarCollapsed ? item.name : undefined}
              >
                <Icon className="h-[17px] w-[17px] shrink-0" />
                {!sidebarCollapsed && (
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{item.name}</span>
                    <span className="block truncate text-[10px] text-blackbox-muted group-hover:text-blackbox-textSecondary">{item.detail}</span>
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto border-t border-blackbox-border p-4">
        <div className={`flex items-center gap-3 rounded-xl border border-blackbox-border bg-blackbox-panel/70 p-2.5 ${sidebarCollapsed ? 'justify-center' : ''}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blackbox-border bg-blackbox-surface text-blackbox-cyan">
            <UserIcon className="h-4 w-4" />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-blackbox-text">{user?.name || 'Operator'}</div>
              <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wider text-blackbox-muted">{user?.role || 'FIELD_OPERATOR'}</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden h-full lg:block">{content}</div>
      {isMobileOpen && <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={onMobileClose} aria-hidden="true" />}
      <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`} aria-hidden={!isMobileOpen}>{content}</div>
    </>
  );
};
