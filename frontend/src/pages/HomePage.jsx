// HomePage: landing screen at "/" with two entry points (Login for staff, Kiosk for customers)
// and the live weather widget for College Station.
import { Link } from 'react-router-dom';
import WeatherWidget from '../components/WeatherWidget.jsx';

export default function HomePage() {
  return (
    <section className="minimal-home">
      {/* Primary navigation buttons that route into the staff login or the customer kiosk */}
      <div className="minimal-home-actions">
        <Link className="minimal-home-link" to="/login">
          Login
        </Link>
        <Link className="minimal-home-link" to="/kiosk">
          Kiosk
        </Link>
      </div>

      {/* Live weather widget; pulls from the Open-Meteo API on mount (see WeatherWidget.jsx) */}
      <div className="minimal-home-weather">
        <WeatherWidget />
      </div>
    </section>
  );
}
