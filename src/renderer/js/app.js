import * as store from './store.js';
import { applyTheme, setOsDark } from './theme.js';
import { fetchWeather, searchPlaces, unitsKey, detectLocation, detectPreciseLocation } from './weather.js';
import { openSettings, openPrivacyDialog } from './settings.js';
import { esc, debounce } from './util.js';
import widgets from './widgets/index.js';

const api = window.cloudnook;
const soloName = new URLSearchParams(location.search).get('widget');
const SIZES = [4, 6, 8, 12];
const instances = new Map();

const LOGO = `<svg viewBox="0 0 64 64" class="logo"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7cc4ff"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs>
  <circle cx="44" cy="22" r="11" fill="#ffc83d"/><path d="M16 50a11 11 0 0 1 1-22 16 16 0 0 1 31 3 10 10 0 0 1 0 19z" fill="url(#lg)"/></svg>`;

const ICONS = {
  gear: '<svg viewBox="0 0 24 24"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  layout: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/></svg>',
  refresh: '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
  pop: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4 9.5 6a14 14 0 0 1-2.6 3.4M6.3 7.7A14 14 0 0 0 2.5 12c1 2 4.5 6 9.5 6 1.4 0 2.7-.3 3.8-.8"/></svg>',
  size: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6"/></svg>',
  widget: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="5"/><path d="M8 14.5a2.5 2.5 0 0 1 .4-5 3.5 3.5 0 0 1 6.7.7 2.3 2.3 0 0 1 0 4.3z"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 17v5M9 3h6l-1 7 3 3v2H7v-2l3-3z"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
};

function toast(msg, kind = '') {
  let box = document.querySelector('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.append(box); }
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.innerHTML = msg;
  box.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 250); }, kind === 'alert' ? 9000 : 4000);
}

function visibleAlerts() {
  const dismissed = new Set(store.get().dismissedAlerts || []);
  return (store.get().weather?.alerts || []).filter((a) => a?.id && !dismissed.has(a.id));
}

function renderAlertBanner() {
  if (soloName) return;
  let bar = document.querySelector('.alert-banner');
  const alerts = visibleAlerts();
  if (!alerts.length) {
    bar?.remove();
    return;
  }
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'alert-banner';
    const anchor = document.querySelector('.locbar') || document.querySelector('.topbar');
    anchor?.after(bar);
    bar.addEventListener('click', (e) => {
      if (e.target.closest('[data-dismiss-alerts]')) {
        const ids = visibleAlerts().map((a) => a.id);
        store.set('dismissedAlerts', [...new Set([...(store.get().dismissedAlerts || []), ...ids])].slice(-80));
        renderAlertBanner();
      }
    });
  }
  const top = alerts[0];
  const extra = alerts.length > 1 ? ` · +${alerts.length - 1} more` : '';
  bar.dataset.severity = top.severity || 'unknown';
  bar.innerHTML = `<div class="alert-banner-body"><b>${esc(top.event || 'Weather alert')}</b>
    <span>${esc(top.headline || '')}${extra}</span></div>
    <button data-dismiss-alerts aria-label="Dismiss alerts">×</button>`;
}

function syncAlertNotices(weather) {
  const alerts = weather?.alerts || [];
  if (alerts.length) api.notifyAlerts(alerts);
  const active = new Set(alerts.map((a) => a.id));
  const kept = (store.get().dismissedAlerts || []).filter((id) => active.has(id));
  if (kept.length !== (store.get().dismissedAlerts || []).length) store.set('dismissedAlerts', kept);
  renderAlertBanner();
}

function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1175].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; o.type = 'sine'; o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.16;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.start(t); o.stop(t + 0.55);
    });
  } catch { /* audio unavailable */ }
}

