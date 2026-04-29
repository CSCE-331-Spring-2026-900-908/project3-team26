// WeatherWidget: small badge showing the current temperature + emoji for College Station.
// Calls the Open-Meteo forecast API on mount (no key required) and maps the returned
// WMO weather code to a description + emoji from the table below.
import { useEffect, useState } from 'react';

// Uses the free Open-Meteo API (no API key required).
// Defaults to College Station, TX; override via props if needed.
// Maps Open-Meteo's WMO weather codes to [description, emoji] for the UI.
const WEATHER_CODES = {
  0: ['Clear', '☀️'],
  1: ['Mainly clear', '🌤️'],
  2: ['Partly cloudy', '⛅'],
  3: ['Overcast', '☁️'],
  45: ['Fog', '🌫️'],
  48: ['Fog', '🌫️'],
  51: ['Drizzle', '🌦️'],
  53: ['Drizzle', '🌦️'],
  55: ['Drizzle', '🌦️'],
  61: ['Rain', '🌧️'],
  63: ['Rain', '🌧️'],
  65: ['Heavy rain', '🌧️'],
  71: ['Snow', '🌨️'],
  73: ['Snow', '🌨️'],
  75: ['Snow', '🌨️'],
  80: ['Showers', '🌦️'],
  81: ['Showers', '🌦️'],
  82: ['Showers', '⛈️'],
  95: ['Thunderstorm', '⛈️'],
  96: ['Thunderstorm', '⛈️'],
  99: ['Thunderstorm', '⛈️'],
};

export default function WeatherWidget({
  latitude = 30.6280,
  longitude = -96.3344,
  label = 'College Station',
}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Hits the Open-Meteo forecast endpoint with the configured coordinates and stores
  // the returned current_weather block in state. Re-runs if latitude/longitude change.
  useEffect(() => {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}` +
      `&longitude=${longitude}&current_weather=true&temperature_unit=fahrenheit`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => setData(j.current_weather))
      .catch((e) => setError(e.message));
  }, [latitude, longitude]);

  if (error) {
    return <div className="weather-widget weather-widget-error">Weather unavailable</div>;
  }
  if (!data) {
    return <div className="weather-widget">Loading…</div>;
  }

  const [desc, icon] = WEATHER_CODES[data.weathercode] || ['—', '🌡️'];
  return (
    <div className="weather-widget" title={`${desc} in ${label}`}>
      <span className="weather-icon">{icon}</span>
      <div className="weather-text">
        <strong>{Math.round(data.temperature)}°F</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
