export const SKY = {
  clear:   { day: ['#2f7fd6', '#8ccaff'], night: ['#060a22', '#1d2a5c'] },
  partly:  { day: ['#4a8bd0', '#a7d2f2'], night: ['#0a1030', '#26345f'] },
  cloudy:  { day: ['#566f89', '#9fb3c5'], night: ['#10151f', '#2b3547'] },
  fog:     { day: ['#7e8d9b', '#c8d0d6'], night: ['#151a22', '#38424f'] },
  drizzle: { day: ['#4c6177', '#8a9cae'], night: ['#0c111b', '#25303f'] },
  rain:    { day: ['#3b4d62', '#76889c'], night: ['#090d16', '#202a38'] },
  snow:    { day: ['#7a8fa7', '#d6e2ef'], night: ['#1a2230', '#4a5a70'] },
  thunder: { day: ['#1c1a2e', '#3f3a5e'], night: ['#0a0912', '#25213b'] },
};

const rnd = (a, b) => a + Math.random() * (b - a);

export class Scene {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.kind = 'clear'; this.day = true; this.wind = 0; this.animate = true;
    this.t = 0; this.last = 0; this.flash = 0; this.bolt = null; this.nextBolt = 3;
    this.clouds = []; this.drops = []; this.flakes = []; this.stars = [];
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement);
    this.resize();
    requestAnimationFrame((ts) => this.loop(ts));
  }

  set(kind, isDay, wind = 0, animate = true) {
    this.kind = kind; this.day = !!isDay; this.wind = wind; this.animate = animate;
    this.seed();
    if (!animate) this.draw(0);
  }

  resize() {
    const r = this.c.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.c.width = this.w * dpr; this.c.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.seed();
  }

  seed() {
    const { w, h, kind } = this;
    const heavy = ['cloudy', 'rain', 'thunder', 'drizzle'].includes(kind);
    const nCloud = { clear: 1, partly: 4, cloudy: 8, fog: 3, drizzle: 7, rain: 8, snow: 6, thunder: 9 }[kind];
    this.clouds = [...Array(nCloud)].map(() => ({
      x: rnd(-0.1, 1.1) * w, y: rnd(0.05, heavy ? 0.45 : 0.55) * h,
      s: rnd(0.7, 1.5) * Math.min(w, 520) / 520 * 34, v: rnd(4, 14),
      a: heavy ? rnd(0.55, 0.9) : rnd(0.28, 0.6),
    }));
    const nDrop = { drizzle: 70, rain: 160, thunder: 220 }[kind] || 0;
    this.drops = [...Array(nDrop)].map(() => ({
      x: rnd(0, w * 1.2), y: rnd(0, h), l: rnd(8, 18), v: rnd(420, 760) * (kind === 'drizzle' ? 0.6 : 1),
    }));
    this.flakes = [...Array(kind === 'snow' ? 120 : 0)].map(() => ({
      x: rnd(0, w), y: rnd(0, h), r: rnd(1, 3.2), v: rnd(20, 60), p: rnd(0, 6.28),
    }));
    const showStars = !this.day && ['clear', 'partly'].includes(kind);
    this.stars = [...Array(showStars ? 70 : 0)].map(() => ({
      x: rnd(0, w), y: rnd(0, h * 0.7), r: rnd(0.4, 1.4), p: rnd(0, 6.28),
    }));
  }

  loop(ts) {
    const dt = Math.min(0.05, (ts - this.last) / 1000 || 0);
    this.last = ts;
    if (this.c.isConnected && !document.hidden && this.animate) this.draw(dt);
    requestAnimationFrame((t) => this.loop(t));
  }

  draw(dt) {
    const { ctx, w, h, kind, day } = this;
    this.t += dt;
    const [top, bot] = SKY[kind][day ? 'day' : 'night'];
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    for (const s of this.stars) {
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(this.t * 1.2 + s.p));
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (['clear', 'partly'].includes(kind)) this.drawBody();

    const tint = day ? '255,255,255' : '150,165,195';
    for (const c of this.clouds) {
      c.x += c.v * dt;
      if (c.x - c.s * 2.4 > w) c.x = -c.s * 2.4;
      ctx.fillStyle = `rgba(${kind === 'thunder' ? '90,90,120' : tint},${c.a})`;
      ctx.beginPath();
      for (const [dx, dy, r] of [[0, 0, 1], [1.1, -0.35, 1.25], [2.2, 0, 1.05], [1.1, 0.35, 1.2], [0.4, 0.3, 0.8], [1.9, 0.3, 0.85]]) {
        const x = c.x + dx * c.s, y = c.y + dy * c.s, rr = r * c.s * 0.8;
        ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, 6.283);
      }
      ctx.fill();
    }

    if (kind === 'fog') {
      for (let i = 0; i < 4; i++) {
        const y = h * (0.35 + i * 0.16);
        const x = ((this.t * (8 + i * 3) + i * 120) % (w * 1.5)) - w * 0.25;
        const fg = ctx.createLinearGradient(x - w, 0, x + w, 0);
        fg.addColorStop(0, 'rgba(255,255,255,0)'); fg.addColorStop(0.5, 'rgba(255,255,255,.28)'); fg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = fg; ctx.fillRect(0, y, w, h * 0.12);
      }
    }

    const slant = Math.max(-0.5, Math.min(0.5, this.wind / 50)) - 0.12;
    if (this.drops.length) {
      ctx.strokeStyle = day ? 'rgba(210,230,255,.55)' : 'rgba(170,200,240,.5)';
      ctx.lineWidth = 1.2; ctx.beginPath();
      for (const d of this.drops) {
        d.y += d.v * dt; d.x += d.v * dt * slant * -1;
        if (d.y > h) { d.y = -d.l; d.x = rnd(0, w * 1.2); }
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.l * slant, d.y - d.l);
      }
      ctx.stroke();
    }
    if (this.flakes.length) {
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      for (const f of this.flakes) {
        f.y += f.v * dt; f.x += Math.sin(this.t + f.p) * 18 * dt + this.wind * 0.2 * dt;
        if (f.y > h) { f.y = -4; f.x = rnd(0, w); }
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
      }
    }
    if (kind === 'thunder') this.drawLightning(dt);
  }

  drawBody() {
    const { ctx, w, h } = this;
    const x = w * 0.8, y = h * 0.3, r = Math.min(w, h) * 0.1;
    const glow = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 4.5);
    glow.addColorStop(0, this.day ? 'rgba(255,214,102,.55)' : 'rgba(200,215,255,.28)');
    glow.addColorStop(1, 'rgba(255,214,102,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    if (this.day) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(this.t * 0.15);
      ctx.strokeStyle = 'rgba(255,225,130,.55)'; ctx.lineWidth = r * 0.14; ctx.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        ctx.rotate(Math.PI / 6);
        const len = r * (i % 2 ? 0.45 : 0.7) * (1 + 0.1 * Math.sin(this.t * 2 + i));
        ctx.beginPath(); ctx.moveTo(r * 1.35, 0); ctx.lineTo(r * 1.35 + len, 0); ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = '#ffd666';
    } else ctx.fillStyle = '#f3eec8';
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
    if (!this.day) {
      ctx.fillStyle = 'rgba(160,160,130,.35)';
      for (const [dx, dy, rr] of [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.3], [-0.1, 0.4, 0.15]]) {
        ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, rr * r, 0, 6.283); ctx.fill();
      }
    }
  }

  drawLightning(dt) {
    const { ctx, w, h } = this;
    this.nextBolt -= dt;
    if (this.nextBolt <= 0) {
      this.flash = 1; this.nextBolt = rnd(2.5, 7);
      let x = rnd(0.2, 0.8) * w, y = 0; this.bolt = [[x, y]];
      while (y < h * 0.75) { x += rnd(-26, 26); y += rnd(18, 36); this.bolt.push([x, y]); }
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.35})`; ctx.fillRect(0, 0, w, h);
      if (this.bolt) {
        ctx.strokeStyle = `rgba(255,255,230,${this.flash})`; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
        ctx.shadowColor = '#fff6a8'; ctx.shadowBlur = 18;
        ctx.beginPath(); this.bolt.forEach(([bx, by], i) => (i ? ctx.lineTo(bx, by) : ctx.moveTo(bx, by))); ctx.stroke();
        ctx.shadowBlur = 0;
      }
      this.flash = Math.max(0, this.flash - dt * 2.8);
    }
  }
}
