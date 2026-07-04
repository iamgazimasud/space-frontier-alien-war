// Canvas UI: screens, HUD, cinematics. Immediate-mode widgets usable by
// mouse, touch, keyboard and gamepad (focus ring + navOk).
import { STR } from "../strings.js";
import { PAL, nebulaBackground, heroSprite } from "./art.js";
import { WEAPONS, UPGRADES, SKINS, PLANETS, DIFFS } from "./data.js";
import { derivedStats, upgradeCost } from "./game.js";
import { input } from "./input.js";
import { fxRng } from "./rng.js";

const FONT = '"Rajdhani", "Bahnschrift", "Segoe UI", sans-serif';

export class UI {
  constructor(atlas, app) {
    this.atlas = atlas;
    this.app = app;               // callbacks: startMission, sfx, music, saveProfile, settings...
    this.screen = "title";
    this.widgets = [];
    this.focus = 0;
    this.t = 0;
    this.menuBg = nebulaBackground(250);
    this.toasts = [];
    this.banner = null;
    this.introIdx = 0;
    this.mapSel = 0;
    this.slotMode = "continue";  // or "new"
    this.confirmSlot = -1;
    this.pendingDiffSlot = -1;
    this.results = null;
    this.endingIdx = 0;
    this.radarOut = [];
    this.heroPreview = null;
    this.stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() }));
  }

  go(screen) {
    this.screen = screen;
    this.focus = 0;
    this.t = 0;
    if (screen !== "mission") input.setTouchButtons([]);
  }

  toast(text, sub = "") { this.toasts.push({ text, sub, t: 3.2 }); }

  // ---------- widget helpers ----------
  beginFrame() { this.widgets.length = 0; }

  button(g, id, x, y, w, h, label, opts = {}) {
    const idx = this.widgets.length;
    this.widgets.push({ id, x, y, w, h, disabled: !!opts.disabled });
    const focused = this.focus === idx;
    const m = input.mouse;
    const hover = m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h;
    if (hover && (m.moved)) this.focus = idx;
    const active = focused || hover;
    g.save();
    const alpha = opts.disabled ? 0.35 : 1;
    g.globalAlpha = alpha;
    // panel
    g.fillStyle = active ? "rgba(60,80,140,0.55)" : "rgba(18,22,46,0.72)";
    g.strokeStyle = active ? PAL.cyan : "rgba(125,224,255,0.35)";
    g.lineWidth = active ? 2 : 1;
    chamfer(g, x, y, w, h, 10);
    g.fill(); g.stroke();
    if (active && !opts.disabled) {
      g.save();
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.14 + Math.sin(this.t * 5) * 0.05;
      g.fillStyle = PAL.cyan;
      chamfer(g, x, y, w, h, 10);
      g.fill();
      g.restore();
    }
    g.fillStyle = active ? "#ffffff" : "#c9d6f2";
    g.font = `bold ${opts.size || 17}px ${FONT}`;
    g.textAlign = opts.align || "center";
    g.textBaseline = "middle";
    const tx = opts.align === "left" ? x + 16 : x + w / 2;
    g.fillText(label, tx, y + h / 2 + 1);
    if (opts.right) {
      g.textAlign = "right";
      g.fillStyle = opts.rightColor || PAL.gold;
      g.fillText(opts.right, x + w - 14, y + h / 2 + 1);
    }
    g.restore();
    return this._clicked(idx, opts.disabled);
  }

  _clicked(idx, disabled) {
    if (disabled) return false;
    const wd = this.widgets[idx];
    for (const c of input.clicks) {
      if (c.x >= wd.x && c.x <= wd.x + wd.w && c.y >= wd.y && c.y <= wd.y + wd.h) {
        this.app.sfx("ui");
        return true;
      }
    }
    if (this.focus === idx && input.pressed("navOk")) { this.app.sfx("ui"); return true; }
    return false;
  }

  navigate() {
    if (!this.widgets.length) return;
    if (input.pressed("navDown") || input.pressed("navRight")) { this.focus = (this.focus + 1) % this.widgets.length; this.app.sfx("ui"); }
    if (input.pressed("navUp") || input.pressed("navLeft")) { this.focus = (this.focus - 1 + this.widgets.length) % this.widgets.length; this.app.sfx("ui"); }
    this.focus = Math.max(0, Math.min(this.widgets.length - 1, this.focus));
  }

  // ---------- frame ----------
  update(dt) {
    this.t += dt;
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      this.toasts[i].t -= dt;
      if (this.toasts[i].t <= 0) this.toasts.splice(i, 1);
    }
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
  }

  render(g, w, h, game, profile) {
    this.beginFrame();
    switch (this.screen) {
      case "title": this.drawTitle(g, w, h); break;
      case "menu": this.drawMenu(g, w, h, profile); break;
      case "slots": this.drawSlots(g, w, h); break;
      case "difficulty": this.drawDifficulty(g, w, h); break;
      case "intro": this.drawIntro(g, w, h); break;
      case "map": this.drawMap(g, w, h, profile); break;
      case "hangar": this.drawHangar(g, w, h, profile); break;
      case "achievements": this.drawAchievements(g, w, h, profile); break;
      case "settings": this.drawSettings(g, w, h); break;
      case "controls": this.drawControls(g, w, h); break;
      case "mission": this.drawHUD(g, w, h, game, profile); break;
      case "pause": game && game.render(g, w, h); this.drawPause(g, w, h); break;
      case "results": game && game.render(g, w, h); this.drawResults(g, w, h, profile); break;
      case "ending": this.drawEnding(g, w, h, profile); break;
    }
    this.drawToasts(g, w, h);
    this.navigate();
  }

  // ---------- backgrounds ----------
  menuBackdrop(g, w, h) {
    const bw = Math.max(w, h * 16 / 9) * 1.06;
    const bh = bw * 9 / 16;
    g.drawImage(this.menuBg, (w - bw) / 2, (h - bh) / 2, bw, bh);
    // drifting stars
    g.save();
    for (const s of this.stars) {
      const x = ((s.x + this.t * 0.004 * (0.3 + s.s)) % 1) * w;
      const y = s.y * h;
      g.globalAlpha = 0.3 + s.s * 0.6;
      g.fillStyle = s.s > 0.9 ? PAL.cyan : "#cdd6ff";
      g.fillRect(x, y, s.s > 0.85 ? 2 : 1, s.s > 0.85 ? 2 : 1);
    }
    g.restore();
  }

  panel(g, x, y, w, h, title) {
    g.save();
    g.fillStyle = "rgba(10,12,30,0.86)";
    g.strokeStyle = "rgba(125,224,255,0.4)";
    g.lineWidth = 1.5;
    chamfer(g, x, y, w, h, 16);
    g.fill(); g.stroke();
    if (title) {
      g.fillStyle = PAL.cyan;
      g.font = `bold 22px ${FONT}`;
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(title, x + w / 2, y + 30);
      g.strokeStyle = "rgba(125,224,255,0.25)";
      g.beginPath(); g.moveTo(x + 30, y + 52); g.lineTo(x + w - 30, y + 52); g.stroke();
    }
    g.restore();
  }

  // ---------- screens ----------
  drawTitle(g, w, h) {
    this.menuBackdrop(g, w, h);
    const cx = w / 2;
    // hero rocket rising with engine glow
    if (!this.heroPreview) this.heroPreview = this.atlas.hero;
    const ry = h * 0.62 + Math.sin(this.t * 1.4) * 8;
    g.save();
    g.globalCompositeOperation = "lighter";
    const fl = g.createRadialGradient(cx, ry + 60, 4, cx, ry + 60, 60 + Math.sin(this.t * 9) * 10);
    fl.addColorStop(0, "rgba(255,179,92,0.9)");
    fl.addColorStop(1, "rgba(255,179,92,0)");
    g.fillStyle = fl;
    g.fillRect(cx - 70, ry - 10, 140, 160);
    g.restore();
    g.drawImage(this.heroPreview, cx - 48, ry - 48, 96, 96);

    g.textAlign = "center"; g.textBaseline = "middle";
    g.save();
    g.shadowColor = PAL.cyan; g.shadowBlur = 26;
    g.fillStyle = "#eaf6ff";
    g.font = `bold ${Math.min(72, w * 0.08)}px ${FONT}`;
    g.fillText(STR.title, cx, h * 0.24);
    g.shadowColor = PAL.magenta;
    g.fillStyle = PAL.magenta;
    g.font = `bold ${Math.min(40, w * 0.045)}px ${FONT}`;
    g.fillText(STR.subtitle, cx, h * 0.24 + Math.min(58, w * 0.06));
    g.restore();
    g.fillStyle = "#93a5cc";
    g.font = `${Math.min(16, w * 0.055)}px ${FONT}`;
    g.fillText(STR.tagline, cx, h * 0.38);
    g.globalAlpha = 0.6 + Math.sin(this.t * 3) * 0.35;
    g.fillStyle = PAL.cyan;
    g.font = `bold ${Math.min(17, w * 0.058)}px ${FONT}`;
    g.fillText(STR.pressStart, cx, h * 0.86);
    g.globalAlpha = 1;
    if (input.anyKey || input.clicks.length) this.app.firstInteract();
  }

  drawMenu(g, w, h, profile) {
    this.menuBackdrop(g, w, h);
    const cx = w / 2;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.save();
    g.shadowColor = PAL.cyan; g.shadowBlur = 18;
    g.fillStyle = "#eaf6ff";
    g.font = `bold ${Math.min(40, w * 0.052)}px ${FONT}`;
    g.fillText(STR.title + " — " + STR.subtitle, cx, 64);
    g.restore();
    const bw = Math.min(360, w - 60), bh = 44, gap = 12;
    let y = 120;
    const hasSave = this.app.hasAnySave();
    const items = [
      ["continue", STR.menu.continue, !hasSave],
      ["new", STR.menu.newGame, false],
      ["map", STR.menu.galaxyMap, !profile],
      ["endless", STR.menu.endless, !profile],
      ["bossrush", STR.menu.bossRush, !profile],
      ["hangar", STR.menu.hangar, !profile],
      ["ach", STR.menu.achievements, !profile],
      ["settings", STR.menu.settings, false],
      ["controls", STR.controls.title, false],
    ];
    for (const [id, label, disabled] of items) {
      if (this.button(g, id, cx - bw / 2, y, bw, bh, label, { disabled })) this.app.menuAction(id);
      y += bh + gap;
    }
    if (profile) {
      g.fillStyle = PAL.gold; g.font = `bold 16px ${FONT}`; g.textAlign = "center";
      g.fillText(`${profile.credits} ${STR.hud.credits}   ◆ ${profile.crystals}   ${DIFFS[profile.difficulty].label.toUpperCase()}${profile.ngPlus ? "  NG+" + profile.ngPlus : ""}`, cx, y + 8);
    }
  }

  drawSlots(g, w, h) {
    this.menuBackdrop(g, w, h);
    const cx = w / 2;
    const pw = Math.min(520, w - 40);
    this.panel(g, cx - pw / 2, 80, pw, Math.min(430, h - 140), this.slotMode === "new" ? STR.menu.newGame : STR.menu.continue);
    let y = 150;
    const slots = this.app.slots();
    for (let i = 0; i < 3; i++) {
      const s = slots[i];
      const label = s
        ? `${STR.menu.slot} ${i + 1} — ${s.planetsCleared.length}/10 · ${DIFFS[s.difficulty].label.toUpperCase()}${s.ngPlus ? " NG+" : ""}`
        : `${STR.menu.slot} ${i + 1} — ${STR.menu.empty}`;
      if (this.confirmSlot === i) {
        g.fillStyle = "#ffb0b0"; g.font = `bold 15px ${FONT}`; g.textAlign = "center";
        g.fillText(STR.menu.confirmWipe, cx, y - 8);
        if (this.button(g, "yes" + i, cx - pw / 2 + 30, y + 6, (pw - 80) / 2, 40, STR.menu.yes)) { this.confirmSlot = -1; this.app.slotPicked(i, true); }
        if (this.button(g, "no" + i, cx + 10, y + 6, (pw - 80) / 2, 40, STR.menu.no)) this.confirmSlot = -1;
        y += 74;
        continue;
      }
      const disabled = this.slotMode === "continue" && !s;
      if (this.button(g, "slot" + i, cx - pw / 2 + 30, y, pw - 60, 48, label, { disabled, align: "left", right: s ? `${s.credits} CR` : "" })) {
        if (this.slotMode === "new" && s) this.confirmSlot = i;
        else this.app.slotPicked(i, this.slotMode === "new");
      }
      y += 62;
    }
    if (this.button(g, "back", cx - 90, y + 14, 180, 42, STR.menu.back)) { this.app.sfx("uiBack"); this.go("menu"); }
  }

  drawDifficulty(g, w, h) {
    this.menuBackdrop(g, w, h);
    const cx = w / 2;
    const pw = Math.min(460, w - 40);
    this.panel(g, cx - pw / 2, 90, pw, 380, STR.chooseDifficulty);
    let y = 160;
    for (const d of ["easy", "normal", "hard", "nightmare"]) {
      if (this.button(g, d, cx - pw / 2 + 40, y, pw - 80, 48, STR.difficulty[d])) this.app.difficultyPicked(d);
      y += 62;
    }
    if (this.button(g, "back", cx - 90, y + 8, 180, 42, STR.menu.back)) { this.app.sfx("uiBack"); this.go("slots"); }
  }

  drawIntro(g, w, h) {
    g.fillStyle = "#05040f"; g.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const slide = this.introIdx;
    // procedural cinematic vignettes
    g.save();
    g.translate(cx, cy - 40);
    const pul = Math.sin(this.t * 2) * 0.5 + 0.5;
    if (slide === 0) {
      // Earth + ominous signal rings
      g.drawImage(this.app.earthImg, -140, -140, 280, 280);
      g.strokeStyle = `rgba(255,90,209,${0.5 - 0.3 * pul})`;
      g.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        g.beginPath(); g.arc(240, -120, 30 + i * 34 + pul * 20, 0, Math.PI * 2); g.stroke();
      }
      g.fillStyle = PAL.magenta;
      g.beginPath(); g.arc(240, -120, 7, 0, 7); g.fill();
    } else if (slide === 1) {
      g.drawImage(this.app.earthImg, -160, -120, 240, 240);
      // drone swarm silhouettes + fires
      for (let i = 0; i < 8; i++) {
        const a = i * 0.8 + this.t * 0.6;
        g.drawImage(this.atlas.drone, -40 + Math.cos(a) * (160 + i * 12) - 14, Math.sin(a) * (90 + i * 8) - 14, 28, 28);
      }
      g.save(); g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 5; i++) {
        const fx = -160 + 60 * i + Math.sin(this.t * 3 + i) * 4;
        const fg = g.createRadialGradient(fx, 40, 2, fx, 40, 26 + pul * 8);
        fg.addColorStop(0, "rgba(255,140,60,0.8)"); fg.addColorStop(1, "rgba(255,60,30,0)");
        g.fillStyle = fg; g.fillRect(fx - 30, 6, 60, 70);
      }
      g.restore();
    } else if (slide === 2) {
      // construction: rocket in scaffold with welding sparks
      g.strokeStyle = "rgba(125,224,255,0.35)"; g.lineWidth = 2;
      g.strokeRect(-90, -130, 180, 260);
      for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(-90, -130 + i * 52); g.lineTo(90, -130 + i * 52); g.stroke(); }
      g.drawImage(this.atlas.hero, -64, -84, 128, 128);
      g.save(); g.globalCompositeOperation = "lighter";
      const sx = Math.sin(this.t * 7) * 60, sy2 = Math.cos(this.t * 5) * 80;
      const sg = g.createRadialGradient(sx, sy2, 1, sx, sy2, 14);
      sg.addColorStop(0, "rgba(255,255,255,0.95)"); sg.addColorStop(1, "rgba(125,224,255,0)");
      g.fillStyle = sg; g.fillRect(sx - 16, sy2 - 16, 32, 32);
      g.restore();
    } else {
      // launch
      const ry = 60 - this.t * 30 % 220;
      g.save(); g.globalCompositeOperation = "lighter";
      const fl = g.createRadialGradient(0, ry + 70, 4, 0, ry + 70, 90);
      fl.addColorStop(0, "rgba(255,200,120,0.95)"); fl.addColorStop(1, "rgba(255,120,40,0)");
      g.fillStyle = fl; g.fillRect(-80, ry, 160, 220);
      g.restore();
      g.drawImage(this.atlas.hero, -56, ry - 56, 112, 112);
      g.fillStyle = "rgba(180,200,255,0.5)";
      for (let i = 0; i < 12; i++) g.fillRect((fxRng.next() - 0.5) * 300, ((this.t * 500 + i * 60) % 500) - 250, 2, 14);
    }
    g.restore();

    // caption
    g.fillStyle = "#dfe7ff";
    g.font = `19px ${FONT}`;
    g.textAlign = "center";
    wrapText(g, STR.intro[slide], cx, h - 130, Math.min(640, w - 60), 26);
    g.fillStyle = "#7d8bb5"; g.font = `13px ${FONT}`;
    g.fillText(`${slide + 1} / ${STR.intro.length}`, cx, h - 40);
    if (this.button(g, "next", cx + 120, h - 76, 130, 40, slide < STR.intro.length - 1 ? "▶" : STR.results.tapToContinue)) this.advanceIntro();
    if (this.button(g, "skip", cx - 250, h - 76, 110, 40, "SKIP")) this.app.introDone();
    if (input.clicks.length === 0 && input.pressed("navOk")) this.advanceIntro();
  }

  advanceIntro() {
    this.introIdx++;
    this.app.sfx("ui");
    if (this.introIdx >= STR.intro.length) this.app.introDone();
  }

  drawMap(g, w, h, profile) {
    this.menuBackdrop(g, w, h);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#eaf6ff"; g.font = `bold ${Math.min(30, w * 0.055)}px ${FONT}`;
    const mtw = g.measureText(STR.map.title).width;
    g.fillText(STR.map.title, Math.max(w / 2, 140 + mtw / 2), 40);

    const cleared = profile.planetsCleared;
    const maxIdx = PLANETS.length - 1;
    const visible = profile.hiddenUnlocked ? 11 : 10;
    // winding path layout
    const cols = Math.min(5, Math.max(3, Math.floor(w / 190)));
    const cellW = Math.min(180, (w - 60) / cols);
    const startX = w / 2 - (cols * cellW) / 2 + cellW / 2;
    const rows = Math.ceil(visible / cols);
    const cellH = Math.min(120, (h - 240) / rows);
    // connecting line
    g.save();
    g.strokeStyle = "rgba(125,224,255,0.3)"; g.lineWidth = 2; g.setLineDash([5, 7]);
    g.beginPath();
    for (let i = 0; i < visible; i++) {
      const { x, y } = nodePos(i);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke(); g.setLineDash([]);
    g.restore();

    for (let i = 0; i < visible; i++) {
      const { x, y } = nodePos(i);
      const done = cleared.includes(i);
      const unlocked = i === 0 || cleared.includes(i - 1) || done || (i === 10 && profile.hiddenUnlocked);
      const idx = this.widgets.length;
      this.widgets.push({ id: "p" + i, x: x - 34, y: y - 34, w: 68, h: 68, disabled: !unlocked });
      const focused = this.focus === idx;
      const hover = Math.hypot(input.mouse.x - x, input.mouse.y - y) < 38;
      if (hover && input.mouse.moved) this.focus = idx;
      const hue = PLANETS[i].hue;
      g.save();
      if (!unlocked) g.globalAlpha = 0.3;
      const gr = g.createRadialGradient(x - 8, y - 8, 3, x, y, 26);
      gr.addColorStop(0, `hsl(${hue},60%,62%)`);
      gr.addColorStop(1, `hsl(${hue},65%,22%)`);
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, 24, 0, 7); g.fill();
      if (focused || hover) {
        g.strokeStyle = PAL.cyan; g.lineWidth = 2.5;
        g.beginPath(); g.arc(x, y, 30 + Math.sin(this.t * 5) * 2, 0, 7); g.stroke();
      }
      if (done) {
        g.strokeStyle = PAL.gold; g.lineWidth = 2;
        g.beginPath(); g.arc(x, y, 28, 0, 7); g.stroke();
        g.fillStyle = PAL.gold; g.font = `bold 13px ${FONT}`;
        g.fillText("✓", x + 20, y - 20);
      }
      g.fillStyle = unlocked ? "#dfe7ff" : "#5d6890";
      g.font = `bold ${Math.min(12, cellW * 0.085)}px ${FONT}`;
      // stagger label rows on tight grids so neighbours don't collide
      const stag = cellW < 150 ? (i % 2) * 13 : 0;
      g.fillText(STR.planets[i].name, x, y + 42 + stag);
      g.restore();
      if (this._clicked(idx, !unlocked)) { this.mapSel = i; }
    }

    // selected planet briefing
    const sel = Math.min(this.mapSel, visible - 1);
    const narrow = w < 560;
    const pw = Math.min(680, w - 30);
    const ph = narrow ? (w < 330 ? 196 : 158) : 116;
    const py = h - ph - 34;
    this.panel(g, w / 2 - pw / 2, py, pw, ph);
    g.fillStyle = PAL.cyan; g.font = `bold ${Math.min(18, pw * 0.055)}px ${FONT}`; g.textAlign = "left";
    const clearedSel = cleared.includes(sel);
    g.fillText(`${sel + 1}. ${STR.planets[sel].name}` + (clearedSel ? `  — ${STR.map.cleared}` : ""), w / 2 - pw / 2 + 20, py + 24);
    g.fillStyle = "#aebadd"; g.font = `14px ${FONT}`;
    wrapText(g, STR.planets[sel].brief, w / 2 - pw / 2 + 20, py + 48, narrow ? pw - 40 : pw - 220, 18, "left");
    if (narrow) {
      if (this.button(g, "launch", w / 2 - 90, py + ph - 56, 180, 44, STR.map.launch)) this.app.launchStory(sel);
    } else {
      if (this.button(g, "launch", w / 2 + pw / 2 - 180, py + 34, 160, 48, STR.map.launch)) this.app.launchStory(sel);
    }
    if (this.button(g, "back", 20, 20, 110, 40, STR.menu.back)) { this.app.sfx("uiBack"); this.go("menu"); }
    if (!profile.hiddenUnlocked) {
      g.fillStyle = "#68d"; g.font = `italic ${Math.min(12, w * 0.032)}px ${FONT}`; g.textAlign = "center";
      g.fillText(STR.map.hiddenHint + ` (${profile.artifacts}/3)`, w / 2, h - 10);
    }

    function nodePos(i) {
      const r = Math.floor(i / cols);
      let c = i % cols;
      if (r % 2 === 1) c = cols - 1 - c;   // serpentine
      return { x: startX + c * cellW, y: 110 + r * cellH };
    }
  }

  drawHangar(g, w, h, profile) {
    this.menuBackdrop(g, w, h);
    const pw = Math.min(760, w - 20);
    const px = w / 2 - pw / 2;
    this.panel(g, px, 14, pw, h - 28, STR.upgrades.title);
    g.textAlign = "left";
    g.fillStyle = PAL.gold; g.font = `bold 15px ${FONT}`;
    g.fillText(`${profile.credits} ${STR.hud.credits}`, px + 20, 68);
    g.fillStyle = PAL.magenta;
    g.fillText(`◆ ${profile.crystals}`, px + 150, 68);

    // ship preview (only when there is room for it)
    const narrow = w < 560;
    if (!narrow) {
      const prX = px + pw - 90, prY = 120;
      g.save();
      g.translate(prX, prY);
      g.rotate(Math.sin(this.t * 0.8) * 0.15);
      g.drawImage(this.atlas.hero, -44, -44, 88, 88);
      g.restore();
    }

    const listX = px + 16;
    let y = 88;
    const rowH = Math.min(37, (h - 320) / UPGRADES.length);
    const btnW = narrow ? 96 : 110;
    const btnX = px + pw - btnW - 14;
    const pipSp = narrow ? 13 : 16, pipSz = narrow ? 9 : 12;
    for (const u of UPGRADES) {
      const lvl = profile.upgrades[u.id] || 0;
      const cost = upgradeCost(u.id, lvl);
      const maxed = lvl >= u.max;
      const afford = profile.credits >= cost;
      const pipsX = btnX - 12 - u.max * pipSp;
      g.fillStyle = "#dfe7ff"; g.font = `bold ${narrow ? 11 : 14}px ${FONT}`; g.textAlign = "left";
      g.fillText(STR.upgrades[u.id], listX, y + 14);
      for (let i = 0; i < u.max; i++) {
        g.fillStyle = i < lvl ? PAL.cyan : "rgba(125,224,255,0.18)";
        g.fillRect(pipsX + i * pipSp, y + 8, pipSz, pipSz);
      }
      const bLabel = maxed ? STR.upgrades.max : `${cost} CR`;
      if (this.button(g, "u_" + u.id, btnX, y, btnW, 26, bLabel, { size: narrow ? 11 : 13, disabled: maxed || !afford })) {
        this.app.buyUpgrade(u.id, cost);
      }
      y += rowH;
    }
    // skins
    y += 6;
    g.fillStyle = PAL.cyan; g.font = `bold 15px ${FONT}`;
    g.fillText(STR.upgrades.skins, listX, y + 8); y += 22;
    let sx2 = listX;
    for (const s of SKINS) {
      const owned = profile.skins.includes(s.id);
      const equipped = profile.skin === s.id;
      const label = STR.skins[s.id];
      const bw2 = 132;
      if (this.button(g, "s_" + s.id, sx2, y, bw2, 30, equipped ? "● " + label : label, { size: 12, disabled: !owned })) {
        this.app.equipSkin(s.id);
      }
      if (!owned) {
        g.fillStyle = "#7d8bb5"; g.font = `10px ${FONT}`; g.textAlign = "center";
        const hintKey = "skinHint" + s.id[0].toUpperCase() + s.id.slice(1);
        g.fillText(STR.skins[hintKey] || STR.upgrades.locked, sx2 + bw2 / 2, y + 42);
      }
      sx2 += bw2 + 10;
      if (sx2 + bw2 > px + pw - 20) { sx2 = listX; y += 56; }
    }
    if (this.button(g, "back", px + pw - 140, h - 70, 120, 40, STR.menu.back)) { this.app.sfx("uiBack"); this.go("menu"); }
  }

  drawAchievements(g, w, h, profile) {
    this.menuBackdrop(g, w, h);
    const pw = Math.min(620, w - 20);
    const px = w / 2 - pw / 2;
    this.panel(g, px, 14, pw, h - 28, STR.ach.title);
    let y = 78;
    const keys = Object.keys(STR.ach).filter((k) => typeof STR.ach[k] === "object");
    for (const k of keys) {
      const got = profile.achievements.includes(k);
      g.save();
      g.globalAlpha = got ? 1 : 0.45;
      g.fillStyle = got ? PAL.gold : "#8892b8";
      g.font = `bold 15px ${FONT}`; g.textAlign = "left";
      g.fillText((got ? "★ " : "☆ ") + STR.ach[k].name, px + 30, y);
      g.fillStyle = "#aebadd"; g.font = `12px ${FONT}`;
      g.fillText(STR.ach[k].desc, px + 240, y);
      g.restore();
      y += Math.min(34, (h - 160) / keys.length);
    }
    if (this.button(g, "back", w / 2 - 60, h - 64, 120, 40, STR.menu.back)) { this.app.sfx("uiBack"); this.go("menu"); }
  }

  drawSettings(g, w, h) {
    this.menuBackdrop(g, w, h);
    const pw = Math.min(480, w - 30);
    const px = w / 2 - pw / 2;
    this.panel(g, px, 80, pw, 360, STR.menu.settings);
    const s = this.app.settings;
    let y = 150;
    for (const [key, label] of [["music", STR.settings.music], ["sfx", STR.settings.sfx]]) {
      g.fillStyle = "#dfe7ff"; g.font = `bold 15px ${FONT}`; g.textAlign = "left";
      g.fillText(label, px + 34, y);
      if (this.button(g, key + "-", px + 200, y - 16, 36, 32, "−")) { s[key] = Math.max(0, Math.round((s[key] - 0.1) * 10) / 10); this.app.settingsChanged(); }
      // bar
      g.fillStyle = "rgba(125,224,255,0.2)"; g.fillRect(px + 246, y - 8, 120, 14);
      g.fillStyle = PAL.cyan; g.fillRect(px + 246, y - 8, 120 * s[key], 14);
      if (this.button(g, key + "+", px + 376, y - 16, 36, 32, "+")) { s[key] = Math.min(1, Math.round((s[key] + 0.1) * 10) / 10); this.app.settingsChanged(); }
      y += 62;
    }
    for (const [key, label] of [["shake", STR.settings.shake], ["reducedFlash", STR.settings.flash]]) {
      g.fillStyle = "#dfe7ff"; g.font = `bold 15px ${FONT}`; g.textAlign = "left";
      g.fillText(label, px + 34, y);
      if (this.button(g, key, px + 246, y - 16, 120, 32, s[key] ? STR.settings.on : STR.settings.off)) { s[key] = !s[key]; this.app.settingsChanged(); }
      y += 62;
    }
    if (this.button(g, "back", w / 2 - 60, y + 4, 120, 40, STR.menu.back)) {
      this.app.sfx("uiBack");
      const ret = this.pauseReturn ? "pause" : "menu";
      this.pauseReturn = false;
      this.go(ret);
    }
  }

  drawControls(g, w, h) {
    this.menuBackdrop(g, w, h);
    const pw = Math.min(520, w - 30);
    const px = w / 2 - pw / 2;
    this.panel(g, px, 60, pw, Math.min(430, h - 110), STR.controls.title);
    const lines = [STR.controls.move, STR.controls.aim, STR.controls.fire, STR.controls.missile, STR.controls.boost, STR.controls.dodge, STR.controls.special, STR.controls.swap, STR.controls.pause];
    let y = 130;
    g.font = `14px ${FONT}`; g.textAlign = "left";
    for (const l of lines) {
      g.fillStyle = "#c9d6f2";
      g.fillText(l, px + 36, y);
      y += Math.min(34, (h - 240) / lines.length);
    }
    if (this.button(g, "back", w / 2 - 60, y + 10, 120, 40, STR.menu.back)) { this.app.sfx("uiBack"); this.go("menu"); }
  }

  // ---------- HUD ----------
  drawHUD(g, w, h, game, profile) {
    if (!game) return;
    const p = game.player, st = game.stats;
    // bars top-left
    const bx = 16, bw = Math.min(230, w * 0.3);
    bar(g, bx, 14, bw, 13, p.hull / st.maxHull, "#ff5a6e", STR.hud.hull);
    bar(g, bx, 33, bw * 0.85, 10, p.shield / st.maxShield, PAL.cyan, STR.hud.shield);
    bar(g, bx, 49, bw * 0.7, 8, p.energy / st.maxEnergy, PAL.gold, STR.hud.energy);
    // weapon + missiles
    const unlocked = game.unlockedWeapons();
    const wdef = unlocked[p.weapon] || unlocked[0];
    g.textAlign = "left"; g.textBaseline = "middle";
    g.fillStyle = wdef.color || PAL.cyan;
    g.font = `bold 14px ${FONT}`;
    g.fillText(STR.weapons[wdef.key], bx, 76);
    g.fillStyle = "#ffb35c";
    g.fillText(`${STR.hud.missiles} ${"▮".repeat(p.missiles)}${"▯".repeat(Math.max(0, st.missileMax - p.missiles))}`, bx, 95);
    // score / combo top-center
    g.textAlign = "center";
    g.fillStyle = "#eaf6ff"; g.font = `bold 22px ${FONT}`;
    g.fillText(String(game.score), w / 2, 22);
    if (game.combo > 1) {
      const s = 1 + Math.min(0.5, (game.comboT > 2.6 ? 0.4 : 0));
      g.save();
      g.translate(w / 2, 48);
      g.scale(s, s);
      g.fillStyle = game.combo >= 8 ? PAL.magenta : PAL.gold;
      g.font = `bold 17px ${FONT}`;
      g.fillText(`x${game.combo} ${STR.hud.combo}`, 0, 0);
      g.restore();
      // combo timer sliver
      g.fillStyle = "rgba(255,215,92,0.5)";
      g.fillRect(w / 2 - 40, 60, 80 * (game.comboT / 3), 3);
    }
    // objective + wave (top on touch so it stays clear of the thumb zones)
    g.fillStyle = "#9fb2dd"; g.font = `13px ${FONT}`;
    g.fillText(this.objectiveText(game), w / 2, input.touchActive ? 146 : h - 20);
    // credits
    g.textAlign = "right";
    g.fillStyle = PAL.gold; g.font = `bold 15px ${FONT}`;
    g.fillText(`+${game.creditsEarned} ${STR.hud.credits}`, w - 16, h - 36);
    g.fillStyle = PAL.magenta;
    g.fillText(`◆ ${game.crystalsEarned}`, w - 16, h - 16);

    // radar top-right
    this.drawRadar(g, w, h, game);

    // boss bar
    if (game.boss && !game.boss.entering) {
      const b = game.boss;
      const bwid = Math.min(460, w - 120);
      const bxx = w / 2 - bwid / 2, byy = h - 54;
      g.fillStyle = "rgba(10,10,26,0.7)";
      chamfer(g, bxx - 8, byy - 20, bwid + 16, 40, 8); g.fill();
      g.fillStyle = PAL.magenta; g.font = `bold 13px ${FONT}`; g.textAlign = "center";
      g.fillText(STR.bosses[b.idx] || "BOSS", w / 2, byy - 8);
      g.fillStyle = "rgba(255,90,209,0.25)";
      g.fillRect(bxx, byy, bwid, 10);
      g.fillStyle = PAL.magenta;
      g.fillRect(bxx, byy, bwid * Math.max(0, b.hp / b.maxHp), 10);
      // phase ticks
      g.fillStyle = "rgba(255,255,255,0.6)";
      for (let i = 1; i < b.def.phases; i++) g.fillRect(bxx + bwid * (i / b.def.phases), byy, 1.5, 10);
    }

    // powerup buff timers
    let py = input.touchActive ? 160 : 118;
    for (const [k, v] of Object.entries(p.buffs)) {
      if (v <= 0) continue;
      g.textAlign = "left";
      g.fillStyle = PAL.cyan; g.font = `bold 12px ${FONT}`;
      g.fillText(`${STR.powerups[k] || k}: ${Math.ceil(v)}s`, bx, py);
      py += 17;
    }

    // banners
    if (game.state === "bossWarn") {
      g.save();
      g.globalAlpha = 0.75 + Math.sin(this.t * 8) * 0.25;
      g.fillStyle = "rgba(80,10,20,0.5)";
      g.fillRect(0, h / 2 - 42, w, 84);
      g.fillStyle = "#ff6a7a"; g.font = `bold ${Math.min(26, w * 0.045)}px ${FONT}`; g.textAlign = "center";
      g.fillText(STR.hud.bossWarning, w / 2, h / 2);
      g.restore();
    }
    if (game.state === "flyin" && game.mode === "story") {
      g.fillStyle = "#eaf6ff"; g.font = `bold ${Math.min(30, w * 0.05)}px ${FONT}`; g.textAlign = "center";
      g.fillText(STR.planets[game.planet].name, w / 2, h * 0.3);
      g.fillStyle = "#9fb2dd"; g.font = `15px ${FONT}`;
      wrapText(g, STR.planets[game.planet].brief, w / 2, h * 0.3 + 34, Math.min(560, w - 60), 20);
    }
    if (game.state === "wave" && game.stateT < 1.6) {
      g.globalAlpha = Math.min(1, (1.6 - game.stateT));
      g.fillStyle = PAL.cyan; g.font = `bold 24px ${FONT}`; g.textAlign = "center";
      g.fillText(`${STR.hud.wave} ${game.mode === "endless" ? game.endlessWave : game.waveIdx + 1}`, w / 2, h * 0.26);
      g.globalAlpha = 1;
    }
    // tutorial hints on planet 1
    if (game.mode === "story" && game.planet === 0 && game.pdef.tutorial && game.time < 30) {
      g.fillStyle = "rgba(159,178,221,0.9)"; g.font = `13px ${FONT}`; g.textAlign = "center";
      const hints = input.touchActive
        ? ["Left thumb: MOVE — Right thumb: AIM & FIRE", "Buttons: BOOST · DODGE · EMP · MISSILES"]
        : [STR.controls.move, STR.controls.fire + "   ·   " + STR.controls.boost + "   ·   " + STR.controls.dodge];
      g.fillText(hints[Math.floor(game.time / 6) % hints.length], w / 2, h * 0.7);
    }

    // touch controls
    if (input.touchActive) this.drawTouchControls(g, w, h);

    // low hull vignette
    if (p.alive && p.hull / st.maxHull < 0.3) {
      g.save();
      g.globalAlpha = 0.25 + Math.sin(this.t * 5) * 0.15;
      const gr = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.8);
      gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(255,30,50,0.5)");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.restore();
    }
  }

  objectiveText(game) {
    if (game.state === "boss") return `${STR.hud.objective}: ${STR.objectives.boss}`;
    if (game.state === "bossWarn") return STR.objectives.approach;
    if (game.mode === "endless") return `${STR.hud.objective}: ${STR.objectives.survive} — ${STR.hud.wave} ${game.endlessWave}`;
    if (game.mode === "bossrush") return `${STR.hud.objective}: ${STR.objectives.boss} ${game.rushIdx + 1}/10`;
    const total = game.pdef.waves.length;
    return `${STR.hud.objective}: ${STR.objectives.clearWaves} (${Math.min(game.waveIdx + 1, total)}/${total})`;
  }

  drawRadar(g, w, h, game) {
    const R = Math.min(64, w * 0.09), cx = w - R - 14, cy = R + 14;
    g.save();
    g.globalAlpha = 0.85;
    g.fillStyle = "rgba(8,10,26,0.7)";
    g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    g.strokeStyle = "rgba(125,224,255,0.4)"; g.lineWidth = 1;
    g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
    g.beginPath(); g.arc(cx, cy, R * 0.55, 0, 7); g.stroke();
    // sweep
    const sa = this.t * 1.8;
    g.strokeStyle = "rgba(125,224,255,0.5)";
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(sa) * R, cy + Math.sin(sa) * R); g.stroke();
    const scale = R / 1500;
    const p = game.player;
    for (const b of game.radarBlips(this.radarOut)) {
      const dx = (b.x - p.x) * scale, dy = (b.y - p.y) * scale;
      const d = Math.hypot(dx, dy);
      if (d > R - 3) continue;
      g.fillStyle = b.k === 1 ? PAL.magenta : b.k === 2 ? PAL.gold : "#ff7a7a";
      const s = b.k === 1 ? 4 : 2.2;
      g.fillRect(cx + dx - s / 2, cy + dy - s / 2, s, s);
    }
    g.fillStyle = PAL.cyan;
    g.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    g.restore();
  }

  drawTouchControls(g, w, h) {
    // register buttons for input
    const br = 26;
    const bx = w - 54, by = h - 210;
    const btns = [
      { id: "boost", x: bx, y: by, r: br, label: "BST", color: PAL.gold },
      { id: "dodge", x: bx - 62, y: by + 40, r: br, label: "DDG", color: PAL.cyan },
      { id: "special", x: bx, y: by + 80, r: br, label: "EMP", color: PAL.magenta },
      { id: "missile", x: bx - 62, y: by + 120, r: br, label: "MSL", color: "#ffb35c" },
      { id: "pause", x: 30, y: 118, r: 18, label: "❚❚", color: "#9fb2dd" },
    ];
    input.setTouchButtons(btns);
    g.save();
    g.globalAlpha = 0.55;
    for (const b of btns) {
      g.fillStyle = "rgba(14,18,40,0.8)";
      g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.fill();
      g.strokeStyle = b.color; g.lineWidth = 1.5;
      g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.stroke();
      g.fillStyle = b.color; g.font = `bold 11px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(b.label, b.x, b.y);
    }
    // stick visuals
    const mv = input.moveStickTouch();
    if (mv) {
      g.strokeStyle = PAL.cyan;
      g.beginPath(); g.arc(mv.anchorX, mv.anchorY, 40, 0, 7); g.stroke();
      g.fillStyle = "rgba(125,224,255,0.5)";
      const dx = clampMag(mv.x - mv.anchorX, 40), dy = clampMag(mv.y - mv.anchorY, 40);
      g.beginPath(); g.arc(mv.anchorX + dx, mv.anchorY + dy, 16, 0, 7); g.fill();
    }
    const am = input.aimStickTouch();
    if (am) {
      g.strokeStyle = PAL.magenta;
      g.beginPath(); g.arc(am.anchorX, am.anchorY, 40, 0, 7); g.stroke();
      g.fillStyle = "rgba(255,90,209,0.5)";
      const dx = clampMag(am.x - am.anchorX, 40), dy = clampMag(am.y - am.anchorY, 40);
      g.beginPath(); g.arc(am.anchorX + dx, am.anchorY + dy, 16, 0, 7); g.fill();
    }
    g.restore();
  }

  drawPause(g, w, h) {
    g.fillStyle = "rgba(4,4,14,0.78)";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#eaf6ff"; g.font = `bold 34px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(STR.hud.paused, w / 2, h * 0.24);
    const bw = 260, bh = 46;
    let y = h * 0.36;
    if (this.button(g, "resume", w / 2 - bw / 2, y, bw, bh, STR.hud.resume)) this.app.resumeMission(); y += 60;
    if (this.button(g, "restart", w / 2 - bw / 2, y, bw, bh, STR.hud.restart)) this.app.restartMission(); y += 60;
    if (this.button(g, "settings", w / 2 - bw / 2, y, bw, bh, STR.menu.settings)) { this.pauseReturn = true; this.go("settings"); } y += 60;
    if (this.button(g, "quit", w / 2 - bw / 2, y, bw, bh, STR.hud.quit)) this.app.quitMission();
  }

  drawResults(g, w, h, profile) {
    const r = this.results;
    if (!r) return;
    g.fillStyle = "rgba(4,4,14,0.82)";
    g.fillRect(0, 0, w, h);
    const win = r.outcome === "victory";
    g.save();
    g.shadowColor = win ? PAL.cyan : "#ff5a6e"; g.shadowBlur = 22;
    g.fillStyle = win ? "#d8fbff" : "#ffb9c2";
    g.font = `bold ${Math.min(44, w * 0.07)}px ${FONT}`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(r.title, w / 2, h * 0.2);
    g.restore();
    const lines = r.lines;
    g.font = `${w < 460 ? 14 : 17}px ${FONT}`;
    const splitX = Math.max(w / 2, w * 0.55);
    let y = h * 0.32;
    for (const [label, val, color] of lines) {
      g.textAlign = "right"; g.fillStyle = "#9fb2dd";
      g.fillText(label, splitX - 12, y);
      g.textAlign = "left"; g.fillStyle = color || "#eaf6ff";
      g.fillText(String(val), splitX + 12, y);
      y += 30;
    }
    if (r.perfect) {
      g.textAlign = "center"; g.fillStyle = PAL.gold; g.font = `bold 17px ${FONT}`;
      g.fillText(STR.results.perfect, w / 2, y + 6); y += 30;
    }
    if (r.record) {
      g.textAlign = "center"; g.fillStyle = PAL.magenta; g.font = `bold 17px ${FONT}`;
      g.fillText(STR.results.newRecord, w / 2, y + 6); y += 30;
    }
    const bw = 230;
    y = Math.min(h - 70, y + 30);
    if (win || r.mode !== "story") {
      if (this.button(g, "cont", w / 2 - bw / 2, y, bw, 48, STR.results.tapToContinue)) this.app.resultsContinue();
    } else {
      if (this.button(g, "retry", w / 2 - bw - 8, y, bw, 48, STR.results.retry)) this.app.retryMission();
      if (this.button(g, "cont", w / 2 + 8, y, bw, 48, STR.results.tapToContinue)) this.app.resultsContinue();
    }
  }

  drawEnding(g, w, h, profile) {
    g.fillStyle = "#05040f"; g.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2 - 30;
    const slide = this.endingIdx;
    g.save();
    g.translate(cx, cy);
    if (slide === 0) {
      // emperor flagship exploding
      g.save(); g.globalAlpha = 0.9;
      g.drawImage(this.atlas.bossMech, -130, -130, 260, 260);
      g.restore();
      g.save(); g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 6; i++) {
        const a = this.t * 2 + i * 1.1;
        const x = Math.cos(a) * 70, y = Math.sin(a * 1.3) * 60;
        const fg = g.createRadialGradient(x, y, 2, x, y, 30 + Math.sin(this.t * 6 + i) * 12);
        fg.addColorStop(0, "rgba(255,220,160,0.95)"); fg.addColorStop(1, "rgba(255,100,40,0)");
        g.fillStyle = fg; g.fillRect(x - 45, y - 45, 90, 90);
      }
      g.restore();
    } else if (slide === 1) {
      // fleets adrift — dark ships, dead cores
      for (let i = 0; i < 7; i++) {
        g.save();
        g.globalAlpha = 0.5;
        g.translate(-200 + i * 66, Math.sin(i * 2.4) * 70);
        g.rotate(i);
        g.drawImage(this.atlas.heavy, -30, -30, 60, 60);
        g.restore();
      }
    } else if (slide === 2) {
      g.drawImage(this.app.earthImg, -140, -140, 280, 280);
      g.save(); g.globalCompositeOperation = "lighter";
      const fg = g.createRadialGradient(0, 0, 100, 0, 0, 200);
      fg.addColorStop(0, "rgba(125,224,255,0.0)"); fg.addColorStop(0.8, "rgba(125,224,255,0.15)"); fg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = fg; g.fillRect(-220, -220, 440, 440);
      g.restore();
    } else {
      g.drawImage(this.atlas.hero, -56, -76, 112, 112);
      g.fillStyle = "rgba(180,200,255,0.4)";
      for (let i = 0; i < 14; i++) g.fillRect((fxRng.next() - 0.5) * 400, ((this.t * 300 + i * 46) % 400) - 200, 1.5, 10);
    }
    g.restore();
    g.fillStyle = "#dfe7ff"; g.font = `19px ${FONT}`; g.textAlign = "center";
    wrapText(g, STR.ending[slide], cx, h - 150, Math.min(640, w - 60), 26);
    if (slide === STR.ending.length - 1) {
      g.fillStyle = PAL.gold; g.font = `bold 20px ${FONT}`;
      g.fillText(`${STR.endingStats} — ${STR.results.score}: ${profile ? profile.stats.lastCampaignScore || "" : ""}`, cx, h - 110);
      if (this.button(g, "ng", cx - 250, h - 76, 230, 44, STR.menu.ngPlus)) this.app.startNgPlus();
      if (this.button(g, "done", cx + 20, h - 76, 230, 44, STR.results.tapToContinue)) this.app.endingDone();
    } else {
      if (this.button(g, "next", cx - 65, h - 76, 130, 40, "▶")) { this.endingIdx++; this.app.sfx("ui"); }
    }
  }

  drawToasts(g, w, h) {
    let y = 90;
    for (const t of this.toasts) {
      const a = Math.min(1, t.t) * Math.min(1, (3.2 - t.t) * 3);
      g.save();
      g.globalAlpha = a;
      g.fillStyle = "rgba(12,16,38,0.9)";
      g.strokeStyle = PAL.gold;
      const tw = Math.min(360, w - 40);
      chamfer(g, w / 2 - tw / 2, y, tw, t.sub ? 52 : 34, 8);
      g.fill(); g.stroke();
      g.fillStyle = PAL.gold; g.font = `bold 14px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(t.text, w / 2, y + 18);
      if (t.sub) {
        g.fillStyle = "#c9d6f2"; g.font = `12px ${FONT}`;
        g.fillText(t.sub, w / 2, y + 37);
      }
      g.restore();
      y += t.sub ? 60 : 42;
    }
  }
}

// ---------- helpers ----------
function chamfer(g, x, y, w, h, c) {
  g.beginPath();
  g.moveTo(x + c, y);
  g.lineTo(x + w - c, y);
  g.lineTo(x + w, y + c);
  g.lineTo(x + w, y + h - c);
  g.lineTo(x + w - c, y + h);
  g.lineTo(x + c, y + h);
  g.lineTo(x, y + h - c);
  g.lineTo(x, y + c);
  g.closePath();
}

function bar(g, x, y, w, h, frac, color, label) {
  g.save();
  g.fillStyle = "rgba(8,10,26,0.7)";
  g.fillRect(x - 2, y - 2, w + 4, h + 4);
  g.fillStyle = "rgba(255,255,255,0.08)";
  g.fillRect(x, y, w, h);
  g.fillStyle = color;
  g.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  g.fillStyle = "rgba(255,255,255,0.75)";
  g.font = `bold 8px "Rajdhani", sans-serif`;
  g.textAlign = "left"; g.textBaseline = "middle";
  g.fillText(label, x + 3, y + h / 2 + 0.5);
  g.restore();
}

function wrapText(g, text, x, y, maxW, lineH, align = "center") {
  const words = text.split(" ");
  let line = "", yy = y;
  g.textAlign = align;
  for (const wd of words) {
    const test = line ? line + " " + wd : wd;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, yy);
      line = wd; yy += lineH;
    } else line = test;
  }
  if (line) g.fillText(line, x, yy);
}

function clampMag(v, m) { return Math.max(-m, Math.min(m, v)); }
