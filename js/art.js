// Procedural art module. Every visual embeds the game's STYLE FORMULA:
// cinematic painterly sci-fi, soft volumetric glow, subtle film grain, sleek angular
// silhouettes with crisp edges and no outlines; environments in deep indigo/violet with
// teal nebula haze; hero in gleaming white/silver with warm orange engine accents;
// aliens in dark iridescent green-and-purple biomech tones; weapon fire and pickups in
// vivid cyan and magenta neon glow; rim light and starlight bloom; top-down perspective.
// Sprites are baked ONCE to offscreen canvases — the frame loop only blits.

import { mulberry32 } from "./rng.js";

export const PAL = {
  space0: "#0a0a1e", space1: "#141033", violet: "#3b2a6e", teal: "#1e6f7a",
  hazeTeal: "rgba(45,170,190,0.16)", hazeViolet: "rgba(110,70,200,0.14)",
  heroHull: "#e8ecf4", heroTrim: "#9aa7bd", heroDark: "#4c5568", engine: "#ffb35c",
  alienA: "#274a35", alienB: "#4a2a5e", alienGlow: "#7dff9a", alienCore: "#c76bff",
  cyan: "#7de0ff", magenta: "#ff5ad1", gold: "#ffd75c", white: "#ffffff",
};

function bake(w, h, fn) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  fn(g, w, h);
  return c;
}

// Subtle painterly grain, baked into ship/large sprites (never per-frame).
function grain(g, w, h, alpha, seed) {
  const rnd = mulberry32(seed);
  g.save();
  g.globalCompositeOperation = "overlay";
  g.globalAlpha = alpha;
  for (let i = 0; i < w * h / 38; i++) {
    const x = rnd() * w, y = rnd() * h, l = rnd() * 255 | 0;
    g.fillStyle = `rgb(${l},${l},${l})`;
    g.fillRect(x, y, 1.5, 1.5);
  }
  g.restore();
}

function rim(g, path, w, h, color, blur) {
  // fake rim light: re-stroke the silhouette with a soft glow, clipped inside
  g.save();
  g.clip(path);
  g.strokeStyle = color;
  g.lineWidth = 3;
  g.shadowColor = color;
  g.shadowBlur = blur;
  g.stroke(path);
  g.restore();
}

export function glowSprite(color, size) {
  return bake(size * 2, size * 2, (g) => {
    const r = size;
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, "#ffffff");
    gr.addColorStop(0.25, color);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, size * 2, size * 2);
  });
}

