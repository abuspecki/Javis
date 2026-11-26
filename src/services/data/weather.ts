import type { WeatherData } from '../../types';

const CODES: Record<number, string> = {
  0: 'Klar', 1: 'Überwiegend klar', 2: 'Teilweise bewölkt', 3: 'Bedeckt', 45: 'Nebel', 48: 'Reifnebel',
  51: 'Leichter Nieselregen', 53: 'Nieselregen', 55: 'Starker Nieselregen', 61: 'Leichter Regen', 63: 'Regen',
  65: 'Starker Regen', 71: 'Leichter Schneefall', 73: 'Schneefall', 75: 'Starker Schneefall', 80: 'Regenschauer',
  81: 'Regenschauer', 82: 'Heftige Schauer', 95: 'Gewitter', 96: 'Gewitter mit Hagel', 99: 'Schweres Gewitter',
};
export const describeCode = (c: number) => CODES[c] ?? 'Unbekannt';

const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function demoWeather(city: string): WeatherData {
  const today = new Date().getDay();
  return {
    city, temperature: 7, apparent: 4, humidity: 78, wind: 14, code: 3, description: describeCode(3), demo: true,
    forecast: [3, 61, 2, 1, 80].map((code, i) => ({ day: DAYS[(today + i + 1) % 7], min: 1 + i, max: 8 + (i % 3), code })),
  };
}

/** Open-Meteo: free, no API key, CORS-enabled. Falls back to labelled demo data. */
export async function fetchWeather(city: string, signal?: AbortSignal): Promise<WeatherData> {
  const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=de&name=${encodeURIComponent(city)}`, { signal });
  if (!geo.ok) throw new Error('geocoding failed');
  const g = (await geo.json()).results?.[0];
  if (!g) throw new Error(`Ort „${city}“ nicht gefunden`);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=6&timezone=auto`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('forecast failed');
  const d = await res.json();
  const c = d.current;
  return {
    city: g.name,
    temperature: Math.round(c.temperature_2m),
    apparent: Math.round(c.apparent_temperature),
    humidity: Math.round(c.relative_humidity_2m),
    wind: Math.round(c.wind_speed_10m),
    code: c.weather_code,
    description: describeCode(c.weather_code),
    demo: false,
    forecast: (d.daily.time as string[]).slice(1).map((t, i) => ({
      day: DAYS[new Date(t).getDay()],
      min: Math.round(d.daily.temperature_2m_min[i + 1]),
      max: Math.round(d.daily.temperature_2m_max[i + 1]),
      code: d.daily.weather_code[i + 1],
    })),
  };
}
