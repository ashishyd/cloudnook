export function kindOf(c) {
  if (c === 0 || c === 1) return 'clear';
  if (c === 2) return 'partly';
  if (c === 3) return 'cloudy';
  if (c === 45 || c === 48) return 'fog';
  if (c >= 51 && c <= 57) return 'drizzle';
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
  if (c >= 95) return 'thunder';
  return 'cloudy';
}

const DESC = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers', 85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm, hail', 99: 'Severe thunderstorm',
};
export const describe = (c) => DESC[c] || 'Unknown';

const CLOUD = 'M18 46a9 9 0 0 1 1-18 13 13 0 0 1 25 2 8 8 0 0 1 0 16z';
const cloud = (tf = '') => `<path class="ic-cloud" transform="${tf}" d="${CLOUD}"/>`;

function sun(cx, cy, r) {
  const rays = [...Array(8)].map((_, i) => {
    const a = (i * Math.PI) / 4;
    const p = (d) => [(cx + Math.cos(a) * d).toFixed(1), (cy + Math.sin(a) * d).toFixed(1)];
    const [x1, y1] = p(r + 4); const [x2, y2] = p(r + 8);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join('');
  return `<g class="ic-sun" style="transform-origin:${cx}px ${cy}px"><circle cx="${cx}" cy="${cy}" r="${r}"/>${rays}</g>`;
}
const moon = (cx, cy, s) =>
  `<path class="ic-moon" transform="translate(${cx - 12 * s} ${cy - 12 * s}) scale(${s})" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;

const rain = (n = 3) => `<g class="ic-rain">${[24, 32, 40].slice(0, n).map((x) =>
  `<line x1="${x}" y1="48" x2="${x - 2}" y2="55"/>`).join('')}</g>`;
const snow = () => `<g class="ic-snow">${[24, 32, 40].map((x) => `<circle cx="${x}" cy="53" r="2"/>`).join('')}</g>`;
const bolt = () => '<polygon class="ic-bolt" points="35,42 26,54 32,54 29,63 40,50 34,50"/>';
const fog = () => `<g class="ic-fog">${[48, 54, 60].map((y, i) =>
  `<line x1="${14 + i * 3}" y1="${y}" x2="${50 - i * 3}" y2="${y}"/>`).join('')}</g>`;

export function icon(code, isDay = true, cls = '') {
  const k = kindOf(code);
  let inner;
  switch (k) {
    case 'clear': inner = isDay ? sun(32, 32, 10) : moon(32, 32, 2.3); break;
    case 'partly': inner = (isDay ? sun(24, 24, 8) : moon(24, 24, 1.7)) + cloud('translate(8 4)'); break;
    case 'cloudy': inner = cloud('translate(-4 -4) scale(.9)').replace('ic-cloud', 'ic-cloud back') + cloud('translate(6 4)'); break;
    case 'fog': inner = cloud('translate(0 -6)') + fog(); break;
    case 'drizzle': inner = cloud('translate(0 -6)') + rain(2); break;
    case 'rain': inner = cloud('translate(0 -6)') + rain(3); break;
    case 'snow': inner = cloud('translate(0 -6)') + snow(); break;
    case 'thunder': inner = cloud('translate(0 -8)') + bolt(); break;
    default: inner = cloud();
  }
  return `<svg class="wicon ${cls}" viewBox="0 0 64 64" aria-hidden="true">${inner}</svg>`;
}
