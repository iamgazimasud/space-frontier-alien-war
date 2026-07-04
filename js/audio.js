// Procedural WebAudio: dynamic music (menu / combat / boss) + all SFX synthesized live.
// Mix discipline: music sits quiet under SFX; a compressor on the master keeps peaks safe.

let ctx = null;
let master, musicGain, sfxGain, delaySend;
let musicTimer = null, currentTrack = null, nextNoteTime = 0, step = 0;
let settings = { music: 0.8, sfx: 0.8 };
let duckUntil = 0;

const A1 = 55;
const MINOR = [0, 2, 3, 5, 7, 8, 10];
function noteHz(root, degree, oct = 0) {
  const d = ((degree % 7) + 7) % 7;
  const o = Math.floor(degree / 7) + oct;
  return root * Math.pow(2, (MINOR[d] + o * 12) / 12);
}

export function initAudio(saved) {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createDynamicsCompressor();
  master.threshold.value = -12; master.knee.value = 24; master.ratio.value = 6;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  sfxGain = ctx.createGain();
  musicGain.connect(master); sfxGain.connect(master);
  // simple space echo for music + big SFX
  delaySend = ctx.createGain(); delaySend.gain.value = 0.35;
  const delay = ctx.createDelay(1.0); delay.delayTime.value = 0.34;
  const fb = ctx.createGain(); fb.gain.value = 0.35;
  const damp = ctx.createBiquadFilter(); damp.type = "lowpass"; damp.frequency.value = 2200;
  delaySend.connect(delay); delay.connect(damp); damp.connect(fb); fb.connect(delay);
  damp.connect(musicGain);
  if (saved) settings = saved;
  applyVolumes();
}

export function resumeAudio() { if (ctx && ctx.state === "suspended") ctx.resume(); }
export function setVolumes(v) { settings = v; applyVolumes(); }
function applyVolumes() {
  if (!ctx) return;
  musicGain.gain.value = 0.14 * settings.music;   // music: quiet background layer
  sfxGain.gain.value = 0.5 * settings.sfx;
}

// ---------------- MUSIC ----------------
const TRACKS = {
  menu:   { bpm: 72,  bass: [0, null, -3, null, -2, null, -3, null], arp: [7, 9, 11, 14, 11, 9], kick: [], hat: [], pad: true, stab: false },
  combat: { bpm: 138, bass: [0, 0, null, 0, -3, -3, null, -3, -2, -2, null, -2, -4, -4, 3, null],
            arp: [7, 10, 14, 10, 12, 7, 14, 10], kick: [0, 4, 8, 12], hat: [2, 6, 10, 14], pad: true, stab: true },
  boss:   { bpm: 150, bass: [0, 0, 1, 0, 0, 0, -1, 0, 0, 0, 1, 0, 3, null, -1, null],
            arp: [12, 13, 12, 10, 12, 13, 15, 13], kick: [0, 3, 6, 8, 11, 14], hat: [1, 2, 5, 7, 9, 10, 13, 15], pad: true, stab: true },
};

export function playMusic(name) {
  if (!ctx || currentTrack === name) return;
  stopMusic();
  currentTrack = name;
  step = 0;
  nextNoteTime = ctx.currentTime + 0.06;
  musicTimer = setInterval(scheduler, 25);
}
export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null; currentTrack = null;
}

function scheduler() {
  const t = TRACKS[currentTrack];
  if (!t) return;
  const spb = 60 / t.bpm / 4; // 16th note
  while (nextNoteTime < ctx.currentTime + 0.12) {
    scheduleStep(t, step, nextNoteTime, spb);
    nextNoteTime += spb;
    step = (step + 1) % 64;
  }
}

function scheduleStep(t, s, when, spb) {
  const bar16 = s % 16;
  // bass
  const b = t.bass[s % t.bass.length];
  if (b !== null && b !== undefined) tone(when, noteHz(A1, b), spb * 0.9, "sawtooth", 0.30, 320, musicGain);
  // arp — sparkling lead, echoes into the delay
  if (s % 2 === 0) {
    const a = t.arp[(s / 2) % t.arp.length];
    tone(when, noteHz(A1, a, 1), spb * 1.6, "square", 0.06, 3400, delaySend);
  }
  // pad every bar
  if (t.pad && bar16 === 0 && s % 32 === 0) {
    const chord = currentTrack === "boss" ? [0, 3, 6] : [0, 4, 7];
    for (const d of chord) tone(when, noteHz(A1 * 2, d), spb * 30, "triangle", 0.05, 1200, delaySend, 0.5);
  }
  // brass-ish stab on bar 3
  if (t.stab && s % 32 === 24) {
    for (const d of [0, 4]) tone(when, noteHz(A1 * 2, d), spb * 3, "sawtooth", 0.09, 900, musicGain, 0.05);
  }
  // drums
  if (t.kick.includes(bar16)) kick(when);
  if (t.hat.includes(bar16)) hat(when);
}

function tone(when, freq, dur, type, vol, cutoff, dest, attack = 0.01) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
  const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(vol, when + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(f); f.connect(g); g.connect(dest);
  o.start(when); o.stop(when + dur + 0.05);
}

