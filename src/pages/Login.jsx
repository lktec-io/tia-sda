import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';
import {
  AlertIcon,
  ArrowRightIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  LogoutIcon
} from '../components/Icons';
import '../styles/auth.css';

const getLoginError = (error) => {
  switch (error?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password. Please check your details and try again.';
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact the church leadership.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a few minutes or reset your password.';
    case 'auth/network-request-failed':
      return 'Network connection lost. Please check your internet and try again.';
    case 'auth/missing-password':
      return 'Please enter your password.';
    default:
      return 'Sign in failed due to an unexpected error. Please try again.';
  }
};

const getResetError = (error) => {
  switch (error?.code) {
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    case 'auth/missing-email':
      return 'Enter your email address first, then tap "Forgot password?".';
    case 'auth/network-request-failed':
      return 'Network connection lost. Please check your internet and try again.';
    case 'auth/too-many-requests':
      return 'Too many requests. Please wait a few minutes before trying again.';
    default:
      return 'Could not send the reset email. Please try again.';
  }
};

function StatusNotice({ variant, icon, title, children, onLogout }) {
  return (
    <div className={`status-notice status-notice-${variant}`}>
      <div className="status-notice-icon">{icon}</div>
      <h2 className="status-notice-title">{title}</h2>
      {children}
      <div className="status-notice-actions">
        <Link to="/" className="btn btn-outline btn-sm">Back to Home</Link>
        <button type="button" className="btn btn-primary btn-sm" onClick={onLogout}>
          <LogoutIcon width={16} height={16} />
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function Login() {
  const { currentUser, userProfile, isLeader, profileError, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || (isLeader ? '/leader' : '/dashboard');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Accounts are active immediately: anyone with a profile goes straight to their workspace.
  useEffect(() => {
    if (!loading && currentUser && userProfile) {
      navigate(redirectTo, { replace: true });
    }
  }, [loading, currentUser, userProfile, navigate, redirectTo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword('');
      // AuthContext picks up the session and profile; the effect above then redirects.
    } catch (error) {
      console.error('Login error:', error);
      setMessage({ type: 'error', text: getLoginError(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setMessage({ type: 'info', text: 'Enter your email address above, then tap "Forgot password?" again.' });
      return;
    }

    setResetting(true);
    setMessage({ type: '', text: '' });

    try {
      await sendPasswordResetEmail(auth, trimmed);
      setMessage({
        type: 'success',
        text: `If an account exists for ${trimmed}, a password reset link has been sent. Check your inbox and spam folder.`
      });
    } catch (error) {
      console.error('Password reset error:', error);
      setMessage({ type: 'error', text: getResetError(error) });
    } finally {
      setResetting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setMessage({ type: 'info', text: 'You have been signed out.' });
    } catch (error) {
      console.error('Logout error:', error);
      setMessage({ type: 'error', text: 'Could not sign out. Please try again.' });
    }
  };

  const renderCardBody = () => {
    // Session exists but the profile is still loading, or the user is being redirected.
    if (currentUser && (loading || userProfile)) {
      return (
        <div className="auth-verifying" role="status" aria-live="polite">
          <div className="spinner" />
          <p>Opening your workspace...</p>
        </div>
      );
    }

    if (currentUser && !userProfile) {
      return (
        <StatusNotice
          variant="error"
          icon={<AlertIcon width={28} height={28} />}
          title={profileError ? 'We could not load your profile' : 'Member profile not found'}
          onLogout={handleLogout}
        >
          <p className="status-notice-text">
            {profileError
              ? 'Your account signed in, but your member profile could not be loaded. Check your connection and refresh, or contact the church leadership.'
              : 'Your sign-in worked, but there is no member profile for this account. It may have been removed from the registry — please contact the TUCASA TIA Mbeya leadership.'}
          </p>
        </StatusNotice>
      );
    }

    return (
      <>
        <div className="auth-card-head">
          <h1>Welcome back</h1>
          <p>Sign in to your TUCASA TIA Mbeya member portal.</p>
        </div>

        {message.text && (
          <div className={`alert alert-${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>
            {message.type === 'success' ? <CheckIcon width={18} height={18} /> : <AlertIcon width={18} height={18} />}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="login-password">Password</label>
            <div className="password-wrap">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOffIcon width={18} height={18} /> : <EyeIcon width={18} height={18} />}
              </button>
            </div>
          </div>

          <div className="auth-row">
            <label className="toggle">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span className="toggle-track" aria-hidden="true">
                <span className="toggle-thumb" />
              </span>
              <span className="toggle-label">Remember me</span>
            </label>

            <button
              type="button"
              className="btn-link"
              onClick={handleForgotPassword}
              disabled={resetting}
            >
              {resetting ? 'Sending...' : 'Forgot password?'}
            </button>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? (
              <>
                <span className="spinner spinner-light" />
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <ArrowRightIcon width={18} height={18} />
              </>
            )}
          </button>
        </form>

        <p className="auth-switch">
          New to TUCASA TIA Mbeya? <Link to="/register">Join the fellowship</Link>
        </p>
      </>
    );
  };

  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <div className="auth-brand-inner">
          <Link to="/" className="auth-brand-top">
            <BrandLogo />
            <span>TUCASA TIA MBEYA</span>
          </Link>

          <div className="auth-brand-copy">
            <span className="eyebrow">Member Portal</span>
            <h2>Worship, fellowship and service — all in one place.</h2>
            <p>
              Access announcements, ministry schedules and your fellowship profile as part of the
              TIA SDA Student Church family in Mbeya.
            </p>
          </div>

          <blockquote className="auth-verse">
            “Remember the sabbath day, to keep it holy.”
            <cite>Exodus 20:8</cite>
          </blockquote>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-logo">
            <BrandLogo className="logo-lg" />
          </div>
          {renderCardBody()}
        </div>
        <Link to="/" className="auth-back">← Back to public website</Link>
      </main>
    </div>
  );
}
