// All sound is made live with Web Audio: squelchy footsteps, drips, splashes, alarms, lava sizzle,
// task blips, plus four music moods. No feedback loops anywhere; the master ends in a limiter + soft clipper.
let ctx = null, master, sfxBus, musicBus, verb, verbIn, noiseBuf, brownBuf;
export const audio = { music: true, sfx: true, ready: false };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10; comp.knee.value = 6; comp.ratio.value = 12; comp.attack.value = 0.003; comp.release.value = 0.2;
  const clip = ctx.createWaveShaper(); const cv = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; cv[i] = Math.tanh(x * 1.2) / Math.tanh(1.2); }
  clip.curve = cv;
  master.connect(comp); comp.connect(clip); clip.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = audio.sfx ? 1 : 0; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = audio.music ? 0.5 : 0; musicBus.connect(master);
  // reverb: convolver with a generated tail (no feedback)
  verb = ctx.createConvolver();
  const len = ctx.sampleRate * 2.4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  verb.buffer = ir;
  verbIn = ctx.createGain(); verbIn.gain.value = 0.35; verbIn.connect(verb);
  const vOut = ctx.createGain(); vOut.gain.value = 0.6; verb.connect(vOut); vOut.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  brownBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
  { const d = brownBuf.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } }
  audio.ready = true;
  setInterval(schedule, 90);
}
export function setMusic(on) { audio.music = on; if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.2); }
export function setSfx(on) { audio.sfx = on; if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05); }

// ------------------------------------------------------------------ building blocks
function out(vol = 1, pan = 0, wet = 0.2, bus = sfxBus) {
  const g = ctx.createGain(); g.gain.value = vol;
  let node = g;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); node = p; }
  node.connect(bus);
  if (wet > 0) { const s = ctx.createGain(); s.gain.value = wet; node.connect(s); s.connect(verbIn); }
  return g;
}
function env(g, t, a, peak, d, sustain = 0.0001) {
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + d);
}
function osc(type, f0, f1, t, dur, vol, dest, a = 0.005) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, a, vol, dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + a + dur + 0.05);
  return o;
}
function noise(t, dur, vol, dest, { type = 'bandpass', f0 = 1000, f1 = f0, q = 1, a = 0.003, buf = noiseBuf, rate = 1 } = {}) {
  const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); env(g, t, a, vol, dur);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + a + dur + 0.05);
  return { s, f, g };
}
const ok = () => ctx && audio.ready;
const R = (a, b) => a + Math.random() * (b - a);

