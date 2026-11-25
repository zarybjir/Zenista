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
    this.trail = [];               // stopa právě letící ryby (x, y, x, y…)
    this.last = [];                // stopa předchozího výstřelu
    this.t = 0;                    // kroky od výstřelu
    this.calm = 0;
    this.acc = 0;
    this.alpha = 1;                // poměr mezi dvěma kroky fyziky, pro vykreslení
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
    p.x = p.y = 0;
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
    for (const e of physStep(this.P)) {
      if (e.kind === 'block') this.score += MAT[e.type].pts;
      else if (e.kind === 'bear') { this.score += BEARS[e.type].pts; this.bears--; }
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
    if (this.fish) physRemove(this.P, this.fish);
    this.fish = null;
    this.last = this.trail;
    this.trail = [];
    if (!this.bears) this.win();
    else this.state = this.queue.length ? 'aim' : 'lost';
  }

  win() {
    this.score += this.queue.length * SCORE.fish;
    this.state = 'won';
  }
}
