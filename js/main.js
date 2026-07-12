// App orchestrator: loop, screens, profiles, achievements, audio routing.
import { STR } from "../strings.js";
import { buildAtlas, planetSprite, vignette } from "./art.js";
import { Game, derivedStats, upgradeCost } from "./game.js";
import { UI } from "./ui.js";
import { input } from "./input.js";
import { save, loadSettings, storeSettings, dailyDate, dailyRecord, storeDaily } from "./save.js";
import { initAudio, resumeAudio, playMusic, stopMusic, setVolumes, SFX, getAudioStream } from "./audio.js";
import { SKINS, WEAPONS, PERF, STAR_PAR } from "./data.js";
import * as rec from "./recorder.js";

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
    // first visit: skip menus — straight into the story
    if (!this.hasAnySave()) {
      profile = save.create(0, "normal");
      activeSlot = 0;
      ui.introIdx = 0;
      ui.launchAfterIntro = true;
      ui.go("intro");
      return;
    }
    ui.go("menu");
  },

  dailyBest() { const r = dailyRecord(); return r.best > 0 ? r.best : null; },
  totalStars() {
    if (!profile) return 0;
    return Object.values(profile.stars || {}).reduce((a, b) => a + b, 0);
  },
  vibrate(ms) {
    if (settings.haptics && navigator.vibrate) navigator.vibrate(ms);
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
      case "gauntlet": this.launch({ mode: "gauntlet", planet: 19 }); break;
      case "daily": {
        const seed = parseInt(dailyDate(), 10) ^ 0x5F3759DF;
        this.launch({ mode: "daily", planet: (seed >>> 3) % 9 + 1, seed });
        break;
      }
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

  introDone() {
    if (ui.launchAfterIntro) {
      ui.launchAfterIntro = false;
      this.launch({ mode: "story", planet: 0 });
      return;
    }
    ui.go("map");
  },

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
    // start a screen recording of this mission (best-effort; never blocks play)
    ui.clipReady = false;
    if (settings.record !== false) { try { rec.startRecording(canvas, getAudioStream()); } catch (e) {} }
    if (dev) window.__game = game;
  },

  watchReplay() { if (rec.hasClip()) { ui.pauseReturn = false; rec.showReplay(() => {}); } },

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
      // Act I finale (planet 9) and Act II finale (planet 19) each play a cutscene.
      if ((planet === 9 || planet === 19) && ui.results.firstClear) {
        ui.endingIdx = 0;
        ui.endingSet = planet === 19 ? "ending2" : "ending";
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
  endingDone() { playMusic("menu"); ui.go(profile ? "map" : "menu"); },

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
  if (profile.achievements.includes("trueVictory")) grant("nova");
  if (profile.achievements.includes("bossRush")) grant("titan");
}

