import React, { useState } from 'react';
import { AlertCircle, ArrowRight, KeyRound, Loader2, Mail, Shield, UserRound } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearError();
    setLocalError(null);
    if (!email.trim() || !password) { setLocalError('Enter your email and password.'); return; }
    try { await login(email.trim(), password); navigate(from, { replace: true }); }
    catch (err: unknown) { setLocalError((err as { message?: string }).message || 'Authentication failed. Check your credentials.'); }
  };

  const quickLogin = async (targetEmail: string) => {
    clearError(); setLocalError(null); setEmail(targetEmail); setPassword('Password123!');
    try { await login(targetEmail, 'Password123!'); navigate(from, { replace: true }); }
    catch (err: unknown) { setLocalError((err as { message?: string }).message || 'Demo profile could not be loaded.'); }
  };

  const activeError = localError || error;

  return (
    <div className="min-h-screen bg-blackbox-bg text-blackbox-text">
      <header className="border-b border-blackbox-border bg-blackbox-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg border border-blackbox-cyan/60 bg-blackbox-panel text-blackbox-cyan"><Shield className="h-4 w-4" /></span><span className="font-display text-sm font-bold tracking-[0.18em]">BLACKBOX</span></Link>
          <ConnectivityIndicator />
        </div>
      </header>
      <main className="mx-auto grid min-h-[calc(100vh-78px)] max-w-6xl items-center gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="max-w-md">
          <div className="ops-kicker text-blackbox-cyan">Secure operator access</div>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.05em] sm:text-5xl">Return to the console.</h1>
          <p className="mt-5 text-base leading-7 text-blackbox-textSecondary">Authenticate to open your assigned missions, local workspace, and live operational stream.</p>
          <div className="mt-8 border-l-2 border-blackbox-brown pl-4 font-mono text-[11px] leading-6 text-blackbox-muted">Your cached session can remain available when the server is unreachable.</div>
        </section>
        <section className="ops-surface mx-auto w-full max-w-lg p-6 sm:p-8" aria-labelledby="login-heading">
          <div className="mb-7"><h2 id="login-heading" className="font-display text-2xl font-bold">Sign in</h2><p className="mt-2 text-sm text-blackbox-muted">Use your BlackBox operator credentials.</p></div>
          {activeError && <div role="alert" className="mb-5 flex items-start gap-2 rounded-lg border border-blackbox-borderLight bg-blackbox-panel p-3 text-sm text-blackbox-textSecondary"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blackbox-warning" /><span>{activeError}</span></div>}
          <form onSubmit={submit} className="space-y-5">
            <div><label htmlFor="login-email" className="mb-2 block text-sm font-medium text-blackbox-textSecondary">Email</label><div className="relative"><Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-blackbox-muted" /><input id="login-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="ops-control w-full pl-10" placeholder="operator@blackbox.local" /></div></div>
            <div><label htmlFor="login-password" className="mb-2 block text-sm font-medium text-blackbox-textSecondary">Password</label><div className="relative"><KeyRound className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-blackbox-muted" /><input id="login-password" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="ops-control w-full pl-10" placeholder="Enter password" /></div></div>
            <button type="submit" disabled={isLoading} className="ops-button-primary w-full">{isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Signing in…</> : <>Open console <ArrowRight className="h-4 w-4" /></>}</button>
          </form>
          <div className="mt-7 border-t border-blackbox-border pt-5"><div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-blackbox-muted"><UserRound className="h-3.5 w-3.5" />Demo profiles</div><div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => quickLogin('cole@blackbox.local')} disabled={isLoading} className="ops-button-quiet">Commander Cole</button><button type="button" onClick={() => quickLogin('arjun@blackbox.local')} disabled={isLoading} className="ops-button-quiet">Operator Arjun</button></div></div>
          <p className="mt-6 text-center text-sm text-blackbox-muted">New operator? <Link to="/register" className="font-semibold text-blackbox-cobalt hover:underline">Create an account</Link></p>
        </section>
      </main>
    </div>
  );
};

export default LoginPage;
