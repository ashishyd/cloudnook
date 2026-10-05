import * as store from '../store.js';
import { parseLocal, fmtTimeStr, deg, round, compass, uvLabel, aqiLabel, UNIT_SYM } from '../util.js';

export default {
  id: 'details', title: 'Conditions', keys: ['weather', 'settings'],
  mount(root) {
    root.innerHTML = '<div class="tiles"></div>';
    const box = root.querySelector('.tiles');

    function draw() {
      const { weather: w, settings: s } = store.get();
      if (!w) { box.innerHTML = '<div class="empty">Conditions appear once a location is set.</div>'; return; }
      const c = w.current, d = w.daily[0];
      const hr = w.hourly.find((h) => h.t.slice(0, 13) === c.time.slice(0, 13)) || w.hourly[0];
      const visKm = (hr.vis ?? 0) / 1000;
      const visTxt = s.wind === 'mph' ? `${(visKm * 0.621).toFixed(1)} mi` : `${visKm.toFixed(visKm > 20 ? 0 : 1)} km`;
      const uv = hr.uv ?? d.uv;
      const ring = 2 * Math.PI * 22;
      const aqi = w.aqi?.us != null ? aqiLabel(w.aqi.us) : null;

      const now = parseLocal(c.time), rise = parseLocal(d.sunrise), set = parseLocal(d.sunset);
      const prog = Math.max(0, Math.min(1, (now - rise) / (set - rise)));
      const up = now >= rise && now <= set;
      const th = Math.PI * prog;
      const sx = 100 - 80 * Math.cos(th), sy = 84 - 80 * Math.sin(th);

      box.innerHTML = `
        <div class="tile"><label>Feels like</label><div class="tv">${deg(c.feels)}</div>
          <p>${c.feels < c.temp - 1 ? 'Wind makes it feel cooler.' : c.feels > c.temp + 1 ? 'Humidity makes it feel warmer.' : 'Close to the actual temperature.'}</p></div>
        <div class="tile"><label>Humidity</label>
          <div class="ringrow"><svg viewBox="0 0 56 56" width="56"><circle cx="28" cy="28" r="22" class="rtrack"/><circle cx="28" cy="28" r="22" class="rfill" style="stroke-dasharray:${ring};stroke-dashoffset:${ring * (1 - c.hum / 100)}"/></svg>
          <div class="tv">${round(c.hum)}%</div></div></div>
        <div class="tile"><label>Wind</label>
          <div class="windrow"><div class="compass"><span class="n">N</span><div class="needle" style="transform:rotate(${(c.dir + 180) % 360}deg)"></div></div>
          <div><div class="tv">${round(c.wind)}<small>${UNIT_SYM.wind[s.wind]}</small></div><p>${compass(c.dir)} · gusts ${round(c.gust)}</p></div></div></div>
        <div class="tile"><label>UV index</label><div class="tv">${round(uv)} <small>${uvLabel(uv)}</small></div>
          <div class="uvbar"><i style="left:${Math.min(100, (uv / 12) * 100)}%"></i></div></div>
        <div class="tile"><label>Pressure</label><div class="tv">${round(c.pressure)}<small>hPa</small></div>
          <p>${c.pressure < 1009 ? 'Low — unsettled' : c.pressure > 1022 ? 'High — settled' : 'Steady'}</p></div>
        <div class="tile"><label>Visibility</label><div class="tv">${visTxt}</div><p>Cloud cover ${round(c.cloud)}%</p></div>
        <div class="tile"><label>Precipitation</label><div class="tv">${c.precip}<small>${UNIT_SYM.precip[s.precip]}</small></div>
          <p>Today ${d.precip} ${UNIT_SYM.precip[s.precip]} · ${d.pop}% chance</p></div>
        <div class="tile"><label>Air quality</label>${aqi
          ? `<div class="tv" style="color:${aqi[1]}">${round(w.aqi.us)}</div><p>${aqi[0]} · PM2.5 ${round(w.aqi.pm25)}</p>`
          : '<div class="tv">–</div><p>Unavailable</p>'}</div>
        <div class="tile wide sunarc"><label>Sun</label>
          <svg viewBox="0 0 200 100" class="arc"><path d="M20 84 A80 80 0 0 1 180 84" class="atrack"/>
            <path d="M20 84 A80 80 0 0 1 180 84" class="afill" pathLength="1" style="stroke-dasharray:${up ? prog : 0} 1"/>
            <line x1="10" y1="84" x2="190" y2="84" class="horizon"/>
            ${up ? `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="7" class="sunpt"/>` : ''}</svg>
          <div class="sunrow"><span>↑ ${fmtTimeStr(d.sunrise, s.clock24)}</span><span>${up ? 'Daytime' : 'Night'}</span><span>↓ ${fmtTimeStr(d.sunset, s.clock24)}</span></div></div>`;
    }
    return { update: draw };
  },
};
