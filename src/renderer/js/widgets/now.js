import * as store from '../store.js';
import { icon, kindOf, describe } from '../icons.js';
import { Scene } from '../scene.js';
import { esc, deg, round, fmtClock, fmtTimeStr, UNIT_SYM } from '../util.js';

export default {
  id: 'now', title: 'Now', bare: true, keys: ['weather', 'settings', 'location'],
  mount(root) {
    root.innerHTML = '<canvas class="scene"></canvas><div class="scrim"></div><div class="now-body"></div>';
    const scene = new Scene(root.querySelector('canvas'));
    const body = root.querySelector('.now-body');
    let clockEl = null;

    function tick() {
      const w = store.get().weather;
      if (!clockEl || !w) return;
      const d = new Date();
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: w.tz, hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
      }).formatToParts(d);
      const h = +parts.find((p) => p.type === 'hour').value % 24, m = +parts.find((p) => p.type === 'minute').value;
      const date = d.toLocaleDateString(undefined, { timeZone: w.tz, weekday: 'long', month: 'long', day: 'numeric' });
      clockEl.textContent = `${date} · ${fmtClock(h, m, store.get().settings.clock24)}`;
    }

    function draw() {
      const { weather: w, location: loc, settings: s } = store.get();
      if (!loc || !w) {
        scene.set('partly', true, 5, s.animations);
        body.innerHTML = `<div class="now-empty">
          <div class="big-ico">${icon(2, true)}</div>
          <h2>Find your sky</h2>
          <p>Detecting your location… or search for a city to see live weather and a 14-day outlook.</p>
          <button class="btn primary" data-act="focus-search">Choose a location</button></div>`;
        body.querySelector('[data-act]').onclick = () => window.dispatchEvent(new Event('cn:focus-search'));
        clockEl = null;
        return;
      }
      const c = w.current, today = w.daily[0];
      scene.set(kindOf(c.code), c.day, c.wind, s.animations);
      const t = UNIT_SYM.temp[s.temp];
      body.innerHTML = `
        <div class="now-top">
          <div><div class="now-loc">${esc(loc.name)}<small>${esc([loc.region, loc.country].filter(Boolean).join(', '))}</small></div>
          <div class="now-clock"></div></div>
        </div>
        <div class="now-main">
          <div class="now-temp"><span class="num">${round(c.temp)}</span><span class="unit">${t}</span></div>
          <div class="now-ico">${icon(c.code, c.day, 'xl')}</div>
        </div>
        <div class="now-cond">${describe(c.code)}</div>
        <div class="now-meta">
          <span>H ${deg(today.max)} · L ${deg(today.min)}</span>
          <span>Feels ${deg(c.feels)}</span>
          <span>${round(c.wind)} ${UNIT_SYM.wind[s.wind]}</span>
          <span>Rain ${today.pop}%</span>
          <span class="dim">Updated ${fmtClock(new Date(w.fetchedAt).getHours(), new Date(w.fetchedAt).getMinutes(), s.clock24)}</span>
        </div>`;
      clockEl = body.querySelector('.now-clock');
      tick();
    }
    setInterval(tick, 15000);
    return { update: draw };
  },
};
