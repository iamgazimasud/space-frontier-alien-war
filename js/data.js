// All balance numbers and content tables live here as data (tuned, not hardcoded in logic).

export const WORLD = {
  arena: 2600,            // half-extent of square arena
  playerAccel: 1350,      // px/s^2
  playerMaxSpeed: 430,
  friction: 2.6,          // velocity damping /s
  boostMul: 2.1,
  boostDrain: 34,         // energy/s
  dodgeSpeed: 1250,
  dodgeTime: 0.18,
  dodgeIFrames: 0.3,
  dodgeCooldown: 1.1,
  dodgeCost: 12,
  shieldRegenDelay: 3.0,
  pickupRadius: 90,
  comboWindow: 3.0,
  comboMax: 8,
  empCost: 55,
  empRadius: 900,
  empStun: 2.4,
  empDamage: 40,
  energyRegen: 9,
};

export const PERF = {
  dprCap: 1.5,
  maxParticles: 1400,
  maxBullets: 480,
  maxEnemies: 64,
  maxPickups: 90,
  frameBudgetMs: 16.7,
};

export const DIFFS = {
  easy:      { hp: 0.7, dmg: 0.65, speed: 0.9,  reward: 0.9,  label: "easy" },
  normal:    { hp: 1.0, dmg: 1.0,  speed: 1.0,  reward: 1.0,  label: "normal" },
  hard:      { hp: 1.5, dmg: 1.45, speed: 1.12, reward: 1.35, label: "hard" },
  nightmare: { hp: 2.2, dmg: 2.0,  speed: 1.25, reward: 1.8,  label: "nightmare" },
};

// Primary weapons. unlockPlanet = index of planet whose clear unlocks it (0 = start).
export const WEAPONS = [
  { id: "mg",      key: "mg",      unlockPlanet: 0, dmg: 9,  rate: 8.5, speed: 980,  spread: 0.06, shots: 1, life: 0.9,  size: 4,  pierce: 0, splash: 0,   energy: 0,   color: "#7de0ff" },
  { id: "laser",   key: "laser",   unlockPlanet: 1, dmg: 16, rate: 5.0, speed: 1650, spread: 0.015,shots: 1, life: 0.75, size: 3,  pierce: 1, splash: 0,   energy: 0,   color: "#41f7d2" },
  { id: "plasma",  key: "plasma",  unlockPlanet: 3, dmg: 34, rate: 2.6, speed: 620,  spread: 0.03, shots: 1, life: 1.4,  size: 11, pierce: 0, splash: 110, energy: 0,   color: "#c76bff" },
  { id: "rail",    key: "rail",    unlockPlanet: 5, dmg: 95, rate: 0.9, speed: 2600, spread: 0.0,  shots: 1, life: 0.6,  size: 5,  pierce: 99,splash: 0,   energy: 8,   color: "#ff5ad1" },
  { id: "quantum", key: "quantum", unlockPlanet: 7, dmg: 7,  rate: 30,  speed: 2100, spread: 0.01, shots: 1, life: 0.5,  size: 3,  pierce: 2, splash: 0,   energy: 14,  color: "#8affff", beam: true },
];

export const MISSILE = { dmg: 60, speed: 700, turn: 5.2, life: 3.2, splash: 90, restock: 4.0 };

// Upgrade tracks: cost(level) = base * (level+1)^1.6, five levels each.
export const UPGRADES = [
  { id: "engine",      base: 120, max: 5, eff: 0.08 },  // +8% speed/accel per level
  { id: "damage",      base: 150, max: 5, eff: 0.12 },
  { id: "fireRate",    base: 150, max: 5, eff: 0.08 },
  { id: "crit",        base: 180, max: 5, eff: 0.05 },  // +5% crit chance (crit = x2.2)
  { id: "hull",        base: 130, max: 5, eff: 22 },    // +22 max hull per level (base 100)
  { id: "armor",       base: 160, max: 5, eff: 0.06 },  // -6% damage taken per level
  { id: "shieldCap",   base: 140, max: 5, eff: 16 },    // +16 shield (base 60)
  { id: "shieldRegen", base: 140, max: 5, eff: 0.2 },   // +20% regen rate
  { id: "missiles",    base: 200, max: 5, eff: 1 },     // +1 missile stock (base 2)
  { id: "energy",      base: 140, max: 5, eff: 18 },    // +18 energy (base 100)
  { id: "magnet",      base: 100, max: 5, eff: 26 },    // +26 pickup radius
];

