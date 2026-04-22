import { Link, NavLink, useNavigate } from 'react-router-dom';
import { logoutUser } from '../utils/session.js';
import WeatherWidget from './WeatherWidget.jsx';

const navItems = [
  ['/', 'Home'],
  ['/login', 'Login'],
  ['/cashier', 'Cashier'],
  ['/manager', 'Manager'],
  ['/sales', 'Sales'],
  ['/kiosk', 'Kiosk'],
];

export default function NavBar() {
  const navigate = useNavigate();

  return (
    <header className="topbar">
      <Link className="brand-lockup" to="/">
        <span className="brand-mark">B26</span>
        <div>
          <strong>Bubble Tea POS</strong>
          <p>Project 2 migrated into a web app</p>
        </div>
      </Link>
      <nav className="topnav">
        {navItems.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {label}
          </NavLink>
        ))}
        <button className="nav-link" onClick={() => logoutUser(navigate)}>
          Logout
        </button>
        <WeatherWidget />
      </nav>
    </header>
  );
}