// ------------------------------------------------------------------ sound effects
export const sfx = {
  step(vol = 1, pan = 0) {
    if (!ok()) return; const t = ctx.currentTime, o = out(0.22 * vol, pan, 0.05);
    noise(t, R(0.07, 0.11), 0.6, o, { f0: R(900, 1300), f1: 300, q: 2.5 });
    osc('sine', R(260, 340), R(90, 130), t + 0.01, 0.07, 0.35, o);
  },
  drip(vol = 1, pan = 0) {
    if (!ok()) return; const t = ctx.currentTime, o = out(0.16 * vol, pan, 0.45);
    const f = R(700, 1100); osc('sine', f, f * R(2, 2.6), t, 0.09, 0.6, o, 0.002);
  },
  splash(size = 1, vol = 1, pan = 0) {
    if (!ok()) return; const t = ctx.currentTime, o = out(0.5 * vol, pan, 0.35);
    noise(t, 0.25 + size * 0.35, 0.8, o, { type: 'lowpass', f0: 4500, f1: 500, q: 0.7 });
    osc('sine', 180, 50, t, 0.18, 0.6, o);
    for (let i = 0; i < 4 + size * 5; i++) { const tt = t + R(0.05, 0.5 + size * 0.3), f = R(600, 1500); osc('sine', f, f * 2.2, tt, 0.07, 0.25, o, 0.002); }
  },
  kill() {
    if (!ok()) return; const t = ctx.currentTime, o = out(0.8, 0, 0.4);
    this.splash(2, 1.1);
    osc('sine', 140, 35, t, 0.35, 0.9, o);
    // sharp stab chord
    for (const f of [233, 247, 349, 466]) osc('sawtooth', f, f * 0.98, t, 0.6, 0.12, o, 0.003);
    noise(t, 0.08, 0.7, o, { type: 'highpass', f0: 3000, q: 0.5 });
  },
  report() {
    if (!ok()) return; const t = ctx.currentTime, o = out(0.4, 0, 0.35);
    for (let i = 0; i < 3; i++) { osc('square', 880, 880, t + i * 0.32, 0.14, 0.35, o); osc('square', 660, 660, t + i * 0.32 + 0.15, 0.14, 0.35, o); }
    for (const f of [146, 155, 220]) osc('sawtooth', f, f, t + 1.0, 1.3, 0.18, o, 0.02);
  },
  emergency() {
    if (!ok()) return; const t = ctx.currentTime, o = out(0.35, 0, 0.35);
    for (let i = 0; i < 2; i++) { const s = osc('sawtooth', 300, 1100, t + i * 0.7, 0.62, 0.35, o, 0.02); }
    noise(t, 1.4, 0.15, o, { type: 'bandpass', f0: 2000, f1: 3500, q: 3 });
  },
  task() {
    if (!ok()) return; const t = ctx.currentTime, o = out(0.3, 0, 0.35);
    [784, 988, 1319].forEach((f, i) => { osc('triangle', f, f, t + i * 0.09, 0.35, 0.5, o); osc('sine', f * 2, f * 2, t + i * 0.09, 0.2, 0.15, o); });
  },
  blip(f = 1100, vol = 1) { if (!ok()) return; const t = ctx.currentTime, o = out(0.14 * vol, 0, 0.1); osc('sine', f, f, t, 0.06, 0.6, o, 0.002); },
  bad() { if (!ok()) return; const t = ctx.currentTime, o = out(0.22, 0, 0.1); osc('square', 180, 160, t, 0.25, 0.4, o); },
  zap() { if (!ok()) return; const t = ctx.currentTime, o = out(0.25, 0, 0.2); noise(t, 0.15, 0.7, o, { type: 'bandpass', f0: 3500, f1: 1200, q: 4 }); osc('sawtooth', 120, 60, t, 0.12, 0.3, o); },
  pour(dur = 0.2) { if (!ok()) return; const t = ctx.currentTime, o = out(0.18, 0, 0.3); noise(t, dur, 0.6, o, { type: 'bandpass', f0: R(500, 800), q: 2, a: 0.02 }); for (let i = 0; i < 3; i++) this.drip(0.5); },
  scrub() { if (!ok()) return; const t = ctx.currentTime, o = out(0.12, 0, 0.1); noise(t, 0.08, 0.6, o, { type: 'bandpass', f0: R(1500, 2500), q: 1.5 }); },
  vent() {
    if (!ok()) return; const t = ctx.currentTime, o = out(0.45, 0, 0.3);
    for (const f of [420, 1130, 1870, 2730]) osc('sine', f * R(0.97, 1.03), f, t, R(0.15, 0.4), 0.25, o, 0.001);
    noise(t, 0.06, 0.6, o, { type: 'highpass', f0: 2000 });
    noise(t + 0.05, 0.35, 0.4, o, { type: 'lowpass', f0: 1200, f1: 200 });
  },
  lightsOff() { if (!ok()) return; const t = ctx.currentTime, o = out(0.35, 0, 0.3); osc('sawtooth', 480, 30, t, 1.1, 0.4, o); noise(t, 0.1, 0.6, o, { type: 'highpass', f0: 3000 }); },
  lightsOn() { if (!ok()) return; const t = ctx.currentTime, o = out(0.3, 0, 0.3); osc('sawtooth', 40, 520, t, 0.7, 0.3, o); osc('sine', 1046, 1046, t + 0.7, 0.3, 0.3, o); },
  heatAlarm() { if (!ok()) return; const t = ctx.currentTime, o = out(0.28, 0, 0.3); osc('square', 1240, 1240, t, 0.18, 0.45, o); osc('square', 930, 930, t + 0.25, 0.18, 0.45, o); },
  vote() { if (!ok()) return; const t = ctx.currentTime, o = out(0.4, 0, 0.2); osc('sine', 150, 60, t, 0.15, 0.9, o); noise(t, 0.05, 0.6, o, { type: 'lowpass', f0: 2000 }); },
  tick(hi = false) { if (!ok()) return; const t = ctx.currentTime, o = out(0.12, 0, 0.05); osc('sine', hi ? 1800 : 1400, hi ? 1800 : 1400, t, 0.03, 0.7, o, 0.001); },
  reveal() { if (!ok()) return; const t = ctx.currentTime, o = out(0.3, 0, 0.4); for (let i = 0; i < 12; i++) noise(t + i * 0.05, 0.05, 0.5 + i * 0.03, o, { type: 'lowpass', f0: 400 }); osc('sawtooth', 110, 110, t + 0.65, 0.8, 0.3, o); },
  squeak(pan = 0) { if (!ok()) return; const t = ctx.currentTime, o = out(0.3, pan, 0.4); const s = osc('sine', 700, 260, t, 0.6, 0.6, o, 0.02); const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 9; lg.gain.value = 30; l.connect(lg); lg.connect(s.frequency); l.start(t); l.stop(t + 0.7); },
  sizzle(big = 1) {
    if (!ok()) return; const t = ctx.currentTime, o = out(0.55, 0, 0.5);
    noise(t, 2.6 * big, 0.9, o, { type: 'highpass', f0: 5000, f1: 2200, q: 0.6, a: 0.01 });
    noise(t, 1.8 * big, 0.6, o, { type: 'bandpass', f0: 1800, f1: 600, q: 0.8, a: 0.02 });
    for (let i = 0; i < 40; i++) noise(t + R(0, 2 * big), 0.02, R(0.2, 0.6), o, { type: 'highpass', f0: R(3000, 7000) });
    osc('sine', 90, 30, t, 0.6, 0.8, o);
  },
  bubble(vol = 1) { if (!ok()) return; const t = ctx.currentTime, o = out(0.25 * vol, R(-0.6, 0.6), 0.5); const f = R(70, 160); osc('sine', f, f * R(1.6, 2.4), t, R(0.08, 0.2), 0.7, o, 0.01); },
  whoosh() { if (!ok()) return; const t = ctx.currentTime, o = out(0.3, 0, 0.3); noise(t, 0.6, 0.6, o, { type: 'bandpass', f0: 300, f1: 2000, q: 1.2, a: 0.2 }); },
  win() { if (!ok()) return; const t = ctx.currentTime, o = out(0.32, 0, 0.45); [523, 659, 784, 1046].forEach((f, i) => { osc('triangle', f, f, t + i * 0.16, 0.9, 0.4, o); osc('sawtooth', f / 2, f / 2, t + i * 0.16, 0.6, 0.08, o); }); },
  lose() { if (!ok()) return; const t = ctx.currentTime, o = out(0.32, 0, 0.45); [392, 370, 311, 233].forEach((f, i) => osc('sawtooth', f, f * 0.97, t + i * 0.3, 0.9, 0.18, o, 0.02)); },
  imposterReveal() { if (!ok()) return; const t = ctx.currentTime, o = out(0.45, 0, 0.5); for (const f of [55, 58.3, 82.4]) osc('sawtooth', f, f, t, 2.5, 0.3, o, 0.3); noise(t, 2, 0.3, o, { type: 'lowpass', f0: 300, f1: 80, a: 0.4 }); },
  burn(vol = 1) {
    if (!ok()) return; const t = ctx.currentTime, o = out(0.6 * vol, 0, 0.35);
    noise(t, 0.5, 0.8, o, { type: 'bandpass', f0: 300, f1: 1800, q: 0.8, a: 0.04 });          // whoomph
    osc('sine', 90, 40, t, 0.4, 0.8, o);
    for (let i = 0; i < 50; i++) noise(t + R(0, 1.6), 0.015, R(0.2, 0.7), o, { type: 'highpass', f0: R(2000, 6000) });   // crackle
    noise(t + 0.3, 1.6, 0.5, o, { type: 'highpass', f0: 4000, f1: 2500, a: 0.1 });               // steam hiss
    for (const f of [233, 247, 349]) osc('sawtooth', f, f * 0.98, t, 0.5, 0.08, o, 0.003);
  },
  slurp() {
    if (!ok()) return; const t = ctx.currentTime, o = out(0.5, 0, 0.3);
    for (let i = 0; i < 6; i++) { const tt = t + i * 0.09; osc('sine', R(500, 800), R(150, 250), tt, 0.08, 0.5, o, 0.005); noise(tt, 0.07, 0.4, o, { type: 'bandpass', f0: R(800, 1400), f1: 300, q: 3 }); }
    osc('sine', 300, 60, t + 0.55, 0.3, 0.6, o);
  },
  scoop() {
    if (!ok()) return; const t = ctx.currentTime, o = out(0.55, 0, 0.35);
    noise(t, 0.35, 0.7, o, { type: 'lowpass', f0: 3000, f1: 500 });
    for (const f of [520, 1400, 2300]) osc('sine', f, f * 0.98, t + 0.05, 0.35, 0.2, o, 0.002);     // metal bucket clang
    osc('sine', 160, 70, t, 0.2, 0.7, o);
  },
  dump() { if (!ok()) return; const t = ctx.currentTime, o = out(0.5, 0, 0.45); noise(t, 0.9, 0.7, o, { type: 'lowpass', f0: 1800, f1: 300, a: 0.05 }); osc('sine', 120, 50, t + 0.2, 0.4, 0.6, o); for (const f of [380, 980]) osc('sine', f, f, t, 0.5, 0.15, o, 0.002); },
  flush() {
    if (!ok()) return; const t = ctx.currentTime, o = out(0.55, 0, 0.4);
    osc('sine', 1200, 1200, t, 0.05, 0.3, o, 0.002);                                            // handle click
    noise(t + 0.08, 1.4, 0.8, o, { type: 'bandpass', f0: 400, f1: 1600, q: 1.2, a: 0.1 });     // rush
    noise(t + 0.6, 0.9, 0.6, o, { type: 'bandpass', f0: 1800, f1: 300, q: 2, a: 0.05 });        // swirl down
    osc('sine', 180, 70, t + 1.2, 0.3, 0.6, o); for (let i = 0; i < 5; i++) this.drip(0.6);
  },
  rain() {
    if (!ok()) return; const t = ctx.currentTime, o = out(0.5, 0, 0.3);
    noise(t, 3.2, 0.7, o, { type: 'bandpass', f0: 3000, q: 0.5, a: 0.6 });
    for (let i = 0; i < 40; i++) setTimeout(() => this.drip(0.5), R(0, 3000));
    osc('sine', 60, 40, t + 0.2, 1.5, 0.4, o, 0.3);                                            // distant thunder
    noise(t + 0.2, 1.8, 0.4, o, { type: 'lowpass', f0: 200, f1: 60, a: 0.3, buf: brownBuf });
  },
  revive() { if (!ok()) return; const t = ctx.currentTime, o = out(0.4, 0, 0.5); noise(t, 1.2, 0.8, o, { type: 'highpass', f0: 2500, a: 0.02 }); [523, 659, 784, 1046, 1318].forEach((f, i) => osc('triangle', f, f, t + 0.4 + i * 0.08, 0.6, 0.3, o)); },
  crewReveal() { if (!ok()) return; const t = ctx.currentTime, o = out(0.4, 0, 0.5); for (const f of [262, 330, 392, 523]) osc('triangle', f, f, t, 2.2, 0.18, o, 0.25); },
};

