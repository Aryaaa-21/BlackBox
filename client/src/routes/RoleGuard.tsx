import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { UserRole } from '../types';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactElement;
  fallbackUrl?: string;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  allowedRoles,
  children,
  fallbackUrl,
}) => {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    if (fallbackUrl) {
      return <Navigate to={fallbackUrl} replace />;
    }

    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-rose-950/40 border border-rose-900/60 text-blackbox-critical flex items-center justify-center mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="text-xs font-mono text-blackbox-critical uppercase tracking-widest mb-1">
          SECURITY ACCESS DENIED // 403
        </div>
        <h2 className="text-xl font-mono font-bold text-blackbox-text mb-2">
          Insufficient Operational Clearance
        </h2>
        <p className="text-xs text-blackbox-muted max-w-md mb-6 leading-relaxed">
          Your current credentials (<span className="text-blackbox-cyan font-mono">{user.role}</span>) do not have authorization to access this operational sector. Required clearance: <span className="text-blackbox-text font-mono">{allowedRoles.join(' or ')}</span>.
        </p>
        <Link
          to="/dashboard"
          className="px-4 py-2 rounded-lg bg-blackbox-surface hover:bg-blackbox-panel border border-blackbox-border text-xs font-mono text-blackbox-text flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }

  return children;
};
