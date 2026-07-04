// App orchestrator: loop, screens, profiles, achievements, audio routing.
import { STR } from "../strings.js";
import { buildAtlas, planetSprite, vignette } from "./art.js";
import { Game, derivedStats, upgradeCost } from "./game.js";
import { UI } from "./ui.js";
import { input } from "./input.js";
import { save, loadSettings, storeSettings } from "./save.js";
import { initAudio, resumeAudio, playMusic, stopMusic, setVolumes, SFX } from "./audio.js";
import { SKINS, WEAPONS, PERF } from "./data.js";

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
let W = innerWidth, H = innerHeight;

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, PERF.dprCap);
  W = innerWidth; H = innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + "px"; canvas.style.height = H + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  vig = vignette(W, H);
}
addEventListener("resize", resize);
addEventListener("orientationchange", resize);

// ---------- app state ----------
const settings = loadSettings();
let profile = null;
let activeSlot = -1;
let game = null;
let missionOpts = null;
let resultsShown = false;
let vig = null;

const app = {
  settings,
  earthImg: planetSprite(210),

  firstInteract() {
    initAudio(settings);
    resumeAudio();
    playMusic("menu");
    ui.go("menu");
  },
  sfx(name, arg) { if (SFX[name]) SFX[name](arg); },
  hasAnySave() { return save.slots().some(Boolean); },
  slots() { return save.slots(); },

  menuAction(id) {
    switch (id) {
      case "continue": {
        ui.slotMode = "continue"; ui.go("slots"); break;
      }
      case "new": ui.slotMode = "new"; ui.go("slots"); break;
      case "map": ui.go("map"); break;
      case "endless": this.launch({ mode: "endless", planet: Math.max(1, profile.planetsCleared.length) - 0 }); break;
      case "bossrush": this.launch({ mode: "bossrush", planet: 9 }); break;
      case "hangar": ui.go("hangar"); break;
      case "ach": ui.go("achievements"); break;
      case "settings": ui.pauseReturn = false; ui.go("settings"); break;
      case "controls": ui.go("controls"); break;
    }
  },

  slotPicked(i, isNew) {
    activeSlot = i;
    if (isNew || !save.get(i)) { ui.pendingDiffSlot = i; ui.go("difficulty"); }
    else { profile = save.get(i); ui.go("map"); }
  },

  difficultyPicked(d) {
    profile = save.create(ui.pendingDiffSlot, d);
    activeSlot = ui.pendingDiffSlot;
    ui.introIdx = 0;
    ui.go("intro");
  },

  introDone() { ui.go("map"); },

  launchStory(planetIdx) { this.launch({ mode: "story", planet: planetIdx }); },

  launch(opts) {
    missionOpts = opts;
    resultsShown = false;
    game = new Game(atlas, emit);
    game.shakeEnabled = settings.shake;
    game.reducedFlash = settings.reducedFlash;
    // rebuild hero sprite for equipped skin
    const skin = SKINS.find((s) => s.id === profile.skin) || SKINS[0];
    atlas.hero = heroForSkin(skin);
    game.startMission(opts, profile);
    playMusic("combat");
    ui.go("mission");
    if (dev) window.__game = game;
  },

  resumeMission() { ui.go("mission"); },
  restartMission() { this.launch(missionOpts); },
  retryMission() { this.launch(missionOpts); },
  quitMission() {
    game = null;
    playMusic("menu");
    ui.go(missionOpts && missionOpts.mode === "story" ? "map" : "menu");
  },

  resultsContinue() {
    if (!ui.results) return;
    const wasStory = missionOpts.mode === "story";
    const planet = missionOpts.planet;
    game = null;
    if (wasStory && ui.results.outcome === "victory") {
      if (planet === 9 && ui.results.firstClear) {
        ui.endingIdx = 0;
        stopMusic();
        SFX.victory();
        ui.go("ending");
        return;
      }
      playMusic("menu");
      ui.go("map");
    } else {
      playMusic("menu");
      ui.go(wasStory ? "map" : "menu");
    }
  },

  startNgPlus() {
    profile.ngPlus++;
    profile.planetsCleared = [];
    save.write(activeSlot, profile);
    playMusic("menu");
    ui.go("map");
  },
  endingDone() { playMusic("menu"); ui.go("menu"); },

  buyUpgrade(id, cost) {
    if (profile.credits < cost) return;
    profile.credits -= cost;
    profile.upgrades[id] = (profile.upgrades[id] || 0) + 1;
    SFX.weaponUp();
    save.write(activeSlot, profile);
  },

  equipSkin(id) {
    if (!profile.skins.includes(id)) return;
    profile.skin = id;
    save.write(activeSlot, profile);
    SFX.ui();
  },

  settingsChanged() {
    setVolumes(settings);
    storeSettings(settings);
    if (game) { game.shakeEnabled = settings.shake; game.reducedFlash = settings.reducedFlash; }
  },
};

