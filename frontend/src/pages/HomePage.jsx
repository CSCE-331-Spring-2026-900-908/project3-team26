import { Link } from 'react-router-dom';
import WeatherWidget from '../components/WeatherWidget.jsx';

export default function HomePage() {
  return (
    <section className="landing-home" aria-label="DATS Boba home">
      <div className="landing-home-art">
        <img src="/images/dats-boba-landing.png" alt="DATS Boba drinks and ingredients" />
      </div>

      <div className="landing-home-panel">
        <div className="landing-home-actions">
          <Link className="landing-home-link landing-home-link-primary" to="/kiosk">
            Kiosk
          </Link>
          <Link className="landing-home-link" to="/login">
            Manager/Cashier Login
          </Link>
        </div>

        <div className="landing-home-weather">
          <WeatherWidget />
        </div>
      </div>
    </section>
  );
}
