'use strict';
// ---------- aplikace: úrovně, propojení vstupu, hlavní smyčka ----------
const App = {
  li: 0, game: null, last: 0,

  start(i) {
    this.li = i;
    this.game = new Game(LEVELS[i]);
    R.reset(this.game);
  },
  restart() { this.start(this.li); },
  hasNext() { return this.li + 1 < LEVELS.length; },
  next() { if (this.game.state === 'won' && this.hasNext()) this.start(this.li + 1); },

  init() {
    R.init(document.getElementById('c'));
    this.start(0);
    Input.init(R.cv, {
      down: (px, py) => {
        const b = UI.hit(px, py), g = this.game;
        if (b) { this[b](); return null; }
        if (g.state === 'aim') {
          const w = R.toWorld(px, py);
          if (Math.hypot(w.x - SLING.x - g.pull.x, w.y - SLING.y - g.pull.y) < SLING.grab && g.aimStart()) return 'aim';
        } else if (g.ability()) return null;
        return 'pan';
      },
      aimMove: (px, py) => { const w = R.toWorld(px, py); this.game.aimTo(w.x, w.y); },
      aimStart: () => this.game.aimStart(),
      aimVec: (x, y) => this.game.aimTo(SLING.x + x * SLING.max, SLING.y + y * SLING.max),
      release: () => this.game.release(),
      pan: d => R.pan(d, this.game),
      fire: () => { const g = this.game; if (g.state === 'aim') g.release(); else if (g.state === 'won') this.next(); else g.ability(); },
      restart: () => this.restart(),
      back: () => {},
    });
    requestAnimationFrame(t => this.frame(t));
  },

  frame(t) {
    const dt = Math.min((t - this.last) / 1000 || 0, 0.1);
    this.last = t;
    Input.poll();
    this.game.update(dt);
    R.draw(this.game, dt);
    UI.draw(R.ctx, this.game, R.W, R.H, this.hasNext());
    requestAnimationFrame(t => this.frame(t));
  },
};

App.init();
