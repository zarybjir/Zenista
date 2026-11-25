'use strict';
// ---------- čísla k ladění ----------
// Jednotky: metry, kilogramy, sekundy. y míří nahoru, zem je y = 0.

// fyzika
const PH = {
  dt: 1 / 60, g: -10,
  thr: 2,                 // impulz nárazu, pod kterým se nic nepoškodí
  calmV: 0.15, calmN: 45, // svět je v klidu: rychlosti pod calmV po calmN kroků
  settle: 90,             // kroky uklidnění po načtení úrovně
  minX: -15, maxX: 45, minY: -5, // mimo tyto meze se tělesa odstraní
};

// prak (rybářský prut): x, y = špička prutu
const SLING = {
  x: 0, y: 1.8,
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
  drevo: { dens: 1.1, fric: 0.6, rest: 0.15, hp: 20, pts: 500, col: '#c8904f', edge: '#6f4420' },
  kamen: { dens: 2.6, fric: 0.8, rest: 0.05, hp: 70, pts: 800, col: '#9aa0a6', edge: '#4b5157' },
};

// tvary bloků: šířka, výška
const SHAPE = {
  sloup:  [0.3, 1.6],
  tram:   [2.4, 0.3],
  deska:  [1.4, 0.3],
  kostka: [0.8, 0.8],
  blok:   [1.2, 0.6],
};

// ryby: poloměr, hustota, pružnost, násobek poškození podle materiálu
const FISH = {
  pstruh: { r: 0.28, dens: 5.5, rest: 0.25, fric: 0.5, dmg: { led: 1.6, drevo: 1, kamen: 0.5, medved: 1.3 }, col: '#7fb069', belly: '#f2d9a0' },
};

// medvědi: poloměr, hustota, výdrž, body
const BEARS = {
  medved: { r: 0.55, dens: 1.4, rest: 0.2, fric: 0.6, hp: 9, pts: 5000, col: '#8a5a33' },
};

const SCORE = { fish: 10000 }; // za každou nevystřelenou rybu

// pohled: výška scény v metrech, výška země nad spodním okrajem, levý okraj
const VIEW = { h: 14, ground: 1.6, minX: -4, zMin: 0.6, zMax: 1.6 };

// efekty: nejvyšší počet částic, otřes kamery (metry na jednotku impulzu a strop), barvy úlomků
const FX = {
  max: 300, shake: 0.006, shakeMax: 0.22,
  col: { led: ['#e6f7fd', '#bfe6f5', '#8cc9e3'], drevo: ['#d9a566', '#c8904f', '#8f5f2e'], kamen: ['#b9bec3', '#9aa0a6', '#6d7379'] },
};
