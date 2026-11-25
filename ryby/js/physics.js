'use strict';
// ---------- obal nad planck.js ----------
// Entita: { kind: 'block'|'bear'|'fish', type, body, hp, max, w, h, r, x, y, a, px, py, pa, vx, vy, dead }
// Zbytek hry čte jen pole entity, na engine nesahá.

function physWorld(lvl) {
  const P = { world: new planck.World({ gravity: { x: 0, y: PH.g } }), ents: [], kill: [], hits: [], dmg: false };
  const gr = P.world.createBody();
  gr.createFixture({ shape: new planck.Box(100, 2, { x: 0, y: -2 }, 0), friction: 0.9 });
  P.world.on('post-solve', (c, imp) => physHit(P, c, imp));
  for (const b of lvl.blocks) physBlock(P, b[0], b[1], b[2], b[3], b[4] || 0);
  for (const b of lvl.bears) physBear(P, b[0], b[1], b[2]);
  // uklidnění: stavba si sedne a usne, teprve pak se počítá poškození
  for (let i = 0; i < PH.settle; i++) P.world.step(PH.dt, 8, 3);
  for (const e of P.ents) {
    e.body.setLinearVelocity({ x: 0, y: 0 });
    e.body.setAngularVelocity(0);
    e.body.setAwake(false);
    physSync(e); physSync(e);
  }
  P.dmg = true;
  return P;
}

function physAdd(P, e, x, y, a, shape, d) {
  e.body = P.world.createBody({ type: 'dynamic', position: { x, y }, angle: a, bullet: e.kind === 'fish' });
  e.body.createFixture({ shape, density: d.dens, friction: d.fric, restitution: d.rest });
  e.body.setUserData(e);
  e.dead = false;
  e.x = e.px = x; e.y = e.py = y; e.a = e.pa = a; e.vx = e.vy = 0;
  P.ents.push(e);
  return e;
}

function physBlock(P, mat, shape, x, y, a) {
  const m = MAT[mat], s = SHAPE[shape];
  return physAdd(P, { kind: 'block', type: mat, w: s[0], h: s[1], hp: m.hp, max: m.hp },
    x, y, a * DEG, new planck.Box(s[0] / 2, s[1] / 2), m);
}

function physBear(P, type, x, y) {
  const b = BEARS[type];
  return physAdd(P, { kind: 'bear', type, r: b.r, hp: b.hp, max: b.hp }, x, y, 0, new planck.Circle(b.r), b);
}

function physFish(P, type, x, y, vx, vy) {
  const f = FISH[type];
  const e = physAdd(P, { kind: 'fish', type, r: f.r, hit: false, used: false }, x, y, 0, new planck.Circle(f.r), f);
  e.body.setLinearVelocity({ x: vx, y: vy });
  e.vx = vx; e.vy = vy;
  return e;
}

// změna velikosti tělesa (nafouknutí čtverzubce)
function physGrow(e, r, dens) {
  const d = FISH[e.type];
  e.body.destroyFixture(e.body.getFixtureList());
  e.body.createFixture({ shape: new planck.Circle(r), density: dens, friction: d.fric, restitution: d.rest });
  e.r = r;
}

// tlaková vlna ze středu src: odhodí a poškodí vše v dosahu, síla klesá se vzdáleností
function physBlast(P, src, rad, imp, dmg) {
  for (const e of P.ents) {
    if (e === src || e.dead) continue;
    const dx = e.x - src.x, dy = e.y - src.y, d = Math.hypot(dx, dy);
    if (d >= rad) continue;
    const k = 1 - d / rad, n = d || 1;
    e.body.applyLinearImpulse({ x: dx / n * imp * k, y: dy / n * imp * k }, e.body.getWorldCenter(), true);
    physDamage(P, e, src, dmg * k);
  }
}

// ---------- náraz → poškození ----------
function physHit(P, c, imp) {
  const ea = c.getFixtureA().getBody().getUserData(), eb = c.getFixtureB().getBody().getUserData();
  if (ea && ea.kind === 'fish') ea.hit = true;
  if (eb && eb.kind === 'fish') eb.hit = true;
  if (!P.dmg) return;
  const n = c.getManifold().pointCount;
  let i = 0;
  for (let k = 0; k < n; k++) i = Math.max(i, imp.normalImpulses[k]);
  if (i <= PH.thr) return;
  // záznam nárazu pro efekty a zvuk (na fyziku nemá vliv)
  const o = ea && ea.kind !== 'fish' ? ea : eb && eb.kind !== 'fish' ? eb : null, wm = c.getWorldManifold(null);
  const p = wm && wm.points[0] || (ea || eb).body.getPosition();
  P.hits.push({ k: 'hit', x: p.x, y: p.y, i, m: o ? o.type : 'zem' });
  physDamage(P, ea, eb, i - PH.thr);
  physDamage(P, eb, ea, i - PH.thr);
}

function physDamage(P, e, by, d) {
  if (!e || e.dead || e.kind === 'fish') return;
  if (by && by.kind === 'fish') d *= FISH[by.type].dmg[e.kind === 'bear' ? 'bear' : e.type] || 1;
  e.hp -= d;
  if (e.hp <= 0) { e.dead = true; P.kill.push(e); }
}

function physSync(e) {
  const p = e.body.getPosition(), v = e.body.getLinearVelocity();
  e.px = e.x; e.py = e.y; e.pa = e.a;
  e.x = p.x; e.y = p.y; e.a = e.body.getAngle();
  e.vx = v.x; e.vy = v.y;
}

// ---------- krok ----------
// Vrací entity odstraněné v tomto kroku (rozbité nebo mimo scénu).
function physStep(P) {
  P.hits.length = 0;
  P.world.step(PH.dt, 8, 3);
  for (const e of P.ents) {
    physSync(e);
    if (!e.dead && (e.x < PH.minX || e.x > PH.maxX || e.y < PH.minY)) { e.dead = true; e.out = true; P.kill.push(e); }
  }
  if (!P.kill.length) return P.kill;
  const out = P.kill;
  P.kill = [];
  for (const e of out) P.world.destroyBody(e.body);
  P.ents = P.ents.filter(e => !e.dead);
  return out;
}

function physRemove(P, e) {
  if (e.dead) return;
  e.dead = true;
  P.world.destroyBody(e.body);
  P.ents = P.ents.filter(x => x !== e);
}

// je svět v klidu?
function physCalm(P) {
  for (const e of P.ents) {
    if (!e.body.isAwake()) continue;
    if (Math.hypot(e.vx, e.vy) > PH.calmV || Math.abs(e.body.getAngularVelocity()) > PH.calmV * 2) return false;
  }
  return true;
}
