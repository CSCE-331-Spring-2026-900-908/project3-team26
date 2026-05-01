// LoginPage: staff entry point at "/login" with two sign-in paths.
// 1) PIN keypad (hard-coded mapping below) for fast in-store login.
// 2) Google Sign-In via the Google Identity Services script for managers/cashiers.
// On success, saves the session via utils/session.js and navigates to the role's page.
// Successful login writes the same session keys regardless of auth provider.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveUserSession } from '../utils/session.js';

const PIN_LENGTH = 5;
const GOOGLE_SCRIPT_ID = 'team26-google-identity';

// Demo PINs mapped to roles + redirect target. Real deploys would look these up from the database.
const PIN_ROLES = {
  '55555': { role: 'manager', employeeId: '1', redirect: '/manager' },
  '44444': { role: 'cashier', employeeId: '2', redirect: '/cashier' },
  '33333': { role: 'cashier', employeeId: '3', redirect: '/cashier' },
};

// Roles selectable from the Google sign-in tab so the same Google account can sign in as either role.
const LOGIN_ROLE_OPTIONS = [
  { key: 'cashier', label: 'Cashier', employeeId: '2', redirect: '/cashier' },
  { key: 'manager', label: 'Manager', employeeId: '1', redirect: '/manager' },
];

// Pulls the user profile (email, name) out of the Google JWT credential without verifying signature.
// Verification happens server-side; this is just for displaying the user's info in the UI.
function decodeJwtPayload(token) {
  const payload = token.split('.')[1];
  if (!payload) {
    throw new Error('Missing Google credential payload.');
  }

  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return JSON.parse(window.atob(padded));
}

export default function LoginPage() {
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);
  const [pin, setPin] = useState('');
  const [selectedRole, setSelectedRole] = useState('cashier');
  const [error, setError] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const [googleError, setGoogleError] = useState('');

  // Persists the session in localStorage and routes to the role's landing page.
  function finishLogin(match, extra = {}) {
    saveUserSession({
      employeeId: match.employeeId,
      role: match.role,
      authProvider: extra.authProvider || 'pin',
      email: extra.email || '',
      name: extra.name || '',
    });
    navigate(match.redirect);
  }

  // Auto-submits the PIN once five digits are entered. Clears after a short delay on a bad PIN.
  useEffect(() => {
    if (pin.length !== PIN_LENGTH) {
      return;
    }

    const match = PIN_ROLES[pin];
    if (!match) {
      setError('Invalid PIN. Try again.');
      const timer = window.setTimeout(() => setPin(''), 600);
      return () => window.clearTimeout(timer);
    }

    setError('');
    finishLogin(match);
  }, [pin, navigate]);

  // Loads Google's Identity Services script the first time the page mounts.
  useEffect(() => {
    if (window.google?.accounts?.id) {
      setGoogleReady(true);
      return undefined;
    }

    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);
    if (existingScript) {
      const handleLoad = () => setGoogleReady(true);
      const handleError = () => setGoogleError('Google Sign-In failed to load.');
      existingScript.addEventListener('load', handleLoad);
      existingScript.addEventListener('error', handleError);

      return () => {
        existingScript.removeEventListener('load', handleLoad);
        existingScript.removeEventListener('error', handleError);
      };
    }

    const script = document.createElement('script');
    script.id = GOOGLE_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleReady(true);
    script.onerror = () => setGoogleError('Google Sign-In failed to load.');
    document.body.appendChild(script);

    return undefined;
  }, []);

  // Initializes Google Sign-In and renders the button once the script is ready
  // and the user has chosen a role (cashier vs manager) for the Google login path.
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!googleReady || !googleButtonRef.current) {
      return;
    }

    if (!clientId) {
      setGoogleError('Add VITE_GOOGLE_CLIENT_ID to enable Google Sign-In.');
      googleButtonRef.current.innerHTML = '';
      return;
    }

    setGoogleError('');

    const activeRole =
      LOGIN_ROLE_OPTIONS.find((option) => option.key === selectedRole) || LOGIN_ROLE_OPTIONS[0];

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        try {
          const profile = decodeJwtPayload(response.credential);
          finishLogin(activeRole, {
            authProvider: 'google',
            email: profile.email || '',
            name: profile.name || '',
          });
        } catch (err) {
          setError(err.message || 'Google Sign-In failed.');
        }
      },
    });

    googleButtonRef.current.innerHTML = '';
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      width: 320,
      logo_alignment: 'left',
    });
  }, [googleReady, selectedRole]);

  // PIN keypad handlers: press appends a digit, backspace removes the last, clear empties the PIN.
  function press(digit) {
    setError('');
    setPin((current) => (current.length < PIN_LENGTH ? current + digit : current));
  }

  // Removes the last digit from the current PIN entry and clears any error message
  // Bound to the backspace key on the keypad UI
  function backspace() {
    setError('');
    setPin((current) => current.slice(0, -1));
  }

  // Resets the PIN input to empty and clears any error message
  // Bound to the "Clear" button on the keypad UI
  function clear() {
    setError('');
    setPin('');
  }

  const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <section id="page-login" className="page active login-pin-page">
      <div className="login-pin-card panel">
        <div className="login-card-top">
          <button
            type="button"
            className="login-back-button"
            onClick={() => navigate('/')}
          >
            Back to Main Screen
          </button>
        </div>

        <div className="login-pin-brand">
          <span className="login-pin-mark">B26</span>
          <div>
            <strong>BOBA POS</strong>
            <p>Use your employee PIN or Google sign-in to continue.</p>
          </div>
        </div>

        <div className="login-pin-display" aria-label="PIN entry">
          {Array.from({ length: PIN_LENGTH }).map((_, index) => (
            <span
              key={index}
              className={`login-pin-dot${index < pin.length ? ' filled' : ''}`}
            />
          ))}
        </div>

        {error ? <div className="login-error">{error}</div> : null}

        <div className="login-pin-pad">
          {keypad.map((digit) => (
            <button
              key={digit}
              type="button"
              className="login-pin-key"
              onClick={() => press(digit)}
            >
              {digit}
            </button>
          ))}
          <button type="button" className="login-pin-key ghost" onClick={clear}>
            Clear
          </button>
          <button type="button" className="login-pin-key" onClick={() => press('0')}>
            0
          </button>
          <button type="button" className="login-pin-key ghost" onClick={backspace}>
            ←
          </button>
        </div>

        <div className="login-divider">
          <span>or sign in with Google</span>
        </div>

        <div className="login-google-block">
          <div className="login-role-switch" role="tablist" aria-label="Google sign-in role">
            {LOGIN_ROLE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={selectedRole === option.key ? 'active' : ''}
                onClick={() => {
                  setSelectedRole(option.key);
                  setError('');
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="login-google-copy">
            Continue as {selectedRole === 'manager' ? 'Manager' : 'Cashier'} with Google
          </p>
          <div className="login-google-button" ref={googleButtonRef} />
          {googleError ? <div className="login-error">{googleError}</div> : null}
        </div>

      </div>
    </section>
  );
}
