'use strict';
// Hledá řešení úrovně: node ryby/tools/solve.js [id] [pokusů na výstřel]
// Postupuje výstřel po výstřelu: pro každý zkusí náhodné výstřely, nechá si několik nejlepších
// (nejméně zbylých medvědů, pak nejvyšší skóre) a pokračuje z nich. Vypíše nejlepší nalezené
// řešení (sol), návrh hranic hvězd a kolik pokusů o první výstřel úroveň rovnou vyhrálo.
// Výstřel: [úhel, síla, krok schopnosti].
const { load } = require('../tests/lib.js');
const G = load();
const Game = G('Game'), LEVELS = G('LEVELS'), FISH = G('FISH'), mulberry32 = G('mulberry32');
const KEEP = 3;

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

const id = process.argv[2], N = +process.argv[3] || 60;
for (const lvl of LEVELS) {
  if (id && lvl.id !== id) continue;
  const rnd = mulberry32(12345);
  const shot = f => {
    const s = [Math.round((-10 + rnd() * 85) * 2) / 2, Math.round((0.5 + rnd() * 0.5) * 50) / 50];
    if (FISH[f].ab && rnd() < 0.85) s.push(8 + (rnd() * 110 | 0));
    return s;
  };
  let front = [[]], best = null, first = 0;
  for (let k = 0; k < lvl.fish.length && front.length; k++) {
    const cand = [];
    for (const pre of front) for (let i = 0; i < N; i++) {
      const shots = [...pre, shot(lvl.fish[k])], g = play(lvl, shots);
      if (g.state === 'won') {
        if (!k) first++;
        if (!best || g.score > best.score) best = { score: g.score, shots };
      } else cand.push({ shots, bears: g.bears, score: g.score });
    }
    cand.sort((a, b) => a.bears - b.bears || b.score - a.score);
    front = cand.slice(0, KEEP).map(c => c.shots);
    if (best && best.shots.length <= k + 1) break; // s více rybami už skóre nebude lepší
  }
  if (!best) { console.log(lvl.id + ': řešení nenalezeno'); continue; }
  const s3 = Math.max(1000, Math.floor((best.score - 1500) / 500) * 500);
  const s2 = s3 > 12000 ? s3 - 10000 : s3 / 2; // o jednu rybu víc = dvě hvězdy
  console.log(`${lvl.id}: ryb ${best.shots.length}/${lvl.fish.length}, první výstřel vyhrál ${first}/${N}, skóre ${best.score}\n    stars: [${s2}, ${s3}],\n    sol: ${JSON.stringify(best.shots).replace(/,/g, ', ')},`);
}
