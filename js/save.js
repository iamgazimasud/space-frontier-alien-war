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
  };
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
  get(i) { return db.slots[i]; },
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
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* default */ }
  return { music: 0.8, sfx: 0.8, shake: true, reducedFlash: false };
}
export function storeSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* non-fatal */ }
}
