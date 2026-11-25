'use strict';
// Testy logiky bez prohlížeče: node ryby/tests/run.js [filtr]
const { load } = require('./lib.js');
const G = load();
const Game = G('Game'), LEVELS = G('LEVELS'), SLING = G('SLING'), MAT = G('MAT'), SHAPE = G('SHAPE'),
  FISH = G('FISH'), BEARS = G('BEARS'), SCORE = G('SCORE');

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const flying = g => g.state === 'fly' || g.state === 'settle';

// odehraje výstřely [úhel, síla] a nechá svět doznít
function play(lvl, shots) {
  const g = new Game(lvl);
  for (const s of shots) {
    if (g.state !== 'aim') break;
    ok(g.shoot(s[0], s[1]), 'výstřel se neprovedl');
    for (let n = 0; flying(g); n++) { ok(n < 3000, 'výstřel neskončil'); g.step(); }
  }
  return g;
}

for (const lvl of LEVELS) {
  test(lvl.id + ': data úrovně', () => {
    ok(lvl.id && lvl.name && lvl.w > 0, 'chybí id, název nebo šířka');
    ok(lvl.fish.length && lvl.fish.every(f => FISH[f]), 'neznámá ryba');
    ok(lvl.bears.length && lvl.bears.every(b => BEARS[b[0]]), 'neznámý medvěd');
    ok(lvl.blocks.every(b => MAT[b[0]] && SHAPE[b[1]]), 'neznámý materiál nebo tvar');
    ok(lvl.blocks.length + lvl.bears.length <= 80, 'příliš mnoho těles');
    ok(lvl.sol.length && lvl.sol.length <= lvl.fish.length, 'chybí referenční řešení');
  });

  test(lvl.id + ': stavba po načtení stojí', () => {
    const g = new Game(lvl), a = g.P.ents.map(e => [e.x, e.y, e.hp]);
    lvl.blocks.forEach((b, i) => ok(Math.hypot(a[i][0] - b[2], a[i][1] - b[3]) < 0.1, 'blok ' + i + ' si při načtení sedl jinam'));
    for (const e of g.P.ents) e.body.setAwake(true);
    for (let i = 0; i < 300; i++) g.step();
    ok(g.P.ents.length === a.length, 'něco se samo rozbilo');
    g.P.ents.forEach((e, i) => {
      ok(Math.hypot(e.x - a[i][0], e.y - a[i][1]) < 0.02, 'těleso ' + i + ' se samo hýbe');
      ok(e.hp === a[i][2], 'těleso ' + i + ' se samo poškodilo');
    });
    ok(g.state === 'aim' && g.score === 0, 'stav se změnil bez výstřelu');
  });

  test(lvl.id + ': referenční řešení vyhraje', () => {
    const g = play(lvl, lvl.sol);
    ok(g.state === 'won', 'stav ' + g.state);
    ok(g.bears === 0, 'zbyli medvědi');
    ok(g.score >= (lvl.fish.length - lvl.sol.length) * SCORE.fish + BEARS[lvl.bears[0][0]].pts, 'skóre ' + g.score);
  });

  test(lvl.id + ': stejný vstup dá stejný výsledek', () => {
    const snap = g => JSON.stringify([g.score, g.state, g.P.ents.map(e => [e.x, e.y, e.a, e.hp])]);
    ok(snap(play(lvl, lvl.sol)) === snap(play(lvl, lvl.sol)), 'výsledky se liší');
    const miss = [[40, 0.6], [15, 0.7]];
    ok(snap(play(lvl, miss)) === snap(play(lvl, miss)), 'výsledky se liší (jiný výstřel)');
  });

  test(lvl.id + ': výstřely mimo skončí prohrou', () => {
    const g = play(lvl, lvl.fish.map(() => [170, 1]));
    ok(g.state === 'lost', 'stav ' + g.state);
    ok(g.score === 0 && g.queue.length === 0, 'skóre nebo fronta nesedí');
  });
}

