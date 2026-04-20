import { Link } from 'react-router-dom';
import WeatherWidget from '../components/WeatherWidget.jsx';

export default function HomePage() {
  return (
    <section className="hero-layout">
      <div className="hero-card">
        <p className="eyebrow">Project 3 Team 26</p>
        <h1>Bubble Tea POS</h1>
        <p className="page-copy">
          The home screen only keeps the essentials: staff login, kiosk access, and the current
          weather in College Station.
        </p>
      </div>

      <div className="card-grid">
        <Link className="feature-card" to="/login">
          <h2>Login</h2>
          <p>Choose a role and enter the app.</p>
        </Link>

        <Link className="feature-card" to="/kiosk">
          <h2>Kiosk</h2>
          <p>Start the customer self-ordering experience.</p>
        </Link>

        <div className="feature-card weather-home-card">
          <h2>Weather</h2>
          <p>Current conditions for College Station.</p>
          <WeatherWidget />
        </div>
      </div>
    </section>
  );
}