function kick(when) {
  const o = ctx.createOscillator(); o.type = "sine";
  o.frequency.setValueAtTime(120, when);
  o.frequency.exponentialRampToValueAtTime(40, when + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.14);
  o.connect(g); g.connect(musicGain);
  o.start(when); o.stop(when + 0.16);
}
function hat(when) {
  const n = noiseSrc(0.05);
  const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.08, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
  n.connect(f); f.connect(g); g.connect(musicGain);
  n.start(when);
}

let noiseBuf = null;
function noiseSrc(dur) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = dur > 1.1;
  return s;
}

// ---------------- SFX ----------------
let sfxCount = 0, sfxWindow = 0;
function gate() {
  // limit simultaneous SFX bursts so swarms don't white-out the mix
  const now = ctx ? ctx.currentTime : 0;
  if (now - sfxWindow > 0.05) { sfxWindow = now; sfxCount = 0; }
  return ++sfxCount <= 6;
}

export const SFX = {
  laser()   { fx((t) => sweep(t, "square", 880, 220, 0.09, 0.12)); },
  laser2()  { fx((t) => sweep(t, "sawtooth", 1400, 500, 0.08, 0.10)); },
  plasma()  { fx((t) => { sweep(t, "sine", 220, 90, 0.22, 0.25); burst(t, 0.15, 1200, 0.08); }); },
  rail()    { fx((t) => { burst(t, 0.22, 3000, 0.2); sweep(t, "sine", 100, 42, 0.3, 0.3); }); },
  quantum() { fx((t) => sweep(t, "triangle", 1800, 1200, 0.05, 0.05)); },
  missile() { fx((t) => { burst(t, 0.5, 900, 0.14, 300); sweep(t, "sawtooth", 300, 700, 0.4, 0.05); }); },
  enemyShot(){ fx((t) => sweep(t, "square", 400, 160, 0.1, 0.06)); },
  hit()     { fx((t) => burst(t, 0.06, 2400, 0.1)); },
  shieldHit(){ fx((t) => { sweep(t, "sine", 900, 500, 0.12, 0.1); burst(t, 0.05, 4000, 0.05); }); },
  explode(big) {
    fx((t) => {
      burst(t, big ? 0.9 : 0.4, 700, big ? 0.5 : 0.3, 90);
      sweep(t, "sine", big ? 90 : 130, 30, big ? 0.8 : 0.4, big ? 0.5 : 0.3);
    });
  },
  pickup()  { fx((t) => { ping(t, 780, 0.1); ping(t + 0.07, 1170, 0.12); }); },
  artifact(){ fx((t) => { ping(t, 660, 0.1); ping(t + 0.08, 880, 0.1); ping(t + 0.16, 1320, 0.16); }); },
  power()   { fx((t) => { ping(t, 520, 0.08); ping(t + 0.06, 780, 0.08); ping(t + 0.12, 1040, 0.14); }); },
  boost()   { fx((t) => burst(t, 0.35, 600, 0.1, 200, 1800)); },
  dodge()   { fx((t) => sweep(t, "sine", 300, 900, 0.14, 0.08)); },
  emp()     { fx((t) => { sweep(t, "sawtooth", 1200, 60, 0.7, 0.3); burst(t, 0.5, 500, 0.2, 100); }); },
  nuke()    { fx((t) => { burst(t, 1.4, 400, 0.55, 60); sweep(t, "sine", 70, 24, 1.4, 0.5); }); },
  alarm()   { fx((t) => { sweep(t, "square", 620, 620, 0.18, 0.12); sweep(t + 0.28, "square", 470, 470, 0.18, 0.12); }); },
  lowHull() { fx((t) => sweep(t, "square", 520, 520, 0.1, 0.07)); },
  ui()      { fx((t) => ping(t, 950, 0.05, 0.06)); },
  uiBack()  { fx((t) => ping(t, 620, 0.05, 0.06)); },
  victory() { fx((t) => { [0, 4, 7, 12].forEach((d, i) => ping(t + i * 0.13, noteHz(220, d), 0.24, 0.14)); }); },
  defeat()  { fx((t) => { [7, 3, 0, -5].forEach((d, i) => ping(t + i * 0.2, noteHz(165, d), 0.3, 0.12)); }); },
  bossDown(){ fx((t) => { burst(t, 1.6, 500, 0.5, 50); [0, 4, 7, 12, 16].forEach((d, i) => ping(t + 0.5 + i * 0.12, noteHz(220, d), 0.25, 0.12)); }); },
  weaponUp(){ fx((t) => { [0, 7, 12, 19].forEach((d, i) => ping(t + i * 0.09, noteHz(330, d), 0.18, 0.1)); }); },
};

function fx(fn) {
  if (!ctx || !gate()) return;
  fn(ctx.currentTime);
}
function sweep(t, type, f0, f1, dur, vol) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(Math.max(20, f0), t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sfxGain);
  o.start(t); o.stop(t + dur + 0.05);
}
function burst(t, dur, cutoff, vol, low = 0, highStart = 0) {
  const n = noiseSrc(dur);
  const f = ctx.createBiquadFilter(); f.type = "lowpass";
  f.frequency.setValueAtTime(highStart || cutoff, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, low || cutoff * 0.3), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(f); f.connect(g); g.connect(sfxGain);
  n.start(t); n.stop(t + dur + 0.05);
}
function ping(t, freq, dur, vol = 0.1) {
  const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sfxGain);
  if (delaySend) g.connect(delaySend);
  o.start(t); o.stop(t + dur + 0.1);
}
