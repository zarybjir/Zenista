'use strict';
// ---------- úrovně (jen data) ----------
// id     stálé, používá se v uloženém postupu
// w      pravý okraj scény v metrech
// fish   pořadí ryb
// blocks [materiál, tvar, x, y, úhel ve stupních] – x, y je střed
// bears  [typ, x, y]
// sol    referenční řešení pro testy: [úhel, síla 0–1] za každý výstřel
const LEVELS = [
  {
    id: 'led-1', name: 'Ledová bouda', w: 20,
    fish: ['pstruh', 'pstruh', 'pstruh'],
    blocks: [
      ['led', 'sloup', 14, 0.8], ['led', 'sloup', 16, 0.8],
      ['led', 'tram', 15, 1.75],
    ],
    bears: [['medved', 15, 0.55]],
    sol: [[30, 0.8]],
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
    sol: [[27.5, 0.9]],
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
    sol: [[30, 0.9]],
  },
];
