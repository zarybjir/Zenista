'use strict';
// Testy logiky bez prohlížeče: node ryby/tests/run.js [filtr]
const { load } = require('./lib.js');
const G = load();
const Game = G('Game'), LEVELS = G('LEVELS'), SLING = G('SLING'), MAT = G('MAT'), SHAPE = G('SHAPE'),
  FISH = G('FISH'), BEARS = G('BEARS'), SCORE = G('SCORE'), Save = G('Save'), ABILITY = G('ABILITY'),
  localStorage = G('localStorage');

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
    for (let n = 0; flying(g); n++) {
      ok(n < 3000, 'výstřel neskončil');
      if (n === s[2]) g.ability(); // třetí číslo = krok, ve kterém se spustí schopnost
      g.step();
    }
  }
  for (let i = 0; i < 120 && g.state === 'aim'; i++) g.step(); // pozdní pád medvěda se počítá i při míření
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
    ok(LEVELS.filter(l => l.id === lvl.id).length === 1, 'id úrovně není jedinečné');
    ok(lvl.stars.length === 2 && lvl.stars[0] > 0 && lvl.stars[0] < lvl.stars[1], 'hranice hvězd nejsou seřazené');
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
    ok(g.stars() === 3, 'referenční řešení má dát 3 hvězdy, skóre ' + g.score + ', hranice ' + lvl.stars);
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
    const g = new Game({ id: 't', name: 't', w: 20, stars: [1, 2], fish: ['pstruh'], blocks: [[mat, 'kostka', 8, 0.4]], bears: [['medved', 30, 0.55]], sol: [] });
    g.shoot(-6, 1); // přímá rána shora z prutu
    while (flying(g)) g.step();
    const b = g.P.ents.find(e => e.kind === 'block');
    return b ? b.hp / b.max : 0;
  };
  const l = hit('led'), d = hit('drevo'), k = hit('kamen');
  ok(l === 0, 'led přímý zásah nevydržel mít: ' + l);
  ok(d > 0 && d < 1, 'dřevo má být poškozené, ne rozbité: ' + d);
  ok(k > d, 'kámen má vydržet víc než dřevo: ' + k + ' / ' + d);
});

test('události: rozbití a body odpovídají skóre', () => {
  const lvl = LEVELS[1], g = new Game(lvl), ev = [];
  g.shoot(lvl.sol[0][0], lvl.sol[0][1]);
  ok(g.ev.length === 1 && g.ev[0].k === 'shot', 'chybí událost výstřelu');
  for (let n = 0; flying(g) && n < 3000; n++) { g.step(); ev.push(...g.ev); g.ev.length = 0; }
  const k = t => ev.filter(e => e.k === t);
  ok(k('hit').length > 0 && k('hit').every(e => e.i > 0 && isFinite(e.x) && isFinite(e.y) && e.m), 'nárazy');
  ok(k('bear').length === 1 && k('win').length === 1 && k('win')[0].n === g.queue.length, 'medvěd a výhra');
  let pts = 0;
  for (const e of [...k('break'), ...k('bear')]) pts += e.pts;
  ok(pts + g.queue.length * SCORE.fish === g.score, 'body v událostech ' + pts + ' neodpovídají skóre ' + g.score);
  ok(k('break').every(e => MAT[e.m] && e.w > 0 && e.h > 0), 'událost rozbití nemá materiál a rozměr');
});

test('události: výstřel vedle nastaví miss a prohra se ohlásí', () => {
  const lvl = LEVELS[0], g = new Game(lvl), ev = [];
  g.shoot(170, 1);
  while (flying(g)) g.step();
  ok(g.miss && g.state === 'aim', 'miss po výstřelu vedle');
  g.shoot(lvl.sol[0][0], lvl.sol[0][1]);
  ok(!g.miss, 'miss se má výstřelem zrušit');
  const h = play(lvl, lvl.fish.map(() => [170, 1]));
  ok(h.ev.some(e => e.k === 'lost') && !h.ev.some(e => e.k === 'win'), 'prohra bez události');
});