/* ---------- widget host ---------- */
function buildWidget(id, size) {
  const def = widgets[id];
  const el = document.createElement('section');
  el.className = `widget w${size} ${def.bare ? 'bare' : ''} wid-${id}`;
  el.dataset.id = id;
  el.innerHTML = `
    <div class="whead"><span class="wtitle">${def.title}</span>
      <div class="wtools">
        <button data-w="size" class="edit-only" title="Change size">${ICONS.size}</button>
        <button data-w="hide" class="edit-only" title="Hide widget">${ICONS.eye}</button>
        <button data-w="pop" title="Pop out as desktop widget">${ICONS.pop}</button>
      </div></div>
    <div class="wbody"></div>`;
  const body = el.querySelector('.wbody');
  const inst = def.mount(body);
  instances.set(id, { def, inst, el });
  inst.update();
  return el;
}

function renderGrid() {
  const grid = document.querySelector('.grid');
  const layout = store.get().layout;
  const existing = new Map([...grid.children].map((c) => [c.dataset.id, c]));
  grid.replaceChildren();
  for (const l of layout) {
    if (!l.visible) { instances.delete(l.id); continue; }
    let el = existing.get(l.id);
    if (!el) el = buildWidget(l.id, l.size);
    el.className = el.className.replace(/\bw(4|6|8|12)\b/, `w${l.size}`);
    grid.append(el);
  }
  renderAddBar();
}

function renderAddBar() {
  const bar = document.querySelector('.addbar');
  const hidden = store.get().layout.filter((l) => !l.visible);
  bar.innerHTML = hidden.length
    ? `<span>Hidden widgets:</span>${hidden.map((l) => `<button class="chip" data-add="${l.id}">+ ${widgets[l.id].title}</button>`).join('')}`
    : '<span>All widgets are visible. Drag to reorder, resize or hide them.</span>';
}

function refresh(key, silent) {
  if (silent) return;
  for (const { def, inst } of instances.values()) {
    if (key === 'settings' || def.keys.includes(key)) inst.update();
  }
}

/* ---------- weather loading ---------- */
let loading = false;
async function loadWeather(force = false) {
  const { location: loc, settings, weather } = store.get();
  if (!loc || loading) return;
  if (!force && weather && weather.units === unitsKey(settings) && Date.now() - weather.fetchedAt < 10 * 60000) return;
  loading = true;
  document.querySelector('[data-act="refresh"]')?.classList.add('spin');
  try {
    const weather = await fetchWeather(loc, settings);
    store.set('weather', weather);
    syncAlertNotices(weather);
  } catch (err) {
    toast(`Couldn't update the weather — ${esc(err.message)}. Showing the last known forecast.`, 'warn');
  } finally {
    loading = false;
    document.querySelector('[data-act="refresh"]')?.classList.remove('spin');
  }
}

function chooseLocation(place) {
  const next = { source: 'search', ...place };
  const saved = [next, ...store.get().savedLocations.filter((p) => !(p.lat === next.lat && p.lon === next.lon))].slice(0, 8);
  store.set('savedLocations', saved);
  store.set('location', next);
  renderLocationBar();
  loadWeather(true);
}

async function locateMe(auto = false) {
  try {
    chooseLocation(await detectLocation());
  } catch {
    if (!auto) toast("Couldn't detect your location. Search for a city instead.", 'warn');
  }
}

/** Quietly replace an IP/legacy guess when precise OS location is available. */
async function upgradeIpLocation() {
  const loc = store.get().location;
  if (!loc || loc.source === 'gps' || loc.source === 'search' || loc.source === 'manual') return;
  try {
    const place = await detectPreciseLocation();
    if (place) chooseLocation(place);
  } catch { /* keep current city */ }
}