// ---------- HERO ROCKET (nose up) ----------
export function heroSprite(skin) {
  const S = 128;
  return bake(S, S, (g) => {
    const cx = S / 2;
    const body = new Path2D();
    // sleek dart: nose 14 → wing roots → tail
    body.moveTo(cx, 8);
    body.bezierCurveTo(cx + 10, 26, cx + 13, 46, cx + 13, 72);
    body.lineTo(cx + 9, 104);
    body.lineTo(cx - 9, 104);
    body.lineTo(cx - 13, 72);
    body.bezierCurveTo(cx - 13, 46, cx - 10, 26, cx, 8);
    body.closePath();
    // wings
    const wing = new Path2D();
    wing.moveTo(cx + 12, 58);
    wing.lineTo(cx + 46, 92);
    wing.lineTo(cx + 40, 104);
    wing.lineTo(cx + 10, 96);
    wing.closePath();
    wing.moveTo(cx - 12, 58);
    wing.lineTo(cx - 46, 92);
    wing.lineTo(cx - 40, 104);
    wing.lineTo(cx - 10, 96);
    wing.closePath();
    // wing fill: trim metal with hull highlight
    let wg = g.createLinearGradient(cx - 46, 60, cx + 46, 104);
    wg.addColorStop(0, skin.trim); wg.addColorStop(0.5, skin.hull); wg.addColorStop(1, skin.trim);
    g.fillStyle = wg; g.fill(wing);
    // hull fill: gleaming vertical gradient
    let hg = g.createLinearGradient(cx - 13, 0, cx + 13, 0);
    hg.addColorStop(0, skin.trim); hg.addColorStop(0.35, skin.hull);
    hg.addColorStop(0.55, "#ffffff"); hg.addColorStop(0.75, skin.hull); hg.addColorStop(1, skin.trim);
    g.fillStyle = hg; g.fill(body);
    // cockpit canopy — teal glass glow
    const cp = new Path2D(); cp.ellipse(cx, 40, 5.5, 12, 0, 0, Math.PI * 2);
    let cg = g.createLinearGradient(0, 28, 0, 52);
    cg.addColorStop(0, "#bfffff"); cg.addColorStop(0.5, PAL.cyan); cg.addColorStop(1, PAL.teal);
    g.fillStyle = cg; g.fill(cp);
    g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.5;
    g.fillStyle = PAL.cyan; g.shadowColor = PAL.cyan; g.shadowBlur = 10; g.fill(cp); g.restore();
    // twin engine nozzles — warm orange accents
    g.fillStyle = PAL.heroDark;
    g.fillRect(cx - 9, 102, 7, 8); g.fillRect(cx + 2, 102, 7, 8);
    g.save(); g.globalCompositeOperation = "lighter";
    g.fillStyle = skin.glow; g.shadowColor = skin.glow; g.shadowBlur = 12;
    g.fillRect(cx - 8, 106, 5, 5); g.fillRect(cx + 3, 106, 5, 5);
    g.restore();
    // panel lines
    g.strokeStyle = "rgba(30,40,60,0.35)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(cx, 26); g.lineTo(cx, 96); g.stroke();
    g.beginPath(); g.moveTo(cx - 10, 70); g.lineTo(cx + 10, 70); g.stroke();
    rim(g, body, S, S, "rgba(125,224,255,0.9)", 6);
    grain(g, S, S, 0.10, 7);
  });
}

// ---------- ALIEN SHIPS (nose up) ----------
function alienGradient(g, x0, y0, x1, y1, tint) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, PAL.alienB);
  gr.addColorStop(0.5, tint || PAL.alienA);
  gr.addColorStop(1, PAL.alienB);
  return gr;
}

export function scoutSprite(tint) {
  const S = 96;
  return bake(S, S, (g) => {
    const cx = S / 2;
    const p = new Path2D();
    p.moveTo(cx, 10);
    p.lineTo(cx + 12, 52);
    p.lineTo(cx + 40, 78);
    p.lineTo(cx + 8, 70);
    p.lineTo(cx, 86);
    p.lineTo(cx - 8, 70);
    p.lineTo(cx - 40, 78);
    p.lineTo(cx - 12, 52);
    p.closePath();
    g.fillStyle = alienGradient(g, cx - 40, 10, cx + 40, 86, null);
    g.fill(p);
    if (tint) { g.save(); g.globalCompositeOperation = "color"; g.globalAlpha = 0.55; g.fillStyle = tint; g.fill(p); g.restore(); }
    // iridescent sheen
    g.save(); g.clip(p); g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.25;
    const sh = g.createLinearGradient(0, 0, S, S);
    sh.addColorStop(0, "#7dff9a"); sh.addColorStop(0.5, "transparent"); sh.addColorStop(1, "#c76bff");
    g.fillStyle = sh; g.fillRect(0, 0, S, S); g.restore();
    // glowing eye slit
    g.save(); g.globalCompositeOperation = "lighter";
    g.fillStyle = tint || PAL.alienGlow; g.shadowColor = tint || PAL.alienGlow; g.shadowBlur = 9;
    g.fillRect(cx - 6, 38, 12, 4); g.restore();
    rim(g, p, S, S, "rgba(199,107,255,0.8)", 5);
    grain(g, S, S, 0.12, 11);
  });
}

