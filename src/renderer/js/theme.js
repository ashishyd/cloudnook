export const THEMES = {
  system:   { name: 'System',   tone: 'system', bg: ['#0b1026', '#1b2a6b', '#0f766e'], accent: '#7cc4ff' },
  aurora:   { name: 'Aurora',   tone: 'dark',  bg: ['#0b1026', '#1b2a6b', '#0f766e'], accent: '#7cc4ff' },
  midnight: { name: 'Midnight', tone: 'dark',  bg: ['#05060d', '#10121f', '#2a1459'], accent: '#a78bfa' },
  sunset:   { name: 'Sunset',   tone: 'dark',  bg: ['#1f0f2e', '#7a1f5c', '#e8643a'], accent: '#ffb36b' },
  forest:   { name: 'Forest',   tone: 'dark',  bg: ['#06140f', '#0f3d2e', '#2f6f4f'], accent: '#7ee0a8' },
  ocean:    { name: 'Ocean',    tone: 'dark',  bg: ['#02111f', '#06406b', '#0891b2'], accent: '#5eead4' },
  daylight: { name: 'Daylight', tone: 'light', bg: ['#e8f2ff', '#c9defa', '#fde9d5'], accent: '#2563eb' },
  paper:    { name: 'Paper',    tone: 'light', bg: ['#f6f1e7', '#efe6d4', '#dfeee6'], accent: '#c2410c' },
  mono:     { name: 'Mono',     tone: 'dark',  bg: ['#0a0a0a', '#171717', '#262626'], accent: '#e5e5e5' },
};

/** Cached OS preference; updated from main via setOsDark(). */
let osDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;

export function setOsDark(dark) {
  osDark = !!dark;
}

export function getOsDark() {
  return osDark;
}

export function resolveTheme(settings) {
  if (settings.theme === 'system') {
    const base = osDark ? THEMES.midnight : THEMES.daylight;
    return { ...base, name: 'System', tone: osDark ? 'dark' : 'light', accent: settings.accent || base.accent };
  }
  if (settings.theme === 'custom') {
    return { name: 'Custom', ...settings.custom, accent: settings.accent || settings.custom.accent };
  }
  const t = THEMES[settings.theme] || THEMES.aurora;
  return { ...t, accent: settings.accent || t.accent };
}

function luminance(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  if (Number.isNaN(n)) return 0;
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function applyTheme(state) {
  const s = state.settings;
  const t = resolveTheme(s);
  const root = document.documentElement;
  const dark = t.tone === 'dark';
  const set = (k, v) => root.style.setProperty(k, v);
  set('--bg1', t.bg[0]); set('--bg2', t.bg[1]); set('--bg3', t.bg[2]);
  set('--accent', t.accent);
  set('--accent-fg', luminance(t.accent) > 0.4 ? '#0b1020' : '#ffffff');
  set('--fg', dark ? '#f4f7ff' : '#14213d');
  set('--fg-dim', dark ? 'rgba(244,247,255,.62)' : 'rgba(20,33,61,.62)');
  set('--card', dark ? `rgba(255,255,255,${0.04 + s.opacity * 0.12})` : `rgba(255,255,255,${0.3 + s.opacity * 0.5})`);
  set('--card-hover', dark ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.8)');
  set('--line', dark ? 'rgba(255,255,255,.12)' : 'rgba(20,33,61,.1)');
  set('--field', dark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.7)');
  set('--shadow', dark ? '0 10px 40px rgba(0,0,0,.35)' : '0 10px 40px rgba(60,80,120,.15)');
  set('--blur', `${s.blur}px`);
  set('--radius', `${s.radius}px`);
  set('--fs', `${s.fontScale}`);
  root.dataset.tone = t.tone;
  document.body.classList.toggle('noanim', !s.animations);
}
