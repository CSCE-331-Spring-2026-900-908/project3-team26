// HomePage: landing screen at "/" with the brand hero, two entry points
// (Login for staff, Kiosk for customers), and the live weather widget for College Station.
// This is the only public marketing-style page before users enter task-focused tools.
import { Link } from 'react-router-dom';
import WeatherWidget from '../components/WeatherWidget.jsx';

// HomePage: landing screen at "/" with the brand hero and two entry points
// Login for staff, Kiosk for customers, and the live weather widget for College Station
export default function HomePage() {
  return (
    <section className="landing-home">
      {/* Brand hero image */}
      <div className="landing-home-art">
        <img src="/images/dats-boba-landing.png" alt="DATS Boba" />
      </div>

      {/* Centered pill panel with the action buttons and the live weather widget */}
      <div className="landing-home-panel">
        <div className="landing-home-actions">
          <Link className="landing-home-link" to="/login">
            Login
          </Link>
          <Link className="landing-home-link landing-home-link-primary" to="/kiosk">
            Kiosk
          </Link>
        </div>

        {/* Live weather widget; pulls from the Open-Meteo API on mount (see WeatherWidget.jsx) */}
        <div className="landing-home-weather">
          <WeatherWidget />
        </div>
      </div>
    </section>
  );
}
