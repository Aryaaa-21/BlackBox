import { LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth.store'
import { ModernLoginSignupBackground } from './modern-login-signup'

export interface AuthSwitchProps {
  initialMode?: 'signin' | 'signup'
}

export default function AuthSwitch({ initialMode = 'signin' }: AuthSwitchProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((state) => state.login)
  const register = useAuthStore((state) => state.register)
  const clearError = useAuthStore((state) => state.clearError)
  const error = useAuthStore((state) => state.error)
  const loading = useAuthStore((state) => state.loading)
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<'COMMANDER' | 'FIELD_OPERATOR'>('FIELD_OPERATOR')
  const [validationError, setValidationError] = useState<string | null>(null)
  const next = new URLSearchParams(location.search).get('next') || '/dashboard'

  const setMode = (signup: boolean) => {
    setIsSignUp(signup)
    setValidationError(null)
    clearError()
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setValidationError(null)
    if (isSignUp && password !== confirmPassword) {
      setValidationError('Passwords must match.')
      return
    }
    try {
      if (isSignUp) {
        await register({ name, email, password, role })
      } else {
        await login({ email, password })
      }
      navigate(next, { replace: true })
    } catch {
      // The auth store exposes the backend error to the form.
    }
  }

  return <main className="auth-switch">
    <ModernLoginSignupBackground className="auth-switch__background" />
    <div className={`auth-switch__container ${isSignUp ? 'auth-switch__container--signup' : ''}`}>
      <div className="auth-switch__forms-container">
        <div className="auth-switch__signin-signup">
          <form className="auth-switch__form auth-switch__form--signin" onSubmit={onSubmit}>
            <ShieldCheck className="auth-switch__logo" size={28} aria-hidden="true" />
            <h1 className="auth-switch__title">Sign in</h1>
            <p className="auth-switch__intro">Return to your BlackBox operations console.</p>
            {error || validationError ? <div className="auth-switch__error" role="alert">{validationError || error}</div> : null}
            <label className="auth-switch__input-field"><span className="sr-only">Email</span><Mail size={17} aria-hidden="true" /><input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
            <label className="auth-switch__input-field"><span className="sr-only">Password</span><LockKeyhole size={17} aria-hidden="true" /><input type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
            <button type="submit" className="auth-switch__button" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
            <p className="auth-switch__fine-print">Use your BlackBox account credentials.</p>
          </form>

          <form className="auth-switch__form auth-switch__form--signup" onSubmit={onSubmit}>
            <UserRound className="auth-switch__logo" size={28} aria-hidden="true" />
            <h1 className="auth-switch__title">Create account</h1>
            <p className="auth-switch__intro">Set up access to coordinate mission work.</p>
            {error || validationError ? <div className="auth-switch__error" role="alert">{validationError || error}</div> : null}
            <label className="auth-switch__input-field"><span className="sr-only">Name</span><UserRound size={17} aria-hidden="true" /><input type="text" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></label>
            <label className="auth-switch__input-field"><span className="sr-only">Email</span><Mail size={17} aria-hidden="true" /><input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
            <label className="auth-switch__input-field"><span className="sr-only">Password</span><LockKeyhole size={17} aria-hidden="true" /><input type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={6} required /></label>
            <label className="auth-switch__input-field"><span className="sr-only">Confirm password</span><LockKeyhole size={17} aria-hidden="true" /><input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required /></label>
            <label className="auth-switch__role"><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value as 'COMMANDER' | 'FIELD_OPERATOR')}><option value="FIELD_OPERATOR">Field operator</option><option value="COMMANDER">Commander</option></select></label>
            <button type="submit" className="auth-switch__button" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
          </form>
        </div>
      </div>

      <div className="auth-switch__panels-container">
        <section className="auth-switch__panel auth-switch__panel--left">
          <div className="auth-switch__panel-content"><h2>New to BlackBox?</h2><p>Create an account and start coordinating offline-ready mission work.</p><button type="button" className="auth-switch__button auth-switch__button--transparent" onClick={() => setMode(true)}>Create account</button></div>
        </section>
        <section className="auth-switch__panel auth-switch__panel--right">
          <div className="auth-switch__panel-content"><h2>Already have access?</h2><p>Welcome back. Sign in to continue coordinating your operation.</p><button type="button" className="auth-switch__button auth-switch__button--transparent" onClick={() => setMode(false)}>Sign in</button></div>
        </section>
      </div>
    </div>
    <Link to="/" className="auth-switch__back">Back to BlackBox</Link>
  </main>
}
