'use strict';
// ---------- aplikace: obrazovky, úrovně, propojení vstupu, hlavní smyčka ----------
const App = {
  screen: 'play', // play | menu (výběr úrovně přes zastavenou hru)
  li: 0, game: null, last: 0,
  best: false,    // poslední výhra byla nové nejlepší skóre

  start(i) {
    this.li = i;
    this.game = new Game(LEVELS[i]);
    this.screen = 'play';
    this.best = false;
    R.reset(this.game);
  },
  restart() { this.start(this.li); },
  hasNext() { return this.li + 1 < LEVELS.length; },
  next() { if (this.game.state === 'won' && this.hasNext()) this.start(this.li + 1); },
  menu() { this.screen = 'menu'; UI.sel = this.li; },

  // tlačítko podle id
  act(id) {
    if (id.startsWith('lvl')) { const i = +id.slice(3); if (Save.open(i)) this.start(i); }
    else this[id]();
  },

  init() {
    Save.load();
    R.init(document.getElementById('c'));
    // první spuštění jde rovnou do první úrovně, další do výběru u první nedohrané
    const i = LEVELS.findIndex(l => !Save.get(l.id).s);
    this.start(i < 0 ? 0 : i);
    if (Save.any()) this.menu();
    Input.init(R.cv, {
      down: (px, py) => {
        Sfx.unlock();
        const b = UI.hit(px, py), g = this.game;
        if (b) { this.act(b); return null; }
        if (this.screen === 'menu') return null;
        if (g.state === 'aim') {
          const w = R.toWorld(px, py);
          if (Math.hypot(w.x - SLING.x - g.pull.x, w.y - SLING.y - g.pull.y) < SLING.grab && g.aimStart()) return 'aim';
        } else if (g.ability()) return null;
        return 'pan';
      },
      aimMove: (px, py) => { const w = R.toWorld(px, py); this.game.aimTo(w.x, w.y); },
      aimStart: () => this.screen === 'play' && this.game.aimStart(),
      aimVec: (x, y) => this.game.aimTo(SLING.x + x * SLING.max, SLING.y + y * SLING.max),
      release: () => this.game.release(),
      pan: d => R.pan(d, this.game),
      zoom: f => R.zoom(f),
      fire: () => {
        Sfx.unlock();
        const g = this.game;
        if (this.screen === 'menu') this.act('lvl' + UI.sel);
        else if (g.state === 'aim') g.release();
        else if (g.state === 'won') this.next();
        else g.ability();
      },
      nav: (dx, dy) => {
        if (this.screen !== 'menu') return;
        const i = UI.sel + dx + dy * UI.cols;
        if (i >= 0 && i < LEVELS.length && Save.open(i)) UI.sel = i;
      },
      restart: () => { if (this.screen === 'play') this.restart(); },
      back: () => { if (this.screen === 'play') this.menu(); else this.screen = 'play'; },
    });
    requestAnimationFrame(t => this.frame(t));
  },

  frame(t) {
    const dt = Math.min((t - this.last) / 1000 || 0, 0.1);
    this.last = t;
    Input.poll();
    const g = this.game;
    if (this.screen === 'play') g.update(dt);
    for (const e of g.ev) {
      if (e.k === 'win') this.best = Save.put(g.lvl.id, g.stars(), g.score);
      R.fx(e, g); Sfx.play(e);
    }
    g.ev.length = 0;
    R.draw(g, dt);
    UI.draw(R.ctx, this, R.W, R.H);
    requestAnimationFrame(t => this.frame(t));
  },
};

App.init();