// ---------- atlas ----------
import { heroSprite } from "./art.js";
function heroForSkin(skin) { return heroSprite(skin); }
const atlas = buildAtlas(SKINS[0]);
const ui = new UI(atlas, app);

// ---------- achievements ----------
function award(id) {
  if (!profile || profile.achievements.includes(id)) return;
  profile.achievements.push(id);
  ui.toast(STR.ach.unlocked, STR.ach[id] ? STR.ach[id].name : id);
  SFX.weaponUp();
  unlockSkins();
  save.write(activeSlot, profile);
}
function unlockSkins() {
  const grant = (skinId) => { if (!profile.skins.includes(skinId)) { profile.skins.push(skinId); ui.toast(STR.upgrades.skins, STR.skins[skinId]); } };
  if (profile.planetsCleared.length >= 3) grant("crimson");
  if (profile.achievements.includes("combo8")) grant("solar");
  if (profile.achievements.includes("endless10")) grant("void");
  if (profile.achievements.includes("savior")) grant("aurora");
}

// ---------- game events ----------
function emit(type, a, b) {
  switch (type) {
    case "sfx": app.sfx(a, b); break;
    case "music": playMusic(a); break;
    case "bossWarn": SFX.alarm(); break;
    case "bossDown": SFX.bossDown(); if (profile) { profile.stats.bossKills++; } break;
    case "victory": SFX.victory(); break;
    case "defeat": SFX.defeat(); stopMusic(); break;
    case "wave": break;
    case "kill":
      if (!profile) break;
      profile.kills++;
      if (profile.kills === 1) award("firstBlood");
      if (profile.kills >= 100) award("kills100");
      if (profile.kills >= 1000) award("kills1000");
      break;
    case "achieve": award(a); break;
    case "artifact":
      if (!profile) break;
      profile.artifacts++;
      if (profile.artifacts >= 3) {
        if (!profile.hiddenUnlocked) { profile.hiddenUnlocked = true; ui.toast(STR.map.hiddenHint); }
        award("treasure");
      }
      break;
    case "powerup": ui.toast(STR.powerups[a] || a); break;
  }
}

// ---------- mission end ----------
function checkMissionEnd() {
  if (!game || resultsShown) return;
  const done = (game.state === "victory" && game.stateT > 2.4) || (game.state === "defeat" && game.stateT > 2.2);
  if (!done) return;
  resultsShown = true;
  const win = game.state === "victory";
  const mode = missionOpts.mode;
  const creditGain = Math.round(game.creditsEarned * (win ? 1 : 0.6)) + (win && mode === "story" ? 150 + missionOpts.planet * 60 : 0);
  profile.credits += creditGain;
  profile.crystals += game.crystalsEarned;
  profile.stats.missions++;
  profile.stats.bestCombo = Math.max(profile.stats.bestCombo, game.maxCombo);
  if (!win) profile.stats.deaths++;

  const lines = [
    [STR.results.score, game.score],
    [STR.results.kills, game.kills],
    [STR.results.time, fmtTime(game.time)],
    [STR.results.maxCombo, "x" + game.maxCombo],
    [STR.results.creditsEarned, creditGain, "#ffd75c"],
    [STR.results.crystalsEarned, game.crystalsEarned, "#ff5ad1"],
  ];
  let record = false, firstClear = false;

  if (mode === "story" && win) {
    firstClear = !profile.planetsCleared.includes(missionOpts.planet);
    if (firstClear) profile.planetsCleared.push(missionOpts.planet);
    // weapon unlocks by planets cleared
    for (const w of WEAPONS) {
      if (w.unlockPlanet <= profile.planetsCleared.length && !profile.weaponsUnlocked.includes(w.id)) {
        profile.weaponsUnlocked.push(w.id);
        ui.toast(STR.weaponUnlocked, STR.weapons[w.key]);
        SFX.weaponUp();
      }
    }
    if (missionOpts.planet === 0) award("earthSaved");
    if (profile.planetsCleared.length >= 5) award("halfway");
    if (missionOpts.planet === 9) {
      award("savior");
      profile.stats.lastCampaignScore = game.score;
    }
    if (!game.tookDamage) award("noDamage");
    if (game.time < 90) award("speedRun");
  }
  if (mode === "endless") {
    const wave = game.endlessWave;
    if (wave > profile.endlessBestWave) { profile.endlessBestWave = wave; record = true; }
    if (game.score > profile.endlessBestScore) { profile.endlessBestScore = game.score; record = true; }
    if (wave >= 10) award("endless10");
    lines.push([STR.results.bestWave, profile.endlessBestWave]);
    lines.push([STR.results.highScore, profile.endlessBestScore]);
  }
  if (mode === "bossrush" && win) profile.bossRushDone = true;

  unlockSkins();
  save.write(activeSlot, profile);

  ui.results = {
    outcome: win ? "victory" : "defeat",
    title: win ? STR.results.victory : (mode === "endless" ? STR.results.endlessOver : STR.results.defeat),
    lines,
    perfect: win && !game.tookDamage,
    record,
    mode,
    firstClear,
  };
  ui.go("results");
}

