'use strict';
// ---------- výběr úrovně, HUD a obrazovka výsledku ----------
// Kreslí se v CSS pixelech přes herní scénu. Tlačítka: { id, x, y, w, h, t }.
// id: restart, next, menu, lvl<index>
const UI = {
  btns: [],
  t0: 0,   // čas konce úrovně; výsledek se ukáže se zpožděním, aby byl vidět poslední zásah
  sel: 0,  // dlaždice vybraná klávesnicí nebo gamepadem
  cols: 5,
  FONT: ' system-ui, sans-serif',

  hit(px, py) {
    for (let i = this.btns.length - 1; i >= 0; i--) {
      const b = this.btns[i];
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return b.id;
    }
    return null;
  },

  draw(c, app, W, H) {
    c.textBaseline = 'middle';
    if (app.screen === 'menu') this.menu(c, W, H);
    else this.play(c, app, W, H);
  },

  // ---------- výběr úrovně ----------
  menu(c, W, H) {
    const b = this.btns = [], n = LEVELS.length, T = Math.min(88, (H - 110) / 2 - 14), G = 14;
    const cols = this.cols = clamp((W - 32 + G) / (T + G) | 0, 1, 5), rows = Math.ceil(n / cols);
    const x0 = (W - cols * (T + G) + G) / 2, y0 = Math.max(84, (H - rows * (T + G) + G) / 2 + 24);
    c.fillStyle = 'rgba(20,35,45,.6)'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#fff'; c.textAlign = 'center';
    c.font = '700 30px' + this.FONT;
    c.fillText('Ryby na medvědy', W / 2, y0 - 46);
    for (let i = 0; i < n; i++) {
      const x = x0 + (i % cols) * (T + G), y = y0 + (i / cols | 0) * (T + G), open = Save.open(i), r = Save.get(LEVELS[i].id);
      if (open) b.push({ id: 'lvl' + i, x, y, w: T, h: T });
      c.fillStyle = open ? '#f5f8fa' : 'rgba(245,248,250,.35)';
      this.rr(c, x, y, T, T, 12); c.fill();
      if (i === this.sel) { c.strokeStyle = '#ffd24a'; c.lineWidth = 4; c.stroke(); }
      c.fillStyle = '#1d3340';
      if (!open) { this.lock(c, x + T / 2, y + T / 2, T * 0.16); continue; }
      c.font = '700 ' + (T * 0.36 | 0) + 'px' + this.FONT;
      c.fillText(i + 1, x + T / 2, y + T * 0.38);
      for (let k = 0; k < 3; k++) this.star(c, x + T / 2 + (k - 1) * T * 0.24, y + T * 0.76, T * 0.11, k < r.s);
    }
  },

  // ---------- hra ----------
  play(c, app, W, H) {
    const g = app.game, b = this.btns = [
      { id: 'restart', x: W - 60, y: 12, w: 48, h: 48 },
      { id: 'menu', x: W - 116, y: 12, w: 48, h: 48 },
    ];
    c.font = '600 20px' + this.FONT; c.fillStyle = '#1d3340'; c.textAlign = 'left';
    c.fillText((app.li + 1) + '. ' + g.lvl.name, 16, 28);
    c.fillText('Skóre ' + g.score, 16, 54);
    for (const k of b) {
      c.fillStyle = 'rgba(29,51,64,.75)'; this.rr(c, k.x, k.y, k.w, k.h, 10); c.fill();
      c.fillStyle = c.strokeStyle = '#fff';
      const cx = k.x + 24, cy = k.y + 24;
      if (k.id === 'restart') { c.font = '600 28px' + this.FONT; c.textAlign = 'center'; c.fillText('↻', cx, cy + 1); }
      else { c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); for (const d of [-8, 0, 8]) { c.moveTo(cx - 10, cy + d); c.lineTo(cx + 10, cy + d); } c.stroke(); }
    }
    const end = g.state === 'won' || g.state === 'lost';
    if (!end) { this.t0 = 0; return; }
    if (!this.t0) this.t0 = performance.now();
    if (performance.now() - this.t0 < 900) return;
    this.result(c, app, W, H);
  },

  result(c, app, W, H) {
    const g = app.game, won = g.state === 'won', next = won && app.hasNext();
    const PW = Math.min(440, W - 24), PH_ = won ? 270 : 190, px = (W - PW) / 2, py = (H - PH_) / 2, cx = W / 2;
    c.fillStyle = 'rgba(20,35,45,.45)'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#f5f8fa'; this.rr(c, px, py, PW, PH_, 14); c.fill();
    c.fillStyle = '#1d3340'; c.textAlign = 'center';
    c.font = '700 26px' + this.FONT;
    c.fillText(won ? 'Úroveň dokončena' : 'Úroveň nedokončena', cx, py + 40);
    let y = py + 84;
    if (won) {
      const s = g.stars();
      for (let k = 0; k < 3; k++) this.star(c, cx + (k - 1) * 58, y + 6, k === 1 ? 26 : 22, k < s);
      y += 58;
    }
    c.fillStyle = '#1d3340'; c.font = '500 20px' + this.FONT;
    c.fillText('Skóre ' + g.score, cx, y);
    if (won) { c.font = '400 16px' + this.FONT; c.fillText(app.best ? 'Nové nejlepší skóre' : 'Nejlepší ' + Save.get(g.lvl.id).b, cx, y + 26); }
    const ids = next ? ['menu', 'restart', 'next'] : ['menu', 'restart'], bw = Math.min(124, (PW - 48) / 3), bh = 52, by = py + PH_ - bh - 20;
    const T = { menu: 'Úrovně', restart: 'Znovu', next: 'Další' };
    ids.forEach((id, i) => {
      const k = { id, x: cx + (i - ids.length / 2) * (bw + 10) + 5, y: by, w: bw, h: bh };
      this.btns.push(k);
      c.fillStyle = id === (next ? 'next' : 'restart') ? '#2f6f8f' : '#5b7f93';
      this.rr(c, k.x, k.y, k.w, k.h, 10); c.fill();
      c.fillStyle = '#fff'; c.font = '600 19px' + this.FONT;
      c.fillText(T[id], k.x + k.w / 2, k.y + k.h / 2 + 1);
    });
  },

  // ---------- tvary ----------
  rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  },

  star(c, x, y, r, on) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, k = i & 1 ? r * 0.45 : r;
      c.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k);
    }
    c.closePath();
    c.fillStyle = on ? '#f2b732' : '#d3dbe0'; c.fill();
    c.fillStyle = '#1d3340';
  },

  lock(c, x, y, r) {
    c.strokeStyle = c.fillStyle; c.lineWidth = r * 0.35;
    c.beginPath(); c.arc(x, y - r * 0.5, r * 0.6, Math.PI, 0); c.stroke();
    c.fillRect(x - r, y - r * 0.5, r * 2, r * 1.6);
  },
};
