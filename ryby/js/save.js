'use strict';
// ---------- uložený postup (localStorage) ----------
// Formát: { v: 1, lv: { <id úrovně>: { s: hvězdy 0–3, b: nejlepší skóre } } }
const Save = {
  KEY: 'ryby',
  d: { v: 1, lv: {} },

  load() {
    this.d = { v: 1, lv: {} };
    try {
      const o = JSON.parse(localStorage.getItem(this.KEY));
      if (o && o.lv && typeof o.lv === 'object') this.d.lv = o.lv;
    } catch (e) {}
  },

  store() { try { localStorage.setItem(this.KEY, JSON.stringify(this.d)); } catch (e) {} },

  // chybějící nebo poškozený záznam se čte jako nedohraná úroveň
  get(id) {
    const r = this.d.lv[id];
    return { s: clamp((r && r.s) | 0, 0, 3), b: Math.max(0, (r && r.b) | 0) };
  },

  // zapíše výsledek, horší výsledek lepší nepřepíše; vrací true při novém nejlepším skóre
  put(id, stars, score) {
    const r = this.get(id);
    this.d.lv[id] = { s: Math.max(r.s, stars), b: Math.max(r.b, score) };
    this.store();
    return score > r.b;
  },

  // úroveň je přístupná, když je první nebo je předchozí dohraná
  open(i) { return i === 0 || this.get(LEVELS[i - 1].id).s > 0; },
  any() { return LEVELS.some(l => this.get(l.id).s > 0); },
};