export function heavySprite(tint) {
  const S = 128;
  return bake(S, S, (g) => {
    const cx = S / 2;
    const p = new Path2D();
    p.moveTo(cx, 12);
    p.lineTo(cx + 20, 34);
    p.lineTo(cx + 22, 78);
    p.lineTo(cx + 52, 66);
    p.lineTo(cx + 56, 96);
    p.lineTo(cx + 22, 104);
    p.lineTo(cx + 10, 116);
    p.lineTo(cx - 10, 116);
    p.lineTo(cx - 22, 104);
    p.lineTo(cx - 56, 96);
    p.lineTo(cx - 52, 66);
    p.lineTo(cx - 22, 78);
    p.lineTo(cx - 20, 34);
    p.closePath();
    g.fillStyle = alienGradient(g, cx - 56, 12, cx + 56, 116, null);
    g.fill(p);
    if (tint) { g.save(); g.globalCompositeOperation = "color"; g.globalAlpha = 0.55; g.fillStyle = tint; g.fill(p); g.restore(); }
    g.save(); g.clip(p); g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.22;
    const sh = g.createLinearGradient(0, 0, S, S);
    sh.addColorStop(0, "#c76bff"); sh.addColorStop(0.5, "transparent"); sh.addColorStop(1, "#7dff9a");
    g.fillStyle = sh; g.fillRect(0, 0, S, S); g.restore();
    // triple glow cores
    g.save(); g.globalCompositeOperation = "lighter";
    g.fillStyle = tint || PAL.alienCore; g.shadowColor = tint || PAL.alienCore; g.shadowBlur = 10;
    g.beginPath(); g.arc(cx, 52, 6, 0, 7); g.fill();
    g.beginPath(); g.arc(cx - 34, 86, 4, 0, 7); g.fill();
    g.beginPath(); g.arc(cx + 34, 86, 4, 0, 7); g.fill();
    g.restore();
    rim(g, p, S, S, "rgba(125,255,154,0.7)", 5);
    grain(g, S, S, 0.12, 13);
  });
}

export function droneSprite() {
  const S = 64;
  return bake(S, S, (g) => {
    const cx = S / 2;
    // spiked orb
    g.save();
    g.translate(cx, cx);
    const p = new Path2D();
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2, a1 = a0 + Math.PI / 8, a2 = a0 + Math.PI / 4;
      p.lineTo(Math.cos(a0) * 18, Math.sin(a0) * 18);
      p.lineTo(Math.cos(a1) * 27, Math.sin(a1) * 27);
      p.lineTo(Math.cos(a2) * 18, Math.sin(a2) * 18);
    }
    p.closePath();
    const gr = g.createRadialGradient(0, 0, 4, 0, 0, 27);
    gr.addColorStop(0, PAL.alienB); gr.addColorStop(1, "#1c1030");
    g.fillStyle = gr; g.fill(p);
    g.globalCompositeOperation = "lighter";
    g.fillStyle = PAL.magenta; g.shadowColor = PAL.magenta; g.shadowBlur = 12;
    g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fill();
    g.restore();
    grain(g, S, S, 0.12, 17);
  });
}

export function bomberSprite(tint) {
  const S = 128;
  return bake(S, S, (g) => {
    const cx = S / 2;
    const p = new Path2D();
    p.ellipse(cx, cx + 6, 40, 52, 0, 0, Math.PI * 2);
    const gr = g.createRadialGradient(cx - 12, cx - 12, 8, cx, cx, 56);
    gr.addColorStop(0, PAL.alienA); gr.addColorStop(0.7, PAL.alienB); gr.addColorStop(1, "#170e26");
    g.fillStyle = gr; g.fill(p);
    if (tint) { g.save(); g.globalCompositeOperation = "color"; g.globalAlpha = 0.5; g.fillStyle = tint; g.fill(p); g.restore(); }
    // armored ribs
    g.strokeStyle = "rgba(20,12,34,0.8)"; g.lineWidth = 3;
    for (let i = -2; i <= 2; i++) {
      g.beginPath(); g.ellipse(cx, cx + 6, 40 - Math.abs(i) * 4, 52 - Math.abs(i) * 4, 0, -0.5 + i * 0.05, 0.5 + i * 0.05); g.stroke();
    }
    // bomb bay glow
    g.save(); g.globalCompositeOperation = "lighter";
    g.fillStyle = tint || PAL.alienGlow; g.shadowColor = tint || PAL.alienGlow; g.shadowBlur = 14;
    g.beginPath(); g.ellipse(cx, cx + 26, 10, 6, 0, 0, 7); g.fill();
    g.restore();
    rim(g, p, S, S, "rgba(199,107,255,0.75)", 6);
    grain(g, S, S, 0.12, 19);
  });
}

