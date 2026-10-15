import React, { useState } from 'react';
import { AlertCircle, Check, KeyRound, Loader2, Mail, Shield, UserRound } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { UserRole } from '../types';
import { ConnectivityIndicator } from '../components/Connectivity/ConnectivityIndicator';
import { ThreeDotBackground } from '../components/ui/three-dot-background';
import { AuthSwitchShell } from '../components/ui/auth-switch-shell';
import { SmokyButton } from '../components/ui/smoky-button';

const smokeColors = {
  primary: '#002FA7',
  secondary: '#5C331F',
  shadow: '#050506',
};

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, isLoading, error, clearError } = useAuthStore();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('FIELD_OPERATOR');
  const [localError, setLocalError] = useState<string | null>(null);
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const resetErrors = () => {
    clearError();
    setLocalError(null);
  };

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    resetErrors();
    if (!email.trim() || !password) {
      setLocalError('Enter your email and password.');
      return;
    }
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setLocalError((err as { message?: string }).message || 'Authentication failed. Check your credentials.');
    }
  };

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    resetErrors();
    if (name.trim().length < 2) {
      setLocalError('Name must be at least 2 characters.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setLocalError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }
    try {
      await register(name.trim(), email.trim(), password, role);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setLocalError((err as { message?: string }).message || 'Registration failed.');
    }
  };

  const quickLogin = async (targetEmail: string) => {
    resetErrors();
    setEmail(targetEmail);
    setPassword('Password123!');
    try {
      await login(targetEmail, 'Password123!');
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setLocalError((err as { message?: string }).message || 'Demo profile could not be loaded.');
    }
  };

  const activeError = localError || error;
  const formTitle = isSignUp ? 'Create access' : 'Sign in';
  const formCopy = isSignUp ? 'Set up the identity used across BlackBox operations.' : 'Open your missions and local workspace.';

  const signInForm = (
    <>
      <h1 className="auth-switch-form-title">{formTitle}</h1>
      <p className="auth-switch-form-copy">{formCopy}</p>
      {activeError && (
        <div role="alert" className="mt-5 flex items-start gap-2 rounded-lg border border-blackbox-borderLight bg-blackbox-panel p-3 text-sm text-blackbox-textSecondary">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blackbox-warning" aria-hidden="true" />
          <span>{activeError}</span>
        </div>
      )}
      <form onSubmit={handleSignIn} className="auth-switch-form mt-7">
        <div className="auth-switch-field">
          <label htmlFor="login-email">Email</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-blackbox-muted" aria-hidden="true" />
            <input id="login-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="ops-control w-full pl-10" placeholder="operator@blackbox.local" />
          </div>
        </div>
        <div className="auth-switch-field">
          <label htmlFor="login-password">Password</label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-blackbox-muted" aria-hidden="true" />
            <input id="login-password" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="ops-control w-full pl-10" placeholder="Enter password" />
          </div>
        </div>
        <SmokyButton type="submit" disabled={isLoading} colors={smokeColors} status={isLoading ? 'checking' : 'ready'} className="mt-2 w-full">
          {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Signing in</> : 'Sign in'}
        </SmokyButton>
      </form>
      <div className="mt-6 border-t border-blackbox-border pt-5">
        <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-blackbox-muted"><UserRound className="h-3.5 w-3.5" aria-hidden="true" /> Demo profiles</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => quickLogin('cole@blackbox.local')} disabled={isLoading} className="ops-button-quiet">Commander Cole</button>
          <button type="button" onClick={() => quickLogin('arjun@blackbox.local')} disabled={isLoading} className="ops-button-quiet">Operator Arjun</button>
        </div>
      </div>
    </>
  );

  const signUpForm = (
    <>
      <h1 className="auth-switch-form-title">{formTitle}</h1>
      <p className="auth-switch-form-copy">{formCopy}</p>
      {activeError && (
        <div role="alert" className="mt-5 flex items-start gap-2 rounded-lg border border-blackbox-borderLight bg-blackbox-panel p-3 text-sm text-blackbox-textSecondary">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blackbox-warning" aria-hidden="true" />
          <span>{activeError}</span>
        </div>
      )}
      <form onSubmit={handleSignUp} className="auth-switch-form mt-7">
        <div className="auth-switch-field">
          <label htmlFor="signup-name">Name or call sign</label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-blackbox-muted" aria-hidden="true" />
            <input id="signup-name" type="text" required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="ops-control w-full pl-10" placeholder="Alex Mercer" />
          </div>
        </div>
        <div className="auth-switch-field">
          <label htmlFor="signup-email">Email</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-blackbox-muted" aria-hidden="true" />
            <input id="signup-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="ops-control w-full pl-10" placeholder="operator@blackbox.local" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="auth-switch-field">
            <label htmlFor="signup-password">Password</label>
            <input id="signup-password" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="ops-control w-full" placeholder="6+ characters" />
          </div>
          <div className="auth-switch-field">
            <label htmlFor="signup-confirm-password">Confirm</label>
            <input id="signup-confirm-password" type="password" required minLength={6} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="ops-control w-full" placeholder="Repeat password" />
          </div>
        </div>
        <fieldset className="auth-switch-field">
          <legend>Role</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['FIELD_OPERATOR', 'COMMANDER'] as UserRole[]).map((option) => (
              <button key={option} type="button" onClick={() => setRole(option)} aria-pressed={role === option} className={`flex min-h-12 items-center justify-between rounded-lg border px-3 text-left transition-colors ${role === option ? 'border-blackbox-cyan bg-blackbox-cyan/10' : 'border-blackbox-border bg-blackbox-panel hover:border-blackbox-borderLight'}`}>
                <span className="font-mono text-[10px] font-semibold text-blackbox-text">{option === 'COMMANDER' ? 'COMMANDER' : 'FIELD OPERATOR'}</span>
                {role === option && <Check className="h-4 w-4 text-blackbox-cobalt" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </fieldset>
        <SmokyButton type="submit" disabled={isLoading} colors={smokeColors} status={isLoading ? 'checking' : 'ready'} className="mt-2 w-full">
          {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Creating</> : 'Create account'}
        </SmokyButton>
      </form>
    </>
  );

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-blackbox-bg text-blackbox-text">
      <ThreeDotBackground className="z-0" dotSize={4.5} totalSize={18} />
      <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" className="flex items-center gap-3" aria-label="Return to BlackBox home">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blackbox-border bg-blackbox-panel text-blackbox-cyan"><Shield className="h-5 w-5" aria-hidden="true" /></span>
          <span><span className="block font-display text-sm font-bold tracking-[0.18em]">BLACKBOX</span><span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-blackbox-muted">Offline-first operations</span></span>
        </Link>
        <ConnectivityIndicator />
      </header>
      <main className="relative z-10 flex min-h-screen w-full items-center justify-center pt-20">
        <AuthSwitchShell isSignUp={isSignUp} onModeChange={(nextMode) => { resetErrors(); setIsSignUp(nextMode); }} signIn={signInForm} signUp={signUpForm} />
      </main>
    </div>
  );
};

export default LoginPage;
