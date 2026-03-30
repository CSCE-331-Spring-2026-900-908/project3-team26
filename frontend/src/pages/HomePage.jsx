import { Link, useNavigate } from 'react-router-dom';
import { logoutUser } from '../utils/session.js';

const quickLinks = [
  { to: '/cashier', label: 'Cashier POS', copy: 'Create counter orders and save them to PostgreSQL.' },
  { to: '/manager', label: 'Manager Dashboard', copy: 'Monitor inventory, view orders, and run reports.' },
  { to: '/sales', label: 'Sales Analytics', copy: 'Review weekly history, peak days, and popular products.' },
  { to: '/kiosk', label: 'Kiosk Mode', copy: 'Launch the customer self-ordering flow for demos.' },
];

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <section className="hero-layout">
      <div className="hero-card">
        <div className="page-action-row">
          <button onClick={() => logoutUser(navigate)}>Logout</button>
        </div>
        <p className="eyebrow">Project 3 Team 26</p>
        <h1>Bubble tea POS, rebuilt as a full-stack web application.</h1>
        <p className="page-copy">
          This site preserves the original Project 2 database design, menu data, inventory flow,
          sales queries, and order logic while replacing the Java Swing interface with a browser UI.
        </p>
        <div className="hero-actions">
          <Link className="action-button large" to="/login">
            Choose a Role
          </Link>
          <Link className="ghost-button large" to="/kiosk">
            Open Demo Kiosk
          </Link>
        </div>
      </div>

      <div className="card-grid">
        {quickLinks.map((link) => (
          <Link className="feature-card" to={link.to} key={link.to}>
            <h2>{link.label}</h2>
            <p>{link.copy}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
