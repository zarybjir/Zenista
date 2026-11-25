'use strict';
// ---------- vykreslení ----------
// Postavy a bloky jsou v gfx/atlas.svg (popis v js/atlas.js, vyrábí tools/gen_gfx.js). Při startu
// se atlas i pozadí předkreslí do offscreen canvasů, ve smyčce se už jen kopíruje (drawImage).
const R = {
  cv: null, ctx: null, W: 0, H: 0, dpr: 1, s: 1, // s = CSS pixely na metr
  z: 1,                       // zoom
  time: 0, shake: 0,
  snap: 0, sx: 0, sy: 0,      // kmit prutu po výstřelu a směr posledního natažení
  parts: [], pi: 0,           // částice (recyklované objekty)
  cam: { x: VIEW.minX, tx: VIEW.minX, st: '' },
  img: null, atl: null, ak: 0, // atlas: zdrojový obrázek, předkreslený canvas, pixely na centimetr
  bg: null,                    // vrstvy pozadí { sky, far, mid, ground }

  init(cv) {
    this.cv = cv;
    this.ctx = cv.getContext('2d');
    this.resize();
    addEventListener('resize', () => this.resize());
  },

  // načte atlas; hra se spouští až potom
  load() {
    return new Promise((ok, err) => {
      const i = new Image();
      i.onload = () => { this.img = i; this.raster(); ok(); };
      i.onerror = () => err(new Error('gfx/atlas.svg'));
      i.src = 'gfx/atlas.svg';
    });
  },

  // předkreslí atlas v rozlišení podle displeje (znovu jen když je potřeba výrazně větší)
  raster() {
    if (!this.img) return;
    const k = Math.min(this.H / VIEW.h * this.dpr * 1.3 / 100, 4096 / Math.max(ATLAS.w, ATLAS.h));
    if (this.atl && k <= this.ak * 1.1) return;
    const a = document.createElement('canvas');
    a.width = Math.ceil(ATLAS.w * k); a.height = Math.ceil(ATLAS.h * k);
    a.getContext('2d').drawImage(this.img, 0, 0, a.width, a.height);
    this.atl = a; this.ak = a.width / ATLAS.w;
  },

  resize() {
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.W = this.cv.clientWidth; this.H = this.cv.clientHeight;
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
    this.s = this.H / VIEW.h * this.z;
    this.raster();
    this.buildBg();
  },

  // ---------- kamera ----------
  viewW() { return this.W / this.s; },
  camMax(g) { return Math.max(VIEW.minX, g.lvl.w - this.viewW()); },
  toWorld(px, py) { return { x: px / this.s + this.cam.x, y: (this.H - py) / this.s - VIEW.ground }; },
  // začátek úrovně: ukázat stavbu a přejet k prutu
  reset(g) {
    this.zoom(clamp(this.W / ((g.lvl.w - VIEW.minX) * this.H / VIEW.h), VIEW.zMin, 1) / this.z); // celá úroveň do obrazu
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

  // ---------- pozadí ----------
  // Čtyři vrstvy: obloha (stojí), hory a mraky, les s řekou (posouvají se pomaleji než scéna)
  // a země (posouvá se se scénou). Hory a les se opakují po šířce tile.
  buildBg() {
    const d = this.dpr, W = this.W, H = this.H, rnd = mulberry32(77), s0 = H / VIEW.h;
    const mk = (w, h) => { const cv = document.createElement('canvas'); cv.width = Math.ceil(w * d); cv.height = Math.ceil(h * d); const c = cv.getContext('2d'); c.scale(d, d); return [cv, c]; };
    const tile = Math.max(W, 900), bg = this.bg = { tile };
    let cv, c;
    // obloha
    [cv, c] = mk(W, H); bg.sky = cv;
    let g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#6db9e6'); g.addColorStop(0.6, '#bfe4f3'); g.addColorStop(1, '#f3f6e4');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    g = c.createRadialGradient(W * 0.8, H * 0.2, 0, W * 0.8, H * 0.2, H * 0.3);
    g.addColorStop(0, 'rgba(255,250,210,.95)'); g.addColorStop(0.18, 'rgba(255,246,190,.9)'); g.addColorStop(0.2, 'rgba(255,244,190,.35)'); g.addColorStop(1, 'rgba(255,244,190,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // hory a mraky: spodní okraj vrstvy = čára země
    [cv, c] = mk(tile, H); bg.far = cv;
    const ridge = (base, amp, col, edge, ph) => {
      const y = x => H * (base - amp * (Math.sin(x / tile * 6.283 * 2 + ph) * 0.5 + Math.sin(x / tile * 6.283 * 5 + ph * 2) * 0.3 + Math.abs(Math.sin(x / tile * 6.283 * 4 + ph * 3)) * 0.5));
      c.beginPath(); c.moveTo(0, H);
      for (let x = 0; x <= tile; x += 6) c.lineTo(x, y(x));
      c.lineTo(tile, H); c.closePath();
      c.fillStyle = col; c.fill();
      c.beginPath(); for (let x = 0; x <= tile; x += 6) c.lineTo(x, y(x));
      c.strokeStyle = edge; c.lineWidth = 2; c.stroke();
    };
    ridge(0.7, 0.13, '#b4cde2', '#d6e6f1', 1);
    ridge(0.8, 0.09, '#97b9cf', '#b9d2df', 4);
    c.fillStyle = 'rgba(255,255,255,.9)';
    for (let i = 0; i < 6; i++) { // mraky ze shluků kruhů
      const cx = (i + rnd() * 0.7) * tile / 6, cy = H * (0.2 + rnd() * 0.22), r = H * (0.02 + rnd() * 0.02);
      for (const o of [0, -tile, tile]) {
        for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(cx + o + (k - 2) * r * 1.1, cy - (k === 2 ? r * 0.6 : k % 2 ? r * 0.35 : 0), r * (k === 2 ? 1.25 : 1), 0, 7); c.fill(); }
        c.beginPath(); c.ellipse(cx + o, cy + r * 0.55, r * 3, r * 0.6, 0, 0, 7); c.fill();
      }
    }
    // les a řeka
    [cv, c] = mk(tile, H); bg.mid = cv;
    c.fillStyle = '#9ccf9a'; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= tile; x += 8) c.lineTo(x, H * (0.84 - 0.04 * Math.sin(x / tile * 6.283 * 3 + 1) - 0.02 * Math.sin(x / tile * 6.283 * 7)));
    c.lineTo(tile, H); c.fill();
    const trees = [];
    for (let i = 0; i < tile / 26; i++) trees.push([rnd() * tile, 0.1 + rnd() * 0.17, rnd()]);
    trees.sort((a, b) => a[1] - b[1]); // menší (vzdálenější) dřív
    for (const [x, hh, v] of trees) for (const o of [0, -tile, tile]) this.tree(c, x + o, H - s0 * 0.45, H * hh, v);
    const ry = H - s0 * 0.55; // řeka těsně nad čarou země
    c.fillStyle = '#5fa8d6'; c.fillRect(0, ry, tile, s0 * 0.6);
    c.fillStyle = '#4c93c3'; c.fillRect(0, ry, tile, 3);
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2; c.lineCap = 'round';
    for (let i = 0; i < tile / 40; i++) { const x = rnd() * tile, y = ry + 8 + rnd() * (s0 * 0.45 - 8), l = 10 + rnd() * 22; c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y); c.stroke(); }
    // země: dlaždice GT metrů, od trávy po spodní okraj obrazu
    const GT = 8, gh = VIEW.ground + 0.35, k = s0 * 1.3;
    [cv, c] = mk(GT * k, gh * k); bg.ground = cv; bg.gt = GT; bg.gh = gh;
    c.scale(k, k); // dál v metrech, y dolů, tráva začíná v y = 0.35
    g = c.createLinearGradient(0, 0.35, 0, gh);
    g.addColorStop(0, '#8a6442'); g.addColorStop(1, '#5c4029');
    c.fillStyle = g; c.fillRect(0, 0.4, GT, gh);
    for (let i = 0; i < 26; i++) { // kameny v hlíně
      const x = rnd() * GT, y = 0.75 + rnd() * (gh - 0.9), r = 0.05 + rnd() * 0.1;
      c.fillStyle = rnd() < 0.5 ? '#a08a72' : '#74593f';
      for (const o of [0, -GT, GT]) { c.beginPath(); c.ellipse(x + o, y, r * 1.4, r, 0, 0, 7); c.fill(); }
    }
    c.fillStyle = '#3f7d3a'; c.fillRect(0, 0.33, GT, 0.32); // tmavý lem trávy
    c.beginPath(); c.moveTo(0, 0.58);
    for (let i = 0; i <= 32; i++) c.quadraticCurveTo((i - 0.5) * GT / 32, 0.74, i * GT / 32, 0.6); // vlnitý spodní okraj
    c.lineTo(GT, 0.35); c.lineTo(0, 0.35); c.fillStyle = '#62b04e'; c.fill();
    c.fillStyle = '#86cf63'; c.fillRect(0, 0.35, GT, 0.07);
    c.strokeStyle = '#3f7d3a'; c.lineWidth = 0.035; c.lineCap = 'round';
    for (let i = 0; i < 40; i++) { // stébla nad čarou země
      const x = rnd() * GT, h = 0.1 + rnd() * 0.2, l = (rnd() - 0.5) * 0.16;
      c.strokeStyle = rnd() < 0.5 ? '#4f9a42' : '#6bbb55';
      for (const o of [0, -GT, GT]) { c.beginPath(); c.moveTo(x + o, 0.38); c.quadraticCurveTo(x + o, 0.38 - h * 0.6, x + o + l, 0.38 - h); c.stroke(); }
    }
  },

  // jehličnan ze tří pater; v = odstín
  tree(c, x, y, h, v) {
    const w = h * 0.42;
    c.fillStyle = '#6b4a2b'; c.fillRect(x - w * 0.08, y - h * 0.15, w * 0.16, h * 0.15);
    for (let i = 0; i < 3; i++) {
      const b = y - h * (0.1 + i * 0.26), t = b - h * 0.42, hw = w * (0.5 - i * 0.11);
      c.fillStyle = v < 0.5 ? '#3f8a55' : '#4a9960';
      c.beginPath(); c.moveTo(x - hw, b); c.lineTo(x, t); c.lineTo(x + hw, b); c.closePath(); c.fill();
      c.fillStyle = 'rgba(20,60,40,.25)';
      c.beginPath(); c.moveTo(x, b); c.lineTo(x, t); c.lineTo(x + hw, b); c.closePath(); c.fill();
    }
  },

  drawBg(c) {
    const b = this.bg, gy = this.H - VIEW.ground * this.s; // čára země na obrazovce
    c.drawImage(b.sky, 0, 0, this.W, this.H);
    for (const [img, par] of [[b.far, 0.12], [b.mid, 0.4]]) {
      let x = -((this.cam.x - VIEW.minX) * this.s * par) % b.tile;
      if (x > 0) x -= b.tile;
      for (; x < this.W; x += b.tile) c.drawImage(img, x, gy - this.H, b.tile, this.H);
    }
  },

  drawGround(c) { // ve světových souřadnicích (y nahoru), proto obrácení
    const b = this.bg, x1 = this.cam.x + this.viewW() + 1;
    c.save(); c.scale(1, -1);
    for (let x = Math.floor((this.cam.x - 1) / b.gt) * b.gt; x < x1; x += b.gt) c.drawImage(b.ground, x, -0.35, b.gt + 0.06, b.gh); // přesah zakryje šev
    c.restore();
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
    this.drawBg(c);
    // dál se kreslí v metrech, y nahoru
    c.setTransform(s, 0, 0, -s, (kx - this.cam.x) * s, (this.H - VIEW.ground * this.s) * this.dpr + ky * s);
    c.lineJoin = c.lineCap = 'round';
    this.drawGround(c);
    for (const r of g.lvl.rocks || []) this.rock(c, r);
    this.dots(c, g.last, 'rgba(255,255,255,.6)');
    this.dots(c, g.trail, 'rgba(255,255,255,.95)');
    this.sling(c, g);
    const al = g.alpha;
    for (const e of g.P.ents) {
      const x = lerp(e.px, e.x, al), y = lerp(e.py, e.y, al), a = lerp(e.pa, e.a, al);
      if (e.kind === 'block') this.block(c, e, x, y, a);
      else if (e.kind === 'bear') this.bear(c, e, x, y, a, g);
      else if (e.hit) this.fish(c, e.type, x, y, a, 1, 0, e.r > FISH[e.type].r, e.used);
      else this.fish(c, e.type, x, y, Math.atan2(e.vy, e.vx), 1 + Math.hypot(e.vx, e.vy) * 0.012, this.time * 16 & 1, e.r > FISH[e.type].r, e.used);
    }
    this.drawParts(c, dt);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },

  // obrázek z atlasu: střed v x, y, natočení a, měřítko kx, ky (záporné ky = převrácení)
  spr(c, name, x, y, a, kx, ky) {
    const q = ATLAS.s[name], k = this.ak;
    c.save(); c.translate(x, y); c.rotate(a); c.scale(kx / 100, -ky / 100);
    c.drawImage(this.atl, q[0] * k, q[1] * k, q[2] * k, q[3] * k, -q[4], -q[5], q[2], q[3]);
    c.restore();
  },

  // skála: nehybná plošina s travnatým vrškem
  rock(c, r) {
    const x = r[0] - r[2] / 2, y = r[1] - r[3] / 2, w = r[2], h = r[3];
    c.fillStyle = '#8c8478'; c.strokeStyle = '#4a443c'; c.lineWidth = 0.07;
    c.fillRect(x, y, w, h); c.strokeRect(x, y, w, h);
    c.fillStyle = '#a39b8e'; c.fillRect(x + 0.06, y + h - 0.3, w - 0.12, 0.12);
    c.fillStyle = '#736b60';
    for (let i = 0.4; i < w - 0.3; i += 0.9) c.fillRect(x + i, y + h * (0.25 + (i * 7 % 3) * 0.15), 0.35, 0.07);
    c.fillStyle = '#62b04e'; c.strokeStyle = '#3f7d3a'; c.lineWidth = 0.05;
    c.fillRect(x - 0.05, y + h - 0.14, w + 0.1, 0.2); c.strokeRect(x - 0.05, y + h - 0.14, w + 0.1, 0.2);
  },

  dots(c, t, col) {
    c.fillStyle = col; c.strokeStyle = 'rgba(40,60,80,.45)'; c.lineWidth = 0.025;
    for (let i = 0; i < t.length; i += 2) { c.beginPath(); c.arc(t[i], t[i + 1], 0.07, 0, 7); c.fill(); c.stroke(); }
  },

  sling(c, g) {
    // prut: špička se ohýbá za rybou, po výstřelu kmitá
    const k = Math.sin(this.snap * 26) * this.snap * 0.3, bx = SLING.x + 0.9;
    const tx = SLING.x + g.pull.x * 0.14 + this.sx * k, ty = SLING.y + g.pull.y * 0.14 + this.sy * k;
    const rod = () => { c.beginPath(); c.moveTo(bx, -0.05); c.quadraticCurveTo(bx - 0.15, SLING.y * 0.8, tx, ty); c.stroke(); };
    c.strokeStyle = '#3a2415'; c.lineWidth = 0.2; rod();
    c.strokeStyle = '#a8713c'; c.lineWidth = 0.11; rod();
    c.strokeStyle = '#3a2415'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(bx, -0.05); c.lineTo(bx - 0.03, 0.75); c.stroke(); // rukojeť
    c.strokeStyle = '#d9b98a'; c.lineWidth = 0.2; c.beginPath(); c.moveTo(bx, 0); c.lineTo(bx - 0.03, 0.7); c.stroke();
    c.fillStyle = '#8d969e'; c.strokeStyle = '#33393f'; c.lineWidth = 0.05; // naviják
    c.beginPath(); c.arc(bx - 0.22, 0.95, 0.17, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.arc(bx - 0.22, 0.95, 0.05, 0, 7); c.stroke();
    // ryby čekající ve frontě poskakují
    const q = g.queue, onSling = g.state === 'aim';
    for (let i = onSling ? 1 : 0, x = SLING.x - 0.3; i < q.length; i++) {
      const f = FISH[q[i]], hop = Math.max(0, Math.sin(this.time * 5 + i * 1.7)) * 0.16;
      x -= f.r * f.lx + 0.14; // rozestup podle délky ryby
      this.fish(c, q[i], x, f.r * f.ly + 0.03 + hop, 0, 1, hop > 0.02 ? 1 : 0);
      x -= f.r * (f.lx + 0.62);
    }
    c.strokeStyle = '#f4f4f4'; c.lineWidth = 0.035;
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
    this.fish(c, q[0], fx, fy, on ? Math.atan2(v.y, v.x) : 0, 1, g.aiming ? this.time * 12 & 1 : this.time * 2.5 & 1);
  },

  block(c, e, x, y, a) {
    const d = e.hp / e.max, st = d < 0.34 ? 2 : d < 0.67 ? 1 : 0; // 3 stavy poškození
    if (e._st !== st) { e._st = st; e._n = 'blk_' + e.type + '_' + e.shape + '_' + st; }
    this.spr(c, e._n, x, y, a, 1, 1);
  },

  // výrazy: zásah (krátce po nárazu), leknutí (ryba letí blízko), smích po výstřelu vedle, mrknutí, klid
  bear(c, e, x, y, a, g) {
    const f = g.fish, t = this.time;
    if (e._hp !== e.hp) { if (e._hp !== undefined) e._ht = t; e._hp = e.hp; }
    const hit = t - (e._ht || -9), laugh = g.miss && g.state === 'aim' && !g.aiming;
    const ex = hit < 0.7 ? 'zasah' : f && !f.dead && Math.hypot(f.x - x, f.y - y) < 6 ? 'lek' : laugh ? 'smich'
      : (t + e.x * 1.3) % 3.4 < 0.12 ? 'mrk' : 'klid';
    let kx = 1, ky = 1 + Math.sin(t * 2.2 + e.x) * 0.02; // dýchání
    if (hit < 0.35) { const q = Math.sin(hit / 0.35 * Math.PI) * 0.16; kx += q; ky -= q; } // zmáčknutí po nárazu
    if (laugh) y += Math.abs(Math.sin(t * 9)) * 0.08;
    this.spr(c, 'bear_' + e.type + '_' + ex, x, y, a, kx, ky);
  },

  // st = protažení v letu, fr = snímek ocasu (0, 1), big = nafouknutý čtverzubec,
  // one = jedna sardinka (po rozdělení); jinak se sardinky kreslí jako hejno tří
  fish(c, type, x, y, a, st, fr, big, one) {
    const n = 'fish_' + type + '_' + (big ? 'big' : fr), ky = Math.cos(a) < 0 ? -1 / st : 1 / st; // břicho vždy dolů
    if (type !== 'sardinky' || one) { this.spr(c, n, x, y, a, st, ky); return; }
    const r = FISH[type].r, ca = Math.cos(a), sa = Math.sin(a), up = ky < 0 ? -1 : 1;
    for (const [ox, oy, f2] of [[-r * 1.1, r * 1.1, fr], [-r * 1.3, -r * 1.1, 1 - fr], [r * 0.9, 0, fr]])
      this.spr(c, 'fish_sardinky_' + f2, x + ox * ca - oy * up * sa, y + ox * sa + oy * up * ca, a, st, ky);
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
    else if (e.k === 'ab') {
      if (e.m === 'ctverzubec') { this.shake = FX.shakeMax; this.ring(e.x, e.y, e.r, '#fff3c4'); this.puff(e.x, e.y, 12, 0.6, '#fff'); }
      else if (e.m === 'uhor') {
        this.ring(e.x, e.y, e.r, '#fff27a');
        for (let i = 0; i < e.to.length; i += 2) this.bolt(e.x, e.y, e.to[i], e.to[i + 1]);
      } else this.puff(e.x, e.y, e.m === 'stika' ? 7 : 4, 0.3, '#fff');
    }
    else if (e.k === 'win') // body za nevystřelené ryby nad frontou
      for (let i = 0; i < e.n; i++) this.text(SLING.x - 1 - i * 0.8, 1.1 + (i & 1) * 0.6, '+' + SCORE.fish, 0.5, '#ffe27a').wait = 0.3 + i * 0.25;
  },

  // rozpínající se kruh (k = 3) a blesk (k = 4, cíl ve vx, vy)
  ring(x, y, r, col) { this.part(3, x, y, 0, 0, 0.35, r, col); },
  bolt(x, y, tx, ty) { this.part(4, x, y, tx, ty, 0.3, 0, '#fff27a'); },

  text(x, y, t, sz, col) { const p = this.part(2, x, y, 0, 1.3, 1.1, sz, col, t); p.a = 0; return p; },

  drawParts(c, dt) {
    for (const p of this.parts) {
      if (p.life <= 0) continue;
      if (p.wait > 0) { p.wait -= dt; continue; }
      p.life -= dt;
      const t = Math.max(0, p.life / p.max);
      if (p.k >= 3) {
        c.globalAlpha = t; c.strokeStyle = p.col; c.lineWidth = 0.1;
        c.beginPath();
        if (p.k === 3) c.arc(p.x, p.y, p.sz * (1 - t * t), 0, 7);
        else { // lomená čára k cíli
          c.moveTo(p.x, p.y);
          for (let i = 1; i < 6; i++) c.lineTo(lerp(p.x, p.vx, i / 6) + (Math.random() - 0.5) * 0.5, lerp(p.y, p.vy, i / 6) + (Math.random() - 0.5) * 0.5);
          c.lineTo(p.vx, p.vy);
        }
        c.stroke();
        continue;
      }
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
