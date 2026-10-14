import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Shield, KeyRound, Mail, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { ConnectivityIndicator } from '../components/Connectivity/ConnectivityIndicator';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);

    if (!email.trim() || !password) {
      setLocalError('Please fill in both email and password');
      return;
    }

    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const e = err as { message?: string };
      setLocalError(e.message || 'Authentication failed. Please verify credentials.');
    }
  };

  const activeError = localError || error;

  return (
    <div className="min-h-screen bg-blackbox-bg ops-grid flex flex-col justify-between p-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-blackbox-panel border border-blackbox-cyan/40 flex items-center justify-center">
            <Shield className="w-4 h-4 text-blackbox-cyan" />
          </div>
          <span className="font-mono font-bold tracking-wider text-sm text-blackbox-text">BLACKBOX</span>
        </Link>
        <ConnectivityIndicator />
      </div>

      {/* Login Card */}
      <div className="ops-surface mx-auto my-12 w-full max-w-md p-8">
        <div className="mb-6">
          <div className="text-[11px] font-mono text-blackbox-cyan uppercase tracking-wider mb-1 font-semibold">
            SECURE ACCESS // AUTH
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-blackbox-text">Sign in to console</h2>
          <p className="text-xs text-blackbox-muted mt-1">
            Authenticate to access live telemetry and mission operations.
          </p>
        </div>

        {activeError && (
          <div className="mb-5 p-3 rounded-lg bg-rose-950/30 border border-rose-900/60 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div>{activeError}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-blackbox-textSecondary mb-1.5 uppercase tracking-wide">
              Operator Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-blackbox-muted absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="commander@blackbox.local"
                className="w-full rounded-lg border border-blackbox-border bg-blackbox-panel py-2.5 pl-9 pr-3 text-sm text-blackbox-text placeholder:text-blackbox-muted focus:border-blackbox-cyan focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-blackbox-textSecondary mb-1.5 uppercase tracking-wide">
              Security Key / Password
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-blackbox-muted absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-lg border border-blackbox-border bg-blackbox-panel py-2.5 pl-9 pr-3 text-sm text-blackbox-text placeholder:text-blackbox-muted focus:border-blackbox-cyan focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-blackbox-cyan px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-cyan-300 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>SIGNING IN...</span>
              </>
            ) : (
              <>
                <span>ESTABLISH SESSION</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-blackbox-border text-center">
          <p className="text-xs text-blackbox-muted">
            New operator joining the unit?{' '}
            <Link to="/register" className="text-blackbox-cyan hover:underline font-mono font-medium">
              Register Credentials
            </Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] font-mono text-blackbox-muted">
        BLACKBOX OPERATION SECURITY • RESILIENT OFFLINE-FIRST ARCHITECTURE
      </div>
    </div>
  );
};