const DESKTOP_WIDGETS = [
  ['summary', 'Weather summary', 'Compact card for your desktop'], ['tasks', 'Tasks', 'Check things off from the desktop'],
  ['reminders', 'Reminders', 'Upcoming and due reminders'], ['notes', 'Sticky notes', 'Notes always in sight'],
  ['now', 'Weather — large', 'Animated current conditions'], ['hourly', 'Weather — hourly', 'Hour-by-hour for any day'],
  ['daily', 'Weather — 14 days', 'Two-week outlook'], ['details', 'Weather — conditions', 'Wind, UV, humidity, sun'],
  ['radar', 'Weather — radar', 'Precipitation radar near you'],
];

function samePlace(a, b) {
  return a && b && a.lat === b.lat && a.lon === b.lon;
}

function renderLocationBar() {
  let bar = document.querySelector('.locbar');
  const saved = store.get().savedLocations || [];
  const loc = store.get().location;
  if (!saved.length && !loc) {
    bar?.remove();
    return;
  }
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'locbar';
    bar.setAttribute('role', 'navigation');
    bar.setAttribute('aria-label', 'Saved locations');
    const top = document.querySelector('.topbar');
    top?.after(bar);
    bar.addEventListener('click', (e) => {
      const del = e.target.closest('[data-del-loc]');
      if (del) {
        e.stopPropagation();
        const i = +del.dataset.delLoc;
        const list = store.get().savedLocations || [];
        const removed = list[i];
        if (!removed) return;
        const next = list.filter((_, idx) => idx !== i);
        store.set('savedLocations', next);
        if (samePlace(removed, store.get().location)) {
          if (next[0]) chooseLocation({ ...next[0], source: next[0].source || 'search' });
          else {
            store.set('location', null);
            store.set('weather', null);
            renderLocationBar();
          }
        } else {
          renderLocationBar();
        }
        return;
      }
      const chip = e.target.closest('[data-loc]');
      if (!chip || e.target.closest('[data-del-loc]')) return;
      const place = (store.get().savedLocations || [])[+chip.dataset.loc];
      if (place) chooseLocation({ ...place, source: place.source || 'search' });
    });
  }
  const list = saved.length ? saved : (loc ? [loc] : []);
  bar.innerHTML = list.map((p, i) => {
    const on = samePlace(p, loc);
    const canDelete = saved.length > 0;
    return `<span class="locchip ${on ? 'on' : ''}" role="group">
      <button type="button" data-loc="${i}" aria-pressed="${on}">${esc(p.name)}</button>
      ${canDelete ? `<button type="button" class="loc-del" data-del-loc="${i}" title="Remove ${esc(p.name)}" aria-label="Remove ${esc(p.name)}">×</button>` : ''}
    </span>`;
  }).join('');
}

function toggleWidgetMenu(anchor) {
  const existing = document.querySelector('.wmenu');
  if (existing) { existing.remove(); return; }
  const menu = document.createElement('div');
  menu.className = 'wmenu';
  const r = anchor.getBoundingClientRect();
  menu.style.top = `${r.bottom + 8}px`;
  menu.style.right = `${window.innerWidth - r.right}px`;
  const render = () => {
    const open = new Set(store.get().openWidgets || []);
    menu.innerHTML = `<div class="rh">Desktop widgets</div>${DESKTOP_WIDGETS.map(([id, t, d]) =>
      `<button data-id="${id}" class="${open.has(id) ? 'on' : ''}"><i></i><span><b>${t}</b><small>${d}</small></span></button>`).join('')}`;
  };
  render();
  document.body.append(menu);
  const off = store.subscribe((key) => { if (key === 'openWidgets') render(); });
  const close = (e) => {
    if (e && menu.contains(e.target)) return;
    menu.remove(); off(); document.removeEventListener('mousedown', close);
  };
  menu.addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) api.toggleWidget(b.dataset.id); });
  setTimeout(() => document.addEventListener('mousedown', close), 0);
}

