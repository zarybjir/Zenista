'use strict';
// ---------- vstup: dotyk, myš, klávesnice a gamepad → stejné události ----------
// Obsluha h: down(px, py) → 'aim' | 'pan' | null, aimMove(px, py), pan(dpx), release(),
//            aimStart(), aimVec(x, y), fire(), restart(), back(), zoom(násobek)
const Input = {
  h: null, mode: null, id: -1, lx: 0, padAim: false, prev: [],
  pts: new Map(), pd: 0, // prsty na displeji a jejich vzdálenost (zoom dvěma prsty)

  init(cv, h) {
    this.h = h;
    const dist = () => { const [a, b] = [...this.pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
    cv.addEventListener('pointerdown', e => {
      this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pts.size === 2 && this.mode !== 'aim') { this.mode = 'zoom'; this.id = -1; this.pd = dist(); cv.setPointerCapture(e.pointerId); return; }
      if (this.mode) return;
      this.mode = h.down(e.clientX, e.clientY);
      if (!this.mode) return;
      this.id = e.pointerId; this.lx = e.clientX;
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', e => {
      const p = this.pts.get(e.pointerId);
      if (p) { p.x = e.clientX; p.y = e.clientY; }
      if (this.mode === 'zoom' && this.pts.size >= 2) { const d = dist(); h.zoom(d / this.pd); this.pd = d; return; }
      if (e.pointerId !== this.id) return;
      if (this.mode === 'aim') h.aimMove(e.clientX, e.clientY);
      else if (this.mode === 'pan') { h.pan(e.clientX - this.lx); this.lx = e.clientX; }
    });
    const up = e => {
      this.pts.delete(e.pointerId);
      if (this.mode === 'zoom') { if (this.pts.size < 2) this.mode = null; return; }
      if (e.pointerId !== this.id) return;
      if (this.mode === 'aim') h.release();
      this.mode = null; this.id = -1;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => { e.preventDefault(); h.zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });
    addEventListener('keydown', e => {
      if (e.repeat) return;
      if (e.key === 'r' || e.key === 'R') h.restart();
      else if (e.key === 'Enter' || e.key === ' ') h.fire();
      else if (e.key === 'Escape') h.back();
    });
  },

  // gamepad: volá se každý snímek
  poll() {
    const p = navigator.getGamepads && [...navigator.getGamepads()].find(x => x);
    if (!p) return;
    const h = this.h, x = p.axes[0] || 0, y = -(p.axes[1] || 0), on = Math.hypot(x, y) > 0.25;
    if (on) {
      if (!this.padAim) this.padAim = h.aimStart();
      if (this.padAim) h.aimVec(x, y);
    } else if (this.padAim) { this.padAim = false; h.aimVec(0, 0); }
    const b = i => p.buttons[i] && p.buttons[i].pressed, edge = i => b(i) && !this.prev[i];
    if (edge(0)) { this.padAim = false; h.fire(); }
    if (edge(3)) h.restart();
    if (edge(1)) h.back();
    this.prev = [b(0), b(1), b(2), b(3)];
  },
};
