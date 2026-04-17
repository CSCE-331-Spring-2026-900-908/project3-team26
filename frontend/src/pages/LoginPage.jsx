import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PIN_LENGTH = 5;

const PIN_ROLES = {
  '55555': { role: 'manager', employeeId: '1', redirect: '/manager' },
  '44444': { role: 'cashier', employeeId: '2', redirect: '/cashier' },
  '33333': { role: 'cashier', employeeId: '3', redirect: '/cashier' },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

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
    localStorage.setItem('team26-employee-id', match.employeeId);
    localStorage.setItem('team26-role', match.role);
    navigate(match.redirect);
  }, [pin, navigate]);

  function press(digit) {
    setError('');
    setPin((current) => (current.length < PIN_LENGTH ? current + digit : current));
  }

  function backspace() {
    setError('');
    setPin((current) => current.slice(0, -1));
  }

  function clear() {
    setError('');
    setPin('');
  }

  const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <section id="page-login" className="page active login-pin-page">
      <div className="login-pin-card panel">
        <div className="login-pin-brand">
          <span className="login-pin-mark">B26</span>
          <div>
            <strong>BOBA POS</strong>
            <p>Enter your employee PIN to continue.</p>
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

        <p className="login-pin-hint">
          Manager: 55555 &middot; Cashier: 44444
        </p>
      </div>
    </section>
  );
}
