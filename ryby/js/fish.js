'use strict';
// ---------- schopnosti ryb (jedna funkce na typ) ----------
// Funkce dostane hru a entitu ryby; volá se nejvýš jednou za let, před prvním nárazem.
const ABILITY = {
  // pstruh schopnost nemá
};

function fishAbility(g, f) {
  const fn = ABILITY[f.type];
  if (!fn || f.used || f.hit) return false;
  f.used = true;
  fn(g, f);
  return true;
}
