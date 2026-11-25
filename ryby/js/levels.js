'use strict';
// ---------- úrovně (jen data) ----------
// id     stálé, používá se v uloženém postupu
// w      pravý okraj scény v metrech
// fish   pořadí ryb
// blocks [materiál, tvar, x, y, úhel ve stupních] – x, y je střed
// bears  [typ, x, y]
// stars  hranice bodů pro 2 a 3 hvězdy (jedna hvězda je za dohrání)
// sol    referenční řešení pro testy: [úhel, síla 0–1, krok schopnosti] za každý výstřel;
//        má dát 3 hvězdy. Hledá ho node ryby/tools/solve.js <id>.
const LEVELS = [
  {
    id: 'led-1', name: 'Ledová bouda', w: 20,
    fish: ['pstruh', 'pstruh', 'pstruh'],
    blocks: [
      ['led', 'sloup', 14, 0.8], ['led', 'sloup', 16, 0.8],
      ['led', 'tram', 15, 1.75],
    ],
    bears: [['medved', 15, 0.55]],
    stars: [14000, 24000],
    sol: [[18, 0.88]],
  },
  {
    id: 'drevo-1', name: 'Srub', w: 21,
    fish: ['pstruh', 'pstruh', 'pstruh'],
    blocks: [
      ['drevo', 'sloup', 15, 0.8], ['drevo', 'sloup', 17, 0.8],
      ['drevo', 'tram', 16, 1.75],
      ['led', 'sloup', 15.2, 2.7], ['led', 'sloup', 16.8, 2.7],
      ['drevo', 'tram', 16, 3.65],
    ],
    bears: [['medved', 16, 2.45]],
    stars: [14500, 24500],
    sol: [[71, 0.96]],
  },
  {
    id: 'kamen-1', name: 'Kamenná zídka', w: 22,
    fish: ['pstruh', 'pstruh', 'pstruh', 'pstruh'],
    blocks: [
      ['kamen', 'sloup', 14.5, 0.8],
      ['kamen', 'kostka', 17, 0.4], ['kamen', 'kostka', 19, 0.4],
      ['drevo', 'tram', 18, 0.95],
      ['led', 'sloup', 17.1, 1.9], ['led', 'sloup', 18.9, 1.9],
      ['led', 'tram', 18, 2.85],
    ],
    bears: [['medved', 18, 1.65]],
    stars: [24000, 34000],
    sol: [[25.5, 0.94]],
  },
  {
    id: 'sardinky-1', name: 'Tři doupata', w: 21,
    fish: ['sardinky', 'sardinky', 'pstruh'],
    blocks: [
      ['led', 'kostka', 13.5, 0.4], ['led', 'kostka', 16, 0.4], ['led', 'kostka', 18.5, 0.4],
      ['led', 'kostka', 16, 1.2],
    ],
    bears: [['medvide', 13.5, 1.2], ['medvide', 16, 2], ['medvide', 18.5, 1.2]],
    stars: [18000, 28000],
    sol: [[33.5, 0.78, 10]],
  },
  {
    id: 'stika-1', name: 'Palisáda', w: 21,
    fish: ['stika', 'stika', 'pstruh'],
    blocks: [
      ['drevo', 'kostka', 14, 0.4], ['drevo', 'kostka', 14, 1.2],
      ['drevo', 'sloup', 15.2, 0.8], ['drevo', 'sloup', 17.2, 0.8],
      ['drevo', 'tram', 16.2, 1.75],
      ['drevo', 'blok', 16.2, 2.2],
    ],
    bears: [['medved', 16.2, 0.55]],
    stars: [15000, 25000],
    sol: [[16, 0.84, 43]],
  },
  {
    id: 'kotlik-1', name: 'Kotlík', w: 21,
    fish: ['pstruh', 'stika', 'pstruh', 'stika'],
    blocks: [
      ['kamen', 'blok', 14, 0.3],
      ['led', 'sloup', 15, 0.8], ['led', 'sloup', 17, 0.8],
      ['drevo', 'tram', 16, 1.75],
      ['led', 'kostka', 16, 2.3],
    ],
    bears: [['kotlik', 16, 0.55]],
    stars: [17500, 27500],
    sol: [[52, 0.74], [12.5, 0.92, 38]],
  },
  {
    id: 'ctverzubec-1', name: 'Hromada', w: 22,
    fish: ['ctverzubec', 'ctverzubec', 'pstruh'],
    blocks: [
      ['kamen', 'kostka', 15, 0.4], ['kamen', 'kostka', 16, 0.4], ['kamen', 'kostka', 17, 0.4],
      ['drevo', 'kostka', 15.5, 1.2], ['drevo', 'kostka', 16.5, 1.2],
      ['led', 'deska', 16, 1.75],
    ],
    bears: [['medved', 16, 2.45], ['medvide', 18.4, 0.4]],
    stars: [16500, 26500],
    sol: [[18.5, 0.94, 87]],
  },
  {
    id: 'sumec-1', name: 'Věž', w: 22,
    fish: ['sumec', 'sumec', 'pstruh'],
    blocks: [
      ['kamen', 'sloup', 15.2, 0.8], ['kamen', 'sloup', 16.8, 0.8],
      ['kamen', 'tram', 16, 1.75],
      ['kamen', 'sloup', 15.2, 2.7], ['kamen', 'sloup', 16.8, 2.7],
      ['kamen', 'tram', 16, 3.65],
    ],
    bears: [['medved', 16, 2.45], ['medvide', 16, 4.2]],
    stars: [19500, 29500],
    sol: [[26, 0.84]],
  },
  {
    id: 'uhor-1', name: 'Bunkr', w: 22,
    fish: ['uhor', 'uhor', 'pstruh'],
    blocks: [
      ['kamen', 'kostka', 15, 0.4], ['kamen', 'kostka', 15, 1.2],
      ['kamen', 'kostka', 17, 0.4], ['kamen', 'kostka', 17, 1.2],
      ['kamen', 'tram', 16, 1.75],
      ['kamen', 'blok', 16, 2.2],
    ],
    bears: [['medved', 16, 0.55]],
    stars: [13500, 23500],
    sol: [[37, 0.84, 102]],
  },
  {
    id: 'grizzly-1', name: 'Grizzly', w: 23,
    fish: ['sumec', 'ctverzubec', 'stika', 'uhor', 'pstruh'],
    blocks: [
      ['kamen', 'blok', 14.95, 0.3], ['drevo', 'blok', 18.05, 0.3],
      ['kamen', 'sloup', 15.4, 1.4], ['drevo', 'sloup', 17.6, 1.4],
      ['drevo', 'tram', 16.5, 2.35],
      ['led', 'sloup', 15.9, 3.3], ['led', 'sloup', 17.1, 3.3],
      ['drevo', 'deska', 16.5, 4.25],
      ['kamen', 'kostka', 19.4, 0.4],
    ],
    bears: [['grizzly', 16.5, 0.85], ['medvide', 16.5, 2.9], ['medvide', 19.4, 1.2]],
    stars: [47500, 57500],
    sol: [[19, 0.96]],
  },
];
