'use strict';
// ---------- vykreslení ----------
// Zatím jednoduché tvary; kreslená grafika přijde později (viz Pořadí prací v CLAUDE.md).
const R = {
  cv: null, ctx: null, W: 0, H: 0, dpr: 1, s: 1, // s = CSS pixely na metr
  cam: { x: VIEW.minX, tx: VIEW.minX, st: '' },
  sky: null,

  init(cv) {
    this.cv = cv;
    this.ctx = cv.getContext('2d');
    this.resize();
    addEventListener('resize', () => this.resize());
  },

  resize() {
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.W = this.cv.clientWidth; this.H = this.cv.clientHeight;
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
    this.s = this.H / VIEW.h;
    const g = this.ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, '#8ecbe8'); g.addColorStop(1, '#e3f3f7');
    this.sky = g;
  },

  // ---------- kamera ----------
  viewW() { return this.W / this.s; },
  camMax(g) { return Math.max(VIEW.minX, g.lvl.w - this.viewW()); },
  toWorld(px, py) { return { x: px / this.s + this.cam.x, y: (this.H - py) / this.s - VIEW.ground }; },
  // začátek úrovně: ukázat stavbu a přejet k prutu
  reset(g) { this.cam.x = this.camMax(g); this.cam.tx = VIEW.minX; this.cam.st = ''; },
  pan(dpx, g) { this.cam.tx = clamp(this.cam.tx - dpx / this.s, VIEW.minX, this.camMax(g)); },

  camera(g, dt) {
    const c = this.cam;
    if (g.state === 'fly' && g.fish) c.tx = g.fish.x - this.viewW() * 0.45;
    else if (g.aiming || g.state === 'aim' && c.st !== 'aim') c.tx = VIEW.minX; // nová ryba: zpět k prutu
    c.st = g.state;
    c.tx = clamp(c.tx, VIEW.minX, this.camMax(g));
    c.x += (c.tx - c.x) * Math.min(1, dt * 5);
  },

  // ---------- snímek ----------
  draw(g, dt) {
    const c = this.ctx, s = this.s * this.dpr;
    this.camera(g, dt);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = this.sky;
    c.fillRect(0, 0, this.W, this.H);
    this.hills(c);
    // dál se kreslí v metrech, y nahoru
    c.setTransform(s, 0, 0, -s, -this.cam.x * s, (this.H - VIEW.ground * this.s) * this.dpr);
    c.lineJoin = c.lineCap = 'round';
    c.fillStyle = '#6fae5a'; c.fillRect(this.cam.x - 1, -0.35, this.viewW() + 2, 0.35);
    c.fillStyle = '#7a5a3c'; c.fillRect(this.cam.x - 1, -VIEW.ground - 1, this.viewW() + 2, VIEW.ground + 0.65);
    this.dots(c, g.last, 'rgba(255,255,255,.55)');
    this.dots(c, g.trail, 'rgba(255,255,255,.9)');
    this.sling(c, g);
    const al = g.alpha;
    for (const e of g.P.ents) {
      const x = lerp(e.px, e.x, al), y = lerp(e.py, e.y, al), a = lerp(e.pa, e.a, al);
      if (e.kind === 'block') this.block(c, e, x, y, a);
      else if (e.kind === 'bear') this.bear(c, e, x, y, a);
      else this.fish(c, e.type, x, y, e.hit ? a : Math.atan2(e.vy, e.vx));
    }
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },

  hills(c) {
    const y = this.H - VIEW.ground * this.s, o = -this.cam.x * this.s * 0.3;
    c.fillStyle = '#a9d3b0';
    for (let i = -1; i < 6; i++) {
      c.beginPath();
      c.ellipse(o + i * this.H * 0.9, y, this.H * 0.6, this.H * (0.16 + (i & 1) * 0.07), 0, Math.PI, 0);
      c.fill();
    }
  },

  dots(c, t, col) {
    c.fillStyle = col;
    for (let i = 0; i < t.length; i += 2) { c.beginPath(); c.arc(t[i], t[i + 1], 0.07, 0, 7); c.fill(); }
  },

  sling(c, g) {
    // prut
    c.strokeStyle = '#5a3d22'; c.lineWidth = 0.14;
    c.beginPath(); c.moveTo(SLING.x + 0.9, 0); c.quadraticCurveTo(SLING.x + 0.7, SLING.y * 0.8, SLING.x, SLING.y); c.stroke();
    // ryby čekající ve frontě
    const q = g.queue, onSling = g.state === 'aim';
    for (let i = onSling ? 1 : 0; i < q.length; i++)
      this.fish(c, q[i], SLING.x - 1.1 - (i - (onSling ? 1 : 0)) * 0.8, FISH[q[i]].r * 0.8, 0);
    if (!onSling) return;
    const fx = SLING.x + g.pull.x, fy = SLING.y + g.pull.y;
    c.strokeStyle = '#f4f4f4'; c.lineWidth = 0.04;
    c.beginPath(); c.moveTo(SLING.x, SLING.y); c.lineTo(fx, fy); c.stroke();
    const v = g.launchVel(), on = Math.hypot(g.pull.x, g.pull.y) >= SLING.min;
    if (on) { // náznak dráhy: jen pár teček
      c.fillStyle = 'rgba(40,60,80,.6)';
      for (let i = 1; i <= SLING.dots; i++) {
        const t = i * SLING.dotT;
        c.beginPath(); c.arc(fx + v.x * t, fy + v.y * t + PH.g * t * t / 2, 0.09 - i * 0.008, 0, 7); c.fill();
      }
    }
    this.fish(c, q[0], fx, fy, on ? Math.atan2(v.y, v.x) : 0);
  },

  block(c, e, x, y, a) {
    const m = MAT[e.type], w = e.w / 2, h = e.h / 2;
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = m.col; c.strokeStyle = m.edge; c.lineWidth = 0.06;
    c.fillRect(-w, -h, e.w, e.h); c.strokeRect(-w, -h, e.w, e.h);
    const d = e.hp / e.max; // 3 stavy poškození
    if (d < 0.67) {
      c.lineWidth = 0.035;
      c.beginPath();
      c.moveTo(-w * 0.6, h); c.lineTo(-w * 0.1, h * 0.1); c.lineTo(-w * 0.5, -h);
      if (d < 0.34) { c.moveTo(w, h * 0.5); c.lineTo(w * 0.3, -h * 0.1); c.lineTo(w * 0.6, -h); c.moveTo(-w * 0.1, h * 0.1); c.lineTo(w * 0.3, -h * 0.1); }
      c.stroke();
    }
    c.restore();
  },

  bear(c, e, x, y, a) {
    const b = BEARS[e.type], r = e.r;
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = b.col; c.strokeStyle = '#3d2614'; c.lineWidth = 0.06;
    for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * r * 0.68, r * 0.68, r * 0.3, 0, 7); c.fill(); c.stroke(); }
    c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#e8cfa8'; c.beginPath(); c.ellipse(0, -r * 0.3, r * 0.45, r * 0.34, 0, 0, 7); c.fill();
    c.fillStyle = '#2a1a0e';
    c.beginPath(); c.ellipse(0, -r * 0.18, r * 0.16, r * 0.11, 0, 0, 7); c.fill();
    const hurt = e.hp < e.max * 0.6;
    for (const sx of [-1, 1]) {
      c.fillStyle = '#fff'; c.beginPath(); c.arc(sx * r * 0.36, r * 0.22, r * 0.2, 0, 7); c.fill();
      c.fillStyle = '#2a1a0e'; c.beginPath(); c.arc(sx * r * 0.36, r * 0.22, r * (hurt ? 0.06 : 0.1), 0, 7); c.fill();
    }
    c.restore();
  },

  fish(c, type, x, y, a) {
    const f = FISH[type], r = f.r;
    c.save(); c.translate(x, y); c.rotate(a);
    if (Math.cos(a) < 0) c.scale(1, -1); // břicho vždy dolů
    c.fillStyle = f.col; c.strokeStyle = '#2f4a2a'; c.lineWidth = 0.05;
    c.beginPath(); c.moveTo(-r * 1.1, 0); c.lineTo(-r * 1.9, r * 0.7); c.lineTo(-r * 1.9, -r * 0.7); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(0, 0, r * 1.35, r * 0.9, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = f.belly; c.beginPath(); c.ellipse(0, -r * 0.3, r * 1.05, r * 0.5, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(r * 0.7, r * 0.25, r * 0.28, 0, 7); c.fill();
    c.fillStyle = '#1c1c1c'; c.beginPath(); c.arc(r * 0.78, r * 0.25, r * 0.13, 0, 7); c.fill();
    c.restore();
  },
};