test('prak: krátký tah nevystřelí', () => {
  const g = new Game(LEVELS[0]);
  g.aimStart(); g.aimTo(SLING.x - 0.1, SLING.y);
  ok(!g.release(), 'vystřelilo');
  ok(g.state === 'aim' && g.queue.length === LEVELS[0].fish.length && g.pull.x === 0, 'stav se změnil');
});

test('prak: natažení je omezené a rychlost mu odpovídá', () => {
  const g = new Game(LEVELS[0]);
  g.aimTo(SLING.x - 50, SLING.y - 50);
  ok(Math.abs(Math.hypot(g.pull.x, g.pull.y) - SLING.max) < 1e-9, 'natažení přes limit');
  const v = g.launchVel();
  ok(v.x > 0 && v.y > 0 && Math.abs(Math.hypot(v.x, v.y) - SLING.max * SLING.k) < 1e-9, 'rychlost nesedí');
  g.aimTo(SLING.x - 1, -5);
  ok(SLING.y + g.pull.y >= FISH[g.queue[0]].r - 1e-9, 'ryba pod zemí');
});

test('prak: během letu nejde mířit ani střílet', () => {
  const g = new Game(LEVELS[0]);
  ok(g.shoot(30, 0.8), 'první výstřel');
  ok(!g.aimStart() && !g.shoot(30, 0.8), 'druhý výstřel za letu');
  ok(g.queue.length === LEVELS[0].fish.length - 1, 'fronta');
});

test('stopa: zůstává po výstřelu a nahradí ji další', () => {
  const g = play(LEVELS[0], [[170, 0.9]]);
  ok(g.state === 'aim' && g.last.length > 4 && g.trail.length === 0, 'stopa chybí');
  const first = g.last;
  g.shoot(170, 0.5);
  while (flying(g)) g.step();
  ok(g.last !== first && g.last.length > 4, 'stopa se nenahradila');
});

test('body: nevystřelené ryby se počítají při výhře', () => {
  const lvl = LEVELS[0], g = play(lvl, lvl.sol);
  let pts = 0;
  for (const b of lvl.blocks) pts += MAT[b[0]].pts;
  const base = g.score - g.queue.length * SCORE.fish;
  ok(g.queue.length === lvl.fish.length - lvl.sol.length, 'fronta');
  ok(base >= BEARS.medved.pts && base <= BEARS.medved.pts + pts, 'body za bloky a medvěda: ' + base);
});

test('materiály: led praskne dřív než dřevo a kámen', () => {
  ok(MAT.led.hp < MAT.drevo.hp && MAT.drevo.hp < MAT.kamen.hp, 'výdrž');
  ok(MAT.led.dens < MAT.drevo.dens && MAT.drevo.dens < MAT.kamen.dens, 'hustota');
  const hit = mat => {
    const g = new Game({ id: 't', name: 't', w: 20, fish: ['pstruh'], blocks: [[mat, 'kostka', 8, 0.4]], bears: [['medved', 30, 0.55]], sol: [] });
    g.shoot(8, 1);
    while (flying(g)) g.step();
    const b = g.P.ents.find(e => e.kind === 'block');
    return b ? b.hp / b.max : 0;
  };
  const l = hit('led'), d = hit('drevo'), k = hit('kamen');
  ok(l === 0, 'led přímý zásah nevydržel mít: ' + l);
  ok(d > 0 && d < 1, 'dřevo má být poškozené, ne rozbité: ' + d);
  ok(k > d, 'kámen má vydržet víc než dřevo: ' + k + ' / ' + d);
});

// ---------- běh ----------
const filter = process.argv[2];
let fail = 0, n = 0;
for (const [name, fn] of tests) {
  if (filter && !name.includes(filter)) continue;
  n++;
  try { fn(); console.log('ok   ' + name); }
  catch (e) { fail++; console.log('FAIL ' + name + ' – ' + e.message); }
}
console.log(fail ? `\n${fail} z ${n} testů selhalo` : `\nvšech ${n} testů prošlo`);
process.exit(fail ? 1 : 0);
