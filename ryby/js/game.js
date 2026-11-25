'use strict';
// ---------- stav úrovně ----------
// Stavy: aim (míření) → fly (let) → settle (doznívání) → aim / won / lost.
// Nezná canvas ani DOM; běží i v Node (testy).

class Game {
  constructor(lvl) {
    this.lvl = lvl;
    this.P = physWorld(lvl);
    this.queue = lvl.fish.slice(); // ryby, které ještě nevyletěly; první je na praku
    this.bears = lvl.bears.length;
    this.score = 0;
    this.state = 'aim';
    this.pull = { x: 0, y: 0 };    // posun ryby od špičky prutu
    this.aiming = false;
    this.fish = null;              // letící ryba
    this.extra = [];               // další ryby téhož výstřelu (hejno)
    this.trail = [];               // stopa právě letící ryby (x, y, x, y…)
    this.last = [];                // stopa předchozího výstřelu
    this.t = 0;                    // kroky od výstřelu
    this.calm = 0;
    this.acc = 0;
    this.alpha = 1;                // poměr mezi dvěma kroky fyziky, pro vykreslení
    this.miss = false;             // poslední výstřel nic nezasáhl
    this.s0 = 0;                   // skóre před výstřelem
    this.ev = [];                  // události pro efekty a zvuk; odebírá je app.js
  }

  // ---------- míření ----------
  aimStart() {
    if (this.state !== 'aim') return false;
    this.aiming = true;
    return true;
  }

  // bod ve světě, kam hráč rybu táhne
  aimTo(x, y) {
    if (this.state !== 'aim') return;
    const r = FISH[this.queue[0]].r;
    let dx = x - SLING.x, dy = Math.max(y, r) - SLING.y;
    const d = Math.hypot(dx, dy);
    if (d > SLING.max) { dx *= SLING.max / d; dy *= SLING.max / d; }
    this.pull.x = dx; this.pull.y = dy;
  }

  // rychlost, kterou by ryba teď vyletěla
  launchVel() { return { x: -this.pull.x * SLING.k, y: -this.pull.y * SLING.k }; }

  release() {
    if (this.state !== 'aim') return false;
    this.aiming = false;
    const p = this.pull, v = this.launchVel();
    if (Math.hypot(p.x, p.y) < SLING.min) { p.x = p.y = 0; return false; }
    this.fish = physFish(this.P, this.queue.shift(), SLING.x + p.x, SLING.y + p.y, v.x, v.y);
    this.ev.push({ k: 'shot', x: p.x, y: p.y });
    p.x = p.y = 0;
    this.miss = false; this.s0 = this.score;
    this.trail = [];
    this.t = 0; this.calm = 0;
    this.state = 'fly';
    return true;
  }

  // výstřel zadaný úhlem (stupně nad vodorovnou) a silou 0–1; pro gamepad a testy
  shoot(a, p) {
    const d = clamp(p, 0, 1) * SLING.max;
    this.aimTo(SLING.x - Math.cos(a * DEG) * d, SLING.y - Math.sin(a * DEG) * d);
    return this.release();
  }

  ability() { return this.state === 'fly' && !!this.fish && fishAbility(this, this.fish); }

  // ---------- smyčka ----------
  update(dt) {
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= PH.dt) { this.step(); this.acc -= PH.dt; }
    this.alpha = this.acc / PH.dt;
  }

  step() {
    if (this.ev.length > 400) this.ev.length = 0; // nikdo je neodebírá (testy)
    const rm = physStep(this.P);
    for (const h of this.P.hits) this.ev.push(h);
    for (const e of rm) {
      if (e.kind === 'fish') continue;
      const pts = e.kind === 'block' ? MAT[e.type].pts : BEARS[e.type].pts;
      this.score += pts;
      if (e.kind === 'bear') this.bears--;
      this.ev.push({ k: e.kind === 'block' ? 'break' : 'bear', m: e.type, x: e.x, y: e.y, a: e.a, w: e.w || e.r * 2, h: e.h || e.r * 2, pts });
    }
    const f = this.fish;
    if (this.state === 'fly' || this.state === 'settle') {
      this.t++;
      if (this.state === 'fly') {
        if (this.t % 3 === 0 && !f.dead) this.trail.push(f.x, f.y);
        if (f.hit || f.dead) this.state = 'settle';
      }
      this.calm = physCalm(this.P) ? this.calm + 1 : 0;
      if (this.state === 'settle' && this.calm >= PH.calmN || this.t >= SLING.maxT) this.endShot();
    } else if (this.state === 'aim' && !this.bears) this.win();
  }

  endShot() {
    for (const f of [this.fish, ...this.extra])
      if (f && !f.dead) { this.ev.push({ k: 'puff', x: f.x, y: f.y }); physRemove(this.P, f); }
    this.fish = null; this.extra = [];
    this.miss = this.score === this.s0;
    this.last = this.trail;
    this.trail = [];
    if (!this.bears) this.win();
    else if (this.queue.length) this.state = 'aim';
    else { this.state = 'lost'; this.ev.push({ k: 'lost' }); }
  }

  // 0 = nedohráno, 1 = výhra, 2 a 3 podle hranic bodů v úrovni
  stars() {
    if (this.state !== 'won') return 0;
    const s = this.lvl.stars;
    return this.score >= s[1] ? 3 : this.score >= s[0] ? 2 : 1;
  }

  win() {
    this.score += this.queue.length * SCORE.fish;
    this.state = 'won';
    this.ev.push({ k: 'win', n: this.queue.length });
  }
}
