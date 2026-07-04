// Pooled particle system. Fixed-size arrays, zero allocation in the frame loop.
import { PERF } from "./data.js";
import { fxRng } from "./rng.js";

const N = PERF.maxParticles;
const px = new Float32Array(N), py = new Float32Array(N);
const vx = new Float32Array(N), vy = new Float32Array(N);
const life = new Float32Array(N), maxLife = new Float32Array(N);
const size = new Float32Array(N), drag = new Float32Array(N);
const kind = new Uint8Array(N);      // 0 dead, 1 glow, 2 spark, 3 smoke
const spriteId = new Uint8Array(N);
let cursor = 0;

let sprites = [];                     // set by game: array of glow canvases
export function setParticleSprites(list) { sprites = list; }

export const GLOW = { cyan: 0, magenta: 1, teal: 2, violet: 3, orange: 4, white: 5, green: 6 };

function alloc() {
  cursor = (cursor + 1) % N;
  return cursor;
}

export function spawnGlow(x, y, spd, count, glowId, lifeS = 0.6, sz = 10, spread = Math.PI * 2, dir = 0) {
  for (let i = 0; i < count; i++) {
    const id = alloc();
    const a = dir + (fxRng.next() - 0.5) * spread;
    const v = spd * (0.3 + fxRng.next() * 0.7);
    px[id] = x; py[id] = y;
    vx[id] = Math.cos(a) * v; vy[id] = Math.sin(a) * v;
    life[id] = maxLife[id] = lifeS * (0.6 + fxRng.next() * 0.4);
    size[id] = sz * (0.6 + fxRng.next() * 0.8);
    drag[id] = 2.5;
    kind[id] = 1; spriteId[id] = glowId;
  }
}

export function spawnSpark(x, y, spd, count, glowId, lifeS = 0.35) {
  for (let i = 0; i < count; i++) {
    const id = alloc();
    const a = fxRng.angle();
    const v = spd * (0.5 + fxRng.next());
    px[id] = x; py[id] = y;
    vx[id] = Math.cos(a) * v; vy[id] = Math.sin(a) * v;
    life[id] = maxLife[id] = lifeS * (0.5 + fxRng.next() * 0.5);
    size[id] = 1;
    drag[id] = 1.2;
    kind[id] = 2; spriteId[id] = glowId;
  }
}

export function spawnSmoke(x, y, count, lifeS = 0.9, sz = 16) {
  for (let i = 0; i < count; i++) {
    const id = alloc();
    const a = fxRng.angle(), v = 20 + fxRng.next() * 50;
    px[id] = x; py[id] = y;
    vx[id] = Math.cos(a) * v; vy[id] = Math.sin(a) * v;
    life[id] = maxLife[id] = lifeS * (0.6 + fxRng.next() * 0.6);
    size[id] = sz * (0.7 + fxRng.next() * 0.6);
    drag[id] = 1.5;
    kind[id] = 3;
  }
}

export function explosion(x, y, big, glowId = GLOW.orange) {
  spawnGlow(x, y, big ? 420 : 260, big ? 26 : 12, glowId, big ? 0.9 : 0.55, big ? 22 : 12);
  spawnGlow(x, y, big ? 200 : 120, big ? 10 : 6, GLOW.white, 0.35, big ? 14 : 8);
  spawnSpark(x, y, big ? 640 : 420, big ? 22 : 10, glowId, 0.5);
  spawnSmoke(x, y, big ? 10 : 4, big ? 1.4 : 0.8, big ? 26 : 14);
}

export function updateParticles(dt) {
  for (let i = 0; i < N; i++) {
    if (!kind[i]) continue;
    life[i] -= dt;
    if (life[i] <= 0) { kind[i] = 0; continue; }
    const d = 1 - drag[i] * dt;
    vx[i] *= d; vy[i] *= d;
    px[i] += vx[i] * dt; py[i] += vy[i] * dt;
  }
}

const SPARK_COLORS = ["#7de0ff", "#ff5ad1", "#41f7d2", "#c76bff", "#ffb35c", "#ffffff", "#7dff9a"];

export function drawParticles(g, camX, camY, w, h) {
  // pass 1: additive glows + sparks
  g.save();
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < N; i++) {
    if (kind[i] === 0 || kind[i] === 3) continue;
    const x = px[i] - camX, y = py[i] - camY;
    if (x < -40 || y < -40 || x > w + 40 || y > h + 40) continue;
    const t = life[i] / maxLife[i];
    if (kind[i] === 1) {
      const s = size[i] * (0.4 + t * 0.8);
      g.globalAlpha = t;
      const spr = sprites[spriteId[i]];
      if (spr) g.drawImage(spr, x - s, y - s, s * 2, s * 2);
    } else {
      g.globalAlpha = t;
      g.strokeStyle = SPARK_COLORS[spriteId[i]];
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - vx[i] * 0.03, y - vy[i] * 0.03);
      g.stroke();
    }
  }
  g.restore();
  // pass 2: smoke (normal blend)
  g.save();
  for (let i = 0; i < N; i++) {
    if (kind[i] !== 3) continue;
    const x = px[i] - camX, y = py[i] - camY;
    if (x < -60 || y < -60 || x > w + 60 || y > h + 60) continue;
    const t = life[i] / maxLife[i];
    g.globalAlpha = t * 0.25;
    g.fillStyle = "#241f3a";
    const s = size[i] * (1.6 - t * 0.6);
    g.beginPath(); g.arc(x, y, s, 0, 7); g.fill();
  }
  g.restore();
  g.globalAlpha = 1;
}

export function clearParticles() { kind.fill(0); }

export function particleCount() {
  let c = 0;
  for (let i = 0; i < N; i++) if (kind[i]) c++;
  return c;
}

// ---- floating combat text (score popups, pickups) ----
const TN = 48;
const texts = Array.from({ length: TN }, () => ({ t: 0, max: 1, x: 0, y: 0, str: "", color: "#fff", size: 13 }));
let tCursor = 0;

export function floatText(x, y, str, color = "#ffffff", sz = 13) {
  tCursor = (tCursor + 1) % TN;
  const o = texts[tCursor];
  o.t = o.max = 0.9; o.x = x; o.y = y; o.str = str; o.color = color; o.size = sz;
}

export function updateTexts(dt) {
  for (const o of texts) if (o.t > 0) { o.t -= dt; o.y -= 34 * dt; }
}

export function drawTexts(g, camX, camY) {
  g.save();
  g.textAlign = "center";
  for (const o of texts) {
    if (o.t <= 0) continue;
    g.globalAlpha = Math.min(1, o.t / o.max * 1.6);
    g.font = `bold ${o.size}px "Rajdhani", "Segoe UI", sans-serif`;
    g.fillStyle = o.color;
    g.fillText(o.str, o.x - camX, o.y - camY);
  }
  g.restore();
  g.globalAlpha = 1;
}
