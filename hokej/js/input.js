'use strict';
// ---------- Vstup: gamepady (Gamepad API) + 2 klávesnicová schémata ----------
const BTN = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'back', 'start', 'up', 'down', 'left', 'right'];
const KB_MAPS = [
  { name: 'Klávesnice 1', up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    a: ['KeyJ'], x: ['KeyK'], b: ['KeyL'], y: ['KeyI'], rt: ['Space', 'ShiftLeft'], start: ['Escape'], back: ['Tab'], lb: ['KeyQ'], rb: ['KeyE'] },
  { name: 'Klávesnice 2', up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    a: ['Numpad1', 'Comma'], x: ['Numpad2', 'Period'], b: ['Numpad3', 'Slash'], y: ['Numpad5', 'Semicolon'],
    rt: ['Numpad0', 'ShiftRight'], start: ['Enter', 'NumpadEnter'], back: ['Backspace'], lb: ['Numpad4'], rb: ['Numpad6'] },
];

function blankState() { const s = { lx: 0, ly: 0 }; for (const b of BTN) s[b] = false; return s; }

class Device {
  constructor(id, kind, name) {
    this.id = id; this.kind = kind; this.name = name;
    this.st = blankState(); this.prev = blankState();
    this.active = kind === 'pad'; this.connected = true;
    this.rep = {}; // autorepeat pro menu
  }
  pressed(b) { return this.st[b] && !this.prev[b]; }
  released(b) { return !this.st[b] && this.prev[b]; }
  // menu navigace s autorepeat (směr: stick + dpad)
  nav(b, dt) {
    const on = this.dirOn(b);
    if (!on) { this.rep[b] = 0; return false; }
    if (!this.rep[b]) { this.rep[b] = 0.0001; return true; }
    const before = this.rep[b];
    this.rep[b] += dt;
    if (before < 0.4 && this.rep[b] >= 0.4) return true;
    if (this.rep[b] > 0.4 && Math.floor((this.rep[b] - 0.4) / 0.12) > Math.floor((before - 0.4) / 0.12)) return true;
    return false;
  }
  dirOn(b) {
    const s = this.st;
    if (b === 'up') return s.up || s.ly < -0.6;
    if (b === 'down') return s.down || s.ly > 0.6;
    if (b === 'left') return s.left || s.lx < -0.6;
    if (b === 'right') return s.right || s.lx > 0.6;
    return false;
  }
  any() { for (const b of BTN) if (this.st[b] && !this.prev[b]) return true; return false; }
}

const Input = {
  keys: new Set(), devices: [], pads: {}, kb: [], merged: null, anyEvent: false,
  init() {
    this.kb = KB_MAPS.map((m, i) => { const d = new Device('kb' + i, 'kb', m.name); d.active = false; d.map = m; return d; });
    this.devices.push(...this.kb);
    this.merged = new Device('all', 'merged', 'Vše');
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code); this.anyEvent = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('mousedown', () => { this.anyEvent = true; });
    window.addEventListener('touchstart', () => { this.anyEvent = true; });
  },
  poll(dt) {
    // klávesnice
    for (const d of this.kb) {
      d.prev = d.st; const s = blankState();
      for (const b of BTN) if (d.map[b]) s[b] = d.map[b].some((k) => this.keys.has(k));
      s.lx = (s.right ? 1 : 0) - (s.left ? 1 : 0); s.ly = (s.down ? 1 : 0) - (s.up ? 1 : 0);
      if (s.lx && s.ly) { s.lx *= 0.7071; s.ly *= 0.7071; }
      d.st = s;
      if (!d.active && BTN.some((b) => s[b])) d.active = true;
    }
    // gamepady
    let gps = [];
    try { gps = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { gps = []; }
    const seen = new Set();
    for (const gp of gps) {
      if (!gp || !gp.connected) continue;
      seen.add(gp.index);
      let d = this.pads[gp.index];
      if (!d) {
        d = new Device('pad' + gp.index, 'pad', 'Ovladač ' + (gp.index + 1));
        d.gpId = gp.id; this.pads[gp.index] = d; this.devices.push(d);
      }
      d.connected = true;
      d.prev = d.st; const s = blankState();
      const B = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
      s.a = B(0); s.b = B(1); s.x = B(2); s.y = B(3); s.lb = B(4); s.rb = B(5);
      s.lt = B(6); s.rt = B(7); s.back = B(8); s.start = B(9);
      s.up = B(12); s.down = B(13); s.left = B(14); s.right = B(15);
      let lx = gp.axes[0] || 0, ly = gp.axes[1] || 0;
      const m = Math.hypot(lx, ly);
      if (m < 0.2) { lx = 0; ly = 0; } else { const k = Math.min(1, (m - 0.2) / 0.75) / m; lx *= k; ly *= k; }
      // dpad jako páčka (pokud páčka v klidu)
      if (!lx && !ly) {
        lx = (s.right ? 1 : 0) - (s.left ? 1 : 0); ly = (s.down ? 1 : 0) - (s.up ? 1 : 0);
        if (lx && ly) { lx *= 0.7071; ly *= 0.7071; }
      }
      s.lx = lx; s.ly = ly;
      d.st = s;
      if (BTN.some((b) => s[b])) this.anyEvent = true;
    }
    for (const k in this.pads) if (!seen.has(+k)) { const d = this.pads[k]; d.connected = false; d.prev = d.st; d.st = blankState(); }
    // sloučené ovládání pro menu
    const M = this.merged; M.prev = M.st; const s = blankState();
    for (const d of this.devices) {
      if (!d.connected) continue;
      for (const b of BTN) s[b] = s[b] || d.st[b];
      if (Math.abs(d.st.lx) > Math.abs(s.lx)) s.lx = d.st.lx;
      if (Math.abs(d.st.ly) > Math.abs(s.ly)) s.ly = d.st.ly;
    }
    // Enter / mezerník potvrzují i v menu
    if (this.keys.has('Enter') || this.keys.has('NumpadEnter')) s.a = true;
    if (this.keys.has('Escape') || this.keys.has('Backspace')) s.b = true;
    M.st = s;
  },
  activeDevices() { return this.devices.filter((d) => d.connected && d.active); },
};