// lava ambience (eject scene): a held low rumble + random bubbles
let lavaNodes = null;
export function lavaAmbience(on) {
  if (!ok()) return;
  if (on && !lavaNodes) {
    const t = ctx.currentTime, o = out(0.0001, 0, 0.3);
    const s = ctx.createBufferSource(); s.buffer = brownBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
    s.connect(f); f.connect(o); s.start(t);
    o.gain.exponentialRampToValueAtTime(0.9, t + 1.2);
    const iv = setInterval(() => { if (Math.random() < 0.6) sfx.bubble(R(0.4, 1)); }, 160);
    lavaNodes = { s, o, iv };
  } else if (!on && lavaNodes) {
    const { s, o, iv } = lavaNodes; clearInterval(iv);
    o.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3); s.stop(ctx.currentTime + 1.5); lavaNodes = null;
  }
}

// ------------------------------------------------------------------ music
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
let mood = null, nextT = 0, step = 0;
export function setMood(m) { if (m === mood) return; mood = m; step = 0; if (ctx) nextT = ctx.currentTime + 0.1; }
const SONGS = {
  // eerie, slow: Dm Bb Gm A
  play: { bpm: 84, chords: [[50, 53, 57, 62], [46, 50, 53, 58], [43, 46, 50, 55], [45, 49, 52, 57]], scale: [62, 65, 67, 69, 72, 74, 77], arp: 0.28, bass: [1, 0, 0, 0, 0, 0, 1, 0], hat: 0.4, pad: 0.05 },
  meeting: { bpm: 112, chords: [[45, 48, 52, 57], [45, 48, 52, 57], [41, 45, 48, 53], [44, 47, 52, 56]], scale: [69, 72, 74, 76, 79], arp: 0.5, bass: [1, 1, 1, 1, 1, 1, 1, 1], hat: 0.9, pad: 0.04 },
  lava: { bpm: 60, chords: [[38, 45, 50, 53], [37, 44, 49, 52]], scale: [62, 63, 65, 68], arp: 0.12, bass: [1, 0, 0, 0, 0, 0, 0, 0], hat: 0, pad: 0.07 },
  title: { bpm: 92, chords: [[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]], scale: [72, 74, 76, 79, 81, 84], arp: 0.45, bass: [1, 0, 0, 1, 0, 0, 1, 0], hat: 0.25, pad: 0.05 },
};
function schedule() {
  if (!ctx || !mood) return;
  const S = SONGS[mood]; if (!S) return;
  const sp = 60 / S.bpm / 2;              // 8th notes
  if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
  while (nextT < ctx.currentTime + 0.3) {
    const t = nextT, bar = Math.floor(step / 8) % (S.chords.length * 2), ch = S.chords[Math.floor(bar / 2)], s8 = step % 8;
    const mo = out(1, 0, 0.35, musicBus);
    if (s8 === 0 && bar % 2 === 0) {          // pad: detuned saws, 2 bars long, filtered
      for (const n of ch) for (const det of [-7, 7]) {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = NOTE(n); o.detune.value = det;
        f.type = 'lowpass'; f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1100, t + sp * 8); f.frequency.linearRampToValueAtTime(500, t + sp * 16); f.Q.value = 0.5;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(S.pad, t + sp * 4); g.gain.linearRampToValueAtTime(S.pad * 0.8, t + sp * 13); g.gain.linearRampToValueAtTime(0.0001, t + sp * 16.5);
        o.connect(f); f.connect(g); g.connect(mo); o.start(t); o.stop(t + sp * 17);
      }
    }
    if (S.bass[s8]) { const n = ch[0] - 12; osc('triangle', NOTE(n), NOTE(n), t, sp * (mood === 'meeting' ? 0.6 : 1.6), mood === 'meeting' ? 0.22 : 0.3, mo, 0.01); osc('sine', NOTE(n - 12), NOTE(n - 12), t, sp * 1.4, 0.25, mo, 0.01); }
    if (Math.random() < S.arp) {
      const n = S.scale[Math.floor(Math.random() * S.scale.length)], f = NOTE(n), v = mood === 'meeting' ? 0.07 : 0.09;
      // watery pluck with two hand-placed echoes (no feedback delay)
      [0, 1, 2].forEach(k => { osc('triangle', f, f, t + k * sp * 3, 0.5, v * Math.pow(0.4, k), mo, 0.004); osc('sine', f * 2, f * 2, t + k * sp * 3, 0.25, v * 0.3 * Math.pow(0.4, k), mo, 0.002); });
    }
    if (S.hat && Math.random() < S.hat && (mood === 'meeting' || s8 % 2 === 1)) noise(t, 0.03, mood === 'meeting' ? 0.06 : 0.04, mo, { type: 'highpass', f0: 8000 });
    if (mood === 'meeting' && s8 % 4 === 0) osc('sine', 1600, 1600, t, 0.02, 0.05, mo, 0.001);   // clock tick
    if (mood === 'play' && step % 32 === 16 && Math.random() < 0.5) { const f = NOTE(S.scale[0] + 12); osc('sine', f, f * 1.01, t, 2.5, 0.04, mo, 0.8); }   // distant tone
    nextT += sp; step++;
  }
}