export function turretSprite() {
  const S = 96;
  return bake(S, S, (g) => {
    const cx = S / 2;
    // rocky base
    const base = new Path2D();
    base.arc(cx, cx, 34, 0, Math.PI * 2);
    const bg = g.createRadialGradient(cx - 8, cx - 8, 4, cx, cx, 36);
    bg.addColorStop(0, "#4a3f5e"); bg.addColorStop(1, "#241a38");
    g.fillStyle = bg; g.fill(base);
    // cannon housing
    g.fillStyle = PAL.alienB;
    g.beginPath(); g.arc(cx, cx, 18, 0, 7); g.fill();
    g.fillRect(cx - 4, cx - 40, 8, 26);
    g.save(); g.globalCompositeOperation = "lighter";
    g.fillStyle = PAL.magenta; g.shadowColor = PAL.magenta; g.shadowBlur = 10;
    g.beginPath(); g.arc(cx, cx, 7, 0, 7); g.fill();
    g.fillRect(cx - 2, cx - 40, 4, 8);
    g.restore();
    grain(g, S, S, 0.12, 23);
  });
}

// ---------- BOSSES ----------
export function bossMechSprite(scale = 1) {
  const S = Math.round(384 * scale);
  return bake(S, S, (g) => {
    const cx = S / 2, u = S / 384;
    // layered battle-station hull: broad arrowhead + side pylons
    const hull = new Path2D();
    hull.moveTo(cx, 24 * u);
    hull.lineTo(cx + 70 * u, 90 * u);
    hull.lineTo(cx + 86 * u, 210 * u);
    hull.lineTo(cx + 160 * u, 180 * u);
    hull.lineTo(cx + 172 * u, 270 * u);
    hull.lineTo(cx + 80 * u, 300 * u);
    hull.lineTo(cx + 40 * u, 356 * u);
    hull.lineTo(cx - 40 * u, 356 * u);
    hull.lineTo(cx - 80 * u, 300 * u);
    hull.lineTo(cx - 172 * u, 270 * u);
    hull.lineTo(cx - 160 * u, 180 * u);
    hull.lineTo(cx - 86 * u, 210 * u);
    hull.lineTo(cx - 70 * u, 90 * u);
    hull.closePath();
    g.fillStyle = alienGradient(g, 0, 0, S, S, "#2c2440");
    g.fill(hull);
    g.save(); g.clip(hull); g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.2;
    const sh = g.createLinearGradient(0, 0, S, S);
    sh.addColorStop(0, "#c76bff"); sh.addColorStop(0.5, "transparent"); sh.addColorStop(1, "#7dff9a");
    g.fillStyle = sh; g.fillRect(0, 0, S, S); g.restore();
    // armored plate lines
    g.strokeStyle = "rgba(12,8,22,0.9)"; g.lineWidth = 3 * u;
    for (let i = 1; i <= 4; i++) {
      g.beginPath(); g.arc(cx, cx, (40 + i * 34) * u, 0, Math.PI * 2); g.stroke();
    }
    // turret pods + engine cores
    g.save(); g.globalCompositeOperation = "lighter";
    g.fillStyle = PAL.magenta; g.shadowColor = PAL.magenta; g.shadowBlur = 16 * u;
    const pods = [[0, -0.35], [0.55, 0.1], [-0.55, 0.1], [0.3, 0.45], [-0.3, 0.45]];
    for (const [px, py] of pods) {
      g.beginPath(); g.arc(cx + px * S * 0.42, cx + py * S * 0.42, 12 * u, 0, 7); g.fill();
    }
    g.fillStyle = PAL.alienGlow; g.shadowColor = PAL.alienGlow;
    g.beginPath(); g.arc(cx, cx, 22 * u, 0, 7); g.fill();
    g.restore();
    rim(g, hull, S, S, "rgba(199,107,255,0.85)", 10 * u);
    grain(g, S, S, 0.1, 29);
  });
}