export const SKINS = [
  { id: "frontier", hull: "#e8ecf4", trim: "#9aa7bd", glow: "#ffb35c", unlock: null },
  { id: "crimson",  hull: "#e2483f", trim: "#5c1a1a", glow: "#ffd75c", unlock: "clear3" },
  { id: "solar",    hull: "#f2c53d", trim: "#8a6b1d", glow: "#7de0ff", unlock: "combo8" },
  { id: "void",     hull: "#3c3550", trim: "#151221", glow: "#c76bff", unlock: "endless10" },
  { id: "aurora",   hull: "#7de0ff", trim: "#2a5a7a", glow: "#ff5ad1", unlock: "savior" },
];

// Enemy archetypes. hp/dmg/speed are pre-difficulty base values.
export const ENEMIES = {
  scout:    { hp: 22,  speed: 240, dmg: 8,  score: 100, credit: 8,  r: 20, fireRate: 0.8, bulletSpeed: 380, ai: "chaser",  sprite: "scout" },
  sniper:   { hp: 18,  speed: 170, dmg: 14, score: 160, credit: 12, r: 20, fireRate: 0.35,bulletSpeed: 720, ai: "sniper",  sprite: "scout",  tint: "#ff5ad1", range: 760 },
  heavy:    { hp: 90,  speed: 130, dmg: 10, score: 250, credit: 20, r: 30, fireRate: 1.4, bulletSpeed: 330, ai: "strafer", sprite: "heavy",  volley: 3 },
  shield:   { hp: 70,  speed: 120, dmg: 10, score: 300, credit: 24, r: 30, fireRate: 1.0, bulletSpeed: 330, ai: "strafer", sprite: "heavy",  tint: "#41f7d2", shield: 60 },
  elite:    { hp: 140, speed: 160, dmg: 13, score: 500, credit: 40, r: 32, fireRate: 1.8, bulletSpeed: 380, ai: "strafer", sprite: "heavy",  tint: "#f2c53d", volley: 5, aura: 260 },
  drone:    { hp: 10,  speed: 330, dmg: 18, score: 60,  credit: 5,  r: 14, fireRate: 0,   bulletSpeed: 0,   ai: "kamikaze",sprite: "drone" },
  bomber:   { hp: 60,  speed: 110, dmg: 16, score: 220, credit: 18, r: 26, fireRate: 0.5, bulletSpeed: 190, ai: "bomber",  sprite: "bomber", lob: true },
  ghost:    { hp: 40,  speed: 260, dmg: 12, score: 280, credit: 26, r: 22, fireRate: 0.7, bulletSpeed: 420, ai: "ghost",   sprite: "scout",  tint: "#8a9bd6" },
  turret:   { hp: 80,  speed: 0,   dmg: 12, score: 200, credit: 16, r: 26, fireRate: 0.9, bulletSpeed: 460, ai: "turret",  sprite: "turret" },
  pirate:   { hp: 45,  speed: 265, dmg: 10, score: 180, credit: 30, r: 22, fireRate: 0.9, bulletSpeed: 400, ai: "chaser",  sprite: "scout",  tint: "#f2884d" },
};

// Boss table: one per planet. kind selects the procedural artwork + pattern family.
export const BOSSES = [
  { kind: "mech",    hp: 700,   r: 70,  speed: 90,  dmg: 12, phases: 2, patterns: ["ring", "aimed"] },
  { kind: "mech",    hp: 1000,  r: 78,  speed: 110, dmg: 13, phases: 2, patterns: ["aimed", "spiral"] },
  { kind: "mech",    hp: 1500,  r: 92,  speed: 100, dmg: 15, phases: 3, patterns: ["ring", "beamsweep", "spawn:drone"] },
  { kind: "mech",    hp: 1900,  r: 88,  speed: 140, dmg: 15, phases: 3, patterns: ["aimed", "spawn:pirate", "spiral"] },
  { kind: "organic", hp: 2400,  r: 100, speed: 120, dmg: 17, phases: 3, patterns: ["spiral", "ring", "charge"] },
  { kind: "organic", hp: 2900,  r: 96,  speed: 130, dmg: 18, phases: 3, patterns: ["lightning", "aimed", "charge"] },
  { kind: "organic", hp: 3500,  r: 110, speed: 120, dmg: 19, phases: 4, patterns: ["spawn:drone", "spiral", "ring", "charge"] },
  { kind: "mech",    hp: 4200,  r: 115, speed: 110, dmg: 20, phases: 4, patterns: ["beamsweep", "ring", "spawn:turret", "aimed"] },
  { kind: "organic", hp: 5000,  r: 105, speed: 160, dmg: 21, phases: 4, patterns: ["ghost", "spiral", "charge", "aimed"] },
  { kind: "mech",    hp: 6800,  r: 135, speed: 120, dmg: 23, phases: 5, patterns: ["ring", "beamsweep", "spiral", "spawn:elite", "aimed"] },
  { kind: "organic", hp: 8000,  r: 130, speed: 150, dmg: 25, phases: 5, patterns: ["spiral", "lightning", "charge", "spawn:ghost", "ring"] },
];

