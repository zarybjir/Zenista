'use strict';
// ---------- HUD a obrazovka výsledku ----------
// Kreslí se v CSS pixelech přes herní scénu. Tlačítka: { id, x, y, w, h, t }.
const UI = {
  btns: [],

  layout(g, W, H, hasNext) {
    const b = this.btns = [{ id: 'restart', x: W - 60, y: 12, w: 48, h: 48, t: '↻' }];
    if (g.state !== 'won' && g.state !== 'lost') return;
    const bw = 150, bh = 52, cy = H / 2 + 34, next = g.state === 'won' && hasNext;
    b.push({ id: 'restart', x: W / 2 - (next ? bw + 8 : bw / 2), y: cy, w: bw, h: bh, t: 'Znovu' });
    if (next) b.push({ id: 'next', x: W / 2 + 8, y: cy, w: bw, h: bh, t: 'Další' });
  },

  hit(px, py) {
    for (let i = this.btns.length - 1; i >= 0; i--) {
      const b = this.btns[i];
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return b.id;
    }
    return null;
  },

  draw(c, g, W, H, hasNext) {
    this.layout(g, W, H, hasNext);
    const end = g.state === 'won' || g.state === 'lost';
    c.textBaseline = 'middle';
    c.font = '600 20px system-ui, sans-serif';
    c.fillStyle = '#1d3340';
    c.textAlign = 'left';
    c.fillText(g.lvl.name, 16, 28);
    c.fillText('Skóre ' + g.score, 16, 54);
    if (end) {
      c.fillStyle = 'rgba(20,35,45,.45)'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#f5f8fa'; this.rr(c, W / 2 - 190, H / 2 - 100, 380, 205, 14); c.fill();
      c.fillStyle = '#1d3340'; c.textAlign = 'center';
      c.font = '700 26px system-ui, sans-serif';
      c.fillText(g.state === 'won' ? 'Úroveň dokončena' : 'Úroveň nedokončena', W / 2, H / 2 - 58);
      c.font = '500 20px system-ui, sans-serif';
      c.fillText('Skóre ' + g.score, W / 2, H / 2 - 14);
    }
    for (const b of this.btns) {
      c.fillStyle = b.t.length > 1 ? '#2f6f8f' : 'rgba(29,51,64,.75)';
      this.rr(c, b.x, b.y, b.w, b.h, 10); c.fill();
      c.fillStyle = '#fff'; c.textAlign = 'center';
      c.font = (b.t.length > 1 ? '600 20px' : '600 28px') + ' system-ui, sans-serif';
      c.fillText(b.t, b.x + b.w / 2, b.y + b.h / 2 + 1);
    }
  },

  rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  },
};