export function bossOrganicSprite(scale = 1) {
  const S = Math.round(384 * scale);
  return bake(S, S, (g) => {
    const cx = S / 2, u = S / 384;
    const rnd = mulberry32(31);
    // radial tentacled mass
    g.save(); g.translate(cx, cx);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + rnd() * 0.3;
      const len = (140 + rnd() * 40) * u;
      g.save(); g.rotate(a);
      const t = new Path2D();
      t.moveTo(0, 0);
      t.quadraticCurveTo(30 * u, len * 0.5, (rnd() * 30 - 15) * u, len);
      t.quadraticCurveTo(-26 * u, len * 0.5, 0, 0);
      const tg = g.createLinearGradient(0, 0, 0, len);
      tg.addColorStop(0, PAL.alienB); tg.addColorStop(1, "#12081f");
      g.fillStyle = tg; g.fill(t);
      // sucker glows along the tentacle
      g.globalCompositeOperation = "lighter";
      g.fillStyle = PAL.alienGlow; g.shadowColor = PAL.alienGlow; g.shadowBlur = 8 * u;
      for (let s = 0.35; s < 0.95; s += 0.2) {
        g.beginPath(); g.arc(0, len * s, 4 * u, 0, 7); g.fill();
      }
      g.restore();
    }
    // central body
    const body = new Path2D(); body.arc(0, 0, 96 * u, 0, Math.PI * 2);
    const bg = g.createRadialGradient(-20 * u, -20 * u, 10 * u, 0, 0, 100 * u);
    bg.addColorStop(0, "#5e3a78"); bg.addColorStop(0.6, PAL.alienB); bg.addColorStop(1, "#170b28");
    g.fillStyle = bg; g.fill(body);
    // great eye — magenta core with cyan iris ring
    g.globalCompositeOperation = "lighter";
    g.fillStyle = PAL.magenta; g.shadowColor = PAL.magenta; g.shadowBlur = 24 * u;
    g.beginPath(); g.arc(0, 0, 34 * u, 0, 7); g.fill();
    g.strokeStyle = PAL.cyan; g.shadowColor = PAL.cyan; g.shadowBlur = 12 * u; g.lineWidth = 4 * u;
    g.beginPath(); g.arc(0, 0, 48 * u, 0, 7); g.stroke();
    g.restore();
    grain(g, S, S, 0.1, 37);
  });
}

// ---------- ENVIRONMENT ----------
export function asteroidSprite(seed) {
  const S = 96;
  return bake(S, S, (g) => {
    const rnd = mulberry32(seed);
    const cx = S / 2;
    const p = new Path2D();
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 26 + rnd() * 16;
      const x = cx + Math.cos(a) * r, y = cx + Math.sin(a) * r;
      i === 0 ? p.moveTo(x, y) : p.lineTo(x, y);
    }
    p.closePath();
    const gr = g.createRadialGradient(cx - 12, cx - 12, 6, cx, cx, 44);
    gr.addColorStop(0, "#6b5f7d"); gr.addColorStop(0.7, "#3d3450"); gr.addColorStop(1, "#221a33");
    g.fillStyle = gr; g.fill(p);
    // craters
    g.save(); g.clip(p);
    for (let i = 0; i < 6; i++) {
      const x = cx + (rnd() - 0.5) * 52, y = cx + (rnd() - 0.5) * 52, r = 3 + rnd() * 7;
      g.fillStyle = "rgba(15,10,26,0.6)";
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.fillStyle = "rgba(160,145,190,0.25)";
      g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.5, 0, 7); g.fill();
    }
    g.restore();
    rim(g, p, S, S, "rgba(125,224,255,0.35)", 4);
    grain(g, S, S, 0.14, seed);
  });
}