test('prak: ryba při plném natažení nezačíná na zemi', () => {
  for (const k of Object.keys(FISH)) ok(SLING.y - SLING.max > (FISH[k].ab && FISH[k].ab.r || FISH[k].r) + 0.05, k + ' by ležela na zemi');
  const g = new Game(LEVELS[0]);
  g.shoot(90, 1); g.step(); g.step();
  ok(g.state === 'fly' && !g.fish.hit, 'let začal nárazem');
});

// ---------- ryby a schopnosti ----------
// zkušební úroveň: jedna ryba, medvědi a bloky podle potřeby
const lab = (fish, blocks, bears) => new Game({ id: 't', name: 't', w: 30, stars: [1, 2], fish: [fish], blocks, bears, sol: [] });
const fly = (g, n) => { for (let i = 0; i < n; i++) g.step(); };

test('ryby: každá má data a schopnost jen ta, která ji má mít', () => {
  for (const [k, f] of Object.entries(FISH)) {
    ok(f.r > 0 && f.dens > 0 && f.col && f.lx && f.ly, k + ': chybí data');
    for (const m of ['led', 'drevo', 'kamen', 'bear']) ok(f.dmg[m] > 0, k + ': chybí násobek pro ' + m);
    ok(!!f.ab === !!ABILITY[k], k + ': data schopnosti a kód si neodpovídají');
  }
  ok(Object.keys(FISH).every(k => LEVELS.some(l => l.fish.includes(k))), 'některá ryba není v žádné úrovni');
  ok(Object.keys(BEARS).every(k => LEVELS.some(l => l.bears.some(b => b[0] === k))), 'některý medvěd není v žádné úrovni');
});

test('schopnost: jen jednou, jen za letu a před nárazem', () => {
  const g = lab('stika', [], [['medved', 25, 0.55]]);
  ok(!g.ability(), 'schopnost při míření');
  g.shoot(45, 1); fly(g, 10);
  ok(g.ability() && !g.ability(), 'schopnost má jít spustit právě jednou');
  const h = lab('stika', [], [['medved', 25, 0.55]]);
  h.shoot(-30, 0.6);
  while (h.state === 'fly') h.step();
  ok(!h.ability(), 'schopnost po nárazu');
  const p = lab('pstruh', [], [['medved', 25, 0.55]]);
  p.shoot(45, 1); fly(p, 10);
  ok(!p.ability(), 'pstruh schopnost nemá');
});

test('štika: zrychlí ve směru letu', () => {
  const g = lab('stika', [], [['medved', 25, 0.55]]);
  g.shoot(40, 0.8); fly(g, 20);
  const f = g.fish, a = Math.atan2(f.vy, f.vx);
  g.ability(); g.step();
  ok(Math.abs(Math.hypot(f.vx, f.vy) - FISH.stika.ab.speed) < 1, 'rychlost ' + Math.hypot(f.vx, f.vy));
  ok(Math.abs(Math.atan2(f.vy, f.vx) - a) < 0.05, 'směr se změnil');
});

test('sardinky: rozdělí se na tři a po výstřelu zmizí všechny', () => {
  const g = lab('sardinky', [], [['medved', 28, 0.55]]);
  g.shoot(45, 0.9); fly(g, 20);
  g.ability(); fly(g, 15);
  const fs = g.P.ents.filter(e => e.kind === 'fish');
  ok(fs.length === 3 && g.extra.length === 2, 'počet ryb ' + fs.length);
  const ys = fs.map(e => e.y).sort((a, b) => a - b);
  ok(ys[2] - ys[0] > 0.8, 'hejno se nerozevřelo');
  while (flying(g)) g.step();
  ok(!g.P.ents.some(e => e.kind === 'fish') && g.extra.length === 0, 'ryby po výstřelu zůstaly');
});

test('čtverzubec: nafoukne se, odhodí a poškodí okolí', () => {
  const g = lab('ctverzubec', [['drevo', 'kostka', 16.3, 0.4], ['drevo', 'kostka', 23, 0.4]], [['medved', 29, 0.55]]);
  const [near, far] = g.P.ents;
  g.shoot(30, 0.75);
  while (g.state === 'fly' && Math.hypot(g.fish.x - near.x, g.fish.y - near.y) > 1.5) g.step();
  ok(g.state === 'fly', 'ryba k bloku nedoletěla');
  g.ability();
  ok(g.fish.r === FISH.ctverzubec.ab.r, 'ryba se nenafoukla');
  fly(g, 5);
  ok(near.hp < near.max && Math.hypot(near.vx, near.vy) > 0.5, 'blízký blok nebyl zasažen');
  ok(far.hp === far.max && Math.hypot(far.vx, far.vy) < 0.01, 'vzdálený blok byl zasažen');
});

