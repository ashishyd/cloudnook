import * as store from '../store.js';
import { icon, describe } from '../icons.js';
import { dayLabel, dateLabel, deg, round, UNIT_SYM } from '../util.js';

const DROP = '<svg class="mini" viewBox="0 0 16 16"><path d="M8 1.5C8 1.5 3 7 3 10a5 5 0 0 0 10 0c0-3-5-8.5-5-8.5z"/></svg>';

export default {
  id: 'daily', title: '14-day forecast', keys: ['weather', 'settings'],
  mount(root) {
    root.innerHTML = '<div class="dlist"></div>';
    const list = root.querySelector('.dlist');

    function draw() {
      const { weather: w, settings: s } = store.get();
      if (!w) { list.innerHTML = '<div class="empty">Choose a location to see the 14-day outlook.</div>'; return; }
      const gmin = Math.min(...w.daily.map((d) => d.min));
      const gmax = Math.max(...w.daily.map((d) => d.max));
      const span = gmax - gmin || 1;
      list.innerHTML = w.daily.map((d, i) => `
        <button class="drow" data-i="${i}" style="--i:${i}">
          <span class="dn"><b>${dayLabel(d.date, i)}</b><small>${dateLabel(d.date)}</small></span>
          ${icon(d.code, true, 'md')}
          <span class="dcond">${describe(d.code)}</span>
          <span class="dpop">${DROP}${d.pop}%</span>
          <span class="dwind">${round(d.wind)}<small>${UNIT_SYM.wind[s.wind]}</small></span>
          <span class="dlo">${deg(d.min)}</span>
          <span class="dbar"><i style="left:${((d.min - gmin) / span) * 100}%;width:${Math.max(6, ((d.max - d.min) / span) * 100)}%"></i></span>
          <span class="dhi">${deg(d.max)}</span>
        </button>`).join('');
    }
    list.addEventListener('click', (e) => {
      const r = e.target.closest('[data-i]');
      if (r) window.dispatchEvent(new CustomEvent('cn:day', { detail: +r.dataset.i }));
    });
    return { update: draw };
  },
};
