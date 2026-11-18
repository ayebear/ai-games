// Tiny procedural sound effects via WebAudio. No asset files needed.
let ctx = null, master = null, noiseBuf = null;
const last = new Map();

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
}

function tone(freq, dur, type = 'sine', vol = 0.3, slide = 0, delay = 0) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur, vol = 0.2, freq = 1200, q = 1, delay = 0, type = 'bandpass') {
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t); s.stop(t + dur + 0.05);
}

const SFX = {
  swing: () => noise(0.12, 0.15, 2500, 0.8),
  hit: () => { tone(180, 0.12, 'square', 0.15, -80); noise(0.08, 0.2, 800); },
  kill: () => { tone(520, 0.08, 'square', 0.12); tone(780, 0.12, 'square', 0.1, 0, 0.06); },
  pickup: () => tone(660, 0.08, 'triangle', 0.2, 200),
  coin: () => { tone(988, 0.07, 'square', 0.1); tone(1319, 0.15, 'square', 0.1, 0, 0.06); },
  plant: () => { noise(0.15, 0.2, 500); tone(400, 0.1, 'sine', 0.15, 150, 0.05); },
  harvest: () => { tone(523, 0.1, 'triangle', 0.2); tone(659, 0.1, 'triangle', 0.2, 0, 0.08); tone(784, 0.2, 'triangle', 0.2, 0, 0.16); },
  buy: () => { tone(880, 0.06, 'square', 0.1); tone(1175, 0.12, 'square', 0.1, 0, 0.05); },
  error: () => tone(160, 0.18, 'sawtooth', 0.12, -40),
  water: () => noise(0.18, 0.08, 3000, 0.5),
  splash: () => noise(0.25, 0.2, 1500, 0.6),
  zap: () => { tone(1400, 0.1, 'sawtooth', 0.12, -900); noise(0.1, 0.15, 4000); },
  join: () => { tone(392, 0.1, 'triangle', 0.25); tone(523, 0.1, 'triangle', 0.25, 0, 0.1); tone(784, 0.2, 'triangle', 0.25, 0, 0.2); },
  leave: () => { tone(523, 0.12, 'triangle', 0.2); tone(330, 0.2, 'triangle', 0.2, 0, 0.1); },
  dawn: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.4, 'sine', 0.15, 0, i * 0.12)),
  dusk: () => [440, 349, 294, 220].forEach((f, i) => tone(f, 0.5, 'triangle', 0.15, 0, i * 0.16)),
  boss: () => { tone(80, 1.2, 'sawtooth', 0.25, -30); tone(120, 1.2, 'sawtooth', 0.15, -50, 0.2); },
  hurt: () => tone(300, 0.2, 'sawtooth', 0.12, -150),
  till: () => noise(0.2, 0.25, 400, 0.7),
  snap: () => { noise(0.05, 0.3, 2000); tone(200, 0.06, 'square', 0.15); },
  throw: () => noise(0.15, 0.12, 1800, 1),
  flash: () => { tone(1200, 0.5, 'sine', 0.2, -800); noise(0.4, 0.15, 6000, 0.3, 0, 'highpass'); },
  sling: () => { tone(700, 0.08, 'triangle', 0.15, -400); noise(0.06, 0.12, 2500); },
  mgun: () => { noise(0.05, 0.25, 900, 0.8); tone(110, 0.05, 'square', 0.1, -30); },
  shoot: () => { noise(0.1, 0.3, 300); tone(140, 0.1, 'square', 0.15, -60); },
  thump: () => tone(90, 0.15, 'sine', 0.3, -40),
  steal: () => tone(1200, 0.06, 'square', 0.06, -400),
  bloom: () => { tone(784, 0.15, 'sine', 0.15); tone(1047, 0.25, 'sine', 0.12, 0, 0.1); },
  gameover: () => [392, 370, 349, 330, 262].forEach((f, i) => tone(f, 0.6, 'triangle', 0.18, 0, i * 0.3)),
  win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.3, 'square', 0.1, 0, i * 0.14)),
};

export function sfx(name, minGap = 0.04) {
  if (!ctx || ctx.state !== 'running' || !SFX[name]) return;
  const now = ctx.currentTime;
  if (now - (last.get(name) || 0) < minGap) return;
  last.set(name, now);
  SFX[name]();
}
