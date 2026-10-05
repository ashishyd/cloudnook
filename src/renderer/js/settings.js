import * as store from './store.js';
import { THEMES, resolveTheme } from './theme.js';

const api = window.cloudnook;

const seg = (name, opts, cur) => `<div class="seg" data-seg="${name}">${opts.map(([v, l]) =>
  `<button type="button" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('')}</div>`;
const slider = (name, min, max, step, v, fmt) =>
  `<div class="slider"><input type="range" data-range="${name}" min="${min}" max="${max}" step="${step}" value="${v}" aria-label="${name}"><output>${fmt(v)}</output></div>`;
const toggle = (name, on) => `<label class="switch"><input type="checkbox" data-toggle="${name}" ${on ? 'checked' : ''} aria-label="${name}"><i></i></label>`;
const row = (label, hint, ctl) => `<div class="srow"><div><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</div>${ctl}</div>`;

function updateLabel(status) {
  if (!status) return 'Checking…';
  if (status.status === 'dev') return 'Dev builds skip auto-update';
  if (status.status === 'checking') return 'Checking for updates…';
  if (status.status === 'available') return `Update ${status.latest} available`;
  if (status.status === 'downloading') return `Downloading update… ${status.percent || 0}%`;
  if (status.status === 'ready') return `Update ${status.latest} ready — restart to install`;
  if (status.status === 'current') return 'You are up to date';
  if (status.status === 'error') return status.message || 'Update check failed';
  return 'Check for updates';
}

function trapFocus(modal, e) {
  if (e.key !== 'Tab') return;
  const focusable = [...modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.disabled && el.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

export function openPrivacyDialog({ required = false } = {}) {
  document.querySelector('.privacy-wrap')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap privacy-wrap';
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
    <header><h2 id="privacy-title">Privacy &amp; data</h2>${required ? '' : '<button class="x" data-close aria-label="Close">×</button>'}</header>
    <div class="mbody privacy-body">
      <p>Cloudnook keeps your tasks, reminders and notes <b>on this device</b>. When available, that file is encrypted with your OS keychain.</p>
      <ul>
        <li><b>Location</b> — prefers Wi‑Fi / GPS. If that is denied, an approximate city is inferred from your public IP via ipwho.is (often imprecise).</li>
        <li><b>Weather</b> — forecast and air quality from Open-Meteo; reverse place names from OpenStreetMap Nominatim.</li>
        <li><b>Radar</b> — map tiles from OpenStreetMap and precipitation from RainViewer.</li>
        <li><b>US alerts</b> — official notices from the National Weather Service when your location is in the US.</li>
      </ul>
      <p>No analytics account is required. Packaged builds may check GitHub Releases for updates.</p>
      <div class="privacy-actions">
        <button class="btn primary" data-accept>${required ? 'Agree &amp; continue' : 'Got it'}</button>
        <button class="btn" type="button" data-external="https://open-meteo.com/en/docs">Open-Meteo docs</button>
      </div>
    </div>
  </div>`;
  document.body.append(wrap);
  const modal = wrap.querySelector('.modal');
  const finish = () => {
    store.set('settings', { ...store.get().settings, privacyAccepted: true });
    wrap.classList.add('out');
    setTimeout(() => wrap.remove(), 160);
  };
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-accept]')) return finish();
    if (!required && (e.target === wrap || e.target.closest('[data-close]'))) {
      wrap.classList.add('out'); setTimeout(() => wrap.remove(), 160);
    }
    const ext = e.target.closest('[data-external]');
    if (ext) api.openExternal(ext.dataset.external);
  });
  wrap.addEventListener('keydown', (e) => trapFocus(modal, e));
  modal.querySelector('[data-accept]')?.focus();
}

