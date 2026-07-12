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
  // --- Act II weapons ---
  { id: "scatter", key: "scatter", unlockPlanet: 10, dmg: 11, rate: 3.2, speed: 940,  spread: 0.13, shots: 5, life: 0.5,  size: 4,  pierce: 0, splash: 0,   energy: 0,   color: "#ffb35c" },
  { id: "tempest", key: "tempest", unlockPlanet: 13, dmg: 6,  rate: 24,  speed: 1500, spread: 0.05, shots: 1, life: 0.6,  size: 3,  pierce: 1, splash: 0,   energy: 6,   color: "#7dffb0", beam: true },
  { id: "annihilator", key: "annihilator", unlockPlanet: 16, dmg: 78, rate: 1.2, speed: 2000, spread: 0.0, shots: 1, life: 0.7, size: 8, pierce: 2, splash: 120, energy: 12, color: "#ff7de0" },
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
  { id: "nova",     hull: "#ffd75c", trim: "#7a5a10", glow: "#ff7de0", unlock: "trueVictory" },
  { id: "titan",    hull: "#9fb2d8", trim: "#33405c", glow: "#7dffb0", unlock: "bossRush" },
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
  // --- Act II archetypes ---
  interceptor:{ hp: 55, speed: 320, dmg: 12, score: 220, credit: 16, r: 20, fireRate: 1.0, bulletSpeed: 460, ai: "chaser",  sprite: "scout",  tint: "#7dffb0" },
  artillery: { hp: 60,  speed: 130, dmg: 20, score: 300, credit: 22, r: 24, fireRate: 0.3, bulletSpeed: 820, ai: "sniper",  sprite: "heavy",  tint: "#ff7de0", range: 900 },
  warden:    { hp: 180, speed: 110, dmg: 14, score: 560, credit: 46, r: 34, fireRate: 1.6, bulletSpeed: 360, ai: "strafer", sprite: "heavy",  tint: "#41f7d2", shield: 120, volley: 4 },
  phantom:   { hp: 70,  speed: 300, dmg: 15, score: 360, credit: 34, r: 22, fireRate: 0.7, bulletSpeed: 440, ai: "ghost",   sprite: "scout",  tint: "#c79bff" },
  swarmer:   { hp: 8,   speed: 380, dmg: 20, score: 70,  credit: 6,  r: 13, fireRate: 0,   bulletSpeed: 0,   ai: "kamikaze",sprite: "drone",  tint: "#ffd75c" },
  dreadling: { hp: 110, speed: 120, dmg: 18, score: 320, credit: 26, r: 28, fireRate: 0.5, bulletSpeed: 210, ai: "bomber",  sprite: "bomber", tint: "#8affff", lob: true },
  sentinel:  { hp: 130, speed: 0,   dmg: 15, score: 300, credit: 20, r: 28, fireRate: 1.1, bulletSpeed: 520, ai: "turret",  sprite: "turret", tint: "#ff5ad1" },
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
  // --- Act II bosses (indices 10-19) ---
  { kind: "mech",    hp: 9000,  r: 120, speed: 130, dmg: 24, phases: 4, patterns: ["cross", "aimed", "wall", "spawn:interceptor"] },
  { kind: "organic", hp: 10500, r: 128, speed: 120, dmg: 25, phases: 4, patterns: ["nova", "spiral", "charge", "spawn:swarmer"] },
  { kind: "mech",    hp: 12000, r: 132, speed: 140, dmg: 26, phases: 5, patterns: ["beamsweep", "cross", "snipe", "wall", "aimed"] },
  { kind: "organic", hp: 13500, r: 130, speed: 160, dmg: 27, phases: 5, patterns: ["ghost", "nova", "spiral", "charge", "spawn:phantom"] },
  { kind: "organic", hp: 15000, r: 140, speed: 130, dmg: 28, phases: 5, patterns: ["spawn:swarmer", "wall", "spiral", "nova", "ring"] },
  { kind: "mech",    hp: 16500, r: 145, speed: 120, dmg: 29, phases: 5, patterns: ["cross", "beamsweep", "spawn:sentinel", "snipe", "wall"] },
  { kind: "organic", hp: 18000, r: 138, speed: 150, dmg: 30, phases: 5, patterns: ["nova", "lightning", "charge", "spiral", "spawn:warden"] },
  { kind: "organic", hp: 19500, r: 142, speed: 160, dmg: 31, phases: 6, patterns: ["ghost", "cross", "nova", "wall", "charge", "spawn:phantom"] },
  { kind: "mech",    hp: 21500, r: 150, speed: 130, dmg: 32, phases: 6, patterns: ["beamsweep", "cross", "wall", "snipe", "spawn:elite", "ring"] },
  { kind: "organic", hp: 26000, r: 165, speed: 150, dmg: 34, phases: 6, patterns: ["nova", "cross", "spiral", "lightning", "wall", "charge"] },
  // hidden final boss (Nebula X)
  { kind: "organic", hp: 8000,  r: 130, speed: 150, dmg: 25, phases: 5, patterns: ["spiral", "lightning", "charge", "spawn:ghost", "ring"] },
  // --- Nightmare bosses (indices 21-25): Gauntlet mode only, brutal ---
  { kind: "mech",    hp: 22000, r: 155, speed: 150, dmg: 34, phases: 6, patterns: ["cross", "wall", "beamsweep", "nova", "snipe", "spawn:warden"] },
  { kind: "organic", hp: 24000, r: 158, speed: 170, dmg: 36, phases: 6, patterns: ["nova", "spiral", "charge", "wall", "spawn:phantom", "lightning"] },
  { kind: "mech",    hp: 26000, r: 160, speed: 150, dmg: 38, phases: 7, patterns: ["beamsweep", "cross", "snipe", "wall", "spawn:sentinel", "ring", "nova"] },
  { kind: "organic", hp: 28000, r: 164, speed: 175, dmg: 40, phases: 7, patterns: ["ghost", "nova", "cross", "charge", "lightning", "wall", "spawn:warden"] },
  { kind: "mech",    hp: 34000, r: 175, speed: 160, dmg: 44, phases: 8, patterns: ["cross", "beamsweep", "wall", "nova", "snipe", "lightning", "charge", "spawn:elite"] },
];