export function planetSprite(hue) {
  const S = 512;
  return bake(S, S, (g) => {
    const cx = S / 2, R = 200;
    // atmosphere halo
    const halo = g.createRadialGradient(cx, cx, R * 0.9, cx, cx, R * 1.26);
    halo.addColorStop(0, `hsla(${hue},70%,60%,0.35)`);
    halo.addColorStop(1, "hsla(0,0%,0%,0)");
    g.fillStyle = halo; g.fillRect(0, 0, S, S);
    // sphere
    g.save();
    g.beginPath(); g.arc(cx, cx, R, 0, Math.PI * 2); g.clip();
    const sp = g.createRadialGradient(cx - 70, cx - 70, 30, cx, cx, R * 1.1);
    sp.addColorStop(0, `hsl(${hue},55%,62%)`);
    sp.addColorStop(0.55, `hsl(${hue},60%,38%)`);
    sp.addColorStop(1, `hsl(${(hue + 30) % 360},65%,12%)`);
    g.fillStyle = sp; g.fillRect(0, 0, S, S);
    // painterly latitude bands
    const rnd = mulberry32(hue + 3);
    for (let i = 0; i < 9; i++) {
      const y = cx - R + rnd() * R * 2;
      g.fillStyle = `hsla(${(hue + rnd() * 40 - 20 + 360) % 360},60%,${30 + rnd() * 35}%,${0.10 + rnd() * 0.12})`;
      g.beginPath();
      g.ellipse(cx, y, R, 9 + rnd() * 26, 0, 0, Math.PI * 2);
      g.fill();
    }
    // terminator shadow
    const tm = g.createRadialGradient(cx + 120, cx + 90, R * 0.2, cx + 60, cx + 40, R * 1.5);
    tm.addColorStop(0, "rgba(0,0,0,0)"); tm.addColorStop(1, "rgba(4,2,12,0.9)");
    g.fillStyle = tm; g.fillRect(0, 0, S, S);
    g.restore();
    grain(g, S, S, 0.08, hue);
  });
}

export function nebulaBackground(hue, w = 1280, h = 720) {
  return bake(w, h, (g) => {
    // deep indigo base
    const base = g.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, PAL.space0);
    base.addColorStop(0.5, PAL.space1);
    base.addColorStop(1, "#0b0820");
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(hue * 7 + 5);
    // violet / teal / planet-hue haze blobs
    const hues = [262, 190, hue, (hue + 40) % 360, 262, 190];
    g.globalCompositeOperation = "screen";
    for (let i = 0; i < 14; i++) {
      const x = rnd() * w, y = rnd() * h, r = 120 + rnd() * 320;
      const hh = hues[i % hues.length];
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `hsla(${hh},65%,${18 + rnd() * 20}%,${0.10 + rnd() * 0.12})`);
      gr.addColorStop(1, "hsla(0,0%,0%,0)");
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.globalCompositeOperation = "source-over";
    // star dust
    for (let i = 0; i < 340; i++) {
      const x = rnd() * w, y = rnd() * h, s = rnd();
      g.globalAlpha = 0.25 + s * 0.6;
      g.fillStyle = s > 0.92 ? PAL.cyan : "#cdd6ff";
      g.fillRect(x, y, s > 0.85 ? 2 : 1, s > 0.85 ? 2 : 1);
    }
    g.globalAlpha = 1;
    // a few bloomed stars with cross flares
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 7; i++) {
      const x = rnd() * w, y = rnd() * h, r = 4 + rnd() * 8;
      const gr = g.createRadialGradient(x, y, 0, x, y, r * 3);
      gr.addColorStop(0, "rgba(255,255,255,0.9)");
      gr.addColorStop(0.3, "rgba(160,220,255,0.35)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
      g.fillStyle = "rgba(200,235,255,0.35)";
      g.fillRect(x - r * 2.5, y - 0.5, r * 5, 1);
      g.fillRect(x - 0.5, y - r * 2.5, 1, r * 5);
    }
    g.globalCompositeOperation = "source-over";
    grain(g, w, h, 0.06, hue + 99);
  });
}

