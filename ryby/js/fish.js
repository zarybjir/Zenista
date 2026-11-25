'use strict';
// ---------- schopnosti ryb (jedna funkce na typ) ----------
// Funkce dostane hru a entitu ryby; volá se nejvýš jednou za let, před prvním nárazem.
// Čísla jsou ve FISH[typ].ab. Každá schopnost ohlásí událost 'ab' pro efekty a zvuk.
const ABILITY = {
  // hejno: přibudou dvě ryby nad a pod, dráhy se rozevřou
  sardinky(g, f) {
    const sp = Math.hypot(f.vx, f.vy) || 1, nx = -f.vy / sp, ny = f.vx / sp;
    for (const s of [-1, 1]) {
      const a = s * FISH.sardinky.ab.spread * DEG, c = Math.cos(a), si = Math.sin(a);
      const e = physFish(g.P, f.type, f.x + nx * s * f.r * 2.2, f.y + ny * s * f.r * 2.2, f.vx * c - f.vy * si, f.vx * si + f.vy * c);
      e.used = true;
      g.extra.push(e);
    }
    g.ev.push({ k: 'ab', m: f.type, x: f.x, y: f.y });
  },

  stika(g, f) {
    const sp = Math.hypot(f.vx, f.vy) || 1, k = FISH.stika.ab.speed / sp;
    f.vx *= k; f.vy *= k;
    f.body.setLinearVelocity({ x: f.vx, y: f.vy });
    g.ev.push({ k: 'ab', m: f.type, x: f.x, y: f.y });
  },

  ctverzubec(g, f) {
    const a = FISH.ctverzubec.ab;
    physGrow(f, a.r, a.dens);
    physBlast(g.P, f, a.rad, a.imp, a.dmg);
    g.ev.push({ k: 'ab', m: f.type, x: f.x, y: f.y, r: a.rad });
  },

  uhor(g, f) {
    const a = FISH.uhor.ab, to = [];
    for (const e of g.P.ents) {
      if (e.kind !== 'bear' || e.dead) continue;
      const d = Math.hypot(e.x - f.x, e.y - f.y);
      if (d >= a.rad) continue;
      physDamage(g.P, e, null, a.dmg * (1 - 0.5 * d / a.rad));
      to.push(e.x, e.y);
    }
    g.ev.push({ k: 'ab', m: f.type, x: f.x, y: f.y, r: a.rad, to });
  },
};

function fishAbility(g, f) {
  const fn = ABILITY[f.type];
  if (!fn || f.used || f.hit || f.dead) return false;
  f.used = true;
  fn(g, f);
  return true;
}
