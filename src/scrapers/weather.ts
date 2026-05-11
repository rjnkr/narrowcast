import { WeatherData, WeatherDay } from '../types';

const APELDOORN_LAT = 52.22;
const APELDOORN_LON = 5.97;

const WEEKDAYS = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];

export async function fetchWeather(): Promise<WeatherData> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${APELDOORN_LAT}&longitude=${APELDOORN_LON}` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum` +
    `&timezone=Europe%2FAmsterdam&forecast_days=5`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
  const json = await res.json() as {
    daily: {
      time: string[];
      weathercode: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_sum: number[];
    };
  };

  const days: WeatherDay[] = json.daily.time.map((date: string, i: number) => {
    const d = new Date(date);
    return {
      date,
      weekday: WEEKDAYS[d.getDay()],
      wmoCode: json.daily.weathercode[i],
      tempMax: Math.round(json.daily.temperature_2m_max[i]),
      tempMin: Math.round(json.daily.temperature_2m_min[i]),
      precipitation: parseFloat((json.daily.precipitation_sum[i] || 0).toFixed(1)),
    };
  });

  return { city: 'Apeldoorn', days, fetchedAt: new Date().toISOString() };
}
