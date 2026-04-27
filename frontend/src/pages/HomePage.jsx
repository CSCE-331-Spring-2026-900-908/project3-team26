import { Link } from 'react-router-dom';
import WeatherWidget from '../components/WeatherWidget.jsx';

export default function HomePage() {
  return (
    <section className="minimal-home">
      <div className="minimal-home-actions">
        <Link className="minimal-home-link" to="/login">
          Login
        </Link>
        <Link className="minimal-home-link" to="/kiosk">
          Kiosk
        </Link>
      </div>

      <div className="minimal-home-weather">
        <WeatherWidget />
      </div>
    </section>
  );
}