// Planet mission scripts. waves: list of {mix:{type:count}} spawned in order.
// hazard: per-planet environmental modifier handled in game.js.
export const PLANETS = [
  { hue: 210, waves: [ { drone: 4 }, { drone: 6 }, { drone: 6, scout: 2 } ], hazard: null,        tutorial: true },
  { hue: 220, waves: [ { scout: 4 }, { scout: 5, drone: 4 }, { scout: 6, sniper: 2 } ], hazard: "meteors" },
  { hue: 10,  waves: [ { scout: 5, heavy: 1 }, { heavy: 2, scout: 4, turret: 2 }, { heavy: 3, sniper: 2, turret: 2 } ], hazard: "meteors" },
  { hue: 35,  waves: [ { pirate: 4, drone: 3 }, { pirate: 5, heavy: 1 }, { pirate: 6, sniper: 2 } ], hazard: "asteroids" },
  { hue: 185, waves: [ { scout: 5, drone: 4 }, { bomber: 2, scout: 5 }, { bomber: 3, sniper: 3, drone: 4 } ], hazard: "ice" },
  { hue: 265, waves: [ { bomber: 3, scout: 4 }, { heavy: 3, drone: 6 }, { elite: 1, bomber: 3, scout: 4 } ], hazard: "storm" },
  { hue: 120, waves: [ { drone: 8, scout: 4 }, { bomber: 3, drone: 8 }, { elite: 1, drone: 10, bomber: 2 } ], hazard: "spores" },
  { hue: 30,  waves: [ { turret: 3, heavy: 3 }, { shield: 3, turret: 3 }, { elite: 2, shield: 3, heavy: 2 } ], hazard: "factory" },
  { hue: 280, waves: [ { ghost: 4, drone: 5 }, { ghost: 5, sniper: 3 }, { ghost: 6, elite: 1, bomber: 2 } ], hazard: "gravity" },
  { hue: 320, waves: [ { elite: 2, shield: 3, scout: 5 }, { ghost: 4, heavy: 3, bomber: 3 }, { elite: 3, shield: 3, sniper: 3, drone: 6 } ], hazard: "gravity" },
  { hue: 160, waves: [ { ghost: 5, elite: 2 }, { shield: 4, bomber: 4 }, { elite: 3, ghost: 5, drone: 8 } ], hazard: "gravity", hidden: true },
];

export const POWERUPS = ["health", "shield", "double", "triple", "rapid", "slow", "emp", "nuke", "invuln", "magnet"];
export const POWERUP_TIME = { double: 9, triple: 9, rapid: 8, slow: 6, invuln: 6, magnet: 10 };
export const POWERUP_DROP = 0.07;      // per kill
export const ARTIFACT_DROP = 0.02;     // rare pickup, elites/bosses boost this
export const CRYSTAL_VALUE = 1;

export const ENDLESS = {
  baseBudget: 6,          // wave 1 spawn budget; grows per wave
  budgetGrowth: 2.4,
  costs: { drone: 1, scout: 2, sniper: 3, pirate: 3, bomber: 4, heavy: 5, ghost: 5, shield: 6, elite: 9 },
  bossEvery: 5,
  hpRampPerWave: 0.06,
};

export const NGPLUS = { hp: 1.6, dmg: 1.5, reward: 1.5 };

export const ACH_IDS = [
  "firstBlood", "earthSaved", "halfway", "savior", "kills100", "kills1000",
  "noDamage", "speedRun", "combo8", "treasure", "endless10", "bossRush",
];
