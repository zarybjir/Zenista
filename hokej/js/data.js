'use strict';
// ---------- Fiktivní týmy ligy ----------
const TEAMS = [
  { city: 'Praha', name: 'Gryfové', abbr: 'PRG', c1: '#b3122e', c2: '#f4c542', c3: '#1b1b1b', pants: '#1b1b1b', off: 88, def: 84, gk: 86, spd: 86 },
  { city: 'Brno', name: 'Vlci', abbr: 'BRN', c1: '#0b6e3a', c2: '#f0f0f0', c3: '#d7b400', pants: '#0d2e1b', off: 86, def: 87, gk: 84, spd: 84 },
  { city: 'Ostrava', name: 'Havíři', abbr: 'OVA', c1: '#1f3f7a', c2: '#ff7a1a', c3: '#ffffff', pants: '#111c33', off: 84, def: 89, gk: 88, spd: 82 },
  { city: 'Plzeň', name: 'Sládci', abbr: 'PLZ', c1: '#c26a00', c2: '#2b1a0e', c3: '#ffffff', pants: '#2b1a0e', off: 90, def: 80, gk: 82, spd: 85 },
  { city: 'Liberec', name: 'Rysi', abbr: 'LBC', c1: '#1e9bd7', c2: '#0a2240', c3: '#ffffff', pants: '#0a2240', off: 85, def: 85, gk: 85, spd: 90 },
  { city: 'Olomouc', name: 'Sokoli', abbr: 'OLM', c1: '#5b2c83', c2: '#e8b923', c3: '#ffffff', pants: '#2a1440', off: 83, def: 86, gk: 87, spd: 85 },
  { city: 'K. Vary', name: 'Gejzíři', abbr: 'KVA', c1: '#00898a', c2: '#ffffff', c3: '#0b2b2b', pants: '#0b2b2b', off: 87, def: 82, gk: 83, spd: 88 },
  { city: 'Budějovice', name: 'Medvědi', abbr: 'CBU', c1: '#161616', c2: '#f2b705', c3: '#c8102e', pants: '#161616', off: 89, def: 86, gk: 80, spd: 83 },
  { city: 'Zlín', name: 'Ševci', abbr: 'ZLN', c1: '#d9262e', c2: '#1d4fa0', c3: '#ffffff', pants: '#1d4fa0', off: 82, def: 88, gk: 90, spd: 82 },
  { city: 'Hradec', name: 'Lvi', abbr: 'HKR', c1: '#e6e6e6', c2: '#c8102e', c3: '#111111', pants: '#c8102e', off: 86, def: 84, gk: 86, spd: 87 },
];

const SURNAMES = ['Novák', 'Svoboda', 'Dvořák', 'Černý', 'Procházka', 'Kučera', 'Veselý', 'Horák', 'Němec', 'Pokorný',
  'Pospíšil', 'Hájek', 'Král', 'Jelínek', 'Růžička', 'Beneš', 'Fiala', 'Sedláček', 'Doležal', 'Zeman', 'Kolář',
  'Navrátil', 'Čermák', 'Vaněk', 'Blažek', 'Kříž', 'Kovář', 'Bartoš', 'Vlček', 'Polák', 'Musil', 'Šimek',
  'Konečný', 'Malý', 'Holub', 'Štěpánek', 'Kadlec', 'Dostál', 'Soukup', 'Mareš', 'Moravec', 'Sýkora', 'Valenta',
  'Matoušek', 'Tichý', 'Bureš', 'Vávra', 'Škoda', 'Hrubý', 'Mach', 'Janda', 'Šindelář', 'Kopecký', 'Hruška',
  'Zelenka', 'Řezníček', 'Brabec', 'Kubíček', 'Lukáš', 'Toman', 'Bednář', 'Šťastný', 'Jireš', 'Klíma', 'Oliva'];
const INITIALS = 'ADFJKLMOPRSTVZ'.split('');
const ROLES = ['C', 'LW', 'RW', 'LD', 'RD', 'G'];

function buildRoster(teamIdx) {
  const t = TEAMS[teamIdx], rnd = mulberry32(teamIdx * 7919 + 13);
  const used = new Set(), nums = new Set();
  const out = [];
  for (const role of ROLES) {
    let sn; do { sn = SURNAMES[Math.floor(rnd() * SURNAMES.length)]; } while (used.has(sn));
    used.add(sn);
    let num;
    if (role === 'G') { do { num = [1, 30, 31, 33, 35, 39, 40][Math.floor(rnd() * 7)]; } while (nums.has(num)); }
    else { do { num = 2 + Math.floor(rnd() * 96); } while (nums.has(num)); }
    nums.add(num);
    const d = role === 'LD' || role === 'RD';
    const j = () => (rnd() - 0.5) * 0.12;
    out.push({
      role, num, name: sn, first: INITIALS[Math.floor(rnd() * INITIALS.length)] + '.',
      hand: rnd() < 0.6 ? 1 : -1,
      spd: 0.86 + (t.spd - 80) * 0.012 + j() - (d ? 0.03 : 0),
      sht: 0.82 + (t.off - 80) * 0.016 + j() - (d ? 0.06 : 0),
      pas: 0.85 + (t.off - 80) * 0.012 + j(),
      chk: 0.85 + (t.def - 80) * 0.014 + j() + (d ? 0.08 : 0),
      gk: 0.9 + (t.gk - 80) * 0.012 + j() * 0.5,
    });
  }
  return out;
}
