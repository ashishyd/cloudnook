import * as store from '../store.js';
import { esc } from '../util.js';

const Z = 6;
const api = window.cloudnook;

function latLonToTile(lat, lon, z) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

export default {
  id: 'radar', title: 'Radar', keys: ['location', 'settings'],
  mount(root) {
    root.innerHTML = `
      <div class="radar-wrap">
        <div class="radar-map" role="img" aria-label="Precipitation radar map"></div>
        <div class="radar-meta"><span class="radar-status">Loading radar…</span>
          <button class="link" data-refresh type="button">Refresh</button></div>
        <div class="radar-attr"><small>Map © OpenStreetMap · Radar © RainViewer</small></div>
      </div>`;
    const map = root.querySelector('.radar-map');
    const status = root.querySelector('.radar-status');
    let timer;

    async function draw() {
      const loc = store.get().location;
      if (!loc) {
        map.innerHTML = '<div class="empty">Choose a location to see precipitation radar.</div>';
        status.textContent = 'No location';
        return;
      }
      status.textContent = 'Updating…';
      try {
        const data = await api.radarMaps();
        const frames = [...(data.radar?.past || []), ...(data.radar?.nowcast || [])];
        const frame = frames[frames.length - 1];
        if (!frame) throw new Error('No radar frames');
        const { x: cx, y: cy } = latLonToTile(loc.lat, loc.lon, Z);
        const host = data.host.replace(/\/$/, '');
        const tiles = [];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const x = cx + dx;
            const y = cy + dy;
            const base = `https://tile.openstreetmap.org/${Z}/${x}/${y}.png`;
            const radar = `${host}${frame.path}/256/${Z}/${x}/${y}/2/1_1.png`;
            tiles.push(`<div class="rtile"><img class="base" alt="" src="${base}"><img class="rain" alt="" src="${radar}"></div>`);
          }
        }
        map.innerHTML = `<div class="radar-grid">${tiles.join('')}</div>
          <div class="radar-pin" title="${esc(loc.name)}"></div>`;
        const when = new Date(frame.time * 1000);
        status.textContent = `${loc.name} · ${when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
      } catch (err) {
        map.innerHTML = `<div class="empty">Radar unavailable — ${esc(err.message)}</div>`;
        status.textContent = 'Unavailable';
      }
    }

    root.querySelector('[data-refresh]').onclick = () => draw();
    draw();
    timer = setInterval(draw, 5 * 60000);
    return {
      update: draw,
      destroy() { clearInterval(timer); },
    };
  },
};
