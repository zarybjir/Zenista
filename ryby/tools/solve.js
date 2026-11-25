'use strict';
// Hledá řešení úrovně náhodným zkoušením: node ryby/tools/solve.js [id] [počet pokusů]
// Vypíše nejlepší nalezené řešení (sol) a návrh hranic hvězd. Výstřel: [úhel, síla, krok schopnosti].
const { load } = require('../tests/lib.js');
const G = load();
const Game = G('Game'), LEVELS = G('LEVELS'), FISH = G('FISH'), mulberry32 = G('mulberry32');

function play(lvl, shots) {
  const g = new Game(lvl);
  for (const s of shots) {
    if (g.state !== 'aim') break;
    g.shoot(s[0], s[1]);
    for (let n = 0; (g.state === 'fly' || g.state === 'settle') && n < 3000; n++) {
      if (n === s[2]) g.ability();
      g.step();
    }
  }
  for (let i = 0; i < 120 && g.state === 'aim'; i++) g.step();
  return g;
}

const id = process.argv[2], N = +process.argv[3] || 600;
for (const lvl of LEVELS) {
  if (id && lvl.id !== id) continue;
  const rnd = mulberry32(12345);
  const shot = f => {
    const s = [Math.round((5 + rnd() * 70) * 2) / 2, Math.round((0.5 + rnd() * 0.5) * 50) / 50];
    if (FISH[f].ab && rnd() < 0.85) s.push(8 + (rnd() * 110 | 0));
    return s;
  };
  let best = null, wins = 0;
  for (let i = 0; i < N; i++) {
    let shots;
    if (best && rnd() < 0.4) { // obměna nejlepšího
      shots = best.shots.map(s => s.slice());
      const k = rnd() * shots.length | 0;
      shots[k] = rnd() < 0.5 ? shot(lvl.fish[k]) : [shots[k][0] + Math.round((rnd() - 0.5) * 8) / 2, shots[k][1], ...(shots[k].length > 2 ? [Math.max(1, shots[k][2] + (rnd() * 13 | 0) - 6)] : [])];
    } else shots = lvl.fish.map(shot);
    const g = play(lvl, shots);
    if (g.state !== 'won') continue;
    wins++;
    const used = lvl.fish.length - g.queue.length;
    if (!best || g.score > best.score) best = { score: g.score, shots: shots.slice(0, used) };
  }
  if (!best) { console.log(lvl.id + ': řešení nenalezeno'); continue; }
  const s3 = Math.floor((best.score - 1500) / 500) * 500, s2 = s3 - 10000; // o jednu rybu víc = dvě hvězdy
  console.log(`${lvl.id}: výher ${wins}/${N}, skóre ${best.score}\n    stars: [${s2}, ${s3}],\n    sol: ${JSON.stringify(best.shots).replace(/,/g, ', ')},`);
}
