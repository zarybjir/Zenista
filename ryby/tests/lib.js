'use strict';
// Zavaděč: načte herní skripty (klasické, globální) do jednoho kontextu bez prohlížeče.
const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const FILES = ['lib/planck.js', 'js/util.js', 'js/data.js', 'js/levels.js', 'js/physics.js', 'js/fish.js', 'js/game.js', 'js/save.js'];

function load() {
  // náhrada localStorage v paměti
  const mem = {};
  const localStorage = { getItem: k => k in mem ? mem[k] : null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  const ctx = vm.createContext({ console, localStorage });
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  // top-level const nejsou vlastnosti globálu, proto přístup výrazem
  return name => vm.runInContext(name, ctx);
}

module.exports = { load, ROOT };
