import { deriveAlerts, mergeAlerts } from './alerts.js';

const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const GEO = 'https://geocoding-api.open-meteo.com/v1/search';
const AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const api = window.cloudnook;

const CURRENT = 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m';
const HOURLY = 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,uv_index,visibility,is_day';
const DAILY = 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,daylight_duration,sunshine_duration,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max';

export const unitsKey = (s) => `${s.temp}|${s.wind}|${s.precip}`;

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather service returned ${res.status}`);
  return res.json();
}

export async function searchPlaces(q) {
  const j = await getJSON(`${GEO}?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
  return (j.results || []).map((r) => ({
    name: r.name, region: r.admin1 || '', country: r.country || '', lat: r.latitude, lon: r.longitude,
    source: 'search',
  }));
}

/** Prefer OS location (Wi‑Fi / GPS); fall back to approximate IP city. */
export async function detectLocation() {
  const precise = await new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5 * 60000 },
    );
  });
  if (precise) {
    try {
      const place = await api.reverseGeocode(precise.lat, precise.lon);
      return { ...place, source: 'gps' };
    } catch {
      return { name: 'Current location', region: '', country: '', lat: precise.lat, lon: precise.lon, source: 'gps' };
    }
  }
  const ip = await api.locate();
  return { ...ip, source: 'ip' };
}

/** OS location only — used to quietly upgrade a bad IP guess. */
export async function detectPreciseLocation() {
  if (!navigator.geolocation) return null;
  const precise = await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5 * 60000 },
    );
  });
  if (!precise) return null;
  try {
    const place = await api.reverseGeocode(precise.lat, precise.lon);
    return { ...place, source: 'gps' };
  } catch {
    return { name: 'Current location', region: '', country: '', lat: precise.lat, lon: precise.lon, source: 'gps' };
  }
}

export async function fetchWeather(loc, settings) {
  const p = new URLSearchParams({
    latitude: loc.lat, longitude: loc.lon, current: CURRENT, hourly: HOURLY, daily: DAILY,
    forecast_days: 14, timezone: 'auto',
    temperature_unit: settings.temp === 'f' ? 'fahrenheit' : 'celsius',
    wind_speed_unit: settings.wind, precipitation_unit: settings.precip,
  });
  const [j, air, official] = await Promise.all([
    getJSON(`${FORECAST}?${p}`),
    getJSON(`${AIR}?latitude=${loc.lat}&longitude=${loc.lon}&current=us_aqi,pm2_5,pm10`).catch(() => null),
    api.officialAlerts(loc).catch(() => []),
  ]);

  const c = j.current, h = j.hourly, d = j.daily;
  const hourly = h.time.map((t, i) => ({
    t, temp: h.temperature_2m[i], feels: h.apparent_temperature[i], hum: h.relative_humidity_2m[i],
    pop: h.precipitation_probability[i] ?? 0, precip: h.precipitation[i], code: h.weather_code[i],
    wind: h.wind_speed_10m[i], dir: h.wind_direction_10m[i], uv: h.uv_index[i], vis: h.visibility[i], day: !!h.is_day[i],
  }));
  const daily = d.time.map((t, i) => ({
    date: t, code: d.weather_code[i], max: d.temperature_2m_max[i], min: d.temperature_2m_min[i],
    fmax: d.apparent_temperature_max[i], fmin: d.apparent_temperature_min[i],
    sunrise: d.sunrise[i], sunset: d.sunset[i], daylight: d.daylight_duration[i], sunshine: d.sunshine_duration[i],
    uv: d.uv_index_max[i], precip: d.precipitation_sum[i], pop: d.precipitation_probability_max[i] ?? 0,
    wind: d.wind_speed_10m_max[i], gust: d.wind_gusts_10m_max[i],
  }));
  const weather = {
    fetchedAt: Date.now(), units: unitsKey(settings), tz: j.timezone,
    current: {
      time: c.time, temp: c.temperature_2m, feels: c.apparent_temperature, hum: c.relative_humidity_2m,
      day: !!c.is_day, precip: c.precipitation, code: c.weather_code, cloud: c.cloud_cover, pressure: c.pressure_msl,
      wind: c.wind_speed_10m, dir: c.wind_direction_10m, gust: c.wind_gusts_10m,
    },
    hourly, daily,
    aqi: air?.current ? { us: air.current.us_aqi, pm25: air.current.pm2_5, pm10: air.current.pm10 } : null,
  };
  weather.alerts = mergeAlerts(deriveAlerts(weather, settings), official);
  return weather;
}
