import React, { useState } from 'react';
import { AlertCircle, ArrowRight, Check, KeyRound, Loader2, Mail, Shield, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { UserRole } from '../types';
import { ConnectivityIndicator } from '../components/Connectivity/ConnectivityIndicator';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('FIELD_OPERATOR'); const [clientError, setClientError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); clearError(); setClientError(null);
    if (name.trim().length < 2) { setClientError('Name must be at least 2 characters.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setClientError('Enter a valid email address.'); return; }
    if (password.length < 6) { setClientError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setClientError('Passwords do not match.'); return; }
    try { await register(name.trim(), email.trim(), password, role); navigate('/dashboard', { replace: true }); }
    catch (err: unknown) { setClientError((err as { message?: string }).message || 'Registration failed.'); }
  };

  const activeError = clientError || error;
  return (
    <div className="min-h-screen bg-blackbox-bg text-blackbox-text">
      <header className="border-b border-blackbox-border bg-blackbox-surface"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8"><Link to="/" className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg border border-blackbox-cyan/60 bg-blackbox-panel text-blackbox-cyan"><Shield className="h-4 w-4" /></span><span className="font-display text-sm font-bold tracking-[0.18em]">BLACKBOX</span></Link><ConnectivityIndicator /></div></header>
      <main className="mx-auto grid min-h-[calc(100vh-78px)] max-w-6xl items-center gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="max-w-md"><div className="ops-kicker text-blackbox-cyan">Operator registration</div><h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.05em] sm:text-5xl">Set up your operating identity.</h1><p className="mt-5 text-base leading-7 text-blackbox-textSecondary">Choose the role that matches your work. Permissions remain enforced by the existing server contract.</p><div className="mt-8 space-y-3 font-mono text-[11px] text-blackbox-muted"><div className="flex gap-3"><span className="text-blackbox-cobalt">01</span><span>Authenticate securely</span></div><div className="flex gap-3"><span className="text-blackbox-cobalt">02</span><span>Join assigned missions</span></div><div className="flex gap-3"><span className="text-blackbox-cobalt">03</span><span>Keep working through interruptions</span></div></div></section>
        <section className="ops-surface mx-auto w-full max-w-lg p-6 sm:p-8" aria-labelledby="register-heading"><div className="mb-7"><h2 id="register-heading" className="font-display text-2xl font-bold">Create account</h2><p className="mt-2 text-sm text-blackbox-muted">Register a new BlackBox operator.</p></div>
          {activeError && <div role="alert" className="mb-5 flex items-start gap-2 rounded-lg border border-blackbox-borderLight bg-blackbox-panel p-3 text-sm text-blackbox-textSecondary"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blackbox-warning" /><span>{activeError}</span></div>}
          <form onSubmit={submit} className="space-y-5">
            <div><label htmlFor="register-name" className="mb-2 block text-sm font-medium text-blackbox-textSecondary">Name or call sign</label><div className="relative"><UserRound className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-blackbox-muted" /><input id="register-name" required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="ops-control w-full pl-10" placeholder="Alex Mercer" /></div></div>
            <div><label htmlFor="register-email" className="mb-2 block text-sm font-medium text-blackbox-textSecondary">Email</label><div className="relative"><Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-blackbox-muted" /><input id="register-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="ops-control w-full pl-10" placeholder="operator@blackbox.local" /></div></div>
            <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="register-password" className="mb-2 block text-sm font-medium text-blackbox-textSecondary">Password</label><div className="relative"><KeyRound className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-blackbox-muted" /><input id="register-password" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="ops-control w-full pl-10" placeholder="6+ characters" /></div></div><div><label htmlFor="register-confirm-password" className="mb-2 block text-sm font-medium text-blackbox-textSecondary">Confirm password</label><input id="register-confirm-password" type="password" required minLength={6} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="ops-control w-full" placeholder="Repeat password" /></div></div>
            <fieldset><legend className="mb-2 block text-sm font-medium text-blackbox-textSecondary">Operating role</legend><div className="grid gap-2 sm:grid-cols-2">{(['FIELD_OPERATOR', 'COMMANDER'] as UserRole[]).map((option) => <button key={option} type="button" onClick={() => setRole(option)} aria-pressed={role === option} className={`flex min-h-16 items-center justify-between rounded-lg border px-3 text-left transition-colors ${role === option ? 'border-blackbox-cyan bg-blackbox-cyan/10' : 'border-blackbox-border bg-blackbox-panel hover:border-blackbox-borderLight'}`}><span><span className="block font-mono text-[11px] font-bold text-blackbox-text">{option === 'COMMANDER' ? 'COMMANDER' : 'FIELD OPERATOR'}</span><span className="mt-1 block text-[11px] text-blackbox-muted">{option === 'COMMANDER' ? 'Create and coordinate missions.' : 'Execute tasks and report observations.'}</span></span>{role === option && <Check className="h-4 w-4 shrink-0 text-blackbox-cobalt" />}</button>)}</div></fieldset>
            <button type="submit" disabled={isLoading} className="ops-button-primary w-full">{isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Creating account…</> : <>Create account <ArrowRight className="h-4 w-4" /></>}</button>
          </form>
          <p className="mt-6 text-center text-sm text-blackbox-muted">Already registered? <Link to="/login" className="font-semibold text-blackbox-cobalt hover:underline">Sign in</Link></p>
        </section>
      </main>
    </div>
  );
};