// Boss Gauntlet: an infinite loop of the hardest bosses, scaling forever. A true endless replay loop.
export const GAUNTLET = {
  // curated hard rotation — Act II bosses interleaved with the nightmare bosses
  order: [10, 12, 14, 21, 16, 18, 11, 22, 13, 15, 23, 17, 19, 24, 25],
  hpBase: 0.85, hpRamp: 0.14,    // hpMul = hpBase + bossesDefeated * hpRamp (grows each fight)
  dmgBase: 1.0,  dmgRamp: 0.05,  // enemy damage ramp per boss
  healFrac: 0.4,                 // hull restored between bosses
  scorePerBoss: 5000,
};

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
  // --- Act II: THE FIRST WAR (indices 10-19) ---
  { hue: 200, waves: [ { interceptor: 5, scout: 4 }, { interceptor: 6, artillery: 2 }, { interceptor: 6, artillery: 3, heavy: 2 } ], hazard: "meteors" },
  { hue: 175, waves: [ { warden: 1, heavy: 3, scout: 4 }, { warden: 2, artillery: 2, drone: 5 }, { warden: 2, heavy: 3, artillery: 3 } ], hazard: "asteroids" },
  { hue: 45,  waves: [ { artillery: 3, sentinel: 2 }, { sentinel: 3, bomber: 3, scout: 4 }, { artillery: 4, sentinel: 3, elite: 1 } ], hazard: "storm" },
  { hue: 250, waves: [ { phantom: 4, ghost: 3 }, { phantom: 5, artillery: 3 }, { phantom: 6, ghost: 4, elite: 1 } ], hazard: "gravity" },
  { hue: 95,  waves: [ { swarmer: 8, drone: 6 }, { dreadling: 3, swarmer: 8 }, { dreadling: 4, swarmer: 10, elite: 1 } ], hazard: "spores" },
  { hue: 20,  waves: [ { warden: 2, sentinel: 3 }, { warden: 3, heavy: 4, drone: 6 }, { warden: 3, sentinel: 4, elite: 2 } ], hazard: "factory" },
  { hue: 190, waves: [ { interceptor: 6, artillery: 2 }, { dreadling: 3, interceptor: 5 }, { interceptor: 6, artillery: 4, dreadling: 3 } ], hazard: "ice" },
  { hue: 285, waves: [ { phantom: 6, ghost: 4 }, { phantom: 6, elite: 2, warden: 1 }, { phantom: 8, ghost: 5, elite: 2 } ], hazard: "gravity" },
  { hue: 340, waves: [ { warden: 2, elite: 2, artillery: 3 }, { phantom: 5, sentinel: 3, dreadling: 3 }, { warden: 3, elite: 3, artillery: 4, swarmer: 8 } ], hazard: "storm" },
  { hue: 355, waves: [ { warden: 3, phantom: 5, artillery: 3 }, { elite: 3, warden: 3, dreadling: 4, swarmer: 8 }, { elite: 4, warden: 4, phantom: 6, artillery: 4, sentinel: 3 } ], hazard: "blackhole" },
  // hidden bonus world
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
  costs: { drone: 1, scout: 2, sniper: 3, pirate: 3, bomber: 4, heavy: 5, ghost: 5, shield: 6, elite: 9,
           swarmer: 1, interceptor: 3, phantom: 5, artillery: 4, dreadling: 5, sentinel: 5, warden: 8 },
  bossEvery: 5,
  hpRampPerWave: 0.06,
};