test('úhoř: výboj zasáhne medvěda za zdí, vzdáleného ne', () => {
  const wall = [['kamen', 'kostka', 9, 0.4], ['kamen', 'kostka', 9, 1.2], ['kamen', 'kostka', 9, 2]];
  const g = lab('uhor', wall, [['medved', 10.2, 0.55], ['medved', 25, 0.55]]);
  const far = g.P.ents.find(e => e.kind === 'bear' && e.x > 20);
  g.shoot(10, 0.7);
  while (g.state === 'fly' && g.fish.x < 8) g.step();
  ok(g.state === 'fly', 'ryba ke zdi nedoletěla');
  g.ability();
  ok(g.P.ents.filter(e => e.kind === 'block').every(e => e.hp === e.max), 'výboj poškodil zeď');
  g.step();
  ok(g.bears === 1 && g.score === BEARS.medved.pts, 'medvěd za zdí přežil');
  ok(far.hp === far.max, 'vzdálený medvěd byl zasažen');
});

test('medvědi: výdrž roste od medvíděte po grizzlyho', () => {
  const b = BEARS;
  ok(b.medvide.hp < b.medved.hp && b.medved.hp < b.kotlik.hp && b.kotlik.hp < b.grizzly.hp, 'výdrž');
  ok(b.medvide.pts < b.medved.pts && b.medved.pts < b.kotlik.pts && b.kotlik.pts < b.grizzly.pts, 'body');
});

// ---------- hvězdy a ukládání ----------
test('hvězdy: podle hranic úrovně, bez výhry žádná', () => {
  const g = new Game(LEVELS[0]), s = LEVELS[0].stars;
  ok(g.stars() === 0, 'hvězdy bez výhry');
  g.state = 'won';
  g.score = s[0] - 1; ok(g.stars() === 1, 'pod první hranicí');
  g.score = s[0]; ok(g.stars() === 2, 'na první hranici');
  g.score = s[1]; ok(g.stars() === 3, 'na druhé hranici');
});

test('ukládání: zápis, načtení, lepší výsledek se nepřepíše', () => {
  localStorage.removeItem(Save.KEY); Save.load();
  ok(!Save.any() && Save.open(0) && !Save.open(1), 'prázdný postup');
  ok(Save.put('led-1', 2, 20000) === true, 'první výsledek je nejlepší');
  ok(Save.put('led-1', 1, 15000) === false, 'horší výsledek není nejlepší');
  Save.load();
  const r = Save.get('led-1');
  ok(r.s === 2 && r.b === 20000, 'uloženo ' + JSON.stringify(r));
  ok(Save.any() && Save.open(1) && !Save.open(2), 'odemčení další úrovně');
  ok(Save.put('led-1', 3, 26000) && Save.get('led-1').s === 3, 'lepší výsledek');
});

test('ukládání: poškozená a starší data hru neshodí', () => {
  for (const raw of ['{', 'null', '5', '{"lv":7}', '{"v":0,"lv":{"led-1":{"s":"x","b":-5},"zrusena":{"s":3}}}', '{"v":1,"lv":{"led-1":{"s":9}}}']) {
    localStorage.setItem(Save.KEY, raw); Save.load();
    const r = Save.get('led-1');
    ok(r.s >= 0 && r.s <= 3 && r.b >= 0, raw + ' → ' + JSON.stringify(r));
    ok(Save.open(0), raw + ': první úroveň má být vždy přístupná');
  }
  localStorage.setItem(Save.KEY, '{"lv":{"led-1":{"s":2}}}'); Save.load(); // starší formát bez skóre a verze
  ok(Save.get('led-1').s === 2 && Save.get('led-1').b === 0 && Save.open(1), 'chybějící pole se doplní');
  localStorage.removeItem(Save.KEY); Save.load();
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
