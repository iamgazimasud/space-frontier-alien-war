// Save system: 3 slots + settings, localStorage-backed, cloud-ready (one versioned JSON blob).
const KEY = "sfaw_save_v1";
const SETTINGS_KEY = "sfaw_settings_v1";

export function freshProfile() {
  return {
    version: 1,
    createdAt: 0,
    difficulty: "normal",
    ngPlus: 0,
    planetsCleared: [],        // planet indices
    weaponsUnlocked: ["mg"],
    upgrades: {},              // id -> level
    skins: ["frontier"],
    skin: "frontier",
    credits: 0,
    crystals: 0,
    artifacts: 0,
    kills: 0,
    achievements: [],
    stats: { missions: 0, bossKills: 0, bestCombo: 0, deaths: 0 },
    endlessBestWave: 0,
    endlessBestScore: 0,
    bossRushDone: false,
    hiddenUnlocked: false,
    stars: {},               // planetIdx -> best 0-3
  };
}

function migrate(p) {
  if (p && !p.stars) p.stars = {};
  return p;
}

function loadAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* corrupted save falls through to fresh */ }
  return { slots: [null, null, null] };
}

const db = loadAll();

export const save = {
  slots() { return db.slots; },
  get(i) { return migrate(db.slots[i]); },
  create(i, difficulty) {
    const p = freshProfile();
    p.createdAt = Date.now();
    p.difficulty = difficulty;
    db.slots[i] = p;
    this.flush();
    return p;
  },
  write(i, profile) { db.slots[i] = profile; this.flush(); },
  flush() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* storage full/denied: play session continues unsaved */ }
  },
  latestSlot() {
    let best = -1, at = -1;
    db.slots.forEach((s, i) => { if (s && s.createdAt > at) { at = s.createdAt; best = i; } });
    return best;
  },
};

export function loadSettings() {
  const def = { music: 0.8, sfx: 0.8, shake: true, reducedFlash: false, haptics: true };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return Object.assign(def, JSON.parse(raw));
  } catch (e) { /* default */ }
  return def;
}

// Daily-run record: one entry per UTC day, profile-independent.
const DAILY_KEY = "sfaw_daily_v1";
export function dailyDate() {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}
export function dailyRecord() {
  try {
    const r = JSON.parse(localStorage.getItem(DAILY_KEY) || "null");
    if (r && r.date === dailyDate()) return r;
  } catch (e) { /* fresh */ }
  return { date: dailyDate(), best: 0, attempts: 0 };
}
export function storeDaily(r) {
  try { localStorage.setItem(DAILY_KEY, JSON.stringify(r)); } catch (e) { /* non-fatal */ }
}
export function storeSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* non-fatal */ }
}