export const NGPLUS = { hp: 1.6, dmg: 1.5, reward: 1.5 };

// Run-scoped perks offered as a draft of 3 after each cleared wave.
// mods multiply/add onto game.perkMods; flags switch behaviors on.
export const PERKS = [
  { id: "overcharge",  rare: false, mods: { dmg: 1.15 } },
  { id: "hairTrigger", rare: false, mods: { rate: 1.15 } },
  { id: "deadeye",     rare: false, mods: { crit: 0.08 } },
  { id: "afterburner", rare: false, mods: { speed: 1.12 } },
  { id: "tractor",     rare: false, mods: { magnet: 70 } },
  { id: "capacitor",   rare: false, mods: { energyRegen: 1.5 } },
  { id: "reflexes",    rare: false, mods: { dodgeCd: 0.7 } },
  { id: "salvage",     rare: false, mods: { drops: 1.35 } },
  { id: "comboCore",   rare: false, mods: { comboWindow: 1.5 } },
  { id: "warheads",    rare: false, mods: { missileSplash: 1.4 } },
  { id: "piercing",    rare: true,  mods: { pierce: 1 } },
  { id: "vampiric",    rare: true,  flags: ["lifesteal"] },
  { id: "aegis",       rare: true,  flags: ["shieldOnKill"] },
  { id: "ricochet",    rare: true,  flags: ["ricochet"] },
  { id: "splitShot",   rare: true,  flags: ["splitOnKill"] },
  { id: "freeBoost",   rare: true,  flags: ["freeBoost"] },
  { id: "twinMissile", rare: true,  mods: { missiles: 1 } },
  { id: "empAmp",      rare: true,  mods: { empRadius: 1.4 } },
  // --- Act II perks ---
  { id: "siege",       rare: true,  mods: { dmg: 1.3 } },
  { id: "overclock",   rare: true,  mods: { rate: 1.25 } },
  { id: "momentum",    rare: false, mods: { speed: 1.14 } },
  { id: "fortune",     rare: true,  mods: { drops: 1.6 } },
  { id: "sharpshooter",rare: true,  mods: { crit: 0.12 } },
  { id: "flywheel",    rare: false, mods: { energyRegen: 1.8 } },
];

// Playable ships (formerly cosmetic skins) — same unlock conditions.
export const SHIPS = {
  frontier: { speed: 1,    dmg: 1,    rate: 1,    hull: 1,   shield: 1,   missiles: 0, dodgeCd: 1,    boostCost: 1,   traits: [] },
  crimson:  { speed: 1.3,  dmg: 1.25, rate: 1.05, hull: 0.6, shield: 0.9, missiles: 0, dodgeCd: 0.75, boostCost: 1,   traits: [] },
  solar:    { speed: 0.8,  dmg: 1,    rate: 0.85, hull: 1.6, shield: 1.2, missiles: 2, dodgeCd: 1.15, boostCost: 1,   traits: [] },
  void:     { speed: 1.1,  dmg: 1,    rate: 1,    hull: 0.9, shield: 0.8, missiles: 0, dodgeCd: 0.9,  boostCost: 1,   traits: ["lifesteal"] },
  aurora:   { speed: 1.15, dmg: 1.15, rate: 1.15, hull: 1.15,shield: 1.15,missiles: 1, dodgeCd: 0.85, boostCost: 0.5, traits: [] },
  nova:     { speed: 1.25, dmg: 1.3,  rate: 1.25, hull: 1.1, shield: 1.2, missiles: 2, dodgeCd: 0.7,  boostCost: 0.5, traits: ["shieldOnKill"] },
  titan:    { speed: 0.85, dmg: 1.15, rate: 0.95, hull: 2.0, shield: 1.5, missiles: 3, dodgeCd: 1.1,  boostCost: 0.8, traits: ["lifesteal"] },
};

// Star goals per mission: clear + no damage + under par seconds.
// Indices 0-9 Act I, 10-19 Act II, 20 hidden.
export const STAR_PAR = [100, 130, 160, 170, 180, 190, 200, 210, 220, 240,
                         250, 260, 270, 275, 280, 290, 300, 310, 320, 350, 240];

// Mid-mission events roll every EVENT.gap seconds during waves.
export const EVENTS = {
  gap: [18, 30],
  bounty: { kills: 4, window: 6, creditReward: 150 },
};

export const JUICE = {
  hitStopBig: 0.05,
  hitStopBoss: 0.09,
  streakWindow: 1.1,
  nearMissSlow: 0.45,
  nearMissTime: 0.5,
};

export const ACH_IDS = [
  "firstBlood", "earthSaved", "halfway", "savior", "kills100", "kills1000",
  "noDamage", "speedRun", "combo8", "treasure", "endless10", "bossRush",
  "frontierWar", "trueVictory", "liberator", "arsenal", "nebula",
  "gauntlet10",
];
