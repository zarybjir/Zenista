'use strict';
// ---------- aplikace: obrazovky, úrovně, propojení vstupu, hlavní smyčka ----------
const App = {
  screen: 'play', // play | menu (výběr úrovně) | title (hlavní nabídka); nabídky leží přes zastavenou hru
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
  title() { this.screen = 'title'; UI.tsel = 0; },
  sound() { Save.setOpt('snd', !Save.opt.snd); Sfx.on = Save.opt.snd; },
  // o obrazovku zpět: úroveň → výběr → hlavní nabídka; false = už není kam
  back() {
    if (this.screen === 'play') this.menu();
    else if (this.screen === 'menu') this.title();
    else return false;
    return true;
  },

  // tlačítko podle id
  act(id) {
    if (id.startsWith('lvl')) { const i = +id.slice(3); if (Save.open(i)) this.start(i); }
    else this[id]();
  },

  init() {
    Save.load();
    Sfx.on = Save.opt.snd;
    R.init(document.getElementById('c'));
    // první spuštění jde rovnou do první úrovně, další do hlavní nabídky
    const i = LEVELS.findIndex(l => !Save.get(l.id).s);
    this.start(i < 0 ? 0 : i);
    if (Save.any()) this.title();
    Input.init(R.cv, {
      down: (px, py) => {
        Sfx.unlock();
        const b = UI.hit(px, py), g = this.game;
        if (b) { this.act(b); return null; }
        if (this.screen !== 'play') return null;
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
        if (this.screen === 'title') this.act(UI.tsel ? 'sound' : 'menu');
        else if (this.screen === 'menu') this.act('lvl' + UI.sel);
        else if (g.state === 'aim') g.release();
        else if (g.state === 'won') this.next();
        else g.ability();
      },
      nav: (dx, dy) => {
        if (this.screen === 'title') { if (dy) UI.tsel = clamp(UI.tsel + dy, 0, 1); return; }
        if (this.screen !== 'menu') return;
        const i = UI.sel + dx + dy * UI.cols;
        if (i >= 0 && i < LEVELS.length && Save.open(i)) UI.sel = i;
      },
      restart: () => { if (this.screen === 'play') this.restart(); },
      back: () => { this.back(); },
    });
    // smyčka se spustí až po načtení grafiky
    R.load().then(() => requestAnimationFrame(t => this.frame(t)), () => {
      const c = R.ctx;
      c.fillStyle = '#fff'; c.font = '18px system-ui, sans-serif';
      c.fillText('Grafiku se nepodařilo načíst.', 24, 40);
    });
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

// tlačítko Zpět v Android obalu; false = obal pošle aplikaci do pozadí
window.rybyBack = () => App.back();

App.init();
