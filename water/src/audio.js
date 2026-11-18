/** Tiny synthesized sound kit (no audio files needed). */
export class Sound {
  constructor() {
    this.ctx = null;
    this.voices = [];
    const unlock = () => this.init();
    addEventListener('keydown', unlock);
    addEventListener('pointerdown', unlock);
  }

  init() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  get ready() { return this.ctx && this.ctx.state === 'running'; }

  loop(freq, q, type = 'bandpass') {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(this.master);
    src.start(0, Math.random() * 1.5);
    return { f, g };
  }

  setPlayer(slot, blast, suck) {
    if (!this.ready) return;
    let v = this.voices[slot];
    if (!v) {
      v = this.voices[slot] = { jet: this.loop(900 + slot * 120, 0.8), suck: this.loop(500 + slot * 60, 2.5) };
    }
    const t = this.ctx.currentTime;
    v.jet.g.gain.setTargetAtTime(blast * 0.22, t, 0.04);
    v.jet.f.frequency.setTargetAtTime(700 + blast * 900 + slot * 120, t, 0.05);
    v.suck.g.gain.setTargetAtTime(suck * 0.12, t, 0.04);
    v.suck.f.frequency.setTargetAtTime(380 + suck * 300 + Math.sin(t * 30) * 60, t, 0.02);
  }

  silence() {
    this.voices.forEach((v, i) => v && this.setPlayer(i, 0, 0));
  }

  splash(vol = 1) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(2500, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.4);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.35 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random()); src.stop(t + 0.5);
  }

  blip(freq, dur = 0.1, type = 'sine', vol = 0.2, when = 0, slideTo = null) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  join() { this.blip(660, 0.12, 'triangle', 0.25); this.blip(990, 0.15, 'triangle', 0.25, 0.08); }
  leave() { this.blip(660, 0.12, 'triangle', 0.2); this.blip(440, 0.15, 'triangle', 0.2, 0.08); }
  bonk(v = 1) { this.blip(160, 0.15, 'sine', 0.3 * Math.min(1, v), 0, 80); }
  fall() { this.blip(700, 0.7, 'sine', 0.18, 0, 120); }
  fail() { [523, 440, 349, 262].forEach((f, i) => this.blip(f, 0.25, 'triangle', 0.22, i * 0.16)); }
  checkpoint() { [659, 784, 1047].forEach((f, i) => this.blip(f, 0.18, 'triangle', 0.22, i * 0.09)); }
  win() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.blip(f, 0.3, 'triangle', 0.25, i * 0.12)); }
  tick(go = false) { this.blip(go ? 880 : 440, go ? 0.35 : 0.15, 'square', 0.12); }
}
