'use strict';
// Generuje kreslenou grafiku: node ryby/tools/gen_gfx.js
// Výstup: gfx/atlas.svg (všechny obrázky v jednom souboru) a js/atlas.js (kde který leží).
// Rozměry a barvy bere z js/data.js, takže po změně velikosti ryby, medvěda nebo tvaru bloku
// stačí nástroj pustit znovu. Jednotky v SVG jsou centimetry, počátek obrázku je střed tělesa.
const fs = require('fs'), path = require('path');
const { load, ROOT } = require('../tests/lib.js');
const G = load();
const FISH = G('FISH'), BEARS = G('BEARS'), MAT = G('MAT'), SHAPE = G('SHAPE'), mulberry32 = G('mulberry32');

const n = v => +v.toFixed(1);
const PAD = 6;
const sprites = [];
const add = (name, x0, y0, x1, y1, svg) => sprites.push({ name, x0: x0 - PAD, y0: y0 - PAD, w: x1 - x0 + 2 * PAD, h: y1 - y0 + 2 * PAD, svg });

// zesvětlení (k > 0) nebo ztmavení (k < 0) barvy #rrggbb
function shade(col, k) {
  const c = [1, 3, 5].map(i => parseInt(col.slice(i, i + 2), 16));
  return '#' + c.map(v => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)).toString(16).padStart(2, '0')).join('');
}
const hash = s => { let h = 7; for (const ch of s) h = h * 31 + ch.charCodeAt(0) | 0; return h; };
const P = (strs, ...v) => strs.reduce((a, s, i) => a + s + (i < v.length ? (typeof v[i] === 'number' ? n(v[i]) : v[i]) : ''), '');

