import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, KeyRound, Mail, User, ArrowRight, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { UserRole } from '../types';
import { ConnectivityIndicator } from '../components/Connectivity/ConnectivityIndicator';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('FIELD_OPERATOR');
  const [clientError, setClientError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setClientError(null);

    // Client validation
    if (!name.trim()) {
      setClientError('Operator name is required');
      return;
    }

    if (name.trim().length < 2) {
      setClientError('Name must be at least 2 characters');
      return;
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email.trim())) {
      setClientError('Please provide a valid email format');
      return;
    }

    if (password.length < 6) {
      setClientError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setClientError('Security passwords do not match');
      return;
    }

    try {
      await register(name.trim(), email.trim(), password, role);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const e = err as { message?: string };
      setClientError(e.message || 'Registration failed');
    }
  };

  const activeError = clientError || error;

  return (
    <div className="min-h-screen bg-blackbox-bg flex flex-col justify-between p-6">
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

      {/* Registration Card */}
      <div className="w-full max-w-md mx-auto my-8 bg-blackbox-surface border border-blackbox-border rounded-xl p-8 shadow-2xl">
        <div className="mb-6">
          <div className="text-[11px] font-mono text-blackbox-cyan uppercase tracking-wider mb-1 font-semibold">
            ENLISTMENT // NEW OPERATOR
          </div>
          <h2 className="text-xl font-bold font-mono text-blackbox-text">Register Credentials</h2>
          <p className="text-xs text-blackbox-muted mt-1">
            Establish a verified operational profile on the BlackBox network.
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
              Operator Full Name / Call-Sign
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-blackbox-muted absolute left-3 top-3" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Commander Alex Mercer"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-blackbox-panel border border-blackbox-border focus:border-blackbox-cyan focus:outline-none text-sm font-mono text-blackbox-text placeholder:text-blackbox-muted"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-blackbox-textSecondary mb-1.5 uppercase tracking-wide">
              Network Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-blackbox-muted absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex.mercer@blackbox.local"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-blackbox-panel border border-blackbox-border focus:border-blackbox-cyan focus:outline-none text-sm font-mono text-blackbox-text placeholder:text-blackbox-muted"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-blackbox-textSecondary mb-1.5 uppercase tracking-wide">
              Security Password
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-blackbox-muted absolute left-3 top-3" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-blackbox-panel border border-blackbox-border focus:border-blackbox-cyan focus:outline-none text-sm font-mono text-blackbox-text placeholder:text-blackbox-muted"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-blackbox-textSecondary mb-1.5 uppercase tracking-wide">
              Confirm Security Password
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-blackbox-muted absolute left-3 top-3" />
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-blackbox-panel border border-blackbox-border focus:border-blackbox-cyan focus:outline-none text-sm font-mono text-blackbox-text placeholder:text-blackbox-muted"
              />
            </div>
          </div>

          {/* Role Selection (Section 20) */}
          <div>
            <label className="block text-xs font-mono text-blackbox-textSecondary mb-2 uppercase tracking-wide">
              Operational Role Selection
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              <div
                onClick={() => setRole('FIELD_OPERATOR')}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  role === 'FIELD_OPERATOR'
                    ? 'border-blackbox-cyan bg-cyan-950/30'
                    : 'border-blackbox-border bg-blackbox-panel hover:border-blackbox-borderLight'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blackbox-text">FIELD OPERATOR</span>
                  </div>
                  {role === 'FIELD_OPERATOR' && <CheckCircle2 className="w-4 h-4 text-blackbox-cyan" />}
                </div>
                <p className="text-[11px] text-blackbox-muted mt-1 leading-snug">
                  Performs assigned field tasks and submits operational updates.
                </p>
              </div>

              <div
                onClick={() => setRole('COMMANDER')}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  role === 'COMMANDER'
                    ? 'border-blackbox-cyan bg-cyan-950/30'
                    : 'border-blackbox-border bg-blackbox-panel hover:border-blackbox-borderLight'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blackbox-text">COMMANDER</span>
                  </div>
                  {role === 'COMMANDER' && <CheckCircle2 className="w-4 h-4 text-blackbox-cyan" />}
                </div>
                <p className="text-[11px] text-blackbox-muted mt-1 leading-snug">
                  Coordinates missions and team operations.
                </p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-4 py-2.5 px-4 rounded-lg bg-blackbox-cyan hover:bg-cyan-300 text-black font-mono text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>CREATING ACCOUNT...</span>
              </>
            ) : (
              <>
                <span>REGISTER & ENTER CONSOLE</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-blackbox-border text-center">
          <p className="text-xs text-blackbox-muted">
            Already registered?{' '}
            <Link to="/login" className="text-blackbox-cyan hover:underline font-mono font-medium">
              Sign In Here
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
