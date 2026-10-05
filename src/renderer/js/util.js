export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const debounce = (fn, ms) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

export const pad = (n) => String(n).padStart(2, '0');

// Open-Meteo returns naive local strings ("2026-10-05T14:00") in the location's timezone.
export function parseLocal(s) {
  const [d, t = '00:00'] = s.split('T');
  const [y, m, dd] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  return new Date(y, m - 1, dd, hh, mm);
}

export function fmtClock(h, m, c24) {
  if (c24) return `${pad(h)}:${pad(m)}`;
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}
export const fmtTimeStr = (s, c24) => fmtClock(+s.slice(11, 13), +s.slice(14, 16), c24);
export const fmtHourStr = (s, c24) => {
  const h = +s.slice(11, 13);
  return c24 ? `${pad(h)}:00` : `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
};
export const fmtDateTime = (ms, c24) => {
  const d = new Date(ms);
  const day0 = new Date(); day0.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(ms).setHours(0, 0, 0, 0) - day0.getTime()) / 864e5);
  const label = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday'
    : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return `${label} · ${fmtClock(d.getHours(), d.getMinutes(), c24)}`;
};
export const dayLabel = (s, i) =>
  i === 0 ? 'Today' : parseLocal(s).toLocaleDateString(undefined, { weekday: 'short' });
export const dateLabel = (s) => parseLocal(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export const toLocalInput = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const UNIT_SYM = {
  temp: { c: '°C', f: '°F' },
  wind: { kmh: 'km/h', mph: 'mph', ms: 'm/s', kn: 'kn' },
  precip: { mm: 'mm', inch: 'in' },
};

export const round = (n) => (n == null || Number.isNaN(n) ? '–' : Math.round(n));
export const deg = (n) => `${round(n)}°`;

const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compass = (d) => DIRS[Math.round((d % 360) / 22.5) % 16];

export const uvLabel = (v) =>
  v < 3 ? 'Low' : v < 6 ? 'Moderate' : v < 8 ? 'High' : v < 11 ? 'Very high' : 'Extreme';

export const aqiLabel = (v) =>
  v <= 50 ? ['Good', '#4ade80'] : v <= 100 ? ['Moderate', '#facc15'] : v <= 150 ? ['Unhealthy for some', '#fb923c']
    : v <= 200 ? ['Unhealthy', '#f87171'] : v <= 300 ? ['Very unhealthy', '#c084fc'] : ['Hazardous', '#be123c'];

export function fromHTML(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