// ---------- medvědi ----------
// výrazy: klid, mrk (mrknutí), lek (leknutí), zasah, smich
function bear(type, ex) {
  const b = BEARS[type], r = b.r * 100, col = b.col, line = '#3a2415';
  const griz = type === 'grizzly', cub = type === 'medvide', hat = !!b.hat;
  const ey = (hat ? 0.0 : -0.2) * r, ex0 = 0.37 * r, er = (cub ? 0.25 : 0.21) * r;
  let s = '';
  for (const sx of [-1, 1]) {
    s += P`<circle cx="${sx * 0.68 * r}" cy="${-0.68 * r}" r="${0.3 * r}" fill="${col}" stroke="${line}" stroke-width="5"/>`;
    s += P`<circle cx="${sx * 0.68 * r}" cy="${-0.68 * r}" r="${0.15 * r}" fill="${shade(col, 0.35)}"/>`;
  }
  s += P`<circle r="${r}" fill="${col}" stroke="${line}" stroke-width="5"/>`;
  // stín dole a lesk nahoře
  const a0 = 0.35, x = Math.cos(a0) * r * 0.96, y = Math.sin(a0) * r * 0.96;
  s += P`<path d="M${x},${y} A${r * 0.96},${r * 0.96} 0 0 1 ${-x},${y} A${r * 1.5},${r * 1.5} 0 0 0 ${x},${y}Z" fill="${shade(col, -0.22)}"/>`;
  s += P`<ellipse cx="${-0.42 * r}" cy="${-0.55 * r}" rx="${0.26 * r}" ry="${0.13 * r}" fill="#fff" opacity=".2" transform="rotate(-32 ${-0.42 * r} ${-0.55 * r})"/>`;
  if (griz) s += P`<path d="M${-0.3 * r},${-0.95 * r} l${0.1 * r},${-0.2 * r} l${0.1 * r},${0.14 * r} l${0.1 * r},${-0.2 * r} l${0.1 * r},${0.14 * r} l${0.1 * r},${-0.16 * r} l${0.1 * r},${0.26 * r}Z" fill="${col}" stroke="${line}" stroke-width="4" stroke-linejoin="round"/>`;
  if (cub) s += P`<path d="M${-0.05 * r},${-0.98 * r} q${-0.05 * r},${-0.28 * r} ${0.2 * r},${-0.3 * r} q${-0.12 * r},${0.1 * r} ${-0.04 * r},${0.28 * r}" fill="${col}" stroke="${line}" stroke-width="4" stroke-linejoin="round"/>`;
  if (hat) { // přilba z kotlíku
    const m = '#8d969e', ml = '#33393f', hy = -0.3 * r;
    s += P`<path d="M${-0.3 * r},${-1.12 * r} Q0,${-1.5 * r} ${0.3 * r},${-1.12 * r}" fill="none" stroke="${ml}" stroke-width="6" stroke-linecap="round"/>`;
    s += P`<path d="M${-0.92 * r},${hy} A${0.92 * r},${0.92 * r} 0 0 1 ${0.92 * r},${hy}Z" fill="${m}" stroke="${ml}" stroke-width="5" stroke-linejoin="round"/>`;
    s += P`<path d="M${-0.7 * r},${hy - 0.25 * r} A${0.72 * r},${0.72 * r} 0 0 1 ${-0.2 * r},${hy - 0.68 * r}" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".45"/>`;
    s += P`<rect x="${-1.02 * r}" y="${hy - 0.03 * r}" width="${2.04 * r}" height="${0.15 * r}" rx="${0.07 * r}" fill="${shade(m, -0.2)}" stroke="${ml}" stroke-width="5"/>`;
    s += P`<path d="M${0.35 * r},${hy - 0.6 * r} l${0.1 * r},${0.12 * r} l${-0.02 * r},${0.14 * r}" fill="none" stroke="${ml}" stroke-width="3" stroke-linecap="round"/>`;
  }
  // čenich
  s += P`<ellipse cy="${0.34 * r}" rx="${0.48 * r}" ry="${0.36 * r}" fill="#f0d9b5" stroke="${line}" stroke-width="3"/>`;
  if (!griz) for (const sx of [-1, 1]) s += P`<ellipse cx="${sx * 0.66 * r}" cy="${0.22 * r}" rx="${0.13 * r}" ry="${0.08 * r}" fill="#f08a7a" opacity=".4"/>`;
  s += P`<ellipse cy="${0.16 * r}" rx="${0.17 * r}" ry="${0.12 * r}" fill="#2a1a12"/><ellipse cx="${-0.05 * r}" cy="${0.12 * r}" rx="${0.05 * r}" ry="${0.03 * r}" fill="#fff" opacity=".6"/>`;
  const st = `fill="none" stroke="${line}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;
  // tlama
  if (ex === 'lek') s += P`<ellipse cy="${0.48 * r}" rx="${0.12 * r}" ry="${0.15 * r}" fill="#5a1f1f" stroke="${line}" stroke-width="3"/>`;
  else if (ex === 'zasah') s += P`<path d="M${-0.2 * r},${0.46 * r} q${0.065 * r},${-0.1 * r} ${0.13 * r},0 t${0.13 * r},0 t${0.13 * r},0" ${st}/>`;
  else if (ex === 'smich') {
    s += P`<path d="M${-0.25 * r},${0.36 * r} Q0,${0.78 * r} ${0.25 * r},${0.36 * r}Z" fill="#7a2424" stroke="${line}" stroke-width="3.5" stroke-linejoin="round"/>`;
    s += P`<ellipse cy="${0.52 * r}" rx="${0.1 * r}" ry="${0.06 * r}" fill="#ef9a9a"/>`;
  } else s += P`<path d="M0,${0.28 * r} L0,${0.38 * r} M${-0.16 * r},${0.4 * r} Q${-0.08 * r},${0.5 * r} 0,${0.38 * r} Q${0.08 * r},${0.5 * r} ${0.16 * r},${0.4 * r}" ${st}/>`;
  // oči a obočí
  for (const sx of [-1, 1]) {
    const cx = sx * ex0;
    if (ex === 'mrk') s += P`<path d="M${cx - er},${ey} Q${cx},${ey + er * 0.9} ${cx + er},${ey}" ${st}/>`;
    else if (ex === 'smich') s += P`<path d="M${cx - er},${ey + er * 0.3} Q${cx},${ey - er} ${cx + er},${ey + er * 0.3}" ${st}/>`;
    else if (ex === 'zasah') s += P`<path d="M${cx - sx * er * 0.8},${ey - er * 0.7} L${cx + sx * er * 0.6},${ey} L${cx - sx * er * 0.8},${ey + er * 0.7}" ${st}/>`;
    else {
      const k = ex === 'lek' ? 1.22 : 1, pr = ex === 'lek' ? 0.3 : 0.52;
      s += P`<circle cx="${cx}" cy="${ey}" r="${er * k}" fill="#fff" stroke="${line}" stroke-width="3"/>`;
      s += P`<circle cx="${cx + er * 0.12}" cy="${ey + er * 0.1}" r="${er * pr}" fill="#2a1a12"/><circle cx="${cx - er * 0.05}" cy="${ey - er * 0.12}" r="${er * 0.17}" fill="#fff"/>`;
    }
    const by = ey - er * 1.45;
    if (ex === 'lek') s += P`<path d="M${cx - sx * er * 0.7},${by - er * 0.25} L${cx + sx * er * 0.5},${by - er * 0.6}" ${st}/>`;
    else if (griz && ex !== 'smich') s += P`<path d="M${cx - sx * er * 0.9},${by + er * 0.45} L${cx + sx * er * 0.9},${by - er * 0.1}" fill="none" stroke="${line}" stroke-width="6" stroke-linecap="round"/>`;
  }
  add('bear_' + type + '_' + ex, -1.1 * r, -1.55 * r, 1.1 * r, 1.05 * r, s);
}

// ---------- ryby ----------
// frame 0 a 1 = mrsknutí ocasem; big = nafouknutý čtverzubec
function fish(type, frame, big) {
  const f = FISH[type], r = (big ? f.ab.r : f.r) * 100, lx = big ? r : r * f.lx, ly = big ? r : r * f.ly;
  const col = f.col, edge = f.edge, fin = shade(col, -0.22), w = (frame ? 1 : -1) * 0.16 * r, rnd = mulberry32(hash(type));
  const st = `stroke="${edge}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
  const tx = -lx - 0.62 * r;
  let s = '';
  // ocas, hřbetní ploutev
  s += P`<path d="M${-lx * 0.72},${-ly * 0.28} L${tx},${-ly * 0.95 + w} Q${-lx - 0.2 * r},${w} ${tx},${ly * 0.95 + w} L${-lx * 0.72},${ly * 0.28}Z" fill="${fin}" ${st}/>`;
  if (type === 'ctverzubec') { // ostny
    const k = big ? 1.32 : 1.22;
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6 + 0.26, c = Math.cos(a), si = Math.sin(a), d = 0.12;
      s += P`<path d="M${Math.cos(a - d) * lx * 0.95},${Math.sin(a - d) * ly * 0.95} L${c * lx * k},${si * ly * k} L${Math.cos(a + d) * lx * 0.95},${Math.sin(a + d) * ly * 0.95}Z" fill="${shade(col, -0.3)}" ${st}/>`;
    }
  } else if (type === 'uhor') s += P`<path d="M${-lx * 0.8},${-ly * 0.6} Q0,${-ly * 1.9} ${lx * 0.45},${-ly * 0.8}Z" fill="${fin}" ${st}/>`;
  else s += P`<path d="M${-lx * (type === 'stika' ? 0.75 : 0.35)},${-ly * 0.8} Q${-lx * (type === 'stika' ? 0.55 : 0.1)},${-ly * 1.65} ${lx * (type === 'stika' ? -0.1 : 0.35)},${-ly * 0.78}Z" fill="${fin}" ${st}/>`;
  // tělo
  const body = type === 'stika'
    ? P`<path d="M${-lx},0 Q${-lx},${-ly} ${-lx * 0.2},${-ly} Q${lx * 0.6},${-ly} ${lx * 1.15},${-ly * 0.08} L${lx * 1.15},${ly * 0.14} Q${lx * 0.6},${ly} ${-lx * 0.2},${ly} Q${-lx},${ly} ${-lx},0Z"`
    : P`<ellipse rx="${lx}" ry="${ly}"`;
  s += body + P` fill="${col}"/>`;
  s += P`<ellipse cy="${ly * 0.4}" rx="${lx * 0.8}" ry="${ly * 0.5}" fill="${f.belly}"/>`;
  s += P`<ellipse cx="${-lx * 0.15}" cy="${-ly * 0.55}" rx="${lx * 0.5}" ry="${ly * 0.16}" fill="#fff" opacity=".22"/>`;
  // kresba podle druhu
  if (type === 'pstruh') {
    s += P`<ellipse cx="${-lx * 0.1}" cy="${ly * 0.02}" rx="${lx * 0.7}" ry="${ly * 0.11}" fill="#e9837b" opacity=".65"/>`;
    for (let i = 0; i < 9; i++) s += P`<circle cx="${(rnd() * 1.3 - 0.85) * lx}" cy="${-(0.2 + rnd() * 0.45) * ly}" r="${2 + rnd() * 1.6}" fill="${shade(col, -0.45)}"/>`;
  } else if (type === 'sardinky') s += P`<path d="M${-lx * 0.85},${-ly * 0.1} Q0,${-ly * 0.35} ${lx * 0.5},${-ly * 0.12}" fill="none" stroke="${shade(col, -0.4)}" stroke-width="3.5" stroke-linecap="round"/>`;
  else if (type === 'stika') for (let i = 0; i < 8; i++) s += P`<ellipse cx="${(i / 8 * 1.5 - 0.85) * lx}" cy="${(i & 1 ? -0.5 : -0.12) * ly}" rx="${4.2}" ry="${2.6}" fill="${shade(col, 0.5)}"/>`;
  else if (type === 'uhor') s += P`<path d="M${-lx * 0.85},${-ly * 0.1} l${lx * 0.2},${-ly * 0.35} l${lx * 0.15},${ly * 0.4} l${lx * 0.2},${-ly * 0.4} l${lx * 0.15},${ly * 0.4} l${lx * 0.2},${-ly * 0.4}" fill="none" stroke="${shade(col, -0.35)}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`;
  else if (type === 'sumec') for (let i = 0; i < 6; i++) s += P`<circle cx="${(rnd() * 1.2 - 0.8) * lx}" cy="${-(0.25 + rnd() * 0.4) * ly}" r="${3 + rnd() * 2}" fill="${shade(col, -0.3)}"/>`;
  s += body + P` fill="none" stroke="${edge}" stroke-width="5"/>`;
  if (!big) {
    s += P`<path d="M${lx * 0.3},${-ly * 0.5} Q${lx * 0.18},0 ${lx * 0.3},${ly * 0.5}" fill="none" stroke="${edge}" stroke-width="3" opacity=".55" stroke-linecap="round"/>`;
    s += P`<path d="M${lx * 0.12},${ly * 0.22} q${-lx * 0.3},${ly * 0.12} ${-lx * 0.32},${ly * 0.62 + w * 0.4} q${lx * 0.34},${-ly * 0.04} ${lx * 0.32},${-ly * 0.62 - w * 0.4}Z" fill="${fin}" stroke="${edge}" stroke-width="3" stroke-linejoin="round"/>`;
  }
  // oko a tlama
  const er = Math.min(0.36 * r, ly * 0.52) * (type === 'sumec' ? 0.72 : 1) * (big ? 0.8 : 1);
  const ex = lx * (big ? 0.42 : 0.56), ey = -ly * (type === 'sumec' ? 0.32 : 0.22);
  s += P`<circle cx="${ex}" cy="${ey}" r="${er}" fill="${type === 'stika' ? '#fff3b0' : '#fff'}" stroke="${edge}" stroke-width="3"/>`;
  s += P`<circle cx="${ex + er * 0.18}" cy="${ey + er * 0.05}" r="${er * (big ? 0.3 : 0.52)}" fill="#1c1c1c"/><circle cx="${ex + er * 0.02}" cy="${ey - er * 0.2}" r="${er * 0.18}" fill="#fff"/>`;
  if (type === 'sumec') {
    s += P`<path d="M${lx * 0.55},${ly * 0.3} Q${lx * 0.85},${ly * 0.45} ${lx * 0.98},${ly * 0.12}" fill="none" ${st}/>`;
    s += P`<path d="M${lx * 0.9},${ly * 0.05} q${r * 0.5},${-r * 0.1} ${r * 0.55},${r * 0.45} M${lx * 0.8},${ly * 0.3} q${r * 0.3},${r * 0.15} ${r * 0.2},${r * 0.6} M${lx * 0.92},${-ly * 0.1} q${r * 0.4},${-r * 0.3} ${r * 0.6},${-r * 0.1}" fill="none" stroke="${edge}" stroke-width="3.5" stroke-linecap="round"/>`;
  } else if (type === 'stika') {
    s += P`<path d="M${lx * 0.55},${ly * 0.42} L${lx * 1.12},${ly * 0.14}" fill="none" ${st}/>`;
    for (let i = 0; i < 4; i++) { const px = lx * (0.64 + i * 0.12), py = ly * (0.38 - i * 0.06); s += P`<path d="M${px},${py} l${3},${7} l${4},${-9.5}Z" fill="#fff" stroke="${edge}" stroke-width="1.5"/>`; }
  } else if (type === 'ctverzubec') s += P`<ellipse cx="${lx * 0.88}" cy="${ly * 0.22}" rx="${big ? 5 : 3.5}" ry="${big ? 7 : 4.5}" fill="#7a3b1e" stroke="${edge}" stroke-width="3"/>`;
  else s += P`<path d="M${lx * 0.8},${ly * 0.3} Q${lx * 0.92},${ly * 0.42} ${lx * 0.98},${ly * 0.16}" fill="none" ${st}/>`;
  const k = type === 'ctverzubec' ? 1.4 : 1, x1 = type === 'stika' ? lx * 1.15 : type === 'sumec' ? lx + r * 0.6 : lx * k;
  const top = Math.max(ly * 1.7, ly * k), bot = Math.max(ly * k, ly * 0.95 + 0.16 * r, type === 'sumec' ? ly * 0.3 + r * 0.8 : 0);
  add('fish_' + type + '_' + (big ? 'big' : frame), Math.min(tx, -lx * k), -top, x1, bot, s);
}