export function openSettings() {
  document.querySelector('.modal-wrap:not(.privacy-wrap)')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-label="Settings"></div>';
  const modal = wrap.firstElementChild;
  document.body.append(wrap);

  let version = '';
  let update = null;
  let enc = { available: false, active: false };
  let offUpdate;
  const patch = (p) => store.set('settings', { ...store.get().settings, ...p });
  const close = () => {
    offUpdate?.();
    wrap.classList.add('out');
    setTimeout(() => wrap.remove(), 160);
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    trapFocus(modal, e);
  };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });

  function render() {
    const s = store.get().settings;
    const t = resolveTheme(s);
    const canInstall = update?.status === 'ready';
    const encLabel = enc.active ? 'On (OS keychain)' : enc.available ? 'Available — saves encrypted' : 'Unavailable on this system';
    modal.innerHTML = `
      <header><h2>Settings</h2><button class="x" data-close aria-label="Close">×</button></header>
      <div class="mbody">
        <section><h3>Theme</h3>
          <div class="themes" role="listbox" aria-label="Themes">${Object.entries(THEMES).map(([id, th]) => `
            <button type="button" class="theme ${s.theme === id ? 'on' : ''}" data-theme="${id}" title="${th.name}" aria-pressed="${s.theme === id}">
              <span class="${id === 'system' ? 'sys' : ''}" style="${id === 'system' ? '' : `background:linear-gradient(135deg,${th.bg[0]},${th.bg[1]} 55%,${th.bg[2]})`}"><i style="background:${id === 'system' ? (t.accent) : th.accent}"></i></span>${th.name}</button>`).join('')}
            <button type="button" class="theme ${s.theme === 'custom' ? 'on' : ''}" data-theme="custom" title="Your own colours" aria-pressed="${s.theme === 'custom'}">
              <span style="background:linear-gradient(135deg,${s.custom.bg[0]},${s.custom.bg[1]} 55%,${s.custom.bg[2]})"><i style="background:${s.custom.accent}"></i></span>Custom</button>
          </div>
          ${s.theme === 'system' ? '<p class="dim theme-hint">Follows your macOS / Windows light or dark appearance.</p>' : ''}
          ${s.theme === 'custom' ? `<div class="customrow">
            ${[0, 1, 2].map((i) => `<label>Background ${i + 1}<input type="color" data-cbg="${i}" value="${s.custom.bg[i]}"></label>`).join('')}
            <label>Mode ${seg('ctone', [['dark', 'Dark'], ['light', 'Light']], s.custom.tone)}</label></div>` : ''}
          ${row('Accent colour', 'Overrides the theme accent', `<div class="accentrow"><input type="color" data-accent value="${t.accent}" aria-label="Accent colour">${s.accent ? '<button class="link" data-reset-accent>Reset</button>' : ''}</div>`)}
        </section>
        <section><h3>Look &amp; feel</h3>
          ${row('Glass blur', '', slider('blur', 0, 40, 1, s.blur, (v) => `${v}px`))}
          ${row('Card opacity', '', slider('opacity', 0, 1, 0.05, s.opacity, (v) => `${Math.round(v * 100)}%`))}
          ${row('Corner radius', '', slider('radius', 6, 32, 1, s.radius, (v) => `${v}px`))}
          ${row('Text size', '', slider('fontScale', 0.85, 1.25, 0.05, s.fontScale, (v) => `${Math.round(v * 100)}%`))}
          ${row('Animations', 'Weather scene, icons and transitions', toggle('animations', s.animations))}
        </section>
        <section><h3>Units &amp; time</h3>
          ${row('Temperature', '', seg('temp', [['c', '°C'], ['f', '°F']], s.temp))}
          ${row('Wind speed', '', seg('wind', [['kmh', 'km/h'], ['mph', 'mph'], ['ms', 'm/s'], ['kn', 'kn']], s.wind))}
          ${row('Precipitation', '', seg('precip', [['mm', 'mm'], ['inch', 'in']], s.precip))}
          ${row('Clock', '', seg('clock24', [['false', '12-hour'], ['true', '24-hour']], s.clock24))}
        </section>
        <section><h3>Notifications</h3>
          ${row('Snooze length', 'Used by reminder snooze and notification actions', seg('snoozeMinutes', [['10', '10m'], ['15', '15m'], ['30', '30m'], ['60', '1h']], String(s.snoozeMinutes || 10)))}
        </section>
        <section><h3>Data</h3>
          ${row('Local encryption', encLabel, `<span class="dim">${enc.available ? 'safeStorage' : 'plaintext fallback'}</span>`)}
          ${row('Backup', 'Export tasks, notes, reminders and settings', '<button class="btn" data-export>Export…</button>')}
          ${row('Restore', 'Replace local data from a backup file', '<button class="btn" data-import>Import…</button>')}
          ${row('Reset layout', 'Restore the default widget arrangement', '<button class="btn" data-reset-layout>Reset</button>')}
        </section>
        <section><h3>System</h3>
          ${row('Launch at login', 'Keeps reminders firing after a restart', toggle('launchAtLogin', s.launchAtLogin))}
          ${row('Show / Hide shortcut', 'Global hotkey (default ⌘⇧Space)', '<code class="kbd">⌘⇧Space</code>')}
          ${row('Updates', updateLabel(update), canInstall
            ? '<button class="btn primary" data-install-update>Restart &amp; install</button>'
            : '<button class="btn" data-check-update>Check now</button>')}
          ${row('Privacy', 'How location and weather data are used', '<button class="btn" data-privacy>View</button>')}
        </section>
        <footer class="about"><b>Cloudnook</b> · Your day, under one sky.<br>
          <small>Version ${version || '…'} · Weather by Open-Meteo.com · Made by Kitium AI</small></footer>
      </div>`;
  }

  modal.addEventListener('click', async (e) => {
    const s = store.get().settings;
    if (e.target.closest('[data-close]')) return close();
    const th = e.target.closest('[data-theme]');
    if (th) { patch({ theme: th.dataset.theme, accent: null }); return render(); }
    const sg = e.target.closest('[data-seg] [data-v]');
    if (sg) {
      const name = sg.parentElement.dataset.seg, v = sg.dataset.v;
      if (name === 'ctone') patch({ custom: { ...s.custom, tone: v } });
      else if (name === 'snoozeMinutes') patch({ snoozeMinutes: Number(v) });
      else patch({ [name]: name === 'clock24' ? v === 'true' : v });
      return render();
    }
    if (e.target.closest('[data-reset-accent]')) { patch({ accent: null }); return render(); }
    if (e.target.closest('[data-reset-layout]')) { store.set('layout', structuredClone(store.DEFAULTS.layout)); return; }
    if (e.target.closest('[data-privacy]')) { openPrivacyDialog(); return; }
    if (e.target.closest('[data-export]')) {
      const res = await api.exportBackup();
      if (res?.ok) window.dispatchEvent(new CustomEvent('cn:toast', { detail: { msg: 'Backup exported.', kind: '' } }));
      else if (res && !res.canceled) window.dispatchEvent(new CustomEvent('cn:toast', { detail: { msg: res.error || 'Export failed.', kind: 'warn' } }));
      return;
    }
    if (e.target.closest('[data-import]')) {
      if (!window.confirm('Importing a backup replaces your current tasks, notes, reminders and settings. Continue?')) return;
      const res = await api.importBackup();
      if (res?.ok) {
        window.dispatchEvent(new CustomEvent('cn:toast', { detail: { msg: 'Backup imported. Refreshing weather…', kind: '' } }));
        close();
        window.dispatchEvent(new Event('cn:reload-weather'));
      } else if (res && !res.canceled) {
        window.dispatchEvent(new CustomEvent('cn:toast', { detail: { msg: res.error || 'Import failed.', kind: 'warn' } }));
      }
      return;
    }
    if (e.target.closest('[data-check-update]')) {
      update = await api.checkUpdate();
      render();
      return;
    }
    if (e.target.closest('[data-install-update]')) {
      await api.installUpdate();
    }
  });
  modal.addEventListener('input', (e) => {
    const s = store.get().settings, el = e.target;
    if (el.dataset.range) {
      const v = parseFloat(el.value);
      el.nextElementSibling.textContent = el.dataset.range === 'opacity' || el.dataset.range === 'fontScale' ? `${Math.round(v * 100)}%` : `${v}px`;
      patch({ [el.dataset.range]: v });
    } else if (el.dataset.accent !== undefined) patch({ accent: el.value });
    else if (el.dataset.cbg !== undefined) {
      const bg = [...s.custom.bg]; bg[+el.dataset.cbg] = el.value;
      patch({ theme: 'custom', custom: { ...s.custom, bg } });
    }
  });
  modal.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.toggle) {
      patch({ [el.dataset.toggle]: el.checked });
      if (el.dataset.toggle === 'launchAtLogin') api.setLogin(el.checked);
    }
    if (el.dataset.cbg !== undefined || el.dataset.accent !== undefined) render();
  });

  offUpdate = api.onUpdate((d) => { update = d; if (document.body.contains(modal)) render(); });
  Promise.all([api.version(), api.updateStatus(), api.encryption()]).then(([v, u, e]) => {
    version = v;
    update = u;
    enc = e || enc;
    render();
    modal.querySelector('[data-close]')?.focus();
  });
  render();
}