function fmtTime(s) {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, "0")}`;
}

// ---------- fixed-timestep loop ----------
const STEP = 1000 / 60;
let acc = 0, last = performance.now();
let frames = 0, fpsAt = last, fps = 0;
const devEl = document.getElementById("dev");
const dev = new URLSearchParams(location.search).has("dev");
if (dev) devEl.style.display = "block";

// Missions auto-pause on blur; the render loop keeps running so the screen
// never goes stale (rAF self-throttles in background tabs).
addEventListener("blur", () => { if (ui.screen === "mission") ui.go("pause"); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden && ui.screen === "mission") ui.go("pause");
  last = performance.now();
});

const noPress = () => false;

function frame(now) {
  requestAnimationFrame(frame);
  acc += now - last; last = now;
  if (acc > 200) acc = 200; // spiral-of-death guard

  input.poll(W, H);
  resumeAudio();

  // pause toggle
  if (input.pressed("pause")) {
    if (ui.screen === "mission") { ui.go("pause"); SFX.ui(); }
    else if (ui.screen === "pause") { ui.go("mission"); SFX.ui(); }
  }

  let first = true;
  while (acc >= STEP) {
    const dt = STEP / 1000;
    ui.update(dt);
    if (ui.screen === "mission" && game) {
      game.update(dt, input.state, first ? (n) => input.pressed(n) : noPress);
    }
    acc -= STEP;
    first = false;
  }
  checkMissionEnd();

  // render
  ctx.clearRect(0, 0, W, H);
  if (ui.screen === "mission" && game) game.render(ctx, W, H);
  ui.render(ctx, W, H, game, profile);
  if (vig && (ui.screen === "mission" || ui.screen === "pause" || ui.screen === "results")) ctx.drawImage(vig, 0, 0);

  input.postFrame();

  if (dev) {
    frames++;
    if (now - fpsAt >= 500) {
      fps = Math.round(frames * 1000 / (now - fpsAt));
      frames = 0; fpsAt = now;
      const st = game ? game.devStats() : { bullets: 0, enemies: 0, particles: 0 };
      devEl.textContent = `${fps} fps | b:${st.bullets} e:${st.enemies} p:${st.particles}`;
    }
  }
}

resize();
requestAnimationFrame(frame);

// Dev harness: manually advance N frames when rAF is throttled (hidden tabs).
if (dev) {
  window.__step = (n = 1) => {
    for (let i = 0; i < n; i++) { last -= STEP; frame(performance.now()); }
    return {
      screen: ui.screen, game: !!game, state: game && game.state,
      widgets: ui.widgets.map((w) => ({ id: w.id, x: Math.round(w.x), y: Math.round(w.y), w: w.w, h: w.h })),
    };
  };
}

// Debug/verification hook: step the simulation synchronously (used by automated smoke tests).
window.__sfaw = {
  ui, app,
  get game() { return game; },
  get profile() { return profile; },
  step(n = 1, inp = null) {
    for (let i = 0; i < n; i++) {
      const dt = STEP / 1000;
      ui.update(dt);
      if (ui.screen === "mission" && game) {
        if (inp) Object.assign(input.state, inp);
        game.update(dt, input.state, i === 0 ? (nm) => input.pressed(nm) : noPress);
      }
    }
    checkMissionEnd();
    ctx.clearRect(0, 0, W, H);
    if (ui.screen === "mission" && game) game.render(ctx, W, H);
    ui.render(ctx, W, H, game, profile);
    input.postFrame();
  },
};