// ---------- bloky ----------
// st: 0 celý, 1 prasklý, 2 těsně před rozbitím
let clipN = 0;
function block(mat, shape, st) {
  const [bw, bh] = SHAPE[shape], w = bw * 100, h = bh * 100, hw = w / 2, hh = h / 2, hor = w >= h, L = Math.max(w, h);
  const rnd = mulberry32(hash(mat + shape)), id = 'k' + clipN++;
  const edge = { led: '#4f93b5', drevo: '#5e3a1a', kamen: '#454b50' }[mat];
  let s = P`<clipPath id="${id}"><rect x="${-hw}" y="${-hh}" width="${w}" height="${h}" rx="4"/></clipPath><g clip-path="url(#${id})">`;
  if (mat === 'led') {
    s += P`<rect x="${-hw}" y="${-hh}" width="${w}" height="${h}" fill="#bfe6f5"/>`;
    s += P`<rect x="${-hw + 5}" y="${-hh + 5}" width="${w - 10}" height="${h - 10}" rx="3" fill="#dcf3fb"/>`;
    for (let i = 0; i < Math.max(2, L / 60 | 0); i++) { // šikmé odlesky
      const p = (rnd() - 0.5) * L * 0.8, t = 6 + rnd() * 10;
      s += hor ? P`<path d="M${p},${-hh} l${t},0 l${-h * 0.7},${h} l${-t},0Z" fill="#fff" opacity=".6"/>` : P`<path d="M${-hw},${p} l0,${t} l${w},${-w * 0.7} l0,${-t}Z" fill="#fff" opacity=".6"/>`;
    }
    for (let i = 0; i < L / 50; i++) s += P`<circle cx="${(rnd() - 0.5) * w * 0.8}" cy="${(rnd() - 0.5) * h * 0.8}" r="${1.5 + rnd() * 2}" fill="none" stroke="#8cc9e3" stroke-width="1.5"/>`;
  } else if (mat === 'drevo') {
    s += P`<rect x="${-hw}" y="${-hh}" width="${w}" height="${h}" fill="#cf9655"/>`;
    const nl = Math.max(2, Math.min(w, h) / 9 | 0);
    for (let i = 1; i < nl; i++) { // léta dřeva
      const o = -Math.min(w, h) / 2 + i * Math.min(w, h) / nl, a = (rnd() - 0.5) * 6, b = (rnd() - 0.5) * 6;
      s += hor ? P`<path d="M${-hw},${o} C${-hw / 3},${o + a} ${hw / 3},${o + b} ${hw},${o}" fill="none" stroke="#b07a3e" stroke-width="2.2"/>`
        : P`<path d="M${o},${-hh} C${o + a},${-hh / 3} ${o + b},${hh / 3} ${o},${hh}" fill="none" stroke="#b07a3e" stroke-width="2.2"/>`;
    }
    if (L > 60) { const kx = hor ? (rnd() - 0.5) * w * 0.5 : 0, ky = hor ? 0 : (rnd() - 0.5) * h * 0.5; s += P`<ellipse cx="${kx}" cy="${ky}" rx="${hor ? 7 : 4.5}" ry="${hor ? 4.5 : 7}" fill="#a06a32" stroke="#8a5826" stroke-width="2"/>`; }
    for (const sg of [-1, 1]) { // tmavší konce a hřebíky
      s += hor ? P`<rect x="${sg > 0 ? hw - 8 : -hw}" y="${-hh}" width="8" height="${h}" fill="#b7813f"/>` : P`<rect x="${-hw}" y="${sg > 0 ? hh - 8 : -hh}" width="${w}" height="8" fill="#b7813f"/>`;
      s += hor ? P`<circle cx="${sg * (hw - 4)}" cy="0" r="1.8" fill="#5e3a1a"/>` : P`<circle cx="0" cy="${sg * (hh - 4)}" r="1.8" fill="#5e3a1a"/>`;
    }
    s += hor ? P`<rect x="${-hw}" y="${-hh}" width="${w}" height="5" fill="#fff" opacity=".22"/>` : P`<rect x="${-hw}" y="${-hh}" width="5" height="${h}" fill="#fff" opacity=".22"/>`;
  } else {
    s += P`<rect x="${-hw}" y="${-hh}" width="${w}" height="${h}" fill="#a3a9ae"/>`;
    s += P`<path d="M${-hw},${-hh} h${w} l-7,7 h${-w + 14} v${h - 14} l-7,7Z" fill="#c6cbcf"/>`;
    s += P`<path d="M${hw},${hh} h${-w} l7,-7 h${w - 14} v${-h + 14} l7,-7Z" fill="#7f858a"/>`;
    for (let i = 0; i < w * h / 260; i++) s += P`<circle cx="${(rnd() - 0.5) * (w - 18)}" cy="${(rnd() - 0.5) * (h - 18)}" r="${1 + rnd() * 2.2}" fill="${rnd() < 0.5 ? '#8b9196' : '#b9bec3'}"/>`;
  }
  // praskliny: lomené čáry napříč kratším rozměrem
  const cr = [];
  for (let i = 0; i < (st === 2 ? 3 : st); i++) {
    let u = (rnd() - 0.5) * L * 0.6;
    const pts = [];
    for (let j = 0; j <= 4; j++) { const v = -Math.min(w, h) / 2 + j * Math.min(w, h) / 4; u += j ? (rnd() - 0.5) * Math.min(22, L * 0.2) : 0; pts.push(hor ? n(u) + ',' + n(v) : n(v) + ',' + n(u)); }
    cr.push(pts.join(' '));
  }
  for (const p of cr) {
    if (mat === 'led') s += `<polyline points="${p}" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>`;
    s += `<polyline points="${p}" fill="none" stroke="${edge}" stroke-width="${st === 2 ? 3.6 : 2.8}" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  if (st === 2) { // odštípnuté rohy
    s += P`<path d="M${-hw},${-hh} l${Math.min(14, w * 0.4)},0 l${-Math.min(14, w * 0.4)},${Math.min(11, h * 0.4)}Z M${hw},${hh} l${-Math.min(12, w * 0.4)},0 l${Math.min(12, w * 0.4)},${-Math.min(14, h * 0.4)}Z" fill="${edge}" opacity=".6"/>`;
    s += P`<rect x="${-hw}" y="${-hh}" width="${w}" height="${h}" fill="#000" opacity=".07"/>`;
  }
  s += P`</g><rect x="${-hw}" y="${-hh}" width="${w}" height="${h}" rx="4" fill="none" stroke="${edge}" stroke-width="5"/>`;
  add('blk_' + mat + '_' + shape + '_' + st, -hw, -hh, hw, hh, s);
}

// ---------- sestavení ----------
for (const t of Object.keys(BEARS)) for (const e of ['klid', 'mrk', 'lek', 'zasah', 'smich']) bear(t, e);
for (const t of Object.keys(FISH)) { fish(t, 0); fish(t, 1); }
fish('ctverzubec', 0, true);
for (const m of Object.keys(MAT)) for (const sh of Object.keys(SHAPE)) for (let st = 0; st < 3; st++) block(m, sh, st);

// police: seřadit podle výšky a skládat do řad
const MAXW = 1500;
let x = 0, y = 0, rowH = 0, W = 0;
const out = {};
let body = '';
for (const sp of sprites.sort((a, b) => b.h - a.h)) {
  if (x + sp.w > MAXW) { x = 0; y += rowH; rowH = 0; }
  body += `<svg x="${n(x)}" y="${n(y)}" width="${n(sp.w)}" height="${n(sp.h)}" viewBox="${n(sp.x0)} ${n(sp.y0)} ${n(sp.w)} ${n(sp.h)}">${sp.svg}</svg>\n`;
  out[sp.name] = [n(x), n(y), n(sp.w), n(sp.h), n(-sp.x0), n(-sp.y0)];
  x += sp.w; rowH = Math.max(rowH, sp.h); W = Math.max(W, x);
}
const H = y + rowH;
fs.writeFileSync(path.join(ROOT, 'gfx/atlas.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="${n(W)}" height="${n(H)}" viewBox="0 0 ${n(W)} ${n(H)}">\n${body}</svg>\n`);
fs.writeFileSync(path.join(ROOT, 'js/atlas.js'),
  `'use strict';\n// Generováno nástrojem tools/gen_gfx.js – neupravuj ručně.\n// Obrázek v gfx/atlas.svg: [x, y, šířka, výška, počátek x, počátek y] v centimetrech.\nconst ATLAS = {\n  w: ${n(W)}, h: ${n(H)},\n  s: {\n${Object.keys(out).sort().map(k => `    ${k}: [${out[k].join(', ')}],`).join('\n')}\n  },\n};\n`);
console.log(`${sprites.length} obrázků, atlas ${n(W)} × ${n(H)} cm`);
