import { describe } from './icons.js';

function toKmh(wind, unit) {
  if (wind == null || Number.isNaN(wind)) return 0;
  if (unit === 'mph') return wind * 1.60934;
  if (unit === 'ms') return wind * 3.6;
  if (unit === 'kn') return wind * 1.852;
  return wind;
}

function toC(temp, unit) {
  if (temp == null || Number.isNaN(temp)) return null;
  return unit === 'f' ? (temp - 32) * (5 / 9) : temp;
}

function push(out, seen, alert) {
  if (!alert?.id || seen.has(alert.id)) return;
  seen.add(alert.id);
  out.push(alert);
}

/** Build local severe-weather alerts from the Open-Meteo forecast (works worldwide). */
export function deriveAlerts(weather, settings = {}) {
  if (!weather?.current) return [];
  const out = [];
  const seen = new Set();
  const windUnit = settings.wind || 'kmh';
  const tempUnit = settings.temp || 'c';
  const now = weather.current;
  const today = weather.daily?.[0];
  const nextHours = (weather.hourly || []).slice(0, 24);

  const severeCodes = {
    82: { event: 'Violent rain showers', severity: 'severe' },
    95: { event: 'Thunderstorm', severity: 'severe' },
    96: { event: 'Thunderstorm with hail', severity: 'extreme' },
    99: { event: 'Severe thunderstorm', severity: 'extreme' },
    75: { event: 'Heavy snow', severity: 'severe' },
    86: { event: 'Heavy snow showers', severity: 'severe' },
    66: { event: 'Freezing rain', severity: 'severe' },
    67: { event: 'Freezing rain', severity: 'severe' },
    56: { event: 'Freezing drizzle', severity: 'moderate' },
    57: { event: 'Freezing drizzle', severity: 'moderate' },
  };

  const codeHit = severeCodes[now.code];
  if (codeHit) {
    push(out, seen, {
      id: `local-now-${now.code}`,
      source: 'local',
      event: codeHit.event,
      headline: `${codeHit.event} in your area now`,
      severity: codeHit.severity,
      description: describe(now.code),
      ends: null,
    });
  }

  for (const h of nextHours) {
    const hit = severeCodes[h.code];
    if (!hit || h.code === now.code) continue;
    push(out, seen, {
      id: `local-hour-${h.code}-${h.t}`,
      source: 'local',
      event: hit.event,
      headline: `${hit.event} expected around ${h.t.slice(11, 16)}`,
      severity: hit.severity,
      description: describe(h.code),
      ends: null,
    });
    break;
  }

  const gust = toKmh(now.gust ?? now.wind, windUnit);
  if (gust >= 90) {
    push(out, seen, {
      id: 'local-wind-extreme',
      source: 'local',
      event: 'Damaging wind',
      headline: `Very strong winds — gusts near ${Math.round(gust)} km/h`,
      severity: 'extreme',
      description: 'Secure loose outdoor items and avoid exposed areas.',
      ends: null,
    });
  } else if (gust >= 70) {
    push(out, seen, {
      id: 'local-wind-severe',
      source: 'local',
      event: 'High wind',
      headline: `Strong winds — gusts near ${Math.round(gust)} km/h`,
      severity: 'severe',
      description: 'Expect difficult driving and blowing debris.',
      ends: null,
    });
  }

  const tempC = toC(now.temp, tempUnit);
  if (tempC != null && tempC >= 40) {
    push(out, seen, {
      id: 'local-heat',
      source: 'local',
      event: 'Extreme heat',
      headline: 'Dangerous heat — limit outdoor time and stay hydrated',
      severity: 'severe',
      description: `Current temperature around ${Math.round(now.temp)}°`,
      ends: null,
    });
  } else if (tempC != null && tempC <= -25) {
    push(out, seen, {
      id: 'local-cold',
      source: 'local',
      event: 'Extreme cold',
      headline: 'Dangerous cold — frostbite risk with prolonged exposure',
      severity: 'severe',
      description: `Current temperature around ${Math.round(now.temp)}°`,
      ends: null,
    });
  }

  const uv = Math.max(today?.uv ?? 0, ...nextHours.map((h) => h.uv ?? 0));
  if (uv >= 11) {
    push(out, seen, {
      id: 'local-uv',
      source: 'local',
      event: 'Extreme UV',
      headline: 'UV index is extreme — seek shade midday',
      severity: 'moderate',
      description: `Peak UV near ${Math.round(uv)}`,
      ends: null,
    });
  }

  const rank = { extreme: 0, severe: 1, moderate: 2, minor: 3, unknown: 4 };
  return out.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9));
}

export function mergeAlerts(local = [], official = []) {
  const out = [];
  const seen = new Set();
  for (const a of [...official, ...local]) push(out, seen, a);
  const rank = { extreme: 0, severe: 1, moderate: 2, minor: 3, unknown: 4 };
  return out.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9));
}
