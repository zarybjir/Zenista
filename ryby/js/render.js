'use strict';
// ---------- vykreslení ----------
// Zatím jednoduché tvary; kreslená grafika přijde později (viz Pořadí prací v CLAUDE.md).
const R = {
  cv: null, ctx: null, W: 0, H: 0, dpr: 1, s: 1, // s = CSS pixely na metr
  z: 1,                       // zoom
  time: 0, shake: 0,
  snap: 0, sx: 0, sy: 0,      // kmit prutu po výstřelu a směr posledního natažení
  parts: [], pi: 0,           // částice (recyklované objekty)
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
    this.s = this.H / VIEW.h * this.z;
    const g = this.ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, '#8ecbe8'); g.addColorStop(1, '#e3f3f7');
    this.sky = g;
  },

  // ---------- kamera ----------
  viewW() { return this.W / this.s; },
  camMax(g) { return Math.max(VIEW.minX, g.lvl.w - this.viewW()); },
  toWorld(px, py) { return { x: px / this.s + this.cam.x, y: (this.H - py) / this.s - VIEW.ground }; },
  // začátek úrovně: ukázat stavbu a přejet k prutu
  reset(g) {
    this.cam.x = this.camMax(g); this.cam.tx = VIEW.minX; this.cam.st = '';
    this.shake = this.snap = 0;
    for (const p of this.parts) p.life = 0;
  },
  zoom(f) { this.z = clamp(this.z * f, VIEW.zMin, VIEW.zMax); this.s = this.H / VIEW.h * this.z; },
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
    this.time += dt;
    this.camera(g, dt);
    this.shake = Math.max(0, this.shake - dt * 0.9);
    this.snap = Math.max(0, this.snap - dt * 2.2);
    const kx = (Math.random() - 0.5) * 2 * this.shake, ky = (Math.random() - 0.5) * 2 * this.shake;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = this.sky;
    c.fillRect(0, 0, this.W, this.H);
    this.hills(c);
    // dál se kreslí v metrech, y nahoru
    c.setTransform(s, 0, 0, -s, (kx - this.cam.x) * s, (this.H - VIEW.ground * this.s) * this.dpr + ky * s);
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
      else if (e.kind === 'bear') this.bear(c, e, x, y, a, g);
      else if (e.hit) this.fish(c, e.type, x, y, a, 1, 0);
      else this.fish(c, e.type, x, y, Math.atan2(e.vy, e.vx), 1 + Math.hypot(e.vx, e.vy) * 0.012, Math.sin(this.time * 38) * 0.5);
    }
    this.drawParts(c, dt);
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
    // špička se ohýbá za rybou, po výstřelu kmitá
    const k = Math.sin(this.snap * 26) * this.snap * 0.3;
    const tx = SLING.x + g.pull.x * 0.14 + this.sx * k, ty = SLING.y + g.pull.y * 0.14 + this.sy * k;
    c.beginPath(); c.moveTo(SLING.x + 0.9, 0); c.quadraticCurveTo(SLING.x + 0.7, SLING.y * 0.8, tx, ty); c.stroke();
    // ryby čekající ve frontě poskakují
    const q = g.queue, onSling = g.state === 'aim';
    for (let i = onSling ? 1 : 0; i < q.length; i++) {
      const hop = Math.max(0, Math.sin(this.time * 5 + i * 1.7)) * 0.16;
      this.fish(c, q[i], SLING.x - 1.1 - (i - (onSling ? 1 : 0)) * 0.8, FISH[q[i]].r * 0.8 + hop, 0, 1, 0);
    }
    c.strokeStyle = '#f4f4f4'; c.lineWidth = 0.04;
    if (!onSling) { c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx - 0.05, ty - 0.5 + Math.abs(k)); c.stroke(); return; }
    const fx = SLING.x + g.pull.x, fy = SLING.y + g.pull.y;
    c.beginPath(); c.moveTo(tx, ty); c.lineTo(fx, fy); c.stroke();
    const v = g.launchVel(), on = Math.hypot(g.pull.x, g.pull.y) >= SLING.min;
    if (on) { // náznak dráhy: jen pár teček
      c.fillStyle = 'rgba(40,60,80,.6)';
      for (let i = 1; i <= SLING.dots; i++) {
        const t = i * SLING.dotT;
        c.beginPath(); c.arc(fx + v.x * t, fy + v.y * t + PH.g * t * t / 2, 0.09 - i * 0.008, 0, 7); c.fill();
      }
    }
    this.fish(c, q[0], fx, fy, on ? Math.atan2(v.y, v.x) : 0, 1, g.aiming ? Math.sin(this.time * 20) * 0.3 : 0);
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

  // výrazy: klid, mrknutí, leknutí (ryba letí blízko), zásah, smích po výstřelu vedle
  bear(c, e, x, y, a, g) {
    const b = BEARS[e.type], r = e.r, f = g.fish;
    const laugh = g.miss && g.state === 'aim' && !g.aiming;
    const scared = !!f && !f.dead && Math.hypot(f.x - x, f.y - y) < 6;
    const blink = (this.time + e.x * 1.3) % 3.4 < 0.12;
    if (laugh) y += Math.abs(Math.sin(this.time * 9)) * 0.08;
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = b.col; c.strokeStyle = '#3d2614'; c.lineWidth = 0.06;
    for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * r * 0.68, r * 0.68, r * 0.3, 0, 7); c.fill(); c.stroke(); }
    c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#e8cfa8'; c.beginPath(); c.ellipse(0, -r * 0.3, r * 0.45, r * 0.34, 0, 0, 7); c.fill();
    c.fillStyle = '#2a1a0e';
    c.beginPath(); c.ellipse(0, -r * 0.18, r * 0.16, r * 0.11, 0, 0, 7); c.fill();
    const hurt = e.hp < e.max;
    c.strokeStyle = '#2a1a0e'; c.lineWidth = 0.045;
    if (laugh) { c.beginPath(); c.arc(0, -r * 0.36, r * 0.2, Math.PI, 0); c.stroke(); }          // úsměv
    else if (scared || hurt) { c.beginPath(); c.ellipse(0, -r * 0.45, r * 0.1, r * 0.13, 0, 0, 7); c.fill(); } // otevřená tlama
    for (const sx of [-1, 1]) {
      const ex = sx * r * 0.36, ey = r * 0.22;
      if (laugh || blink && !scared) { c.beginPath(); c.arc(ex, ey - r * 0.06, r * 0.15, 0, Math.PI); c.stroke(); continue; }
      c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, ey, r * (scared ? 0.25 : 0.2), 0, 7); c.fill();
      c.fillStyle = '#2a1a0e'; c.beginPath(); c.arc(ex, ey, r * (scared || hurt ? 0.06 : 0.1), 0, 7); c.fill();
    }
    c.restore();
  },

  // st = protažení v letu, wag = výchylka ocasu (−1 až 1)
  fish(c, type, x, y, a, st, wag) {
    const f = FISH[type], r = f.r;
    c.save(); c.translate(x, y); c.rotate(a);
    if (Math.cos(a) < 0) c.scale(1, -1); // břicho vždy dolů
    c.scale(st, 1 / st);
    c.fillStyle = f.col; c.strokeStyle = '#2f4a2a'; c.lineWidth = 0.05;
    const ty = wag * r * 0.5;
    c.beginPath(); c.moveTo(-r * 1.1, 0); c.lineTo(-r * 1.9, r * 0.7 + ty); c.lineTo(-r * 1.9, -r * 0.7 + ty); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(0, 0, r * 1.35, r * 0.9, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = f.belly; c.beginPath(); c.ellipse(0, -r * 0.3, r * 1.05, r * 0.5, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(r * 0.7, r * 0.25, r * 0.28, 0, 7); c.fill();
    c.fillStyle = '#1c1c1c'; c.beginPath(); c.arc(r * 0.78, r * 0.25, r * 0.13, 0, 7); c.fill();
    c.restore();
  },

  // ---------- efekty ----------
  // částice: k = 0 úlomek, 1 obláček, 2 text
  part(k, x, y, vx, vy, life, sz, col, txt) {
    let p = this.parts[this.pi];
    if (!p) p = this.parts[this.pi] = {};
    this.pi = (this.pi + 1) % FX.max;
    p.k = k; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = p.max = life; p.sz = sz; p.col = col; p.txt = txt;
    p.a = Math.random() * 6; p.va = (Math.random() - 0.5) * 14; p.wait = 0;
    return p;
  },

  puff(x, y, n, sz, col) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.3, v = 0.5 + Math.random() * 1.6;
      this.part(1, x + Math.cos(a) * sz * 0.4, y + Math.sin(a) * sz * 0.4, Math.cos(a) * v, Math.sin(a) * v + 0.6, 0.45 + Math.random() * 0.3, sz * (0.5 + Math.random() * 0.5), col);
    }
  },

  // událost hry → částice, otřes, kmit prutu
  fx(e, g) {
    const rnd = Math.random;
    if (e.k === 'shot') { const d = Math.hypot(e.x, e.y) || 1; this.sx = e.x / d; this.sy = e.y / d; this.snap = 1; }
    else if (e.k === 'hit') {
      this.shake = Math.min(FX.shakeMax, Math.max(this.shake, e.i * FX.shake));
      const col = FX.col[e.m], n = Math.min(6, e.i / 4 | 0);
      if (col) for (let i = 0; i < n; i++) this.part(0, e.x, e.y, (rnd() - 0.5) * 5, rnd() * 4 + 1, 0.4 + rnd() * 0.3, 0.06 + rnd() * 0.06, col[i % 3]);
      else if (e.i > 6) this.puff(e.x, e.y, 3, 0.25, e.m === 'zem' ? '#c9b38f' : '#fff');
    } else if (e.k === 'break') {
      this.shake = Math.min(FX.shakeMax, this.shake + 0.04);
      const col = FX.col[e.m], n = clamp(e.w * e.h * 22 | 0, 6, 16), ca = Math.cos(e.a), sa = Math.sin(e.a);
      for (let i = 0; i < n; i++) { // úlomky po celé ploše bloku
        const lx = (rnd() - 0.5) * e.w, ly = (rnd() - 0.5) * e.h;
        this.part(0, e.x + lx * ca - ly * sa, e.y + lx * sa + ly * ca, (rnd() - 0.5) * 6, rnd() * 5 + 1, 0.6 + rnd() * 0.5, 0.08 + rnd() * 0.12, col[i % 3]);
      }
      this.text(e.x, e.y, '+' + e.pts, 0.45, '#fff');
    } else if (e.k === 'bear') {
      this.shake = Math.min(FX.shakeMax, this.shake + 0.08);
      this.puff(e.x, e.y, 14, e.w * 0.7, '#fff');
      this.text(e.x, e.y + 0.4, '+' + e.pts, 0.8, '#ffe27a');
    } else if (e.k === 'puff') this.puff(e.x, e.y, 6, 0.35, '#e8f4fa');
    else if (e.k === 'win') // body za nevystřelené ryby nad frontou
      for (let i = 0; i < e.n; i++) this.text(SLING.x - 1.1 - i * 0.8, 1, '+' + SCORE.fish, 0.5, '#ffe27a').wait = 0.3 + i * 0.25;
  },

  text(x, y, t, sz, col) { const p = this.part(2, x, y, 0, 1.3, 1.1, sz, col, t); p.a = 0; return p; },

  drawParts(c, dt) {
    for (const p of this.parts) {
      if (p.life <= 0) continue;
      if (p.wait > 0) { p.wait -= dt; continue; }
      p.life -= dt;
      const t = Math.max(0, p.life / p.max);
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 0) { p.vy += PH.g * dt; p.a += p.va * dt; if (p.y < p.sz / 2 && p.vy < 0) { p.y = p.sz / 2; p.vy *= -0.35; p.vx *= 0.6; p.va *= 0.5; } }
      else if (p.k === 1) { p.vx *= 1 - 3 * dt; p.vy *= 1 - 3 * dt; }
      else p.vy *= 1 - 1.5 * dt;
      c.globalAlpha = Math.min(1, t * 2.5);
      c.fillStyle = p.col;
      if (p.k === 0) { c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillRect(-p.sz / 2, -p.sz / 2, p.sz, p.sz * 0.7); c.restore(); }
      else if (p.k === 1) { c.beginPath(); c.arc(p.x, p.y, p.sz * (1.2 - t * 0.7), 0, 7); c.fill(); }
      else {
        const k = p.sz * Math.min(1, (1 - t) * 8 + 0.3); // vyskočení
        c.save(); c.translate(p.x, p.y); c.scale(k / 20, -k / 20);
        c.font = '800 20px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineWidth = 4; c.strokeStyle = 'rgba(29,51,64,.85)'; c.strokeText(p.txt, 0, 0); c.fillText(p.txt, 0, 0);
        c.restore();
      }
    }
    c.globalAlpha = 1;
  },
};
