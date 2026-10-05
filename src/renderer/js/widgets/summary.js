import * as store from '../store.js';
import { icon, kindOf, describe } from '../icons.js';
import { SKY } from '../scene.js';
import { esc, deg } from '../util.js';

// Compact desktop summary (pop-out only; not part of the dashboard grid).
export default {
  id: 'summary', title: 'Weather', bare: true, keys: ['weather', 'location', 'settings'],
  mount(root) {
    const frame = () => root.closest('.solo-frame');
    function draw() {
      const { weather: w, location: loc } = store.get();
      if (!w || !loc) {
        root.innerHTML = '<div class="sum"><div class="sum-loc">Cloudnook</div><div class="sum-cond">Open the app to choose a location</div></div>';
        return;
      }
      const c = w.current, d = w.daily[0];
      const [top, bot] = SKY[kindOf(c.code)][c.day ? 'day' : 'night'];
      frame()?.style.setProperty('--sum-bg', `linear-gradient(180deg, ${top}, ${bot})`);
      root.innerHTML = `<div class="sum">
        <div class="sum-loc">${esc(loc.name)}<svg viewBox="0 0 16 16"><path d="M14 2L2 7.5l5 1.5 1.5 5z"/></svg></div>
        <div class="sum-temp">${deg(c.temp)}</div>
        <div class="sum-foot">${icon(c.code, c.day, 'sm')}<div class="sum-cond">${describe(c.code)}</div>
        <div class="sum-hl">H:${deg(d.max)} L:${deg(d.min)}</div></div></div>`;
    }
    return { update: draw };
  },
};
