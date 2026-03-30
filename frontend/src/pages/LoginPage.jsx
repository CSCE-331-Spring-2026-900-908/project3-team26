import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState('2');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Cashier');
  const [error, setError] = useState('');

  function handleLogin() {
    if (!employeeId.trim()) {
      setError('Please enter an employee ID.');
      return;
    }

    setError('');
    localStorage.setItem('team26-employee-id', employeeId.trim());
    localStorage.setItem('team26-role', role.toLowerCase());

    if (role === 'Manager') {
      navigate('/manager');
      return;
    }
    navigate('/cashier');
  }

  return (
    <section id="page-login" className="page active">
      <div className="login-title">EMPLOYEE LOGIN</div>
      <div className="login-stack">
        <div className="login-logo">BOBA POS</div>
        <div className="login-form">
          <label htmlFor="l-user">Username (Employee ID)</label>
          <input
            id="l-user"
            type="text"
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            placeholder="Enter employee ID"
            autoComplete="off"
          />

          <label htmlFor="l-pass">Password</label>
          <input
            id="l-pass"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            autoComplete="off"
          />

          <label htmlFor="l-role">Role</label>
          <select id="l-role" value={role} onChange={(event) => setRole(event.target.value)}>
            <option>Cashier</option>
            <option>Manager</option>
          </select>

          <button className="primary bold" onClick={handleLogin}>
            LOGIN
          </button>

          {error ? <div className="login-error">{error}</div> : null}
        </div>
      </div>
    </section>
  );
}
