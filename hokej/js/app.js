'use strict';
// ---------- Obrazovky, menu, hlavní smyčka ----------
const PERIOD_OPTS = [1, 2, 3, 5, 10, 20];
const App = {
  screen: 'press', sel: 0, game: null, demo: null, t: 0, fps: 60, slots: {}, pauseSel: 0, helpFrom: 'title', speed: 1,

  init() {
    Settings.load();
    const q = new URLSearchParams(location.search);
    this.speed = Math.max(1, Math.min(50, +q.get('speed') || 1));
    this.newDemo();
    if (q.get('auto')) { this.screen = 'game'; this.game = new Game({ home: 0, away: 1, periodLen: (+q.get('len') || 3) * 60, diff: 1, humans: [], silent: !!q.get('mute') }); }
    if (q.get('screen')) this.screen = q.get('screen');
  },
  newDemo() {
    const a = Math.floor(Math.random() * TEAMS.length);
    let b = Math.floor(Math.random() * (TEAMS.length - 1)); if (b >= a) b++;
    this.demo = new Game({ home: a, away: b, periodLen: 240, silent: true, demo: true, humans: [] });
    this.demo.banner = null;
  },
  go(screen, sel = 0) { this.screen = screen; this.sel = sel; Sfx.stick(0.6); },
  menuMove(n, count, dt) {
    const M = Input.merged;
    if (M.nav('up', dt)) { this.sel = (this.sel + count - 1) % count; Sfx.stick(0.4); }
    if (M.nav('down', dt)) { this.sel = (this.sel + 1) % count; Sfx.stick(0.4); }
  },
  lr(dt) { const M = Input.merged; return M.nav('left', dt) ? -1 : M.nav('right', dt) ? 1 : 0; },

  update(dt) {
    this.t += dt;
    if (Input.anyEvent) { Sfx.init(); Sfx.resume(); }
    const M = Input.merged, S = Settings.data;
    if (this.screen !== 'game') {
      this.demo.update(dt);
      if (this.demo.over || this.demo.state === 'final') this.newDemo();
      if (this.demo.state === 'periodEnd') this.demo.nextPeriod();
      this.demo.banner = null; this.demo.lower = null;
    }
    switch (this.screen) {
      case 'press':
        if (M.pressed('a') || M.pressed('start') || (Input.anyEvent && Input.keys.size)) { Sfx.init(); Sfx.resume(); this.go('title'); }
        break;
      case 'title': {
        const items = 4;
        this.menuMove(0, items, dt);
        if (M.pressed('a') || M.pressed('start')) {
          if (this.sel === 0) this.go('setup');
          else if (this.sel === 1) this.go('settings');
          else if (this.sel === 2) { this.helpFrom = 'title'; this.go('help'); }
          else if (this.sel === 3) { try { window.close(); } catch (e) {} this.quitMsg = 3; }
        }
        if (this.quitMsg) this.quitMsg = Math.max(0, this.quitMsg - dt);
        break;
      }
      case 'setup': {
        this.menuMove(0, 5, dt);
        const d = this.lr(dt);
        if (d) {
          const nx = (v, o) => { v = (v + d + TEAMS.length) % TEAMS.length; return v === o ? (v + d + TEAMS.length) % TEAMS.length : v; };
          if (this.sel === 0) S.home = nx(S.home, S.away);
          if (this.sel === 1) S.away = nx(S.away, S.home);
          if (this.sel === 2) { const i = PERIOD_OPTS.indexOf(S.periodLen); S.periodLen = PERIOD_OPTS[clamp((i < 0 ? 2 : i) + d, 0, PERIOD_OPTS.length - 1)]; }
          if (this.sel === 3) S.diff = clamp(S.diff + d, 0, 2);
          Sfx.stick(0.4); Settings.save();
        }
        if (M.pressed('a') || M.pressed('start')) {
          if (this.sel === 4 || M.pressed('start')) { this.initSlots(); this.go('ctrl'); }
          else this.sel = Math.min(4, this.sel + 1);
        }
        if (M.pressed('b')) this.go('title');
        break;
      }
      case 'ctrl': {
        for (const dv of Input.activeDevices()) {
          if (!(dv.id in this.slots)) this.slots[dv.id] = 0;
          if (dv.nav('left', dt)) { this.slots[dv.id] = Math.max(-1, this.slots[dv.id] - 1); Sfx.stick(0.5); }
          if (dv.nav('right', dt)) { this.slots[dv.id] = Math.min(1, this.slots[dv.id] + 1); Sfx.stick(0.5); }
        }
        if (M.pressed('a') || M.pressed('start')) this.startGame();
        else if (M.pressed('b')) this.go('setup', 4);
        break;
      }
      case 'settings': {
        const n = 6;
        this.menuMove(0, n, dt);
        const d = this.lr(dt), a = M.pressed('a');
        if (this.sel === 0 && d) { S.vol = clamp(S.vol + d, 0, 10); Sfx.setVol(S.vol); Sfx.stick(0.8); }
        if (this.sel === 1 && (d || a)) { S.comm = !S.comm; if (S.comm) Voice.say('Komentář zapnut.', true); }
        if (this.sel === 2 && (d || a)) S.replay = !S.replay;
        if (this.sel === 3 && (d || a)) S.fps = !S.fps;
        if (this.sel === 4 && a) this.toggleFull();
        if ((this.sel === 5 && a) || M.pressed('b')) { Settings.save(); this.go('title', 1); }
        if (d || a) Settings.save();
        break;
      }
      case 'help':
        if (M.pressed('a') || M.pressed('b') || M.pressed('start')) {
          if (this.helpFrom === 'pause') { this.screen = 'game'; } else this.go('title', 2);
        }
        break;
      case 'game': {
        const g = this.game;
        if (g.paused) {
          this.menuMove(0, 3, dt);
          if (M.pressed('start') || M.pressed('b')) g.paused = false;
          else if (M.pressed('a')) {
            if (this.sel === 0) g.paused = false;
            else if (this.sel === 1) { this.helpFrom = 'pause'; this.screen = 'help'; }
            else { this.game = null; this.newDemo(); this.go('title'); try { speechSynthesis.cancel(); } catch (e) {} }
          }
          break;
        }
        if (M.pressed('start') && !['final', 'periodEnd'].includes(g.state)) { g.paused = true; this.sel = 0; Sfx.whistle(); break; }
        if (M.pressed('a') || M.pressed('start')) g.confirm();
        for (let i = 0; i < this.speed; i++) g.update(dt);
        if (g.over) { this.game = null; this.newDemo(); this.go('title'); }
        break;
      }
    }
  },
  initSlots() {
    // zachová předchozí rozložení; první ovladač default k domácím
    const act = Input.activeDevices();
    if (!act.some((d) => this.slots[d.id] && this.slots[d.id] !== 0) && act.length) {
      const first = act.find((d) => d.kind === 'pad') || act[0];
      this.slots[first.id] = -1;
    }
  },
  startGame() {
    const S = Settings.data, humans = [];
    for (const d of Input.activeDevices()) {
      const s = this.slots[d.id];
      if (s === -1 && humans.length < 4) humans.push({ dev: d, team: 0 });
      if (s === 1 && humans.length < 4) humans.push({ dev: d, team: 1 });
    }
    Sfx.init(); Sfx.resume();
    this.game = new Game({ home: S.home, away: S.away, periodLen: S.periodLen * 60, diff: S.diff, humans });
    this.screen = 'game'; this.sel = 0;
  },
  toggleFull() {
    try {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    } catch (e) {}
  },

  // ---------- kreslení ----------
  draw(dt) {
    const ctx = R.ctx;
    if (this.screen === 'game' || (this.screen === 'help' && this.helpFrom === 'pause')) {
      R.drawGame(this.game, this.t, dt);
      if (this.game.paused && this.screen === 'game') this.drawPause();
      if (this.screen === 'help') { this.dim(0.75); this.drawHelp(); }
      return;
    }
    // pozadí: ukázkový zápas
    const d = this.demo;
    R.updateCam(d.puck.x, dt, d.camSnap, 0); d.camSnap = false;
    R.drawWorld(d, d.all, d.puck, d.time, dt, { puckSpeed: Math.hypot(d.puck.vx, d.puck.vy) });
    this.dim(this.screen === 'press' ? 0.35 : 0.6);
    if (this.screen === 'press' || this.screen === 'title') this.drawLogo();
    if (this.screen === 'press') {
      if (Math.floor(this.t * 1.6) % 2 === 0) R.chromeText('STISKNI  A  /  START', R.W / 2, 560, 34, '#fff', '#ffd21f');
      ctx.font = font(14, 'bold'); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'center';
      ctx.fillText('1–2 hráči  •  gamepad nebo klávesnice', R.W / 2, 620);
    }
    if (this.screen === 'title') this.drawList(['EXHIBICE', 'NASTAVENÍ', 'OVLÁDÁNÍ', 'UKONČIT'], 470);
    if (this.screen === 'title' && this.quitMsg) {
      ctx.font = font(15, 'bold'); ctx.fillStyle = '#ffd21f'; ctx.textAlign = 'center';
      ctx.fillText('Ukonči přes tlačítko Steam → Ukončit hru (nebo Alt+F4)', R.W / 2, 740);
    }
    if (this.screen === 'setup') this.drawSetup();
    if (this.screen === 'ctrl') this.drawCtrl();
    if (this.screen === 'settings') this.drawSettings();
    if (this.screen === 'help') this.drawHelp();
  },
  dim(a) { R.ctx.fillStyle = `rgba(2,6,20,${a})`; R.ctx.fillRect(0, 0, R.W, R.H); },
  drawLogo() {
    const ctx = R.ctx, cx = R.W / 2, y = 200 + Math.sin(this.t * 1.5) * 4;
    ctx.save(); ctx.translate(cx, y); ctx.transform(1, 0, -0.12, 1, 0, 0);
    ctx.fillStyle = '#c8102e'; ctx.fillRect(-330, 52, 660, 10);
    ctx.fillStyle = '#1d4fb8'; ctx.fillRect(-330, 66, 660, 6);
    ctx.restore();
    R.chromeText('HOKEJ', cx - 70, y - 10, 120, '#ffffff', '#9fc4ff');
    R.chromeText("'98", cx + 215, y - 10, 120, '#fff4c0', '#ffb300');
    ctx.font = font(22); ctx.fillStyle = '#e8eefc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('L E D O V Á   L I G A', cx, y + 100);
  },
  drawList(items, y0, sel = this.sel) {
    const ctx = R.ctx;
    items.forEach((it, i) => {
      const y = y0 + i * 56, on = i === sel;
      if (on) {
        const w = 420, g = ctx.createLinearGradient(R.W / 2 - w / 2, 0, R.W / 2 + w / 2, 0);
        g.addColorStop(0, 'rgba(255,210,31,0)'); g.addColorStop(0.5, 'rgba(255,210,31,0.35)'); g.addColorStop(1, 'rgba(255,210,31,0)');
        ctx.fillStyle = g; ctx.fillRect(R.W / 2 - w / 2, y - 24, w, 48);
        this.puckIcon(R.W / 2 - 190 + Math.sin(this.t * 6) * 4, y);
      }
      R.chromeText(it, R.W / 2, y, on ? 36 : 30, on ? '#fff8d0' : '#ffffff', on ? '#ffcc33' : '#8fa4c8');
    });
  },
  puckIcon(x, y) {
    const ctx = R.ctx;
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y + 3, 14, 7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.ellipse(x, y, 14, 7, 0, 0, TAU); ctx.fill();
  },
  teamLogo(T, x, y, s) {
    const ctx = R.ctx;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(-60, -70); ctx.lineTo(60, -70); ctx.lineTo(60, 10); ctx.quadraticCurveTo(60, 60, 0, 80); ctx.quadraticCurveTo(-60, 60, -60, 10); ctx.closePath();
    ctx.fillStyle = T.c2; ctx.fill();
    ctx.scale(0.86, 0.86); ctx.beginPath(); ctx.moveTo(-60, -70); ctx.lineTo(60, -70); ctx.lineTo(60, 10); ctx.quadraticCurveTo(60, 60, 0, 80); ctx.quadraticCurveTo(-60, 60, -60, 10); ctx.closePath();
    ctx.fillStyle = T.c1; ctx.fill();
    ctx.fillStyle = T.c3; ctx.fillRect(-60, -22, 120, 14);
    ctx.font = font(46); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = lightness(T.c1) > 0.6 ? T.c2 : '#000'; ctx.strokeText(T.abbr, 0, 22);
    ctx.fillStyle = lightness(T.c1) > 0.6 ? '#111' : '#fff'; ctx.fillText(T.abbr, 0, 22);
    ctx.restore();
  },
  teamCard(T, x, y, label, on) {
    const ctx = R.ctx, w = 380, h = 330;
    R.panel(x - w / 2, y, w, h, 0.85);
    if (on) { ctx.strokeStyle = '#ffd21f'; ctx.lineWidth = 3; ctx.strokeRect(x - w / 2 + 1.5, y + 1.5, w - 3, h - 3); }
    ctx.font = font(18); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#9fe3ff'; ctx.fillText(label, x, y + 22);
    this.teamLogo(T, x, y + 110, 0.8);
    if (on) {
      ctx.fillStyle = '#ffd21f'; ctx.font = font(36);
      ctx.fillText('◄', x - 150 - Math.sin(this.t * 6) * 3, y + 110); ctx.fillText('►', x + 150 + Math.sin(this.t * 6) * 3, y + 110);
    }
    R.chromeText(T.city.toUpperCase(), x, y + 200, 28);
    ctx.font = font(18, 'bold'); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(T.name.toUpperCase(), x, y + 228);
    const bars = [['ÚTOK', T.off], ['OBRANA', T.def], ['BRANKÁŘ', T.gk], ['RYCHLOST', T.spd]];
    bars.forEach(([n, v], i) => {
      const yy = y + 254 + i * 17;
      ctx.font = font(11, 'bold'); ctx.textAlign = 'right'; ctx.fillStyle = '#cfd8ea'; ctx.fillText(n, x - 70, yy);
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x - 60, yy - 5, 200, 10);
      ctx.fillStyle = v >= 88 ? '#4cff7a' : v >= 85 ? '#ffd21f' : '#ff9a3a'; ctx.fillRect(x - 60, yy - 5, 200 * (v - 60) / 35, 10);
      ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.fillText(String(v), x + 146, yy);
    });
  },
  drawSetup() {
    const ctx = R.ctx, S = Settings.data;
    R.chromeText('EXHIBICE', R.W / 2, 50, 46);
    this.teamCard(TEAMS[S.home], R.W / 2 - 230, 90, 'DOMÁCÍ', this.sel === 0);
    this.teamCard(TEAMS[S.away], R.W / 2 + 230, 90, 'HOSTÉ', this.sel === 1);
    R.chromeText('VS', R.W / 2, 250, 54, '#fff', '#ff5a3c');
    const rows = [['DÉLKA TŘETINY', S.periodLen + ' MIN'], ['OBTÍŽNOST', DIFF[S.diff].name.toUpperCase()]];
    rows.forEach(([n, v], i) => {
      const y = 470 + i * 50, on = this.sel === i + 2;
      R.panel(R.W / 2 - 300, y - 21, 600, 42, on ? 0.95 : 0.6);
      if (on) { ctx.strokeStyle = '#ffd21f'; ctx.lineWidth = 2; ctx.strokeRect(R.W / 2 - 299, y - 20, 598, 40); }
      ctx.font = font(18); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = '#cfd8ea'; ctx.fillText(n, R.W / 2 - 280, y);
      ctx.textAlign = 'right'; ctx.fillStyle = on ? '#ffd21f' : '#fff'; ctx.fillText((on ? '◄  ' : '') + v + (on ? '  ►' : ''), R.W / 2 + 280, y);
    });
    const on = this.sel === 4;
    R.chromeText('POKRAČOVAT  ►', R.W / 2, 600, on ? 38 : 30, on ? '#fff8d0' : '#fff', on ? '#ffcc33' : '#8fa4c8');
    ctx.font = font(14, 'bold'); ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.textAlign = 'center';
    ctx.fillText('↑↓ výběr   ◄► změna   A potvrdit   B zpět', R.W / 2, 760);
  },
  drawCtrl() {
    const ctx = R.ctx, S = Settings.data;
    R.chromeText('VÝBĚR OVLADAČŮ', R.W / 2, 50, 44);
    const cols = [R.W / 2 - 360, R.W / 2, R.W / 2 + 360];
    const heads = [TEAMS[S.home], null, TEAMS[S.away]];
    heads.forEach((T, i) => {
      if (T) { this.teamLogo(T, cols[i], 160, 0.6); R.chromeText(T.city.toUpperCase(), cols[i], 240, 24); ctx.font = font(14, 'bold'); ctx.fillStyle = '#9fe3ff'; ctx.textAlign = 'center'; ctx.fillText(i === 0 ? 'DOMÁCÍ' : 'HOSTÉ', cols[i], 266); }
      else { ctx.font = font(18); ctx.fillStyle = '#8fa4c8'; ctx.textAlign = 'center'; ctx.fillText('POČÍTAČ', cols[1], 160); ctx.font = font(13, 'bold'); ctx.fillText('(nehraje)', cols[1], 186); }
    });
    const devs = Input.activeDevices();
    if (!devs.length) {
      ctx.font = font(18, 'bold'); ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.fillText('Stiskni tlačítko na ovladači, aby se objevil.', R.W / 2, 380);
    }
    devs.forEach((d, i) => {
      const s = this.slots[d.id] || 0, x = cols[s + 1], y = 320 + i * 74;
      const col = d.kind === 'pad' ? '#2ee6ff' : '#ffd21f';
      R.panel(x - 130, y, 260, 58, 0.9);
      ctx.strokeStyle = s ? col : 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.strokeRect(x - 129, y + 1, 258, 56);
      ctx.font = font(18); ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.name.toUpperCase(), x, y + 22);
      ctx.font = font(11, 'bold'); ctx.fillStyle = '#aab';
      ctx.fillText(s === 0 ? '◄  posuň k týmu  ►' : s < 0 ? 'hraje za domácí  ►' : '◄  hraje za hosty', x, y + 44);
    });
    const hum = devs.filter((d) => this.slots[d.id]).length;
    R.chromeText(hum ? 'A  =  ZAČÍT ZÁPAS' : 'A  =  SLEDOVAT (CPU vs CPU)', R.W / 2, 690, 30, '#fff8d0', '#ffcc33');
    ctx.font = font(14, 'bold'); ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.textAlign = 'center';
    ctx.fillText('Každý hráč posune svůj ovladač páčkou doleva/doprava.  Dva na jedné straně = spolupráce.   B zpět', R.W / 2, 750);
  },
  drawSettings() {
    const ctx = R.ctx, S = Settings.data;
    R.chromeText('NASTAVENÍ', R.W / 2, 90, 46);
    const rows = [['HLASITOST', '▮'.repeat(S.vol) + '▯'.repeat(10 - S.vol)], ['KOMENTÁŘ (HLAS)', S.comm ? 'ZAP' : 'VYP'],
      ['ZÁZNAM PO GÓLU', S.replay ? 'ZAP' : 'VYP'], ['ZOBRAZIT FPS', S.fps ? 'ZAP' : 'VYP'], ['CELÁ OBRAZOVKA', document.fullscreenElement ? 'ZAP' : 'VYP'], ['ZPĚT', '']];
    rows.forEach(([n, v], i) => {
      const y = 200 + i * 66, on = this.sel === i;
      R.panel(R.W / 2 - 330, y - 25, 660, 50, on ? 0.95 : 0.6);
      if (on) { ctx.strokeStyle = '#ffd21f'; ctx.lineWidth = 2; ctx.strokeRect(R.W / 2 - 329, y - 24, 658, 48); }
      ctx.font = font(20); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = on ? '#fff' : '#cfd8ea'; ctx.fillText(n, R.W / 2 - 305, y);
      ctx.textAlign = 'right'; ctx.fillStyle = on ? '#ffd21f' : '#fff'; ctx.fillText(v, R.W / 2 + 305, y);
    });
    ctx.font = font(13, 'bold'); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'center';
    ctx.fillText('Komentář používá hlasovou syntézu systému — na některých zařízeních nemusí být k dispozici.', R.W / 2, 610);
  },
  drawHelp() {
    const ctx = R.ctx;
    R.chromeText('OVLÁDÁNÍ', R.W / 2, 60, 46);
    const L = [
      ['LEVÁ PÁČKA', 'bruslení (i D-pad)'], ['RT / RB', 'sprint (spotřebovává sílu)'],
      ['', ''], ['S PUKEM', ''],
      ['A', 'přihrávka (ve směru páčky)'], ['X', 'střela — ťukni = zápěstí, drž = příklep'],
      ['X během přihrávky k tobě', 'golfák z první (one-timer)'], ['B', 'klička'], ['Y', 'lobovaná přihrávka / nahození'],
      ['↑ / ↓ při střele', 'mířit na vzdálenou / bližší tyč'],
      ['', ''], ['BEZ PUKU', ''],
      ['A', 'přepnout na hráče nejblíž puku'], ['X', 'bodyček'], ['B', 'šťouchnutí holí (poke)'],
      ['A když má puk spoluhráč', '„dej mi ho!" — přihraje ti'], ['BULY', 'stiskni A/X přesně, když puk dopadne'],
      ['MENU / START', 'pauza'],
    ];
    L.forEach(([a, b], i) => {
      const y = 120 + i * 30;
      if (!a && !b) return;
      if (!b) { ctx.font = font(18); ctx.fillStyle = '#ffd21f'; ctx.textAlign = 'center'; ctx.fillText(a, R.W / 2, y); return; }
      ctx.font = font(16); ctx.textBaseline = 'middle'; ctx.textAlign = 'right'; ctx.fillStyle = '#9fe3ff'; ctx.fillText(a, R.W / 2 - 20, y);
      ctx.font = font(16, 'bold'); ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.fillText(b, R.W / 2 + 20, y);
    });
    ctx.font = font(12, 'bold'); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'center';
    ctx.fillText('Klávesnice 1: WASD, J=A, K=X, L=B, I=Y, Mezerník=sprint, Esc=pauza   •   Klávesnice 2: šipky, Num1=A, Num2=X, Num3=B, Num5=Y, Num0=sprint, Enter=pauza', R.W / 2, 690);
    ctx.font = font(14, 'bold'); ctx.fillStyle = '#ffd21f'; ctx.fillText('A / B — zpět', R.W / 2, 740);
  },
  drawPause() {
    this.dim(0.6);
    R.chromeText('PAUZA', R.W / 2, 220, 64);
    this.drawList(['POKRAČOVAT', 'OVLÁDÁNÍ', 'UKONČIT ZÁPAS'], 360);
  },
};

// ---------- start ----------
(function main() {
  const cv = document.getElementById('c');
  R.init(cv);
  Input.init();
  App.init();
  try { if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => Voice.pickVoice(); } catch (e) {}
  // zvuk: s --autoplay-policy=no-user-gesture-required běží hned, jinak po první klávese
  Sfx.init();
  const unlock = () => { Sfx.init(); Sfx.resume(); };
  window.addEventListener('keydown', unlock); window.addEventListener('pointerdown', unlock);
  let last = performance.now();
  function frame(ts) {
    const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000)) || 1 / 60;
    last = ts;
    App.fps = lerp(App.fps, 1 / Math.max(dt, 0.001), 0.05);
    Input.poll(dt);
    try { App.update(dt); } catch (e) { console.error(e); }
    R.begin();
    try { App.draw(dt); } catch (e) { console.error(e); }
    R.end();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__app = App;
})();
