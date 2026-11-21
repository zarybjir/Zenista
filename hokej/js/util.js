'use strict';
// ---------- Pomocné funkce a geometrie kluziště ----------
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sgn = (v) => (v < 0 ? -1 : 1);
function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 0.5; }

// Rozměry ve stopách (NHL): 200 x 85, rohy r=28
const RINK = {
  HL: 100, HW: 42.5, R: 28, GOAL_X: 89, BLUE_X: 25,
  NET_W: 3, NET_H: 4, NET_D: 3.4, BOARD_H: 3.5, GLASS_H: 8.5,
};

// Kontakt s mantinelem: vrací normálu (ven) a průnik, nebo null
function rinkContact(x, y, r) {
  const ax = Math.abs(x), ay = Math.abs(y);
  const cx = RINK.HL - RINK.R, cy = RINK.HW - RINK.R;
  if (ax > cx && ay > cy) {
    const dx = ax - cx, dy = ay - cy, d = Math.hypot(dx, dy);
    const lim = RINK.R - r;
    if (d > lim) return { nx: (dx / d) * sgn(x), ny: (dy / d) * sgn(y), pen: d - lim };
    return null;
  }
  let pen = 0, nx = 0, ny = 0;
  if (ax > RINK.HL - r) { pen = ax - (RINK.HL - r); nx = sgn(x); }
  if (ay > RINK.HW - r) { const p = ay - (RINK.HW - r); if (p > pen) { pen = p; nx = 0; ny = sgn(y); } }
  return pen > 0 ? { nx, ny, pen } : null;
}
function rinkHalfWidthAt(x) {
  const ax = Math.abs(x), cx = RINK.HL - RINK.R;
  if (ax <= cx) return RINK.HW;
  const d = Math.min(RINK.R, ax - cx);
  return RINK.HW - RINK.R + Math.sqrt(RINK.R * RINK.R - d * d);
}
function rinkOutline(n) {
  const pts = [], cx = RINK.HL - RINK.R, cy = RINK.HW - RINK.R, R = RINK.R;
  const corners = [[cx, cy, 0], [-cx, cy, 90], [-cx, -cy, 180], [cx, -cy, 270]];
  for (const [ox, oy, a0] of corners)
    for (let i = 0; i <= n; i++) {
      const a = ((a0 + (90 * i) / n) * Math.PI) / 180;
      pts.push([ox + R * Math.cos(a), oy + R * Math.sin(a)]);
    }
  return pts;
}

// Poloha čepele hole vůči hráči (svět. souřadnice) — sdílí hra i vykreslování
function bladeOffset(dir, hand, carry, t, wind, poke) {
  const fx = Math.cos(dir), fy = Math.sin(dir);
  const lx = -fy, ly = fx; // levá strana hráče
  let f = 2.9, s = hand * 0.9, z = 0;
  if (carry) { s += Math.sin(t * 9) * 0.75; f = 2.6 + Math.cos(t * 4.5) * 0.35; }
  if (poke > 0) f += 2.4 * Math.sin(Math.min(1, poke) * Math.PI);
  if (wind > 0) {
    const w = Math.min(1, wind);
    f = f * (1 - w) - 1.0 * w;
    s = s + hand * 1.6 * w;
    z = 4.2 * w * w;
  }
  return [fx * f + lx * s, fy * f + ly * s, z];
}

// Nejmenší vzdálenost bodu (px,py) od úsečky (ax,ay)-(bx,by)
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

const Settings = {
  data: { vol: 8, comm: true, replay: true, periodLen: 3, diff: 1, home: 0, away: 1, fps: false },
  load() {
    try { const s = JSON.parse(localStorage.getItem('hokej98') || '{}'); Object.assign(this.data, s); } catch (e) {}
  },
  save() { try { localStorage.setItem('hokej98', JSON.stringify(this.data)); } catch (e) {} },
};