// ---------- game events ----------
function emit(type, a, b) {
  switch (type) {
    case "sfx":
      app.sfx(a, b);
      if (a === "explode") app.vibrate(b ? 45 : 18);
      if (a === "emp" || a === "nuke") app.vibrate(60);
      break;
    case "music": playMusic(a); break;
    case "bossWarn": SFX.alarm(); app.vibrate([40, 60, 40]); break;
    case "bossDown": SFX.bossDown(); app.vibrate([60, 40, 80]); if (profile) { profile.stats.bossKills++; } break;
    case "victory": SFX.victory(); break;
    case "defeat": SFX.defeat(); stopMusic(); app.vibrate(120); break;
    case "streak": ui.streak(a); break;
    case "closeCall": ui.closeCall(); break;
    case "event": ui.event(a, b); break;
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
  // finalize the screen recording so the results screen can offer replay/share
  if (settings.record !== false) {
    rec.stopRecording().then(() => { ui.clipReady = rec.hasClip(); }).catch(() => {});
  }
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
  let record = false, firstClear = false, stars;

  if (mode === "story" && win) {
    firstClear = !profile.planetsCleared.includes(missionOpts.planet);
    if (firstClear) profile.planetsCleared.push(missionOpts.planet);
    // star rating: clear + no damage + under par time
    stars = 1 + (!game.tookDamage ? 1 : 0) + (game.time <= (STAR_PAR[missionOpts.planet] || 200) ? 1 : 0);
    profile.stars = profile.stars || {};
    profile.stars[missionOpts.planet] = Math.max(profile.stars[missionOpts.planet] || 0, stars);
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
    if (profile.planetsCleared.length >= 15) award("liberator");
    if (missionOpts.planet === 9) {
      award("savior");
      profile.stats.lastCampaignScore = game.score;
    }
    if (missionOpts.planet === 10) award("frontierWar");
    if (missionOpts.planet === 19) {
      award("trueVictory");
      profile.stats.lastCampaignScore = game.score;
    }
    if (missionOpts.planet === 20) award("nebula");
    // full arsenal: every weapon unlocked
    if (WEAPONS.every((w) => profile.weaponsUnlocked.includes(w.id))) award("arsenal");
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
  if (mode === "daily") {
    const r = dailyRecord();
    r.attempts++;
    if (game.score > r.best) { r.best = game.score; record = true; }
    storeDaily(r);
    if (game.endlessWave >= 10) award("endless10");
    lines.push([STR.menu.dailyBest, r.best, "#ffd75c"]);
  }
  if (mode === "gauntlet") {
    const downed = game.gauntletIdx;
    if (downed > (profile.gauntletBest || 0)) { profile.gauntletBest = downed; record = true; }
    if (game.score > (profile.gauntletBestScore || 0)) { profile.gauntletBestScore = game.score; }
    if (downed >= 10) award("gauntlet10");
    lines.push([STR.results.bossesDown, downed, "#ff7de0"]);
    lines.push([STR.results.bestBosses, profile.gauntletBest || 0, "#ffd75c"]);
  }
  if (mode === "bossrush" && win) profile.bossRushDone = true;

  unlockSkins();
  save.write(activeSlot, profile);

  ui.results = {
    outcome: win ? "victory" : "defeat",
    title: win ? STR.results.victory : (mode === "endless" || mode === "daily" || mode === "gauntlet" ? STR.results.endlessOver : STR.results.defeat),
    lines,
    perfect: win && !game.tookDamage,
    record,
    mode,
    firstClear,
    stars,
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
const params = new URLSearchParams(location.search);
const dev = params.has("dev");
const shot = params.get("shot");    // headless screenshot rig: title|menu|map|hangar|combat|boss
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
  if (shot === "combat" && game) {
    // screenshot autopilot: orbit and fire
    const t = now / 1000;
    input.state.moveX = Math.cos(t * 0.8); input.state.moveY = Math.sin(t * 0.8) * 0.6;
    input.state.aimX = W / 2 + Math.cos(t * 1.7) * 260; input.state.aimY = H / 2 + Math.sin(t * 1.7) * 260;
    input.state.hasAim = true; input.state.fire = true;
  }
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

// PWA: offline cache + installability (no-op during local file testing)
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("./sw.js").catch(() => { /* offline play just won't be available */ });
}

// Screenshot rig: jump straight to a staged scene (?shot=…), used by headless capture only.
if (shot) {
  profile = save.get(0) || save.create(0, "normal");
  activeSlot = 0;
  if (shot === "menu") ui.go("menu");
  else if (shot === "map") { profile.planetsCleared = [0, 1, 2, 3]; profile.stars = { 0: 3, 1: 2, 2: 3, 3: 1 }; ui.go("map"); }
  else if (shot === "hangar") { profile.credits = 1240; profile.crystals = 87; ui.go("hangar"); }
  else if (shot === "combat") {
    app.launch({ mode: "story", planet: 2 });
    setTimeout(() => { for (let i = 0; i < 760; i++) { last -= STEP; frame(performance.now()); } }, 800);
  } else if (shot === "boss") {
    app.launch({ mode: "story", planet: 4 });
    setTimeout(() => {
      if (!game) return;
      game.enemies.clear(); game.setState("bossWarn");
      for (let i = 0; i < 560; i++) { last -= STEP; frame(performance.now()); }
    }, 800);
  }
}

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
