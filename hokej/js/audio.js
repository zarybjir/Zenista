'use strict';
// ---------- Syntetizovaný zvuk (WebAudio) + komentář ----------
const Sfx = {
  ctx: null, master: null, noise: null, crowdG: null, crowdF: null, excite: 0, target: 0, roar: 0,
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.setVol(Settings.data.vol);
      const len = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      this.startCrowd();
    } catch (e) { this.ctx = null; }
  },
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); },
  setVol(v) { if (this.master) this.master.gain.value = (v / 10) * 0.9; },
  ok() { return this.ctx && this.ctx.state === 'running'; },
  src() { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; return s; },
  startCrowd() {
    const c = this.ctx;
    const s1 = this.src(), f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 900; f1.Q.value = 0.5;
    const s2 = this.src(), f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 350;
    this.crowdG = c.createGain(); this.crowdG.gain.value = 0.0;
    const g2 = c.createGain(); g2.gain.value = 0.6;
    s1.connect(f1); f1.connect(this.crowdG);
    s2.connect(f2); f2.connect(g2); g2.connect(this.crowdG);
    this.crowdG.connect(this.master);
    this.crowdF = f1;
    s1.start(); s2.start(0, 1.0);
  },
  tick(dt, base) {
    this.roar = Math.max(0, this.roar - dt * 0.18);
    this.excite = lerp(this.excite, this.target, Math.min(1, dt * 2));
    if (!this.ok()) return;
    const now = this.ctx.currentTime;
    if (now - (this.lastTick || 0) < 0.08) return;
    this.lastTick = now;
    const v = base * (0.05 + this.excite * 0.07 + this.roar * 0.45);
    this.crowdG.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
    this.crowdF.frequency.setTargetAtTime(800 + this.excite * 500 + this.roar * 900, this.ctx.currentTime, 0.2);
  },
  env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  },
  burst(freq, type, vol, dec, q) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime, s = this.src(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    s.connect(f); f.connect(g); g.connect(this.master);
    this.env(g, t, 0.003, Math.max(0.0002, vol), dec);
    s.start(t, Math.random()); s.stop(t + dec + 0.05);
  },
  tone(freq, type, vol, a, dec, when = 0, slide = 0) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + a + dec);
    o.connect(g); g.connect(this.master);
    this.env(g, t, a, vol, dec);
    o.start(t); o.stop(t + a + dec + 0.05);
  },
  stick(v = 0.5) { this.burst(2500, 'highpass', 0.35 * v, 0.04); this.tone(900, 'triangle', 0.08 * v, 0.002, 0.03); },
  slap(v = 1) { this.burst(1800, 'highpass', 0.7 * v, 0.06); this.burst(200, 'lowpass', 0.6 * v, 0.12); },
  board(v = 0.6) { this.burst(160, 'lowpass', 0.9 * v, 0.22); this.burst(600, 'bandpass', 0.25 * v, 0.15, 2); },
  post() { this.tone(1760, 'sine', 0.35, 0.002, 0.7); this.tone(2637, 'sine', 0.18, 0.002, 0.5); this.tone(3520, 'sine', 0.08, 0.002, 0.3); },
  hit(v = 1) { this.burst(120, 'lowpass', 1.0 * v, 0.3); this.burst(400, 'bandpass', 0.5 * v, 0.2, 1); this.ooh(v); },
  ooh(v = 1) { this.target = Math.max(this.target, 0.5); this.roar = Math.max(this.roar, 0.25 * v); },
  cheer(v = 1) { this.roar = Math.max(this.roar, v); },
  whistle() {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime;
    for (const [f, vv] of [[2900, 0.12], [3150, 0.06]]) {
      const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      o.frequency.value = f; lfo.frequency.value = 38; lg.gain.value = 160;
      lfo.connect(lg); lg.connect(o.frequency); o.connect(g); g.connect(this.master);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vv, t + 0.02);
      g.gain.setValueAtTime(vv, t + 0.42); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      o.start(t); lfo.start(t); o.stop(t + 0.6); lfo.stop(t + 0.6);
    }
  },
  horn(dur = 2.6) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.value = 1300; f.connect(g); g.connect(this.master);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.08);
    g.gain.setValueAtTime(0.22, t + dur - 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const fr of [146.8, 185, 220, 293.7]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = rand(-8, 8);
      o.connect(f); o.start(t); o.stop(t + dur + 0.05);
    }
  },
  buzzer() {
    if (!this.ok()) return;
    this.tone(220, 'square', 0.12, 0.01, 1.4); this.tone(223, 'square', 0.1, 0.01, 1.4);
  },
  organNote(freq, when, dur, vol = 0.07) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime + when, g = c.createGain();
    g.connect(this.master);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.setValueAtTime(vol, t + dur * 0.85); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const [m, a] of [[1, 1], [2, 0.5], [4, 0.25], [3, 0.15]]) {
      const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.value = freq * m; og.gain.value = a;
      o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.05);
    }
  },
  organ(n) {
    const N = (s) => 440 * Math.pow(2, (s - 69) / 12);
    const tunes = [
      // „Charge!" fanfára
      [[67, 0, 0.16], [72, 0.17, 0.16], [76, 0.34, 0.16], [79, 0.51, 0.3], [76, 0.85, 0.16], [79, 1.02, 0.6]],
      // stoupající chromatika
      [[60, 0, 0.12], [61, 0.13, 0.12], [62, 0.26, 0.12], [63, 0.39, 0.12], [64, 0.52, 0.12], [65, 0.65, 0.12], [66, 0.78, 0.12], [67, 0.91, 0.4], [72, 1.35, 0.5]],
      // „Let's go" rytmus
      [[72, 0, 0.14], [72, 0.2, 0.14], [72, 0.55, 0.12], [72, 0.7, 0.12], [72, 0.85, 0.2], [67, 1.3, 0.14], [72, 1.5, 0.4]],
      // houpavý motiv
      [[64, 0, 0.2], [67, 0.22, 0.2], [72, 0.44, 0.2], [71, 0.66, 0.2], [69, 0.88, 0.2], [67, 1.1, 0.5]],
    ];
    const tune = tunes[n % tunes.length];
    for (const [s, w, d] of tune) this.organNote(N(s), w, d);
  },
  claps() { if (!this.ok()) return; for (const w of [0, 0.3, 0.8, 1.05, 1.3]) setTimeout(() => this.burst(1500, 'bandpass', 0.25, 0.08, 0.7), w * 1000); },
};

const Voice = {
  last: 0, voice: null, picked: false,
  pickVoice() {
    if (this.picked || !window.speechSynthesis) return;
    const vs = speechSynthesis.getVoices();
    if (!vs.length) return;
    this.picked = true;
    this.voice = vs.find((v) => /^cs/i.test(v.lang)) || null;
  },
  say(text, prio = false, chance = 1) {
    if (!Settings.data.comm || !window.speechSynthesis) return;
    const now = performance.now();
    if (Math.random() > chance) return;
    if (!prio && now - this.last < 3500) return;
    try {
      this.pickVoice();
      if (prio) speechSynthesis.cancel();
      else if (speechSynthesis.speaking) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'cs-CZ'; if (this.voice) u.voice = this.voice;
      u.rate = 1.12; u.pitch = 1.0; u.volume = Settings.data.vol / 10;
      speechSynthesis.speak(u);
      this.last = now;
    } catch (e) {}
  },
};
