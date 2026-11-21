'use strict';
// ---------- Herní logika: fyzika, pravidla, AI ----------
const DIFF = [
  { name: 'Lehká', cpuSpd: 0.9, cpuAcc: 0.7, cpuGk: -0.1, myGk: 0.06, think: 0.34, aggr: 0.55, fo: -0.12 },
  { name: 'Normální', cpuSpd: 0.97, cpuAcc: 1.0, cpuGk: -0.02, myGk: 0.02, think: 0.22, aggr: 0.9, fo: 0 },
  { name: 'Těžká', cpuSpd: 1.04, cpuAcc: 1.2, cpuGk: 0.05, myGk: -0.02, think: 0.13, aggr: 1.3, fo: 0.12 },
];
const PH = { ACC: 40, MAXV: 25, TURBO: 1.27, GLIDE: 0.55, PF: 0.2, G: 32, PR: 0.3, PLR: 1.3, GR: 1.7, BE: 0.6 };
const HUMAN_COLORS = ['#ffd21f', '#2ee6ff', '#ff4fd8', '#7dff4f'];
const PERIOD_NAMES = ['', '1. TŘETINA', '2. TŘETINA', '3. TŘETINA', 'PRODLOUŽENÍ'];

function lightness(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

class Player {
  constructor(team, info) {
    Object.assign(this, { team, role: info.role, name: info.name, first: info.first, num: info.num, hand: info.hand,
      spd: info.spd, sht: info.sht, pas: info.pas, chk: info.chk, gk: info.gk });
    this.isGoalie = info.role === 'G';
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.dir = 0;
    this.stride = Math.random() * 6; this.spdN = 0; this.carry = false;
    this.downT = 0; this.lie = 0; this.checkT = 0; this.checkHit = false; this.pokeA = 0; this.pokeCD = 0; this.checkCD = 0;
    this.winding = false; this.windT = 0; this.dekeT = 0; this.recoverT = 0; this.saveT = 0; this.saveKind = 0; this.holdT = 0;
    this.stamina = 1; this.turbo = false; this.ctrl = -1; this.pickCD = 0; this.inX = 0; this.inY = 0; this.faceDir = null;
    this.oneTimerQ = false;
    this.ai = { t: Math.random() * 0.2, wind: 0, ph: Math.random() * 10, tx: 0, ty: 0 };
    this.stats = { g: 0, a: 0, s: 0, h: 0, sv: 0, sa: 0 };
  }
}

class Game {
  constructor(cfg) {
    this.cfg = cfg; this.silent = !!cfg.silent; this.demo = !!cfg.demo;
    this.diff = DIFF[cfg.diff == null ? 1 : cfg.diff];
    this.periodLen = cfg.periodLen || 180;
    this.time = 0; this.period = 1; this.clock = this.periodLen; this.acc = 0;
    this.teams = [this.makeTeam(cfg.home, 0), this.makeTeam(cfg.away, 1)];
    this.all = [...this.teams[0].players, ...this.teams[1].players];
    this.puck = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, owner: null, held: null, passTarget: null, passT: 0, wasPass: false,
      shot: null, lastTouch: null, history: [], oneTimer: false, reboundT: 0, deflT: 0, ignore: new Map(), drop: false, inNet: 0 };
    this.humans = (cfg.humans || []).map((h, i) => ({ idx: i, dev: h.dev, team: this.teams[h.team], player: null, foPress: -9, color: HUMAN_COLORS[i % 4] }));
    for (const h of this.humans) h.team.humans.push(h);
    for (const t of this.teams) t.cpu = t.humans.length === 0;
    this.vsHuman = this.humans.length > 0 && this.teams.some((t) => t.cpu);
    for (const t of this.teams) t.spdMod = t.cpu && this.vsHuman ? this.diff.cpuSpd : 1;
    this.setColors();
    this.banner = null; this.pops = []; this.lower = null; this.shake = 0; this.goalLight = 0; this.goalLightT = 0;
    this.rec = []; this.recSkip = 0; this.replay = null; this.paused = false; this.over = false; this.goals = [];
    this.state = 'intro'; this.stateT = 0;
    this.setDirs();
    this.setupFaceoff(0, 0);
    this.state = 'intro';
    this.showBanner(PERIOD_NAMES[1], this.teams[0].def.city + ' vs ' + this.teams[1].def.city, 2.2);
    if (!this.silent) { Sfx.organ(0); this.say('Vítejte u zápasu. ' + this.teams[0].def.city + ' proti ' + this.teams[1].def.city + '.', true); }
  }

  // ---------- pomocné ----------
  makeTeam(idx, side) {
    const def = TEAMS[idx];
    const t = { idx, def, side, dir: 1, players: [], skaters: [], goalie: null, score: 0, shots: 0, hits: 0, humans: [],
      chaser: null, presser: null, marks: new Map(), thinkT: Math.random() * 0.15, cpu: true, spdMod: 1 };
    for (const r of buildRoster(idx)) {
      const p = new Player(t, r);
      t.players.push(p);
      if (p.isGoalie) t.goalie = p; else t.skaters.push(p);
    }
    return t;
  }
  setColors() {
    const [h, a] = this.teams;
    h.jersey = h.def.c1; h.stripe = h.def.c2;
    if (lightness(h.def.c1) > 0.7) {
      a.jersey = a.def.c1; a.stripe = a.def.c2;
      if (lightness(a.def.c1) > 0.7) { a.jersey = a.def.c2; a.stripe = a.def.c1; }
    } else { a.jersey = '#f2f2f2'; a.stripe = a.def.c1; }
    for (const t of this.teams) {
      const L = lightness(t.jersey);
      t.numCol = L > 0.6 ? (lightness(t.stripe) < 0.6 ? t.stripe : '#111') : '#ffffff';
      t.helmet = L > 0.7 ? (lightness(t.stripe) < 0.7 ? t.stripe : t.def.pants) : t.jersey;
      t.pants = t.def.pants;
    }
  }
  setDirs() {
    const flip = this.period % 2 === 0;
    this.teams[0].dir = flip ? -1 : 1;
    this.teams[1].dir = -this.teams[0].dir;
  }
  other(t) { return t === this.teams[0] ? this.teams[1] : this.teams[0]; }
  sfx(n, ...a) { if (!this.silent) Sfx[n](...a); }
  say(text, prio, chance) { if (!this.silent) Voice.say(text, prio, chance); }
  showBanner(text, sub, dur = 2, color) { this.banner = { text, sub, t: 0, dur, color }; }
  pop(text, x, y, color = '#fff') { this.pops.push({ text, x, y, t: 0, color }); }
  thinkFor(t) { return t.cpu && this.vsHuman ? this.diff.think : 0.2; }
  aggrFor(t) { return t.cpu && this.vsHuman ? this.diff.aggr : 0.85; }

  // ---------- buly ----------
  setupFaceoff(fx, fy) {
    this.foSpot = [fx, fy];
    for (const t of this.teams) {
      const s = t.dir;
      const pos = { C: [fx - s * 2.4, fy], LW: [fx - s * 4, fy + s * 15], RW: [fx - s * 4, fy - s * 15], LD: [fx - s * 17, fy + s * 10], RD: [fx - s * 17, fy - s * 10] };
      for (const p of t.skaters) {
        let [x, y] = pos[p.role];
        x = clamp(x, -85, 85); const hw = rinkHalfWidthAt(x) - 3; y = clamp(y, -hw, hw);
        Object.assign(p, { x, y, vx: 0, vy: 0, dir: s > 0 ? 0 : Math.PI, downT: 0, checkT: 0, pokeA: 0, winding: false, windT: 0,
          dekeT: 0, recoverT: 0, inX: 0, inY: 0, turbo: false, oneTimerQ: false, pickCD: 0, faceDir: null });
        p.ai.t = rand(0, 0.3);
      }
      const g = t.goalie;
      Object.assign(g, { x: -s * (RINK.GOAL_X - 2.5), y: 0, vx: 0, vy: 0, dir: s > 0 ? 0 : Math.PI, holdT: 0, saveT: 0, downT: 0 });
      g.ai.tx = g.x; g.ai.ty = g.y;
    }
    const pk = this.puck;
    Object.assign(pk, { x: fx, y: fy, z: 4.5, vx: 0, vy: 0, vz: 0, owner: null, held: null, passTarget: null, passT: 0, wasPass: false,
      shot: null, lastTouch: null, history: [], oneTimer: false, reboundT: 0, deflT: 0, drop: false, inNet: 0 });
    pk.ignore.clear();
    for (const t of this.teams) {
      for (const p of t.players) p.ctrl = -1;
      const order = ['C', 'RW', 'LW', 'LD', 'RD'];
      t.humans.forEach((h, i) => { const p = t.skaters.find((q) => q.role === order[i % 5]); h.player = p; p.ctrl = h.idx; h.foPress = -9; });
    }
    this.state = 'faceoff'; this.stateT = 0; this.camSnap = true;
  }
  resolveFaceoff() {
    const c = this.teams.map((t) => t.skaters.find((p) => p.role === 'C'));
    let pr0 = 0.5 + (c[0].pas - c[1].pas) * 0.6;
    for (let i = 0; i < 2; i++) {
      const t = this.teams[i];
      let bonus = 0;
      const h = this.humans.find((q) => q.player === c[i]);
      if (h) { const d = this.time - h.foPress; if (d >= 0 && d < 0.4) bonus = 0.3; else if (d < 1.0) bonus = 0.08; }
      else if (t.cpu && this.vsHuman) bonus = this.diff.fo;
      pr0 += i === 0 ? bonus : -bonus;
    }
    const win = Math.random() < clamp(pr0, 0.08, 0.92) ? 0 : 1;
    const s = this.teams[win].dir, [fx, fy] = this.foSpot, pk = this.puck;
    const tx = fx - s * 14, ty = fy + rand(-9, 9), d = Math.hypot(tx - fx, ty - fy), sp = rand(13, 19);
    pk.vx = ((tx - fx) / d) * sp; pk.vy = ((ty - fy) / d) * sp; pk.z = 0; pk.vz = 0;
    pk.lastTouch = c[win]; pk.history = [c[win]];
    c[0].pickCD = c[1].pickCD = 0.2;
    this.state = 'play'; this.stateT = 0;
    this.sfx('stick', 0.7);
  }

  // ---------- hlavní smyčka ----------
  update(dt) {
    if (this.paused) return;
    this.handleHumans(dt);
    this.acc += dt;
    const h = 1 / 120; let n = 0;
    while (this.acc >= h && n < 10) { this.step(h); this.acc -= h; n++; }
    if (n >= 10) this.acc = 0;
    // efekty
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.dur) this.banner = null; }
    if (this.lower) { this.lower.t += dt; if (this.lower.t > this.lower.dur) this.lower = null; }
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < 1.6);
    this.shake = Math.max(0, this.shake - dt * 2);
    this.goalLightT = Math.max(0, this.goalLightT - dt);
    // nadšení davu
    const pk = this.puck;
    let ex = clamp((Math.abs(pk.x) - 45) / 45, 0, 1) * 0.7;
    if (pk.shot) ex = 0.9;
    if (this.state === 'goal') ex = 1;
    Sfx.target = ex;
    Sfx.tick(dt, this.silent ? 0.45 : 1);
  }
  step(h) {
    this.time += h; this.stateT += h;
    const pk = this.puck;
    switch (this.state) {
      case 'intro':
        this.freeze();
        if (this.stateT > 2.2) { this.state = 'faceoff'; this.stateT = 0; }
        break;
      case 'faceoff':
        this.freeze();
        this.goalieMoveAll(h);
        if (!pk.drop && this.stateT > 0.9) { pk.drop = true; }
        if (pk.drop) { pk.vz -= PH.G * h; pk.z += pk.vz * h; if (pk.z <= 0) { pk.z = 0; this.resolveFaceoff(); } }
        break;
      case 'play':
        this.clock -= h;
        this.thinkAll(h);
        this.movePlayers(h);
        this.updatePuck(h);
        this.record();
        if (this.clock <= 0 && this.state === 'play') { this.clock = 0; this.endPeriod(); }
        break;
      case 'stop':
        this.glide(); this.movePlayers(h); this.updatePuck(h);
        if (this.stateT > 1.4) {
          this.setupFaceoff(this.stopSpot[0], this.stopSpot[1]);
          if (Math.random() < 0.5) this.sfx('organ', Math.floor(Math.random() * 4));
        }
        break;
      case 'goal':
        this.glide(); this.movePlayers(h); this.updatePuck(h);
        if (this.stateT < 1.2) this.record();
        if (this.stateT > 3.6) this.afterGoal();
        break;
      case 'replay': {
        const r = this.replay;
        r.f += h * 60 * 0.55;
        if (r.f >= r.frames.length - 1) this.endReplay();
        break;
      }
      case 'periodEnd':
        if (this.stateT > 14) this.nextPeriod();
        break;
      case 'final':
        if (this.demo && this.stateT > 6) this.over = true;
        break;
    }
  }
  confirm() {
    if (this.state === 'replay') this.endReplay();
    else if (this.state === 'goal' && this.stateT > 1.2) this.afterGoal();
    else if (this.state === 'periodEnd' && this.stateT > 1.2) this.nextPeriod();
    else if (this.state === 'final' && this.stateT > 1.5) this.over = true;
  }
  freeze() {
    for (const p of this.all) {
      p.vx = 0; p.vy = 0; p.spdN = 0; p.carry = false;
      if (!p.isGoalie) { const s = p.team.dir; p.dir = s > 0 ? 0 : Math.PI; }
    }
  }
  glide() { for (const p of this.all) { if (p.ctrl < 0 || this.state !== 'play') { p.inX = 0; p.inY = 0; p.turbo = false; p.winding = false; p.windT = 0; } } }

  // ---------- lidští hráči ----------
  handleHumans() {
    const pk = this.puck;
    for (const h of this.humans) {
      const d = h.dev, p = h.player;
      if (!p) continue;
      const st = d.st;
      p.inX = st.lx; p.inY = -st.ly; p.turbo = st.rt || st.rb;
      if (this.state === 'faceoff') { if (d.pressed('a') || d.pressed('x')) h.foPress = this.time; continue; }
      if (this.state !== 'play') continue;
      if (d.pressed('a')) {
        if (pk.owner === p) this.pass(p, this.choosePassTarget(p, p.inX, p.inY), false);
        else if (pk.owner && pk.owner.team === p.team && pk.owner.ctrl < 0) this.pass(pk.owner, p, false);
        else if (pk.held && pk.held.team === p.team) this.passTo(pk.held, p.x, p.y, false, p);
        else this.switchPlayer(h);
      }
      if (d.pressed('x')) {
        const q = h.player;
        if (pk.owner === q) { q.winding = true; q.windT = 0; }
        else if (!pk.owner && pk.passTarget === q) q.oneTimerQ = true;
        else this.startCheck(q);
      }
      const cur = h.player;
      if (cur.winding && !st.x) this.releaseShot(cur);
      if (d.pressed('b')) { if (pk.owner === cur) this.deke(cur); else this.poke(cur); }
      if (d.pressed('y')) { if (pk.owner === cur) this.saucer(cur, cur.inX, cur.inY); else this.switchPlayer(h); }
    }
  }
  switchPlayer(h) {
    const pk = this.puck; let best = null, bd = 1e9;
    for (const q of h.team.skaters) {
      if (q === h.player || (q.ctrl >= 0 && q.ctrl !== h.idx)) continue;
      const d = Math.hypot(q.x - pk.x, q.y - pk.y) + (q.downT > 0 ? 30 : 0);
      if (d < bd) { bd = d; best = q; }
    }
    if (best) this.assign(h, best);
  }
  assign(h, p) {
    if (h.player === p) return;
    if (h.player) { h.player.ctrl = -1; h.player.winding = false; h.player.windT = 0; }
    h.player = p; p.ctrl = h.idx; p.oneTimerQ = false;
  }

  // ---------- akce ----------
  choosePassTarget(p, ix, iy) {
    const m = Math.hypot(ix, iy), a = m > 0.3 ? Math.atan2(iy, ix) : p.dir;
    let best = null, bs = 1e9;
    for (const q of p.team.skaters) {
      if (q === p || q.downT > 0) continue;
      const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
      let s = Math.abs(angDiff(a, Math.atan2(dy, dx))) * 45 + d * 0.22;
      if (this.laneBlocked(p, q)) s += 14;
      if (s < bs) { bs = s; best = q; }
    }
    return best;
  }
  laneBlocked(p, q) {
    for (const o of this.other(p.team).skaters) {
      if (o.downT > 0) continue;
      if (segDist(o.x, o.y, p.x, p.y, q.x, q.y) < 3.2) {
        const t = ((o.x - p.x) * (q.x - p.x) + (o.y - p.y) * (q.y - p.y)) / ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 + 0.01);
        if (t > 0.08 && t < 0.95) return true;
      }
    }
    return false;
  }
  pass(p, m, saucer) { if (m) this.passTo(p, m.x, m.y, saucer, m); }
  passTo(p, tx, ty, saucer, m) {
    const pk = this.puck;
    if (pk.owner !== p && pk.held !== p) return;
    let dist = Math.hypot(tx - pk.x, ty - pk.y);
    let speed = saucer ? clamp(dist * 0.8 + 22, 30, 62) : clamp(dist * 0.7 + 40, 46, 84);
    if (m) for (let i = 0; i < 2; i++) {
      const t = dist / speed;
      tx = m.x + m.vx * t * 0.85; ty = m.y + m.vy * t * 0.85;
      dist = Math.hypot(tx - pk.x, ty - pk.y);
    }
    const ang = Math.atan2(ty - pk.y, tx - pk.x) + gauss() * (1.15 - p.pas) * 0.07;
    pk.owner = null; pk.held = null;
    pk.vx = Math.cos(ang) * speed; pk.vy = Math.sin(ang) * speed;
    if (saucer) { const t = dist / speed; pk.vz = PH.G * t * 0.5; pk.z = 0.3; } else { pk.vz = 0; pk.z = 0; }
    pk.passTarget = m || null; pk.passT = dist / speed + 0.6; pk.wasPass = true; pk.shot = null; pk.oneTimer = false;
    pk.lastTouch = p; p.pickCD = 0.3; p.winding = false; p.windT = 0;
    if (p.isGoalie) { p.holdT = 0; pk.ignore.set(p, this.time + 0.8); }
    this.sfx('stick', 0.7);
  }
  saucer(p, ix, iy) {
    const s = p.team.dir, m = Math.hypot(ix, iy);
    const q = m > 0.3 ? this.choosePassTarget(p, ix, iy) : null;
    if (q && Math.abs(angDiff(Math.atan2(iy, ix), Math.atan2(q.y - p.y, q.x - p.x))) < 0.6) this.pass(p, q, true);
    else this.dump(p);
  }
  dump(p) {
    const s = p.team.dir;
    this.passTo(p, s * 84, (p.y >= 0 ? 1 : -1) * 28 * (Math.random() < 0.3 ? -1 : 1), true, null);
  }
  releaseShot(p) {
    const w = p.windT;
    const aim = p.ctrl >= 0 && Math.abs(p.inY) > 0.35 ? sgn(p.inY) : null;
    if (w < 0.22) this.shoot(p, 0, false, aim, false);
    else this.shoot(p, clamp((w - 0.22) / 0.75, 0, 1), true, aim, false);
  }
  shoot(p, power, slap, aimY, oneTimer) {
    const pk = this.puck;
    if (pk.owner !== p) { p.winding = false; p.windT = 0; return; }
    const s = p.team.dir, nx = s * RINK.GOAL_X, g = this.other(p.team).goalie;
    let ty;
    if (aimY != null) ty = aimY * 2.45;
    else {
      const off = g.y;
      ty = (Math.abs(off) > 0.4 ? -sgn(off) : pick([-1, 1])) * 2.45;
      if (Math.random() < 0.25) ty *= rand(0, 0.6);
    }
    const tz = slap ? rand(0.15, 3.6) : rand(0.25, 3.3);
    const dx = nx - pk.x, dy = ty - pk.y, d = Math.hypot(dx, dy);
    const speed = slap ? (80 + 38 * power) * p.sht : 58 + 16 * p.sht;
    let err = (slap ? 0.05 : 0.036) * (1.3 - p.sht) + clamp(d / 100, 0, 0.6) * 0.03;
    if (p.team.cpu && this.vsHuman) err *= 2 - this.diff.cpuAcc;
    if (oneTimer) err *= 1.25;
    const ang = Math.atan2(dy, dx) + gauss() * err;
    const t = d / speed, vz = (tz + 0.5 * PH.G * t * t) / t;
    pk.owner = null; pk.vx = Math.cos(ang) * speed; pk.vy = Math.sin(ang) * speed; pk.vz = vz; pk.z = 0.1;
    pk.shot = { by: p, team: p.team, t: this.time, counted: false, dist: d };
    pk.oneTimer = !!oneTimer; pk.passTarget = null; pk.wasPass = false; pk.lastTouch = p; p.pickCD = 0.35;
    p.winding = false; p.windT = 0;
    if (slap) this.sfx('slap', 0.6 + 0.4 * power); else this.sfx('stick', 1);
    if (oneTimer) this.pop('Z PRVNÍ!', p.x, p.y, '#ffd21f');
  }
  startCheck(p) {
    if (p.checkCD > 0 || p.downT > 0 || p.carry) return;
    p.checkCD = 0.9; p.checkT = 0.4; p.checkHit = false;
    p.vx += Math.cos(p.dir) * 9; p.vy += Math.sin(p.dir) * 9;
    const sp = Math.hypot(p.vx, p.vy); if (sp > 34) { p.vx *= 34 / sp; p.vy *= 34 / sp; }
  }
  poke(p) {
    if (p.pokeCD > 0 || p.downT > 0) return;
    p.pokeCD = 0.55; p.pokeA = 1;
    const pk = this.puck, bx = p.x + Math.cos(p.dir) * 4.2, by = p.y + Math.sin(p.dir) * 4.2;
    const o = pk.owner;
    if (o && o.team !== p.team) {
      const d = Math.hypot(pk.x - bx, pk.y - by), dd = Math.hypot(pk.x - p.x, pk.y - p.y);
      if (d < 3.2 || dd < 4.2) {
        let ch = 0.4 + 0.35 * (p.chk - 1);
        if (p.team.cpu && this.vsHuman) ch += (this.diff.aggr - 1) * 0.15;
        if (o.dekeT > 0) ch *= 0.3;
        if (o.winding) ch += 0.2;
        if (Math.random() < ch) {
          const a = Math.atan2(pk.y - p.y, pk.x - p.x) + rand(-0.9, 0.9), v = rand(9, 17);
          this.loosePuck(o, Math.cos(a) * v + o.vx * 0.3, Math.sin(a) * v + o.vy * 0.3);
          p.pickCD = 0.1;
          this.sfx('stick', 0.8);
        }
      }
    } else if (!o && !pk.held && pk.z < 1.5 && Math.hypot(pk.x - bx, pk.y - by) < 3) {
      pk.vx = Math.cos(p.dir) * 14 + p.vx * 0.5; pk.vy = Math.sin(p.dir) * 14 + p.vy * 0.5; pk.lastTouch = p;
      this.sfx('stick', 0.5);
    }
  }
  deke(p) {
    if (p.dekeT > 0) return;
    p.dekeT = 0.45;
    const lx = -Math.sin(p.dir), ly = Math.cos(p.dir);
    let side = Math.random() < 0.5 ? -1 : 1;
    if (p.ctrl >= 0 && Math.hypot(p.inX, p.inY) > 0.3) side = sgn(lx * p.inX + ly * p.inY);
    p.vx += lx * side * 9; p.vy += ly * side * 9;
  }
  loosePuck(from, vx, vy) {
    const pk = this.puck;
    pk.owner = null; pk.vx = vx; pk.vy = vy; pk.vz = 0; pk.z = 0; pk.passTarget = null; pk.shot = null;
    from.pickCD = 0.45; from.winding = false; from.windT = 0;
  }
  hit(a, b, rel, nx, ny) {
    const sp = Math.hypot(a.vx, a.vy);
    const force = Math.max(rel, 0) + sp * 0.35 + 6 * a.chk - 6 * (b.chk - 0.9) + (a.turbo ? 3 : 0);
    a.checkT = 0; a.checkHit = true;
    if (force < 11) { this.sfx('board', 0.3); return; }
    b.downT = 0.9 + Math.min(1.2, force * 0.035); b.lie = Math.atan2(ny, nx) + rand(-0.5, 0.5);
    b.winding = false; b.windT = 0;
    b.vx += nx * force * 0.45; b.vy += ny * force * 0.45;
    a.team.hits++; a.stats.h++;
    if (this.puck.owner === b) this.loosePuck(b, b.vx * 0.6 + rand(-6, 6), b.vy * 0.6 + rand(-6, 6));
    this.sfx('hit', clamp(force / 30, 0.4, 1));
    this.shake = Math.max(this.shake, clamp(force / 25, 0.2, 1) * 0.6);
    if (force > 24) {
      this.pop('TVRDÝ HIT!', b.x, b.y, '#ff5a3c');
      this.say(pick(['Ten to schytal!', 'Tvrdý hit!', 'Au, to bolelo!', 'Pořádný bodyček!']), false, 0.6);
    }
  }

  // ---------- fyzika hráčů ----------
  movePlayers(h) {
    const pk = this.puck;
    this.goalieMoveAll(h);
    for (const p of this.all) {
      if (p.isGoalie) continue;
      p.pokeA = Math.max(0, p.pokeA - h * 3.3); p.pokeCD -= h; p.checkCD -= h; p.pickCD -= h;
      if (p.checkT > 0) { p.checkT -= h; if (p.checkT <= 0 && !p.checkHit) p.recoverT = 0.3; }
      p.dekeT = Math.max(0, p.dekeT - h); p.recoverT = Math.max(0, p.recoverT - h);
      p.carry = pk.owner === p;
      if (p.downT > 0) {
        p.downT -= h; const f = 1 - 3 * h; p.vx *= f; p.vy *= f; p.spdN = Math.hypot(p.vx, p.vy);
        this.integrate(p, h); continue;
      }
      if (p.winding) { p.windT = Math.min(1.2, p.windT + h * 1.4); if (!p.carry) { p.winding = false; p.windT = 0; } }
      let ix = p.inX, iy = p.inY, m = Math.hypot(ix, iy);
      if (m > 1) { ix /= m; iy /= m; m = 1; }
      let maxV = PH.MAXV * p.spd * p.team.spdMod, acc = PH.ACC * (0.8 + 0.2 * p.spd);
      if (p.carry) maxV *= 0.94;
      if (p.turbo && m > 0.3 && p.stamina > 0.03 && !p.winding) { maxV *= PH.TURBO; acc *= 1.3; p.stamina = Math.max(0, p.stamina - h * 0.3); }
      else p.stamina = Math.min(1, p.stamina + h * (m < 0.3 ? 0.16 : 0.08));
      if (p.recoverT > 0) acc *= 0.35;
      if (p.winding) { const f = 1 - 1.3 * h; p.vx *= f; p.vy *= f; }
      else if (m > 0.12) {
        let dvx = ix * maxV - p.vx, dvy = iy * maxV - p.vy;
        const dl = Math.hypot(dvx, dvy), lim = acc * h;
        if (dl > lim) { dvx *= lim / dl; dvy *= lim / dl; }
        p.vx += dvx; p.vy += dvy;
      } else { const f = 1 - PH.GLIDE * h; p.vx *= f; p.vy *= f; }
      // natočení
      const sp = Math.hypot(p.vx, p.vy);
      let fd = null;
      if (p.winding) fd = Math.atan2(-p.y, p.team.dir * RINK.GOAL_X - p.x);
      else if (m > 0.2) fd = Math.atan2(iy, ix);
      else if (p.faceDir != null) fd = p.faceDir;
      else if (sp > 3) fd = Math.atan2(p.vy, p.vx);
      if (fd != null) { const r = (p.carry ? 7 : 9) * h; p.dir += clamp(angDiff(p.dir, fd), -r, r); }
      p.stride += h * (sp * 0.3 + (m > 0.5 ? 1.5 : 0));
      p.spdN = sp;
      this.integrate(p, h);
    }
    this.collidePlayers();
  }
  integrate(p, h) {
    p.x += p.vx * h; p.y += p.vy * h;
    const r = p.isGoalie ? PH.GR : PH.PLR;
    const c = rinkContact(p.x, p.y, r);
    if (c) {
      p.x -= c.nx * c.pen; p.y -= c.ny * c.pen;
      const vn = p.vx * c.nx + p.vy * c.ny;
      if (vn > 0) { p.vx -= 1.25 * vn * c.nx; p.vy -= 1.25 * vn * c.ny; if (vn > 14) this.sfx('board', clamp(vn / 40, 0.2, 0.8)); }
    }
    if (!p.isGoalie) {
      for (const sN of [-1, 1]) {
        const x0 = sN > 0 ? RINK.GOAL_X : -RINK.GOAL_X - RINK.NET_D, x1 = x0 + RINK.NET_D;
        if (p.x > x0 - r && p.x < x1 + r && p.y > -RINK.NET_W - r && p.y < RINK.NET_W + r) {
          const pl = p.x - (x0 - r), pr = x1 + r - p.x, pb = p.y + RINK.NET_W + r, pt = RINK.NET_W + r - p.y;
          const m = Math.min(pl, pr, pb, pt);
          if (m === pl) { p.x -= pl; p.vx = Math.min(0, p.vx); } else if (m === pr) { p.x += pr; p.vx = Math.max(0, p.vx); }
          else if (m === pb) { p.y -= pb; p.vy = Math.min(0, p.vy); } else { p.y += pt; p.vy = Math.max(0, p.vy); }
        }
      }
    }
  }
  collidePlayers() {
    const A = this.all;
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      const a = A[i], b = A[j];
      const ra = a.isGoalie ? PH.GR : PH.PLR, rb = b.isGoalie ? PH.GR : PH.PLR;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = ra + rb;
      if (d >= min || d < 0.001) continue;
      const nx = dx / d, ny = dy / d, pen = min - d;
      const ma = a.isGoalie ? 4 : 1, mb = b.isGoalie ? 4 : 1, mt = ma + mb;
      a.x -= nx * pen * mb / mt; a.y -= ny * pen * mb / mt; b.x += nx * pen * ma / mt; b.y += ny * pen * ma / mt;
      const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (a.team !== b.team && this.state === 'play') {
        if (a.checkT > 0 && !b.isGoalie && b.downT <= 0) this.hit(a, b, rel, nx, ny);
        else if (b.checkT > 0 && !a.isGoalie && a.downT <= 0) this.hit(b, a, rel, -nx, -ny);
      }
      if (rel > 0) {
        const imp = rel * 0.8;
        a.vx -= imp * nx * mb / mt; a.vy -= imp * ny * mb / mt; b.vx += imp * nx * ma / mt; b.vy += imp * ny * ma / mt;
      }
    }
  }

  // ---------- brankáři ----------
  goalieMoveAll(h) { for (const t of this.teams) this.goalieMove(t.goalie, h); }
  goalieMove(g, h) {
    const sN = -g.team.dir, gl = RINK.GOAL_X, gx = sN * gl, pk = this.puck;
    g.saveT = Math.max(0, g.saveT - h); g.carry = false;
    if (pk.held === g && this.state === 'play') {
      g.holdT += h;
      if (g.holdT > 0.9) {
        let near = 1e9;
        for (const o of this.other(g.team).skaters) near = Math.min(near, Math.hypot(o.x - g.x, o.y - g.y));
        const human = g.team.humans.length > 0;
        if (near < 13 || g.holdT > (human ? 3 : 2.2)) this.whistle('ZAKRYTÝ PUK', [sN * 69, (pk.y >= 0 ? 1 : -1) * 22]);
        else if (!human || g.holdT > 1.6) {
          let best = null, bs = -1e9;
          for (const q of g.team.skaters) { if (q.downT > 0) continue; const sc = this.openScore(q, g); if (sc > bs) { bs = sc; best = q; } }
          if (best) this.passTo(g, best.x, best.y, false, best);
        }
      }
    }
    let tx, ty;
    if (sN * pk.x > gl) { tx = sN * (gl - 1.3); ty = (pk.y >= 0 ? 1 : -1) * 2.3; }
    else {
      const dx = pk.x - gx, dy = pk.y, d = Math.hypot(dx, dy) || 1, r = clamp(1.6 + d * 0.045, 1.6, 4.2);
      tx = gx + (dx / d) * r; ty = (dy / d) * r;
      if (!pk.owner && !pk.held && pk.vx * sN > 20) {
        const t = (gx - pk.x) / pk.vx;
        if (t > 0 && t < 1) { const yA = pk.y + pk.vy * t; if (Math.abs(yA) < 5) ty = lerp(ty, clamp(yA, -2.6, 2.6), 0.5); }
      }
    }
    if (sN * tx > gl - 1.0) tx = sN * (gl - 1.0);
    const k = Math.min(1, h * 7 * g.gk);
    g.ai.tx = lerp(g.ai.tx, tx, k); g.ai.ty = lerp(g.ai.ty, ty, k);
    if (this.state === 'intro' || this.state === 'faceoff') { g.ai.tx = tx; g.ai.ty = ty; }
    const maxV = 15 * g.gk;
    let tvx = (g.ai.tx - g.x) * 7, tvy = (g.ai.ty - g.y) * 7;
    const tl = Math.hypot(tvx, tvy); if (tl > maxV) { tvx *= maxV / tl; tvy *= maxV / tl; }
    let dvx = tvx - g.vx, dvy = tvy - g.vy; const dl = Math.hypot(dvx, dvy), lim = 80 * h;
    if (dl > lim) { dvx *= lim / dl; dvy *= lim / dl; }
    g.vx += dvx; g.vy += dvy;
    const fd = Math.atan2(pk.y - g.y, pk.x - g.x);
    g.dir += clamp(angDiff(g.dir, fd), -8 * h, 8 * h);
    g.spdN = Math.hypot(g.vx, g.vy);
    g.stride += h * g.spdN * 0.3;
    this.integrate(g, h);
  }
  goalieCover(g) {
    const pk = this.puck;
    pk.held = g; pk.owner = null; pk.vx = pk.vy = pk.vz = 0; pk.passTarget = null; pk.shot = null; pk.history = [g]; pk.lastTouch = g;
    g.holdT = 0;
    this.sfx('stick', 0.3);
  }
  goalieSaves(px, py) {
    const pk = this.puck, sp = Math.hypot(pk.vx, pk.vy);
    for (const t of this.teams) {
      const g = t.goalie, sN = -t.dir;
      if ((pk.ignore.get(g) || 0) > this.time) continue;
      const d = segDist(g.x, g.y, px, py, pk.x, pk.y);
      if (sp < 16) {
        if (d < 2.2 && pk.z < 2 && sN * pk.x > RINK.GOAL_X - 12) { this.goalieCover(g); return; }
        continue;
      }
      if (pk.vx * sN <= 0 || pk.z > 6) continue;
      // puk míjí rovinu brankáře (nebo letí přímo do něj)
      const gu = sN * g.x, pu = sN * px, cu = sN * pk.x;
      let lat;
      if (pu < gu && cu >= gu) { const f = (gu - pu) / (cu - pu); lat = Math.abs(py + (pk.y - py) * f - g.y); }
      else if (d < 1.4) lat = d;
      else continue;
      const tt = (sN * RINK.GOAL_X - pk.x) / pk.vx;
      let onNet = false;
      if (tt > 0) {
        const yA = pk.y + pk.vy * tt, zA = pk.z + pk.vz * tt - 0.5 * PH.G * tt * tt;
        onNet = Math.abs(yA) < RINK.NET_W + 0.2 && zA < RINK.NET_H + 0.3;
      }
      const reach = 3.2 + 0.6 * g.gk;
      if ((!onNet && lat > 1.2) || lat > reach) { pk.ignore.set(g, this.time + 0.5); continue; }
      let sv = 0.93 + (g.gk - 1) * 0.6;
      if (this.vsHuman) sv += t.cpu ? this.diff.cpuGk : this.diff.myGk;
      sv -= clamp((sp - 60) / 200, 0, 0.22);
      sv -= clamp((lat - 1.4) * 0.11, -0.05, 0.3);
      if (pk.oneTimer) sv -= 0.09;
      if (pk.reboundT > 0) sv -= 0.05;
      if (pk.deflT > 0) sv -= 0.12;
      if (pk.shot) sv += clamp((pk.shot.dist - 30) / 120, -0.06, 0.12);
      sv -= clamp((Math.hypot(g.vx, g.vy) - 6) / 40, 0, 0.1);
      sv = clamp(sv, 0.25, 0.97);
      if (Math.random() < sv) { this.save(g, sp, onNet); return; }
      pk.ignore.set(g, this.time + 0.6);
    }
  }
  save(g, sp, onNet) {
    const pk = this.puck, sN = -g.team.dir;
    if (onNet && pk.shot && !pk.shot.counted) {
      pk.shot.counted = true; pk.shot.team.shots++; pk.shot.by.stats.s++; g.stats.sa++; g.stats.sv++;
    }
    g.saveT = 0.5; g.saveKind = pk.z < 1.0 ? 1 : (pk.y - g.y) * sN > 0 ? 2 : 3;
    if ((sp < 62 && pk.z > 0.7 && Math.random() < 0.55) || (sp < 40 && Math.random() < 0.5)) {
      this.goalieCover(g);
      if (onNet) this.say(pick(['Chytil to!', 'Lapačka!', 'Jistý zákrok.']), false, 0.3);
    } else {
      const ang = (sN > 0 ? Math.PI : 0) + rand(-1.15, 1.15), rs = rand(10, 24) * clamp(sp / 80, 0.6, 1.4);
      pk.vx = Math.cos(ang) * rs; pk.vy = Math.sin(ang) * rs; pk.vz = pk.z > 1 ? rand(0, 5) : 0;
      pk.reboundT = 1.5; pk.shot = null; pk.oneTimer = false; pk.passTarget = null; pk.lastTouch = g;
      pk.ignore.set(g, this.time + 0.35);
      this.sfx('board', 0.25); this.sfx('stick', 0.6);
      if (onNet) {
        if (Math.random() < 0.35) this.pop('ZÁKROK!', g.x, g.y, '#9fe3ff');
        this.say(pick(['Výborný zákrok!', 'Brankář je na místě.', 'Skvělá reakce!', 'Vyrazil to!']), false, 0.35);
      }
    }
    this.sfx('ooh', 0.6);
  }

  // ---------- puk ----------
  updatePuck(h) {
    const pk = this.puck;
    if (pk.reboundT > 0) pk.reboundT -= h;
    if (pk.deflT > 0) pk.deflT -= h;
    if (pk.passT > 0) { pk.passT -= h; if (pk.passT <= 0) pk.passTarget = null; }
    if (pk.held) {
      const g = pk.held;
      pk.x = g.x + Math.cos(g.dir) * 1.1; pk.y = g.y + Math.sin(g.dir) * 1.1; pk.z = 1.6; pk.vx = pk.vy = pk.vz = 0;
      return;
    }
    if (pk.owner) {
      const o = pk.owner, off = bladeOffset(o.dir, o.hand, true, this.time, 0, 0);
      pk.x = o.x + off[0]; pk.y = o.y + off[1]; pk.z = 0; pk.vx = o.vx; pk.vy = o.vy; pk.vz = 0;
      const c = rinkContact(pk.x, pk.y, PH.PR);
      if (c) { pk.x -= c.nx * c.pen; pk.y -= c.ny * c.pen; }
      for (const sN of [-1, 1]) {
        const u = sN * pk.x;
        if (u > RINK.GOAL_X - 0.3 && u < RINK.GOAL_X + RINK.NET_D + 0.3 && Math.abs(pk.y) < RINK.NET_W + 0.3) {
          if (u < RINK.GOAL_X + 1) pk.x = sN * (RINK.GOAL_X - 0.4);
          else pk.y = (pk.y >= 0 ? 1 : -1) * (RINK.NET_W + 0.4);
        }
      }
      return;
    }
    const px = pk.x, py = pk.y, pz = pk.z;
    pk.x += pk.vx * h; pk.y += pk.vy * h;
    if (pk.z > 0 || pk.vz > 0) {
      pk.vz -= PH.G * h; pk.z += pk.vz * h;
      if (pk.z <= 0) { pk.z = 0; if (pk.vz < -5) pk.vz = -pk.vz * 0.3; else pk.vz = 0; }
    }
    if (pk.z <= 0.01) {
      const f = 1 - PH.PF * h; pk.vx *= f; pk.vy *= f;
      if (Math.hypot(pk.vx, pk.vy) < 4) { const f2 = Math.max(0, 1 - 1.2 * h); pk.vx *= f2; pk.vy *= f2; }
    }
    if (pk.inNet) { this.keepInNet(); return; }
    if (this.checkNets(px, py, pz)) return;
    const c = rinkContact(pk.x, pk.y, PH.PR);
    if (c) {
      pk.x -= c.nx * c.pen; pk.y -= c.ny * c.pen;
      const vn = pk.vx * c.nx + pk.vy * c.ny;
      if (vn > 0) {
        pk.vx -= (1 + PH.BE) * vn * c.nx; pk.vy -= (1 + PH.BE) * vn * c.ny; pk.vx *= 0.92; pk.vy *= 0.92;
        if (vn > 10) this.sfx('board', clamp(vn / 90, 0.15, 0.6));
        if (vn > 30) pk.shot = null;
      }
    }
    if (this.state === 'play') { this.goalieSaves(px, py); if (!pk.held) this.pickups(); }
  }
  keepInNet() {
    const pk = this.puck, sN = pk.inNet, u = sN * pk.x;
    if (u > RINK.GOAL_X + RINK.NET_D - 0.5) { pk.x = sN * (RINK.GOAL_X + RINK.NET_D - 0.5); pk.vx *= -0.2; }
    if (u < RINK.GOAL_X + 0.3) { pk.x = sN * (RINK.GOAL_X + 0.3); pk.vx *= -0.2; }
    if (Math.abs(pk.y) > RINK.NET_W - 0.4) { pk.y = sgn(pk.y) * (RINK.NET_W - 0.4); pk.vy *= -0.3; }
    if (pk.z > RINK.NET_H - 0.4) { pk.z = RINK.NET_H - 0.4; pk.vz = 0; }
    pk.vx *= 0.96; pk.vy *= 0.96;
  }
  checkNets(px, py, pz) {
    const pk = this.puck, gl = RINK.GOAL_X, W = RINK.NET_W;
    for (const sN of [1, -1]) {
      const pu = sN * px, cu = sN * pk.x;
      if (pu < gl && cu >= gl) {
        const t = (gl - pu) / (cu - pu), yc = py + (pk.y - py) * t, zc = pz + (pk.z - pz) * t, ay = Math.abs(yc);
        if (ay < W - PH.PR && zc < RINK.NET_H - 0.2) {
          if (this.state === 'play') { this.goal(sN); return true; }
          pk.vx *= -0.3; pk.x = sN * (gl - 0.1); return true;
        }
        if (ay < W + 0.45 && zc < RINK.NET_H + 0.35) {
          pk.x = sN * (gl - 0.1);
          if (zc > RINK.NET_H - 0.2) { pk.vz = -Math.abs(pk.vz) * 0.4 + 2; pk.vx *= -0.4; }
          else { pk.vx = -pk.vx * 0.55; pk.vy += sgn(yc) * rand(3, 10); }
          if (pk.shot && this.state === 'play') {
            this.sfx('post'); this.pop('TYČKA!', pk.x, pk.y, '#ffe066'); this.say('Tyčka!', false, 0.7); this.sfx('ooh', 1);
            pk.shot = null;
          } else this.sfx('stick', 0.6);
          return false;
        }
      }
      // tělo branky (zezadu / z boku)
      if (cu > gl && cu < gl + RINK.NET_D && Math.abs(pk.y) < W + PH.PR && pk.z < RINK.NET_H) {
        if (pu >= gl + RINK.NET_D) { pk.x = sN * (gl + RINK.NET_D + PH.PR); pk.vx = -pk.vx * 0.3; }
        else if (Math.abs(py) >= W) { pk.y = sgn(py) * (W + PH.PR); pk.vy = -pk.vy * 0.3; }
        else { pk.x = sN * (gl + RINK.NET_D + PH.PR); }
        this.sfx('stick', 0.3);
      }
    }
    return false;
  }
  pickups() {
    const pk = this.puck;
    if (pk.z > 1.3) return;
    const sp = Math.hypot(pk.vx, pk.vy);
    let best = null, bd = 2.0;
    for (const p of this.all) {
      if (p.isGoalie || p.downT > 0 || p.pickCD > 0) continue;
      const off = bladeOffset(p.dir, p.hand, false, this.time, p.winding ? p.windT : 0, p.pokeA);
      let d = Math.hypot(p.x + off[0] - pk.x, p.y + off[1] - pk.y);
      const db = Math.hypot(p.x - pk.x, p.y - pk.y) - 0.4;
      if (db < d) d = db;
      if (d < bd) { bd = d; best = p; }
    }
    if (!best) return;
    const p = best;
    if (sp > 52 && pk.passTarget !== p) {
      if (Math.random() < 0.4) {
        const a = Math.atan2(pk.vy, pk.vx) + rand(-1.2, 1.2), ns = sp * rand(0.2, 0.5);
        pk.vx = Math.cos(a) * ns; pk.vy = Math.sin(a) * ns; pk.vz = rand(0, 5); pk.deflT = 0.5;
        if (pk.shot && pk.shot.team !== p.team) { pk.shot = null; this.pop('BLOK!', p.x, p.y, '#ddd'); }
        else if (pk.shot) { pk.lastTouch = p; pk.history.push(p); }
        p.pickCD = 0.3; this.sfx('stick', 0.8);
        return;
      }
      p.pickCD = 0.25; return;
    }
    if (sp > 95 && Math.random() < 0.3) { p.pickCD = 0.2; return; }
    this.gain(p);
  }
  gain(p) {
    const pk = this.puck, wasPass = pk.wasPass;
    const last = pk.history[pk.history.length - 1];
    if (last && last.team !== p.team) pk.history = [];
    if (pk.history[pk.history.length - 1] !== p) pk.history.push(p);
    if (pk.history.length > 6) pk.history.shift();
    Object.assign(pk, { owner: p, held: null, passTarget: null, shot: null, oneTimer: false, deflT: 0, wasPass: false, lastTouch: p, z: 0, vz: 0 });
    this.sfx('stick', 0.35);
    // přepnutí lidského hráče na nosiče puku
    if (p.ctrl < 0 && p.team.humans.length) {
      const hs = p.team.humans;
      let h = hs[0];
      if (hs.length > 1) {
        const passer = pk.history.length > 1 ? pk.history[pk.history.length - 2] : null;
        h = hs.find((q) => q.player === passer) || hs.reduce((a, b) => (Math.hypot(a.player.x - p.x, a.player.y - p.y) < Math.hypot(b.player.x - p.x, b.player.y - p.y) ? a : b));
      }
      this.assign(h, p);
    }
    for (const q of this.all) if (q !== p) q.oneTimerQ = false;
    if (p.oneTimerQ) { p.oneTimerQ = false; this.shoot(p, 0.85, true, p.ctrl >= 0 && Math.abs(p.inY) > 0.35 ? sgn(p.inY) : null, true); return; }
    if (p.ctrl < 0 && wasPass) {
      const s = p.team.dir, u = s * p.x, dn = Math.hypot(s * RINK.GOAL_X - p.x, p.y);
      if (u > 55 && u < 86 && dn < 38 && Math.abs(p.y) < 24 && Math.random() < 0.35) this.shoot(p, 0.75, true, null, true);
    }
  }

  // ---------- AI ----------
  thinkAll(h) {
    for (const t of this.teams) { t.thinkT -= h; if (t.thinkT <= 0) { t.thinkT = 0.15; this.teamThink(t); } }
    for (const p of this.all) {
      if (p.isGoalie || p.ctrl >= 0) continue;
      if (p.downT > 0) { p.inX = p.inY = 0; continue; }
      this.aiSkater(p, h);
    }
  }
  teamThink(t) {
    const pk = this.puck, opp = this.other(t), owner = pk.owner || pk.held;
    const ais = t.skaters.filter((p) => p.ctrl < 0 && p.downT <= 0), hum = t.skaters.filter((p) => p.ctrl >= 0);
    t.chaser = null; t.presser = null; t.marks = new Map();
    const near = (list, x, y) => { let b = null, bd = 1e9; for (const p of list) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; b = p; } } return [b, bd]; };
    if (!owner) {
      const px = pk.x + pk.vx * 0.35, py = pk.y + pk.vy * 0.35;
      const [a, ad] = near(ais, px, py), [, hd] = near(hum, px, py);
      if (a && !(hd < ad - 8)) t.chaser = a;
    } else if (owner.team !== t && !owner.isGoalie) {
      const [a, ad] = near(ais, owner.x, owner.y), [, hd] = near(hum, owner.x, owner.y);
      if (a && !(hd < ad - 6)) t.presser = a;
      const gx = -t.dir * RINK.GOAL_X;
      const attackers = opp.skaters.filter((o) => o !== owner).sort((a, b) => Math.hypot(a.x - gx, a.y) - Math.hypot(b.x - gx, b.y));
      const free = ais.filter((p) => p !== t.presser);
      for (const o of attackers.slice(0, 3)) {
        if (!free.length) break;
        let bi = 0, bd = 1e9;
        free.forEach((p, i) => { const d = Math.hypot(p.x - o.x, p.y - o.y); if (d < bd) { bd = d; bi = i; } });
        t.marks.set(free[bi], o); free.splice(bi, 1);
      }
    }
  }
  aiSkater(p, h) {
    const t = p.team, s = t.dir, pk = this.puck;
    if (pk.owner === p) return this.aiCarrier(p, h);
    let tx, ty, urg = false, turbo = false;
    p.faceDir = null;
    if (t.chaser === p) {
      const d = Math.hypot(pk.x - p.x, pk.y - p.y), look = clamp(d / 40, 0, 0.6);
      tx = pk.x + pk.vx * look; ty = pk.y + pk.vy * look;
      turbo = d > 18 && p.stamina > 0.35; urg = true;
    } else if (t.presser === p && pk.owner) {
      const o = pk.owner, gx = -s * RINK.GOAL_X, dx = gx - o.x, dy = -o.y, dl = Math.hypot(dx, dy) || 1;
      tx = o.x + o.vx * 0.25 + (dx / dl) * 2.5; ty = o.y + o.vy * 0.25 + (dy / dl) * 2.5;
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      turbo = d > 14 && p.stamina > 0.3; urg = true;
      p.ai.t -= h;
      if (p.ai.t <= 0) {
        p.ai.t = this.thinkFor(t) * rand(0.7, 1.3);
        if (d < 6.5) {
          const ag = this.aggrFor(t), fa = Math.abs(angDiff(p.dir, Math.atan2(o.y - p.y, o.x - p.x)));
          if (fa < 0.8 && p.spdN > 9 && Math.random() < 0.2 * ag) this.startCheck(p);
          else if (Math.random() < 0.42 * ag) this.poke(p);
        }
      }
    } else if (t.marks.has(p)) {
      const o = t.marks.get(p), gx = -s * RINK.GOAL_X;
      tx = o.x + (gx - o.x) * 0.28; ty = o.y * 0.8;
    } else [tx, ty] = this.spotFor(p);
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d < 1.2) { p.inX = 0; p.inY = 0; }
    else { const m = urg ? 1 : clamp(d / 10, 0.25, 1); p.inX = (dx / d) * m; p.inY = (dy / d) * m; }
    if (d < 4 && !urg) p.faceDir = Math.atan2(pk.y - p.y, pk.x - p.x);
    p.turbo = turbo;
  }
  spotFor(p) {
    const t = p.team, s = t.dir, pk = this.puck, owner = pk.owner || pk.held;
    const pu = s * pk.x, pv = s * pk.y, ph = p.ai.ph, tm = this.time, D = p.role[1] === 'D';
    let u, v;
    const off = owner ? owner.team === t : pu > 5;
    if (off) {
      if (pu > 18) {
        const S = { C: [60, 0], LW: [72, 17], RW: [72, -17], LD: [33, 16], RD: [33, -16] }[p.role];
        u = S[0] + Math.sin(tm * 0.6 + ph) * (D ? 3 : 7); v = S[1] + Math.cos(tm * 0.45 + ph * 1.3) * (D ? 6 : 7);
        if (p.role === 'C' && Math.sin(tm * 0.4 + ph) > 0.5) { u = 78; v = Math.sin(ph) > 0 ? 4 : -4; }
      } else {
        const S = { C: [pu + 14, -pv * 0.3], LW: [pu + 24, 22], RW: [pu + 24, -22], LD: [pu - 16, 15], RD: [pu - 16, -15] }[p.role];
        u = S[0]; v = S[1];
        if (!D) u = Math.min(u, 70);
      }
    } else {
      const S = { C: [pu - 12, pv * 0.5], LW: [pu - 14, 18], RW: [pu - 14, -18], LD: [Math.min(pu - 28, 50), 12], RD: [Math.min(pu - 28, 50), -12] }[p.role];
      u = S[0]; v = S[1];
    }
    u = clamp(u, -84, 84);
    const hw = rinkHalfWidthAt(s * u) - 4; v = clamp(v, -hw, hw);
    return [s * u, s * v];
  }
  aiCarrier(p, h) {
    const t = p.team, s = t.dir, opp = this.other(t), u = s * p.x, v = s * p.y;
    let td = 1e9, thr = null;
    for (const o of opp.skaters) { if (o.downT > 0) continue; const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < td) { td = d; thr = o; } }
    const front = thr ? s * (thr.x - p.x) > -1 : false;
    let tu, tv;
    if (u > 86) { tu = 80; tv = (v >= 0 ? 1 : -1) * 16; }
    else if (u < 52) { tu = u + 28; tv = v * 0.55; }
    else { tu = 76; tv = (Math.abs(v) < 6 ? v : v * 0.4) + (v >= 0 ? 3 : -3); }
    for (const o of opp.skaters) {
      if (o.downT > 0) continue;
      const du = s * o.x - u, dv = s * o.y - v, d = Math.hypot(du, dv);
      if (d < 16 && du > -4) { const w = (16 - d) / 16; tv += (dv >= 0 ? -1 : 1) * w * 16; tu -= w * 4; }
    }
    tu = clamp(tu, -85, 85);
    const hw = rinkHalfWidthAt(s * tu) - 5; tv = clamp(tv, -hw, hw);
    const dx = s * tu - p.x, dy = s * tv - p.y, d = Math.hypot(dx, dy) || 1;
    p.inX = dx / d; p.inY = dy / d; p.faceDir = null;
    p.turbo = td > 13 && p.stamina > 0.4 && u < 65;
    if (p.winding) { p.ai.wind -= h; if (p.ai.wind <= 0 || td < 3.5) this.releaseShot(p); return; }
    p.ai.t -= h;
    if (p.ai.t > 0) return;
    p.ai.t = this.thinkFor(t) * rand(0.7, 1.3);
    const dn = Math.hypot(s * RINK.GOAL_X - p.x, p.y);
    let sp = 0;
    if (u > 38 && u < 88) {
      sp = dn < 20 ? 0.55 : dn < 32 ? 0.3 : dn < 48 ? 0.12 : 0.04;
      const a = Math.atan2(Math.abs(v), RINK.GOAL_X - u);
      if (a > 1.15) sp *= 0.15; else if (a > 0.9) sp *= 0.5;
    }
    if (Math.random() < sp) {
      if (dn > 30 && td > 9 && Math.random() < 0.65) { p.winding = true; p.windT = 0; p.ai.wind = rand(0.35, 0.8); }
      else this.shoot(p, 0, false, null, false);
      return;
    }
    const my = this.openScore(p, p);
    let best = null, bs = -1e9;
    for (const q of t.skaters) { if (q === p || q.downT > 0) continue; const sc = this.openScore(q, p); if (sc > bs) { bs = sc; best = q; } }
    const pressure = td < 9 && front;
    if (best && ((pressure && bs > my - 4 && Math.random() < 0.55) || (bs > my + 10 && Math.random() < 0.4))) { this.pass(p, best, false); return; }
    if (pressure && u > -15 && u < 28 && Math.random() < 0.18) { this.dump(p); return; }
    if (td < 5.5 && front && Math.random() < 0.25) this.deke(p);
  }
  openScore(q, from) {
    const s = q.team.dir, u = s * q.x, v = s * q.y;
    let open = 25;
    for (const o of this.other(q.team).skaters) { if (o.downT > 0) continue; open = Math.min(open, Math.hypot(o.x - q.x, o.y - q.y)); }
    let sc = open * 1.2 + clamp(u, -60, 85) * 0.3;
    if (u > 55 && Math.abs(v) < 22) sc += 12;
    if (q !== from) {
      if (this.laneBlocked(from, q)) sc -= 25;
      const d = Math.hypot(q.x - from.x, q.y - from.y);
      if (d > 75) sc -= 15; if (d < 10) sc -= 10;
    }
    return sc;
  }

  // ---------- přerušení, góly, třetiny ----------
  whistle(reason, spot) {
    this.state = 'stop'; this.stateT = 0; this.stopSpot = spot;
    this.sfx('whistle');
    this.showBanner(reason, '', 1.4);
  }
  goal(sN) {
    const pk = this.puck, team = this.teams.find((t) => t.dir === sN), opp = this.other(team);
    team.score++;
    pk.inNet = sN;
    if (pk.shot && !pk.shot.counted && pk.shot.team === team) { pk.shot.counted = true; team.shots++; pk.shot.by.stats.s++; opp.goalie.stats.sa++; }
    const hist = pk.history.filter((p) => p.team === team && !p.isGoalie);
    const scorer = hist.length ? hist[hist.length - 1] : null;
    const assists = [];
    for (let i = hist.length - 2; i >= 0 && assists.length < 2; i--) if (hist[i] !== scorer && !assists.includes(hist[i])) assists.push(hist[i]);
    if (scorer) scorer.stats.g++;
    for (const a of assists) a.stats.a++;
    this.goals.push({ team, scorer, assists, period: this.period, clock: this.clock });
    this.state = 'goal'; this.stateT = 0; this.goalLight = sN; this.goalLightT = 4;
    this.showBanner('GÓÓÓL!', team.def.city + ' ' + team.def.name, 3.4, team.jersey);
    const who = scorer ? '#' + scorer.num + ' ' + scorer.name.toUpperCase() : 'VLASTNÍ GÓL';
    const ast = assists.length ? 'Asistence: ' + assists.map((a) => a.name).join(', ') : 'Bez asistence';
    this.lower = { title: who, sub: ast, team, t: 0, dur: 3.6 };
    this.sfx('horn'); this.sfx('cheer', 1);
    this.say(pick(['Gól!', 'A je to tam!', 'Gól! Puk je v síti!', 'Gól! Neuvěřitelné!']) + (scorer ? ' Skóroval ' + scorer.name + '.' : ''), true);
    for (const p of team.skaters) { p.inX = 0; p.inY = 0; }
  }
  afterGoal() {
    if (this.period > 3) return this.finish();
    if (Settings.data.replay && !this.demo && this.rec.length > 60) this.startReplay();
    else this.afterReplay();
  }
  startReplay() {
    this.replay = { frames: this.rec.slice(-250), f: 0 };
    this.state = 'replay'; this.stateT = 0;
  }
  endReplay() { this.replay = null; this.afterReplay(); }
  afterReplay() {
    this.rec = [];
    this.setupFaceoff(0, 0);
    this.sfx('organ', Math.floor(Math.random() * 4));
  }
  record() {
    this.recSkip ^= 1;
    if (this.recSkip) return;
    const pk = this.puck;
    this.rec.push({
      px: pk.x, py: pk.y, pz: pk.z,
      pl: this.all.map((p) => ({ x: p.x, y: p.y, dir: p.dir, stride: p.stride, spdN: p.spdN, downT: p.downT, lie: p.lie,
        windT: p.winding ? p.windT : 0, pokeA: p.pokeA, saveT: p.saveT, saveKind: p.saveKind, isGoalie: p.isGoalie, team: p.team,
        num: p.num, hand: p.hand, carry: p.carry, ctrl: -1, role: p.role })),
    });
    if (this.rec.length > 330) this.rec.shift();
  }
  endPeriod() {
    this.sfx('buzzer');
    const [a, b] = this.teams;
    if ((this.period >= 3 && a.score !== b.score) || this.period >= 4) return this.finish();
    this.state = 'periodEnd'; this.stateT = 0;
    this.say('Konec ' + ['', 'první', 'druhé', 'třetí'][this.period] + ' třetiny.', true);
  }
  nextPeriod() {
    this.period++; this.clock = this.periodLen; this.setDirs();
    for (const p of this.all) p.stamina = 1;
    this.setupFaceoff(0, 0);
    this.state = 'intro'; this.stateT = 0;
    this.showBanner(PERIOD_NAMES[this.period], this.period === 4 ? 'Náhlá smrt — rozhodne první gól' : '', 2.2);
    this.sfx('organ', this.period);
    this.say(this.period === 4 ? 'Jdeme do prodloužení!' : 'Začíná ' + ['', 'první', 'druhá', 'třetí'][this.period] + ' třetina.', true);
  }
  finish() {
    this.state = 'final'; this.stateT = 0;
    const [a, b] = this.teams;
    const win = a.score > b.score ? a : b.score > a.score ? b : null;
    this.winner = win;
    const all = this.all.map((p) => {
      let sc = p.stats.g * 3 + p.stats.a * 2 + p.stats.h * 0.3 + p.stats.s * 0.2;
      if (p.isGoalie) sc = p.stats.sv * 0.3 - (p.stats.sa - p.stats.sv) * 1.0 + (win === p.team ? 1.5 : 0);
      if (win === p.team) sc += 0.5;
      return { p, sc };
    }).sort((x, y) => y.sc - x.sc);
    this.stars = all.slice(0, 3).map((o) => o.p);
    this.sfx('horn', 3.2); this.sfx('cheer', 0.8);
    this.say(win ? 'Konec zápasu! Vítězí ' + win.def.city + '!' : 'Konec zápasu. Remíza.', true);
  }
}