/* ---------- main window ---------- */
function bootMain() {
  document.body.innerHTML = `
    <a class="skip" href="#main">Skip to content</a>
    <div class="blob b1" aria-hidden="true"></div><div class="blob b2" aria-hidden="true"></div>
    <header class="topbar">
      <div class="brand">${LOGO}<div><b>Cloudnook</b><small>Your day, under one sky.</small></div></div>
      <div class="search" role="search">${ICONS.search}<input placeholder="Search city, tasks, notes…  ( / )" autocomplete="off" spellcheck="false" aria-label="Search cities, tasks and notes" aria-autocomplete="list" aria-controls="search-results"><div class="results" id="search-results" role="listbox"></div></div>
      <div class="actions">
        <button type="button" data-act="widgets" title="Desktop widgets" aria-label="Desktop widgets">${ICONS.widget}</button>
        <button type="button" data-act="refresh" title="Refresh weather" aria-label="Refresh weather">${ICONS.refresh}</button>
        <button type="button" data-act="edit" title="Customize layout" aria-label="Customize layout" aria-pressed="false">${ICONS.layout}</button>
        <button type="button" data-act="settings" title="Settings" aria-label="Settings">${ICONS.gear}</button>
      </div>
    </header>
    <main class="grid" id="main" tabindex="-1"></main>
    <div class="addbar"></div>
    <div class="toasts" aria-live="polite"></div>`;
  document.body.classList.add(api.platform === 'darwin' ? 'mac' : 'other');
  document.querySelector('.topbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'settings') openSettings();
    else if (b.dataset.act === 'widgets') toggleWidgetMenu(b);
    else if (b.dataset.act === 'refresh') loadWeather(true);
    else if (b.dataset.act === 'edit') {
      const on = document.body.classList.toggle('editing');
      b.setAttribute('aria-pressed', String(on));
    }
  });

  renderGrid();
  renderLocationBar();
  initSearch();
  if (!store.get().location) locateMe(true);
  else upgradeIpLocation();
  initGridEvents();
  loadWeather();
  setInterval(() => loadWeather(), 5 * 60000);
  window.addEventListener('focus', () => loadWeather());
  window.addEventListener('cn:reload-weather', () => loadWeather(true));
  window.addEventListener('cn:toast', (e) => toast(e.detail?.msg || '', e.detail?.kind || ''));
  renderAlertBanner();
  if (!store.get().settings.privacyAccepted) openPrivacyDialog({ required: true });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) {
      e.preventDefault(); document.querySelector('.search input').focus();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === ',') openSettings();
  });
  window.addEventListener('cn:focus-search', () => document.querySelector('.search input').focus());
  api.onCommand((cmd) => {
    if (cmd === 'settings') openSettings();
    if (cmd === 'privacy') openPrivacyDialog();
  });
}

function localMatches(q) {
  const needle = q.toLowerCase();
  const tasks = (store.get().tasks || [])
    .filter((t) => t.title?.toLowerCase().includes(needle))
    .slice(0, 5)
    .map((t) => ({ kind: 'task', id: t.id, title: t.title, done: t.done }));
  const notes = (store.get().notes || [])
    .filter((n) => (n.text || '').toLowerCase().includes(needle))
    .slice(0, 5)
    .map((n) => ({ kind: 'note', id: n.id, title: n.text?.slice(0, 48) || 'Untitled note' }));
  return { tasks, notes };
}

