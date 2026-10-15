import React from 'react';
import { ArrowRight, Shield } from 'lucide-react';

interface AuthSwitchShellProps {
  isSignUp: boolean;
  onModeChange: (isSignUp: boolean) => void;
  signIn: React.ReactNode;
  signUp: React.ReactNode;
}

export const AuthSwitchShell: React.FC<AuthSwitchShellProps> = ({
  isSignUp,
  onModeChange,
  signIn,
  signUp,
}) => (
  <div className="auth-switch-shell">
    <div className={`auth-switch-card ${isSignUp ? 'auth-switch-card-signup' : ''}`}>
      <div className="auth-switch-accent" aria-hidden="true">
        <div className="auth-switch-mark"><Shield className="h-5 w-5" /></div>
        <div className="auth-switch-accent-copy">
          <span className="ops-kicker text-blackbox-text">BlackBox</span>
          <strong>{isSignUp ? 'Create access.' : 'Return to operations.'}</strong>
          <p>{isSignUp ? 'One identity for missions, tasks, and local continuity.' : 'Your operational workspace is ready when the link is not.'}</p>
        </div>
        <div className="auth-switch-index">OFFLINE-FIRST OPERATIONS</div>
      </div>

      <div className="auth-switch-form-column">
        <div className="auth-switch-form-head">
          <span className="ops-kicker">BlackBox access</span>
          <span className="font-mono text-[10px] text-blackbox-muted">{isSignUp ? '01 / CREATE' : '01 / SIGN IN'}</span>
        </div>
        <div className="auth-switch-form-content">{isSignUp ? signUp : signIn}</div>
        <div className="auth-switch-switcher">
          <span>{isSignUp ? 'Already registered?' : 'New operator?'}</span>
          <button type="button" onClick={() => onModeChange(!isSignUp)} className="auth-switch-link">
            {isSignUp ? 'Sign in' : 'Create account'}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default AuthSwitchShell;
