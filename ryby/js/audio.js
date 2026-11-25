'use strict';
// ---------- zvuky (WebAudio syntéza, bez souborů) ----------
const Sfx = {
  ac: null, out: null, nb: null, on: true, last: {},

  // volá se z prvního dotyku nebo klávesy, jinak prohlížeč zvuk nepovolí
  unlock() {
    if (!this.ac) {
      try {
        const A = window.AudioContext || window.webkitAudioContext;
        this.ac = new A();
        this.out = this.ac.createGain(); this.out.gain.value = 0.5; this.out.connect(this.ac.destination);
        const n = this.ac.sampleRate, b = this.nb = this.ac.createBuffer(1, n, n), d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { this.ac = null; }
    }
    if (this.ac && this.ac.state === 'suspended') this.ac.resume();
  },

  env(vol, t, d) {
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    g.connect(this.out);
    return g;
  },

  // tón s klouzavou výškou f0 → f1
  tone(f0, f1, d, vol, type, at) {
    const t = this.ac.currentTime + (at || 0), o = this.ac.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
    o.connect(this.env(vol, t, d)); o.start(t); o.stop(t + d + 0.02);
  },

  // šum přes filtr
  noise(f0, f1, d, vol, type, at) {
    const t = this.ac.currentTime + (at || 0), s = this.ac.createBufferSource(), f = this.ac.createBiquadFilter();
    s.buffer = this.nb; s.loop = true;
    f.type = type || 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + d);
    s.connect(f); f.connect(this.env(vol, t, d)); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02);
  },

  // stejný druh zvuku nejvýš jednou za gap sekund
  gate(k, gap) {
    const t = this.ac.currentTime;
    if (t - (this.last[k] || -1) < gap) return false;
    this.last[k] = t;
    return true;
  },

  // ---------- události hry ----------
  play(e) {
    if (!this.on || !this.ac || this.ac.state !== 'running') return;
    const fn = this['ev_' + e.k];
    if (fn) fn.call(this, e);
  },

  ev_shot() { this.noise(600, 2600, 0.2, 0.5); this.tone(260, 620, 0.14, 0.25, 'triangle'); },

  ev_hit(e) {
    if (!this.gate('hit' + e.m, 0.05)) return;
    const v = clamp(e.i / 25, 0.12, 1);
    if (e.m === 'led') { this.tone(2400, 1700, 0.07, 0.3 * v, 'triangle'); this.noise(5000, 3000, 0.06, 0.3 * v, 'highpass'); }
    else if (e.m === 'drevo') { this.tone(230, 130, 0.09, 0.6 * v, 'triangle'); this.noise(700, 400, 0.07, 0.5 * v); }
    else if (e.m === 'kamen') { this.tone(120, 70, 0.13, 0.8 * v); this.noise(400, 150, 0.1, 0.6 * v, 'lowpass'); }
    else if (e.m === 'zem') this.noise(260, 90, 0.12, 0.7 * v, 'lowpass');
    else this.tone(320, 170, 0.12, 0.5 * v); // medvěd
  },

  ev_break(e) {
    if (!this.gate('br' + e.m, 0.04)) return;
    if (e.m === 'led') {
      for (let i = 0; i < 5; i++) this.tone(1800 + Math.random() * 2600, 1500, 0.09, 0.22, 'triangle', i * 0.025);
      this.noise(6000, 2500, 0.22, 0.4, 'highpass');
    } else if (e.m === 'drevo') {
      this.noise(1400, 500, 0.22, 0.7); this.tone(200, 90, 0.16, 0.5, 'sawtooth');
      this.tone(330, 160, 0.08, 0.3, 'triangle', 0.06);
    } else { this.noise(500, 80, 0.35, 0.9, 'lowpass'); this.tone(95, 45, 0.3, 0.8); }
  },

  ev_bear() { this.tone(620, 140, 0.28, 0.5, 'triangle'); this.noise(1200, 300, 0.18, 0.4); this.tone(900, 1300, 0.08, 0.25, 'sine', 0.26); },
  ev_ab(e) {
    if (e.m === 'ctverzubec') { this.noise(900, 90, 0.4, 1, 'lowpass'); this.tone(160, 50, 0.35, 0.8); }
    else if (e.m === 'uhor') { for (let i = 0; i < 4; i++) this.tone(1400 + Math.random() * 1800, 300, 0.07, 0.25, 'sawtooth', i * 0.04); this.noise(4000, 1500, 0.2, 0.3, 'highpass'); }
    else if (e.m === 'stika') { this.noise(1200, 5000, 0.18, 0.5); this.tone(400, 1100, 0.15, 0.25, 'triangle'); }
    else for (let i = 0; i < 3; i++) this.tone(900 + i * 250, 1200 + i * 250, 0.06, 0.25, 'sine', i * 0.04); // hejno
  },
  ev_puff() { this.noise(900, 300, 0.12, 0.2); },
  ev_win() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.22, 0.35, 'triangle', 0.25 + i * 0.11)); },
  ev_lost() { this.tone(330, 250, 0.3, 0.35, 'triangle', 0.2); this.tone(250, 165, 0.45, 0.35, 'triangle', 0.5); },
};