function initSearch() {
  const wrap = document.querySelector('.search');
  const input = wrap.querySelector('input');
  const box = wrap.querySelector('.results');
  let places = [];
  let locals = { tasks: [], notes: [] };

  const render = (header) => {
    const here = '<button type="button" data-locate class="here"><b>Use my device location</b><small>Wi‑Fi / GPS — more accurate than IP</small></button>';
    const placeHtml = places.length
      ? `${header ? `<div class="rh">${header}</div>` : ''}${places.map((p, i) => `<button type="button" role="option" data-place="${i}"><b>${esc(p.name)}</b><small>${esc([p.region, p.country].filter(Boolean).join(', '))}</small></button>`).join('')}`
      : '';
    const taskHtml = locals.tasks.length
      ? `<div class="rh">Tasks</div>${locals.tasks.map((t, i) => `<button type="button" role="option" data-task="${i}"><b>${esc(t.title)}</b><small>${t.done ? 'Done' : 'Task'}</small></button>`).join('')}`
      : '';
    const noteHtml = locals.notes.length
      ? `<div class="rh">Notes</div>${locals.notes.map((n, i) => `<button type="button" role="option" data-note="${i}"><b>${esc(n.title)}</b><small>Note</small></button>`).join('')}`
      : '';
    const empty = !places.length && !locals.tasks.length && !locals.notes.length
      ? '<div class="rh">No matches</div>' : '';
    box.innerHTML = here + placeHtml + taskHtml + noteHtml + empty;
    box.classList.add('open');
  };

  const find = debounce(async () => {
    const q = input.value.trim();
    locals = q.length >= 2 ? localMatches(q) : { tasks: [], notes: [] };
    if (q.length < 2) {
      places = store.get().savedLocations;
      return render(places.length ? 'Saved locations' : '');
    }
    try {
      places = await searchPlaces(q);
      render('Cities');
    } catch {
      places = [];
      render('');
      if (!locals.tasks.length && !locals.notes.length) {
        box.innerHTML = '<div class="rh">Search unavailable offline</div>';
        box.classList.add('open');
      }
    }
  }, 250);

  const focusWidget = (id) => {
    const el = document.querySelector(`.widget[data-id="${id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.classList.add('flash');
    setTimeout(() => el?.classList.remove('flash'), 1200);
  };

  input.addEventListener('focus', () => { if (!input.value) find(); });
  input.addEventListener('input', find);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { input.blur(); box.classList.remove('open'); }
    if (e.key === 'Enter') {
      if (places[0]) { chooseLocation(places[0]); input.value = ''; input.blur(); box.classList.remove('open'); }
      else if (locals.tasks[0]) { focusWidget('tasks'); input.value = ''; box.classList.remove('open'); }
      else if (locals.notes[0]) { focusWidget('notes'); input.value = ''; box.classList.remove('open'); }
    }
  });
  box.addEventListener('mousedown', (e) => {
    if (e.target.closest('[data-locate]')) { locateMe(); input.value = ''; box.classList.remove('open'); input.blur(); return; }
    const place = e.target.closest('[data-place]');
    if (place) {
      chooseLocation(places[+place.dataset.place]);
      input.value = ''; box.classList.remove('open'); input.blur();
      return;
    }
    if (e.target.closest('[data-task]')) { focusWidget('tasks'); input.value = ''; box.classList.remove('open'); input.blur(); return; }
    if (e.target.closest('[data-note]')) { focusWidget('notes'); input.value = ''; box.classList.remove('open'); input.blur(); }
  });
  document.addEventListener('mousedown', (e) => { if (!wrap.contains(e.target)) box.classList.remove('open'); });
}

function initGridEvents() {
  const grid = document.querySelector('.grid');
  const patchLayout = (fn) => { store.set('layout', fn(structuredClone(store.get().layout))); renderGrid(); };

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-w]');
    if (!btn) return;
    const id = btn.closest('.widget').dataset.id;
    if (btn.dataset.w === 'pop') api.openWidget(id);
    if (btn.dataset.w === 'hide') patchLayout((l) => { l.find((x) => x.id === id).visible = false; return l; });
    if (btn.dataset.w === 'size') patchLayout((l) => {
      const it = l.find((x) => x.id === id);
      it.size = SIZES[(SIZES.indexOf(it.size) + 1) % SIZES.length];
      return l;
    });
  });
  document.querySelector('.addbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    if (b) patchLayout((l) => { l.find((x) => x.id === b.dataset.add).visible = true; return l; });
  });

  // Drag to reorder (edit mode only).
  let dragId = null;
  grid.addEventListener('mousedown', (e) => {
    const w = e.target.closest('.widget');
    grid.querySelectorAll('.widget').forEach((x) => { x.draggable = document.body.classList.contains('editing') && !!w && x === w && !!e.target.closest('.whead, .bare'); });
  });
  grid.addEventListener('dragstart', (e) => {
    const w = e.target.closest('.widget');
    if (!w || !w.draggable) return e.preventDefault();
    dragId = w.dataset.id; w.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  grid.addEventListener('dragover', (e) => {
    if (!dragId) return;
    e.preventDefault();
    const over = e.target.closest('.widget');
    grid.querySelectorAll('.drop').forEach((x) => x.classList.remove('drop'));
    if (over && over.dataset.id !== dragId) over.classList.add('drop');
  });
  grid.addEventListener('drop', (e) => {
    const over = e.target.closest('.widget');
    if (!dragId || !over || over.dataset.id === dragId) return;
    e.preventDefault();
    patchLayout((l) => {
      const from = l.findIndex((x) => x.id === dragId), to = l.findIndex((x) => x.id === over.dataset.id);
      l.splice(to, 0, l.splice(from, 1)[0]);
      return l;
    });
  });
  grid.addEventListener('dragend', () => {
    dragId = null;
    grid.querySelectorAll('.dragging,.drop').forEach((x) => x.classList.remove('dragging', 'drop'));
  });
}

/* ---------- pop-out widget window ---------- */
function bootSolo(id) {
  const def = widgets[id];
  if (!def) return;
  document.body.classList.add('solo');
  document.body.innerHTML = `
    <div class="solo-frame wid-${id}">
      <div class="solo-bar"><span>${def.title}</span>
        <div><button data-s="pin" title="Keep on top of other apps">${ICONS.pin}</button><button data-s="close" title="Close">${ICONS.close}</button></div></div>
      <div class="wbody"></div></div>`;
  const body = document.querySelector('.wbody');
  const inst = def.mount(body);
  instances.set(id, { def, inst, el: body });
  inst.update();
  document.querySelector('.solo-bar').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-s]');
    if (!b) return;
    if (b.dataset.s === 'close') api.closeWindow();
    else b.classList.toggle('on', await api.togglePin());
  });
}

/* ---------- boot ---------- */
(async function boot() {
  await store.init();
  try {
    const os = await api.osTheme();
    setOsDark(os?.dark);
  } catch { /* ignore */ }
  api.onOsTheme((os) => {
    setOsDark(os?.dark);
    if (store.get().settings.theme === 'system') applyTheme(store.get());
  });
  document.body.classList.add(api.platform === 'darwin' ? 'mac' : 'other');
  applyTheme(store.get());
  store.subscribe((key, silent) => {
    if (key === 'settings') {
      applyTheme(store.get());
      if (!soloName && store.get().weather && store.get().weather.units !== unitsKey(store.get().settings)) loadWeather(true);
    }
    if (key === 'layout' && !soloName && !silent) renderGrid();
    if ((key === 'weather' || key === 'dismissedAlerts') && !soloName) renderAlertBanner();
    if ((key === 'location' || key === 'savedLocations') && !soloName) renderLocationBar();
    refresh(key, silent);
  });
  api.onReminder((r) => {
    chime();
    toast(`<b>${esc(r.title)}</b><small>Reminder is due</small>`, 'alert');
  });
  api.onTaskDue((t) => {
    chime();
    toast(`<b>${esc(t.title)}</b><small>Task is due today</small>`, 'alert');
  });
  api.onUpdate((u) => {
    if (u?.status === 'ready') toast(`<b>Update ${esc(u.latest)} ready</b><small>Open Settings to restart and install</small>`, 'alert');
    if (u?.status === 'available') toast(`<b>Update ${esc(u.latest)} available</b><small>Downloading in the background…</small>`);
  });
  if (soloName) bootSolo(soloName); else bootMain();
})();