export function vignette(w, h) {
  return bake(w, h, (g) => {
    const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.72);
    gr.addColorStop(0, "rgba(0,0,0,0)");
    gr.addColorStop(1, "rgba(3,2,10,0.55)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

// ---------- PICKUPS & PROJECTILES ----------
export function pickupSprite(kind) {
  const S = 48;
  return bake(S, S, (g) => {
    const c = S / 2;
    g.save();
    g.translate(c, c);
    g.globalCompositeOperation = "lighter";
    const draw = {
      credit()  { poly(g, 6, 10, PAL.gold); },
      crystal() { poly(g, 4, 12, PAL.magenta); },
      energy()  { poly(g, 3, 12, PAL.cyan); },
      artifact(){ poly(g, 5, 13, "#b0ff8a"); },
      health()  { g.fillStyle = "#7dffb0"; g.shadowColor = "#7dffb0"; g.shadowBlur = 10; g.fillRect(-9, -3, 18, 6); g.fillRect(-3, -9, 6, 18); },
      power()   { poly(g, 8, 12, PAL.cyan); },
    };
    (draw[kind] || draw.power)();
    g.restore();
  });
  function poly(g, n, r, color) {
    g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 12;
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath(); g.fill();
    g.fillStyle = "rgba(255,255,255,0.85)"; g.shadowBlur = 0;
    g.beginPath(); g.arc(-r * 0.25, -r * 0.25, r * 0.28, 0, 7); g.fill();
  }
}

export function missileSprite() {
  const S = 32;
  return bake(S, S, (g) => {
    const cx = S / 2;
    g.fillStyle = "#cfd6e4";
    g.beginPath();
    g.moveTo(cx, 3); g.lineTo(cx + 4, 10); g.lineTo(cx + 4, 24); g.lineTo(cx + 7, 29);
    g.lineTo(cx - 7, 29); g.lineTo(cx - 4, 24); g.lineTo(cx - 4, 10);
    g.closePath(); g.fill();
    g.save(); g.globalCompositeOperation = "lighter";
    g.fillStyle = PAL.engine; g.shadowColor = PAL.engine; g.shadowBlur = 8;
    g.fillRect(cx - 2, 26, 4, 5);
    g.restore();
  });
}

// ---------- ATLAS ----------
export function buildAtlas(skin) {
  return {
    hero: heroSprite(skin),
    scout: scoutSprite(null),
    scoutSniper: scoutSprite("#ff5ad1"),
    scoutGhost: scoutSprite("#8a9bd6"),
    scoutPirate: scoutSprite("#f2884d"),
    heavy: heavySprite(null),
    heavyShield: heavySprite("#41f7d2"),
    heavyElite: heavySprite("#f2c53d"),
    drone: droneSprite(),
    bomber: bomberSprite(null),
    bomberGhost: bomberSprite("#8a9bd6"),
    turret: turretSprite(),
    bossMech: bossMechSprite(1),
    bossOrganic: bossOrganicSprite(1),
    missile: missileSprite(),
    glowCyan: glowSprite(PAL.cyan, 16),
    glowMagenta: glowSprite(PAL.magenta, 16),
    glowTeal: glowSprite("#41f7d2", 16),
    glowViolet: glowSprite("#c76bff", 20),
    glowOrange: glowSprite(PAL.engine, 14),
    glowWhite: glowSprite("#ffffff", 16),
    glowGreen: glowSprite("#7dff9a", 14),
    pickups: {
      credit: pickupSprite("credit"),
      crystal: pickupSprite("crystal"),
      energy: pickupSprite("energy"),
      artifact: pickupSprite("artifact"),
      health: pickupSprite("health"),
      power: pickupSprite("power"),
    },
    asteroids: [asteroidSprite(41), asteroidSprite(43), asteroidSprite(47)],
  };
}
