'use strict';
// ---------- čísla k ladění ----------
// Jednotky: metry, kilogramy, sekundy. y míří nahoru, zem je y = 0.

// fyzika
const PH = {
  dt: 1 / 60, g: -10,
  thr: 2,                 // impulz nárazu, pod kterým se nic nepoškodí
  calmV: 0.15, calmN: 45, // svět je v klidu: rychlosti pod calmV po calmN kroků
  settle: 90,             // kroky uklidnění po načtení úrovně
  bearDamp: 1.5,          // tlumení otáčení medvědů
  minX: -15, minY: -5, outX: 1.5, // tělesa vlevo od minX, pod minY nebo dál než outX za pravým okrajem úrovně se odstraní
};

// prak (rybářský prut): x, y = špička prutu; y musí být nad max + poloměr ryby,
// jinak by natažená ryba ležela na zemi a let by začal nárazem
const SLING = {
  x: 0, y: 2.8,
  max: 2.2,   // největší natažení
  min: 0.35,  // kratší tah se nepočítá jako výstřel
  k: 8,       // rychlost výstřelu = natažení × k
  grab: 1.6,  // jak daleko od ryby lze začít táhnout
  maxT: 720,  // nejdelší doba jednoho výstřelu (kroky)
  dots: 6, dotT: 0.07, // náznak dráhy: počet teček a rozestup v čase
};

// materiály: hustota, tření, pružnost, výdrž, body za rozbití
const MAT = {
  led:   { dens: 0.8, fric: 0.3, rest: 0.1,  hp: 5,  pts: 300, col: '#bfe6f5', edge: '#5d9fbd' },
  drevo: { dens: 1.1, fric: 0.6, rest: 0.15, hp: 28, pts: 500, col: '#c8904f', edge: '#6f4420' },
  kamen: { dens: 2.6, fric: 0.8, rest: 0.05, hp: 110, pts: 800, col: '#9aa0a6', edge: '#4b5157' },
};

// tvary bloků: šířka, výška
const SHAPE = {
  sloup:  [0.3, 1.6],
  spalek: [0.3, 0.8],
  tram:   [2.4, 0.3],
  deska:  [1.4, 0.3],
  kostka: [0.8, 0.8],
  blok:   [1.2, 0.6],
};

// ryby: poloměr, hustota, pružnost, násobek poškození podle materiálu (bear = medvědi),
// ab = čísla schopnosti (kód je ve fish.js), lx, ly = tvar těla při kreslení
const FISH = {
  pstruh:     { r: 0.28, dens: 5.5, rest: 0.25, fric: 0.5, dmg: { led: 1.6, drevo: 1, kamen: 0.5, bear: 1.3 },
                lx: 1.35, ly: 0.9, col: '#7fb069', belly: '#f2d9a0', edge: '#2f4a2a' },
  // rozdělí se na hejno tří; spread = rozevření ve stupních
  sardinky:   { r: 0.19, dens: 6, rest: 0.2, fric: 0.5, dmg: { led: 2.2, drevo: 0.6, kamen: 0.3, bear: 1.3 },
                ab: { spread: 11 }, lx: 1.5, ly: 0.7, col: '#8fa9c4', belly: '#e9eef3', edge: '#3a4d63' },
  // prudce zrychlí v přímém směru
  stika:      { r: 0.24, dens: 6.5, rest: 0.1, fric: 0.4, dmg: { led: 1, drevo: 2.4, kamen: 0.5, bear: 1 },
                ab: { speed: 30 }, lx: 1.9, ly: 0.65, col: '#5d8a4a', belly: '#dfe6b0', edge: '#26401f' },
  // nafoukne se a odhodí okolí: dosah, impulz a poškození uprostřed, nový poloměr a hustota
  ctverzubec: { r: 0.24, dens: 4, rest: 0.3, fric: 0.5, dmg: { led: 1, drevo: 1, kamen: 1.6, bear: 1 },
                ab: { rad: 2.6, imp: 9, dmg: 16, r: 0.5, dens: 1 }, lx: 1.1, ly: 1, col: '#e3b23c', belly: '#fbf1cf', edge: '#6b4e0e' },
  // schopnost nemá, bourá vahou
  sumec:      { r: 0.42, dens: 9, rest: 0.05, fric: 0.6, dmg: { led: 1, drevo: 1.2, kamen: 1.7, bear: 1 },
                lx: 1.4, ly: 0.9, col: '#5b5f6b', belly: '#c9c4b8', edge: '#24262d' },
  // výboj zasáhne medvědy v dosahu i přes překážku; na okraji dosahu má poloviční sílu
  uhor:       { r: 0.24, dens: 5, rest: 0.2, fric: 0.4, dmg: { led: 0.8, drevo: 0.8, kamen: 0.4, bear: 1 },
                ab: { rad: 4, dmg: 18 }, lx: 2.3, ly: 0.5, col: '#d9c23a', belly: '#f6efb5', edge: '#5e5210' },
};

// medvědi: poloměr, hustota, výdrž, body; hat = přilba z kotlíku
const BEARS = {
  medvide: { r: 0.4,  dens: 1.2, rest: 0.25, fric: 0.6, hp: 5,  pts: 3000,  col: '#b07a48' },
  medved:  { r: 0.55, dens: 1.4, rest: 0.2,  fric: 0.6, hp: 12, pts: 5000,  col: '#8a5a33' },
  kotlik:  { r: 0.55, dens: 1.6, rest: 0.2,  fric: 0.6, hp: 30, pts: 8000,  col: '#8a5a33', hat: true },
  grizzly: { r: 0.85, dens: 1.8, rest: 0.1,  fric: 0.7, hp: 60, pts: 12000, col: '#5e3d24' },
};

const SCORE = { fish: 10000 }; // za každou nevystřelenou rybu

// pohled: výška scény v metrech, výška země nad spodním okrajem, levý okraj
const VIEW = { h: 14, ground: 1.6, minX: -4.6, zMin: 0.6, zMax: 1.6 };

// efekty: nejvyšší počet částic, otřes kamery (metry na jednotku impulzu a strop), barvy úlomků
const FX = {
  max: 300, shake: 0.006, shakeMax: 0.22,
  col: { led: ['#e6f7fd', '#bfe6f5', '#8cc9e3'], drevo: ['#d9a566', '#c8904f', '#8f5f2e'], kamen: ['#b9bec3', '#9aa0a6', '#6d7379'] },
};
