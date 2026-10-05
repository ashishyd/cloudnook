import * as store from '../store.js';
import { icon, describe } from '../icons.js';
import {
  fmtHourStr, fmtTimeStr, dayLabel, dateLabel, deg, round, UNIT_SYM,
} from '../util.js';

const TW = 68, CH = 128, PAD_T = 34, PAD_B = 14;
let sel = 0;

const DROP = '<svg class="mini" viewBox="0 0 16 16"><path d="M8 1.5C8 1.5 3 7 3 10a5 5 0 0 0 10 0c0-3-5-8.5-5-8.5z"/></svg>';

export default {
  id: 'hourly', title: 'Hour by hour', keys: ['weather', 'settings'],
  mount(root) {
    root.innerHTML = '<div class="chips"></div><div class="daysum"></div><div class="hscroll"><div class="hinner"></div></div>';
    const chips = root.querySelector('.chips');
    const sum = root.querySelector('.daysum');
    const scroll = root.querySelector('.hscroll');
    const inner = root.querySelector('.hinner');

    function draw(jump) {
      const { weather: w, settings: s } = store.get();
      if (!w) { chips.innerHTML = sum.innerHTML = inner.innerHTML = ''; inner.innerHTML = '<div class="empty">Choose a location to see the hourly forecast.</div>'; return; }
      sel = Math.min(sel, w.daily.length - 1);
      const tu = UNIT_SYM.temp[s.temp];
      chips.innerHTML = w.daily.map((d, i) => `
        <button class="chip ${i === sel ? 'on' : ''}" data-i="${i}">
          <span class="cd">${dayLabel(d.date, i)}</span><span class="cn">${dateLabel(d.date)}</span>
          ${icon(d.code, true, 'sm')}<span class="ct">${deg(d.max)}</span></button>`).join('');

      const d = w.daily[sel];
      const hrs = w.hourly.slice(sel * 24, sel * 24 + 24);
      const hm = (sec) => `${Math.floor(sec / 3600)}h ${Math.round((sec % 3600) / 60)}m`;
      sum.innerHTML = `
        <div class="ds-title">${describe(d.code)} <span class="dim">· ${deg(d.min)} / ${deg(d.max)} ${tu.slice(1)}</span></div>
        <div class="ds-grid">
          <div><label>Sunrise</label>${fmtTimeStr(d.sunrise, s.clock24)}</div>
          <div><label>Sunset</label>${fmtTimeStr(d.sunset, s.clock24)}</div>
          <div><label>Daylight</label>${hm(d.daylight)}</div>
          <div><label>Sunshine</label>${hm(d.sunshine)}</div>
          <div><label>UV max</label>${round(d.uv)}</div>
          <div><label>Rain</label>${d.precip} ${UNIT_SYM.precip[s.precip]} · ${d.pop}%</div>
          <div><label>Wind max</label>${round(d.wind)} ${UNIT_SYM.wind[s.wind]}</div>
          <div><label>Gusts</label>${round(d.gust)} ${UNIT_SYM.wind[s.wind]}</div>
        </div>`;

      const temps = hrs.map((h) => h.temp);
      const lo = Math.min(...temps), hi = Math.max(...temps), span = hi - lo || 1;
      const X = (i) => i * TW + TW / 2;
      const Y = (t) => PAD_T + (1 - (t - lo) / span) * (CH - PAD_T - PAD_B);
      let path = `M${X(0)} ${Y(temps[0])}`;
      for (let i = 1; i < temps.length; i++) {
        const mx = (X(i - 1) + X(i)) / 2;
        path += ` C${mx} ${Y(temps[i - 1])} ${mx} ${Y(temps[i])} ${X(i)} ${Y(temps[i])}`;
      }
      const area = `${path} L${X(23)} ${CH} L${X(0)} ${CH} Z`;
      const nowIdx = sel === 0 ? +w.current.time.slice(11, 13) : -1;
      const svg = `<svg class="hchart" width="${24 * TW}" height="${CH}" viewBox="0 0 ${24 * TW} ${CH}">
        <defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".45"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
        <path d="${area}" fill="url(#hg)" class="harea"/>
        <path d="${path}" class="hline" pathLength="1"/>
        ${temps.map((t, i) => `<circle cx="${X(i)}" cy="${Y(t)}" r="${i === nowIdx ? 5 : 3}" class="hdot ${i === nowIdx ? 'now' : ''}"/>
          <text x="${X(i)}" y="${Y(t) - 11}" class="htxt">${deg(t)}</text>`).join('')}
      </svg>`;
      const tiles = hrs.map((h, i) => `
        <div class="htile ${i === nowIdx ? 'now' : ''} ${h.day ? '' : 'night'}" title="${describe(h.code)} · feels ${deg(h.feels)}">
          <div class="ht">${i === nowIdx ? 'Now' : fmtHourStr(h.t, s.clock24)}</div>
          ${icon(h.code, h.day, 'md')}
          <div class="hp">${DROP}${h.pop}%</div>
          <div class="pbar"><i style="height:${Math.max(2, h.pop)}%"></i></div>
          <div class="hw">${round(h.wind)}<small>${UNIT_SYM.wind[s.wind]}</small></div>
          <div class="hh">${round(h.hum)}%</div>
        </div>`).join('');
      inner.style.width = `${24 * TW}px`;
      inner.innerHTML = `${svg}<div class="htiles">${tiles}</div>`;
      if (jump) {
        const target = sel === 0 ? Math.max(0, nowIdx) : 6;
        scroll.scrollTo({ left: Math.max(0, target * TW - 60), behavior: 'smooth' });
      }
    }

    chips.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (b) { sel = +b.dataset.i; draw(true); }
    });
    window.addEventListener('cn:day', (e) => { sel = e.detail; draw(true); });
    // Convert vertical wheel to horizontal scroll for the hourly strip.
    scroll.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { scroll.scrollLeft += e.deltaY; e.preventDefault(); }
    }, { passive: false });
    return { update: () => { draw(true); } };
  },
};
