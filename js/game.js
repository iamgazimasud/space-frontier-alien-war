// Core simulation + world rendering. Fixed-timestep, seeded RNG, pooled entities.
import { WORLD, PERF, DIFFS, WEAPONS, MISSILE, UPGRADES, ENEMIES, BOSSES, PLANETS, POWERUPS, POWERUP_TIME, POWERUP_DROP, ARTIFACT_DROP, ENDLESS, NGPLUS, SKINS, PERKS, SHIPS, EVENTS, JUICE, GAUNTLET } from "./data.js";
import { simRng, fxRng } from "./rng.js";
import { spawnGlow, spawnSpark, explosion, updateParticles, drawParticles, clearParticles, GLOW, floatText, updateTexts, drawTexts, setParticleSprites, particleCount } from "./particles.js";
import { PAL, nebulaBackground, planetSprite } from "./art.js";

const TAU = Math.PI * 2;

function upLevel(profile, id) { return profile.upgrades[id] || 0; }
function upEff(id) { return UPGRADES.find((u) => u.id === id).eff; }

export function derivedStats(profile, stock = false) {
  // stock=true = daily-run fairness: no hangar upgrades, everyone flies the Frontier
  const u = (id) => (stock ? 0 : upLevel(profile, id) * upEff(id));
  const ship = stock ? SHIPS.frontier : (SHIPS[profile.skin] || SHIPS.frontier);
  return {
    accel: WORLD.playerAccel * (1 + u("engine")) * ship.speed,
    maxSpeed: WORLD.playerMaxSpeed * (1 + u("engine")) * ship.speed,
    dmgMul: (1 + u("damage")) * ship.dmg,
    rateMul: (1 + u("fireRate")) * ship.rate,
    critChance: u("crit"),
    maxHull: (100 + u("hull")) * ship.hull,
    armor: Math.min(0.5, u("armor")),
    maxShield: (60 + u("shieldCap")) * ship.shield,
    shieldRegen: 8 * (1 + u("shieldRegen")),
    missileMax: 2 + (stock ? 0 : upLevel(profile, "missiles")) + ship.missiles,
    maxEnergy: 100 + u("energy"),
    magnetR: WORLD.pickupRadius + u("magnet"),
    dodgeCdMul: ship.dodgeCd,
    boostCostMul: ship.boostCost,
    traits: ship.traits,
  };
}

export function upgradeCost(id, level) {
  const u = UPGRADES.find((x) => x.id === id);
  return Math.round(u.base * Math.pow(level + 1, 1.6) / 10) * 10;
}

class Pool {
  constructor(n, make) {
    this.items = Array.from({ length: n }, make);
    this.n = n;
  }
  get() {
    for (const it of this.items) if (!it.active) { it.active = true; return it; }
    return null;
  }
  each(fn) { for (const it of this.items) if (it.active) fn(it); }
  clear() { for (const it of this.items) it.active = false; }
  count() { let c = 0; for (const it of this.items) if (it.active) c++; return c; }
}

export class Game {
  constructor(atlas, emit) {
    this.atlas = atlas;
    this.emit = emit;
    setParticleSprites([
      atlas.glowCyan, atlas.glowMagenta, atlas.glowTeal, atlas.glowViolet,
      atlas.glowOrange, atlas.glowWhite, atlas.glowGreen,
    ]);
    this.bullets = new Pool(PERF.maxBullets, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, dmg: 0, size: 4, glow: 0, friendly: true, pierce: 0, splash: 0, hits: 0 }));
    this.missiles = new Pool(24, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, a: 0, life: 0, target: -1 }));
    this.enemies = new Pool(PERF.maxEnemies, () => ({ active: false }));
    this.pickups = new Pool(PERF.maxPickups, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, kind: "", sub: "", t: 0 }));
    this.meteors = new Pool(20, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, hp: 0, r: 0, spr: 0, rot: 0, rotV: 0 }));
    this.wells = [];
    this.clouds = [];
    this.strikes = [];
    this.dust = Array.from({ length: 70 }, () => ({ x: fxRng.range(-1300, 1300), y: fxRng.range(-1300, 1300), z: fxRng.range(0.4, 1) }));
    this.cam = { x: 0, y: 0, shake: 0 };
    this._w = innerWidth; this._h = innerHeight;
    this.state = "idle";
    this.bg = null;
    this.planetImg = null;
    this.shakeEnabled = true;
    this.reducedFlash = false;
  }

  // ---------- mission setup ----------
  startMission(opts, profile) {
    this.profile = profile;
    this.isDaily = opts.mode === "daily";
    this.mode = this.isDaily ? "endless" : opts.mode;   // story | endless | bossrush (daily = seeded stock endless)
    this.planet = opts.planet ?? 0;
    this.diff = DIFFS[profile.difficulty] || DIFFS.normal;
    this.ngMul = profile.ngPlus ? NGPLUS : { hp: 1, dmg: 1, reward: 1 };
    let pdef = PLANETS[Math.min(this.planet, PLANETS.length - 1)];
    // Gauntlet is a pure boss-skill loop — keep the dramatic backdrop, drop the hazard.
    if (this.mode === "gauntlet") pdef = { ...pdef, hazard: null };
    this.pdef = pdef;
    if (this.isDaily && opts.seed) simRng.reseed(opts.seed);
    else simRng.reseed((this.planet + 1) * 7919 + (profile.ngPlus + 1) * 31 + { easy: 1, normal: 2, hard: 3, nightmare: 4 }[profile.difficulty] * 101 + (this.mode === "endless" ? 55 : 0));
    if (this.isDaily) this.diff = DIFFS.normal;
    this.bg = nebulaBackground(pdef.hue);
    this.planetImg = planetSprite(pdef.hue);
    this.planetRot = 0;

    const st = derivedStats(profile, this.isDaily);
    this.stats = st;
    const skin = SKINS.find((s) => s.id === profile.skin) || SKINS[0];
    this.skinGlow = skin.glow;

    // run-scoped perk system
    this.perks = [];
    this.perkMods = { dmg: 1, rate: 1, crit: 0, speed: 1, magnet: 0, energyRegen: 1, dodgeCd: 1, drops: 1, comboWindow: 0, missileSplash: 1, pierce: 0, missiles: 0, empRadius: 1 };
    this.perkFlags = new Set(st.traits);
    this.pendingDraft = null;

    // juice + events state
    this.hitStop = 0;
    this.streakCount = 0; this.streakT = 0; this.streakBanner = null;
    this.nearMissT = 0;
    this.eventT = simRng.range(EVENTS.gap[0], EVENTS.gap[1]);
    this.eventBanner = null;
    this.bounty = null;

    this.player = {
      x: 0, y: 0, vx: 0, vy: 0, aim: -Math.PI / 2,
      hull: st.maxHull, shield: st.maxShield, energy: st.maxEnergy,
      missiles: st.missileMax, missileT: 0, fireT: 0, hitT: 99,
      dodgeT: 0, dodgeCd: 0, iframes: 0, boosting: false,
      weapon: 0, alive: true, deadT: 0,
      buffs: { double: 0, triple: 0, rapid: 0, slow: 0, invuln: 0, magnet: 0 },
    };
    // last unlocked weapon equipped by default
    const unlocked = this.unlockedWeapons();
    this.player.weapon = unlocked.length - 1;

    this.bullets.clear(); this.missiles.clear(); this.enemies.clear();
    this.pickups.clear(); this.meteors.clear(); clearParticles();
    this.wells.length = 0; this.clouds.length = 0; this.strikes.length = 0;
    this.boss = null;
    this.score = 0; this.kills = 0; this.combo = 0; this.comboT = 0; this.maxCombo = 0;
    this.creditsEarned = 0; this.crystalsEarned = 0; this.artifactsEarned = 0;
    this.tookDamage = false;
    this.time = 0;
    this.waveIdx = -1;
    this.endlessWave = 0;
    this.rushIdx = 0;
    this.gauntletIdx = 0;
    this.slowMo = 1;
    this.stateT = 0;
    this.hazardT = 0;
    this.setState("flyin");

    if (pdef.hazard === "gravity") {
      for (let i = 0; i < 3; i++) this.wells.push({ x: simRng.range(-1400, 1400), y: simRng.range(-1400, 1400), r: 340, pull: 260 });
    }
    if (pdef.hazard === "blackhole") {
      // one massive central singularity plus two smaller drifting wells
      this.wells.push({ x: 0, y: 0, r: 520, pull: 520 });
      for (let i = 0; i < 2; i++) this.wells.push({ x: simRng.range(-1500, 1500), y: simRng.range(-1500, 1500), r: 360, pull: 300 });
    }
    if (pdef.hazard === "asteroids" || this.planet === 3) this.spawnAsteroidField(10);
    if (pdef.hazard === "spores") {
      for (let i = 0; i < 5; i++) this.clouds.push({ x: simRng.range(-1600, 1600), y: simRng.range(-1600, 1600), r: simRng.range(160, 260), vx: simRng.range(-20, 20), vy: simRng.range(-20, 20) });
    }
  }

  unlockedWeapons() { return WEAPONS.filter((w) => this.profile.weaponsUnlocked.includes(w.id)); }

  setState(s) {
    this.state = s;
    this.stateT = 0;
    if (s === "bossWarn") this.emit("bossWarn");
    if (s === "boss") this.emit("music", "boss");
    if (s === "victory") this.emit("victory");
    if (s === "defeat") this.emit("defeat");
    if (s === "between" && this.mode !== "bossrush") this.offerDraft();
  }

  // ---------- perks ----------
  offerDraft() {
    const pool = PERKS.filter((p) => !(p.flags && p.flags.every((f) => this.perkFlags.has(f))));
    const opts = [];
    let guard = 0;
    while (opts.length < 3 && guard++ < 60 && pool.length) {
      const p = pool[simRng.int(0, pool.length - 1)];
      if (!opts.includes(p) && (!p.rare || simRng.chance(0.5))) opts.push(p);
    }
    if (opts.length) { this.pendingDraft = opts; this.emit("sfx", "power"); }
  }

  applyPerk(perk) {
    this.perks.push(perk.id);
    if (perk.mods) {
      for (const [k, v] of Object.entries(perk.mods)) {
        if (k === "crit" || k === "magnet" || k === "comboWindow" || k === "pierce") this.perkMods[k] += v;
        else if (k === "missiles") { this.perkMods.missiles += v; this.player.missiles += v; }
        else this.perkMods[k] *= v;
      }
    }
    if (perk.flags) perk.flags.forEach((f) => this.perkFlags.add(f));
    this.pendingDraft = null;
    this.emit("sfx", "weaponUp");
  }

  missileCap() { return this.stats.missileMax + this.perkMods.missiles; }

  // ---------- spawning ----------
  spawnWaveFromMix(mix, hpRamp = 1) {
    for (const [type, count] of Object.entries(mix)) {
      for (let i = 0; i < count; i++) this.spawnEnemy(type, hpRamp);
    }
  }

  spawnEnemy(type, hpRamp = 1, nearBoss = false) {
    const def = ENEMIES[type];
    const e = this.enemies.get();
    if (!e) return;
    const p = this.player;
    let x, y;
    if (nearBoss && this.boss) {
      x = this.boss.x + simRng.range(-120, 120); y = this.boss.y + simRng.range(-120, 120);
    } else if (type === "turret") {
      x = p.x + Math.cos(simRng.angle()) * simRng.range(500, 900);
      y = p.y + Math.sin(simRng.angle()) * simRng.range(500, 900);
    } else {
      const a = simRng.angle();
      const d = simRng.range(760, 1050);
      x = p.x + Math.cos(a) * d; y = p.y + Math.sin(a) * d;
    }
    const A = WORLD.arena;
    e.x = Math.max(-A, Math.min(A, x)); e.y = Math.max(-A, Math.min(A, y));
    e.type = type; e.def = def;
    e.vx = 0; e.vy = 0; e.angle = 0;
    e.hp = e.maxHp = def.hp * this.diff.hp * this.ngMul.hp * hpRamp;
    e.shieldHp = (def.shield || 0) * this.diff.hp;
    e.fireT = simRng.range(0.4, 1.6);
    e.stun = 0; e.t = simRng.range(0, 6); e.alpha = 1;
    e.telegraph = 0; e.flash = 0;
    e.r = def.r;
  }

  spawnAsteroidField(n) {
    for (let i = 0; i < n; i++) {
      const m = this.meteors.get();
      if (!m) return;
      m.x = simRng.range(-2000, 2000); m.y = simRng.range(-2000, 2000);
      const a = simRng.angle();
      const v = simRng.range(20, 70);
      m.vx = Math.cos(a) * v; m.vy = Math.sin(a) * v;
      m.hp = 30; m.r = simRng.range(24, 42); m.spr = simRng.int(0, 2);
      m.rot = simRng.angle(); m.rotV = simRng.range(-0.8, 0.8);
      m.flaming = false;
    }
  }

  spawnMeteor() {
    const m = this.meteors.get();
    if (!m) return;
    const p = this.player;
    const a = simRng.angle();
    m.x = p.x + Math.cos(a) * 1000; m.y = p.y + Math.sin(a) * 1000;
    const toward = Math.atan2(p.y - m.y, p.x - m.x) + simRng.range(-0.4, 0.4);
    const v = simRng.range(260, 420);
    m.vx = Math.cos(toward) * v; m.vy = Math.sin(toward) * v;
    m.hp = 20; m.r = simRng.range(18, 30); m.spr = simRng.int(0, 2);
    m.rot = simRng.angle(); m.rotV = simRng.range(-2, 2);
    m.flaming = true;
  }

  spawnBoss(idx, hpMul = 1) {
    const def = BOSSES[Math.min(idx, BOSSES.length - 1)];
    const p = this.player;
    this.boss = {
      def, kind: def.kind, idx,
      x: p.x, y: p.y - 1400,
      vx: 0, vy: 0,
      hp: def.hp * this.diff.hp * this.ngMul.hp * hpMul,
      maxHp: def.hp * this.diff.hp * this.ngMul.hp * hpMul,
      r: def.r, phase: 0, patternI: 0,
      patT: 0, patDur: 4, entering: true,
      angle: 0, spiralA: 0, beam: null, chargeV: null, flash: 0,
      stun: 0, dying: 0,
    };
  }

  // ---------- update ----------
  update(dt0, inp, pressed) {
    if (this.state === "idle") return;
    if (this.pendingDraft) return;                       // world holds its breath during a draft
    if (this.hitStop > 0) { this.hitStop -= dt0; return; }
    const dt = dt0 * this.slowMo;
    this.time += dt;
    this.stateT += dt;
    const p = this.player;

    // kill-streak window
    if (this.streakT > 0) { this.streakT -= dt; if (this.streakT <= 0) this.streakCount = 0; }
    if (this.nearMissT > 0) this.nearMissT -= dt0;

    this.updateEvents(dt);

    // mission flow
    this.updateFlow(dt, pressed);

    if (p.alive) this.updatePlayer(dt, inp, pressed);
    else { p.deadT += dt; }

    const eDt = dt * (p.buffs.slow > 0 ? 0.4 : 1);
    this.updateEnemies(eDt, dt);
    if (this.boss) this.updateBoss(eDt, dt);
    this.updateBullets(dt, eDt);
    this.updateMissiles(dt);
    this.updatePickups(dt);
    this.updateHazards(dt, eDt);
    updateParticles(dt0);
    updateTexts(dt0);

    // combo decay
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }

    // buffs tick
    for (const k of Object.keys(p.buffs)) if (p.buffs[k] > 0) p.buffs[k] -= dt;

    // camera
    const lookX = Math.cos(p.aim) * 70, lookY = Math.sin(p.aim) * 70;
    this.cam.x += ((p.x + lookX) - this.cam.x) * Math.min(1, dt * 5);
    this.cam.y += ((p.y + lookY) - this.cam.y) * Math.min(1, dt * 5);
    this.cam.shake = Math.max(0, this.cam.shake - dt * 26);
    this.planetRot += dt * 0.02;

    // slow-mo: cinematic (victory/boss death) or a near-miss pulse
    const targetSlow = (this.state === "victory" || (this.boss && this.boss.dying > 0)) ? 0.35
      : this.nearMissT > 0 ? JUICE.nearMissSlow : 1;
    this.slowMo += (targetSlow - this.slowMo) * Math.min(1, dt0 * 8);
  }

  // ---------- mid-mission events ----------
  updateEvents(dt) {
    if (this.state !== "wave" && this.state !== "boss") { return; }
    // bounty resolution
    if (this.bounty) {
      this.bounty.left -= dt;
      const got = this.kills - this.bounty.startKills;
      if (got >= this.bounty.need) {
        const r = EVENTS.bounty.creditReward;
        this.creditsEarned += r;
        this.player.shield = this.stats.maxShield;
        this.emit("event", "bountyDone", r);
        this.emit("sfx", "victory");
        this.bounty = null;
      } else if (this.bounty.left <= 0) {
        this.emit("event", "bountyFail");
        this.bounty = null;
      }
    }
    this.eventT -= dt;
    if (this.eventT > 0 || this.state !== "wave") return;
    this.eventT = simRng.range(EVENTS.gap[0], EVENTS.gap[1]);
    const roll = simRng.next();
    const p = this.player;
    if (roll < 0.38) {
      // supply drop: a beacon crate full of goodies
      const a = simRng.angle();
      const x = p.x + Math.cos(a) * 420, y = p.y + Math.sin(a) * 420;
      this.dropPickup(x, y, "power", 0, POWERUPS[simRng.int(0, POWERUPS.length - 1)]);
      this.dropPickup(x + 20, y, "credit", 25);
      this.dropPickup(x - 20, y, "energy");
      spawnGlow(x, y, 300, 20, GLOW.cyan, 0.8, 16);
      this.emit("event", "supply");
      this.emit("sfx", "power");
    } else if (roll < 0.66) {
      const t = this.planet >= 8 ? "ghost" : "elite";
      this.spawnEnemy(t, 1); this.spawnEnemy(this.planet >= 4 ? t : "scout", 1);
      this.emit("event", "ambush");
      this.emit("sfx", "alarm");
    } else {
      this.bounty = { need: EVENTS.bounty.kills, left: EVENTS.bounty.window, startKills: this.kills };
      this.emit("event", "bounty", { n: EVENTS.bounty.kills, s: EVENTS.bounty.window });
      this.emit("sfx", "alarm");
    }
  }

  updateFlow(dt, pressed) {
    const enemiesLeft = this.enemies.count();
    switch (this.state) {
      case "flyin":
        if (this.stateT > 1.4) {
          if (this.mode === "bossrush" || this.mode === "gauntlet") { this.setState("bossWarn"); }
          else this.nextWave();
        }
        break;
      case "wave":
        if (enemiesLeft === 0 && this.stateT > 1) this.setState("between");
        break;
      case "between":
        if (this.stateT > 1.6) this.nextWave();
        break;
      case "bossWarn":
        if (this.stateT > 2.4) {
          let idx, mul;
          if (this.mode === "gauntlet") {
            idx = GAUNTLET.order[this.gauntletIdx % GAUNTLET.order.length];
            mul = GAUNTLET.hpBase + this.gauntletIdx * GAUNTLET.hpRamp;
            // ramp enemy damage each boss (read live by bullet/contact damage)
            this.ngMul = { hp: 1, dmg: GAUNTLET.dmgBase + this.gauntletIdx * GAUNTLET.dmgRamp, reward: 1 };
          } else {
            idx = this.mode === "bossrush" ? this.rushIdx
              : this.mode === "endless" ? (Math.floor(this.endlessWave / ENDLESS.bossEvery) - 1) % BOSSES.length
              : this.planet;
            mul = this.mode === "endless" ? 0.55 * (1 + this.endlessWave * 0.04) : this.mode === "bossrush" ? 0.8 : 1;
          }
          this.spawnBoss(idx, mul);
          this.setState("boss");
        }
        break;
      case "boss":
        if (this.boss && this.boss.hp <= 0 && this.boss.dying <= 0) this.killBoss();
        break;
      case "victory":
      case "defeat":
        break;
    }
  }

  nextWave() {
    if (this.mode === "story") {
      this.waveIdx++;
      const waves = this.pdef.waves;
      if (this.waveIdx >= waves.length) { this.setState("bossWarn"); return; }
      this.spawnWaveFromMix(waves[this.waveIdx]);
      this.setState("wave");
      this.emit("wave", this.waveIdx + 1);
    } else if (this.mode === "endless") {
      this.endlessWave++;
      if (this.endlessWave > 1 && (this.endlessWave - 1) % ENDLESS.bossEvery === 0) { this.setState("bossWarn"); return; }
      let budget = ENDLESS.baseBudget + (this.endlessWave - 1) * ENDLESS.budgetGrowth;
      const ramp = 1 + this.endlessWave * ENDLESS.hpRampPerWave;
      const types = Object.keys(ENDLESS.costs);
      let guard = 0;
      while (budget > 0 && guard++ < 60) {
        const t = types[simRng.int(0, types.length - 1)];
        const c = ENDLESS.costs[t];
        if (c <= budget) { this.spawnEnemy(t, ramp); budget -= c; }
        else budget -= 0.5;
      }
      this.setState("wave");
      this.emit("wave", this.endlessWave);
    }
  }

  killBoss() {
    const b = this.boss;
    b.dying = 2.2;
    b.beam = null;
    this.emit("bossDown");
    this.addScore(2000 + b.idx * 500);
    // loot burst
    for (let i = 0; i < 14; i++) this.dropPickup(b.x + simRng.range(-80, 80), b.y + simRng.range(-80, 80), i < 8 ? "credit" : "crystal");
    if (simRng.chance(0.6)) this.dropPickup(b.x, b.y, "artifact");
  }

  updatePlayer(dt, inp, pressed) {
    const p = this.player, st = this.stats;
    const noControl = this.state === "flyin" || this.state === "victory";

    // aim
    if (inp.hasAim) {
      const wx = inp.aimX + this.cam.x - this._w / 2;
      const wy = inp.aimY + this.cam.y - this._h / 2;
      p.aim = Math.atan2(wy - p.y, wx - p.x);
    } else if (Math.hypot(p.vx, p.vy) > 40 && (inp.moveX || inp.moveY)) {
      p.aim = Math.atan2(p.vy, p.vx);
    }

    // dodge
    if (p.dodgeCd > 0) p.dodgeCd -= dt;
    if (!noControl && pressed("dodge") && p.dodgeCd <= 0 && p.energy >= WORLD.dodgeCost) {
      p.dodgeT = WORLD.dodgeTime;
      p.dodgeCd = WORLD.dodgeCooldown * st.dodgeCdMul * this.perkMods.dodgeCd;
      p.iframes = WORLD.dodgeIFrames;
      p.energy -= WORLD.dodgeCost;
      const a = (inp.moveX || inp.moveY) ? Math.atan2(inp.moveY, inp.moveX) : p.aim;
      p.vx = Math.cos(a) * WORLD.dodgeSpeed; p.vy = Math.sin(a) * WORLD.dodgeSpeed;
      this.emit("sfx", "dodge");
      spawnGlow(p.x, p.y, 160, 10, GLOW.cyan, 0.4, 10);
    }
    if (p.dodgeT > 0) p.dodgeT -= dt;
    if (p.iframes > 0) p.iframes -= dt;

    // thrust
    p.boosting = false;
    if (!noControl && p.dodgeT <= 0) {
      let ax = inp.moveX, ay = inp.moveY;
      let accel = st.accel * this.perkMods.speed, maxV = st.maxSpeed * this.perkMods.speed;
      if (inp.boost && p.energy > 1 && (ax || ay)) {
        p.boosting = true;
        accel *= WORLD.boostMul; maxV *= WORLD.boostMul;
        if (!this.perkFlags.has("freeBoost")) {
          p.energy = Math.max(0, p.energy - WORLD.boostDrain * st.boostCostMul * dt);
        }
      }
      p.vx += ax * accel * dt; p.vy += ay * accel * dt;
      const v = Math.hypot(p.vx, p.vy);
      if (v > maxV) { p.vx = p.vx / v * maxV; p.vy = p.vy / v * maxV; }
      // engine particles
      if (ax || ay) {
        const back = Math.atan2(-ay, -ax);
        spawnGlow(p.x + Math.cos(back) * 20, p.y + Math.sin(back) * 20, p.boosting ? 320 : 170,
          p.boosting ? 3 : 1, GLOW.orange, 0.35, p.boosting ? 10 : 6, 0.5, back);
      }
    }
    const fr = this.pdef.hazard === "ice" ? 0.55 : WORLD.friction;
    p.vx *= Math.max(0, 1 - fr * dt); p.vy *= Math.max(0, 1 - fr * dt);
    p.x += p.vx * dt; p.y += p.vy * dt;
    const A = WORLD.arena;
    if (p.x < -A) { p.x = -A; p.vx = Math.abs(p.vx) * 0.4; }
    if (p.x > A) { p.x = A; p.vx = -Math.abs(p.vx) * 0.4; }
    if (p.y < -A) { p.y = -A; p.vy = Math.abs(p.vy) * 0.4; }
    if (p.y > A) { p.y = A; p.vy = -Math.abs(p.vy) * 0.4; }

    // regen
    p.hitT += dt;
    if (p.hitT > WORLD.shieldRegenDelay && p.shield < st.maxShield) {
      p.shield = Math.min(st.maxShield, p.shield + st.shieldRegen * dt);
    }
    p.energy = Math.min(st.maxEnergy, p.energy + WORLD.energyRegen * this.perkMods.energyRegen * dt);

    // weapon swap
    if (!noControl) {
      const unlocked = this.unlockedWeapons();
      if (pressed("swap")) { p.weapon = (p.weapon + 1) % unlocked.length; this.emit("sfx", "ui"); }
      for (let i = 0; i < 5; i++) if (pressed("w" + (i + 1)) && i < unlocked.length) { p.weapon = i; this.emit("sfx", "ui"); }
      if (p.weapon >= unlocked.length) p.weapon = unlocked.length - 1;
    }

    // fire primary
    p.fireT -= dt;
    if (!noControl && inp.fire && p.fireT <= 0) this.firePrimary();

    // missiles
    p.missileT += dt;
    if (p.missiles < this.missileCap() && p.missileT > MISSILE.restock) { p.missiles++; p.missileT = 0; }
    if (!noControl && inp.missile && p.missiles > 0 && (this._mslGap = (this._mslGap || 0)) <= 0) {
      this.fireMissile(); this._mslGap = 0.22;
    }
    if (this._mslGap > 0) this._mslGap -= dt;

    // EMP special
    if (!noControl && pressed("special") && p.energy >= WORLD.empCost) {
      p.energy -= WORLD.empCost;
      this.empBlast(p.x, p.y, WORLD.empRadius * this.perkMods.empRadius, WORLD.empDamage, WORLD.empStun);
    }
  }

  firePrimary() {
    const p = this.player, st = this.stats;
    const unlocked = this.unlockedWeapons();
    const w = unlocked[p.weapon] || unlocked[0];
    if (w.energy && p.energy < w.energy) return;
    let rate = w.rate * st.rateMul * this.perkMods.rate * (p.buffs.rapid > 0 ? 1.7 : 1);
    p.fireT = 1 / rate;
    if (w.energy) p.energy -= w.beam ? w.energy / rate * 4 : w.energy;
    const shots = p.buffs.triple > 0 ? 3 : w.shots;
    for (let i = 0; i < shots; i++) {
      const b = this.bullets.get();
      if (!b) return;
      const spreadA = (shots > 1 ? (i - (shots - 1) / 2) * 0.14 : 0) + (fxRng.next() - 0.5) * w.spread * 2;
      const a = p.aim + spreadA;
      b.x = p.x + Math.cos(p.aim) * 26; b.y = p.y + Math.sin(p.aim) * 26;
      b.vx = Math.cos(a) * w.speed + p.vx * 0.3; b.vy = Math.sin(a) * w.speed + p.vy * 0.3;
      b.life = w.life;
      let dmg = w.dmg * st.dmgMul * this.perkMods.dmg;
      if (p.buffs.double > 0) dmg *= 2;
      if (fxRng.next() < st.critChance + this.perkMods.crit) { dmg *= 2.2; b.crit = true; } else b.crit = false;
      b.dmg = dmg;
      b.size = w.size; b.friendly = true; b.bomb = 0; b.bounced = false;
      b.pierce = w.pierce + this.perkMods.pierce; b.splash = w.splash; b.hits = 0;
      b.glow = w.id === "mg" ? GLOW.cyan : w.id === "laser" ? GLOW.teal : w.id === "plasma" ? GLOW.violet : w.id === "rail" ? GLOW.magenta : GLOW.white;
    }
    this.emit("sfx", w.id === "mg" ? "laser" : w.id === "laser" ? "laser2" : w.id === "plasma" ? "plasma" : w.id === "rail" ? "rail" : "quantum");
    if (w.id === "rail") this.shake(4);
    spawnGlow(p.x + Math.cos(p.aim) * 30, p.y + Math.sin(p.aim) * 30, 60, 2, GLOW.cyan, 0.15, 6);
  }

  fireMissile() {
    const p = this.player;
    const m = this.missiles.get();
    if (!m) return;
    p.missiles--;
    m.x = p.x; m.y = p.y;
    m.a = p.aim + fxRng.range(-0.5, 0.5);
    m.vx = Math.cos(m.a) * 250 + p.vx; m.vy = Math.sin(m.a) * 250 + p.vy;
    m.life = MISSILE.life;
    m.target = -1;
    this.emit("sfx", "missile");
  }

  empBlast(x, y, radius, dmg, stun) {
    this.emit("sfx", "emp");
    this.shake(10);
    spawnGlow(x, y, 900, 40, GLOW.cyan, 0.7, 22);
    this.enemies.each((e) => {
      if (dist(e.x, e.y, x, y) < radius) { this.damageEnemy(e, dmg, true); e.stun = Math.max(e.stun, stun); }
    });
    if (this.boss && !this.boss.entering && dist(this.boss.x, this.boss.y, x, y) < radius) {
      this.damageBoss(dmg * 2); this.boss.stun = 1.0;
    }
    // clear hostile bullets
    this.bullets.each((b) => {
      if (!b.friendly && dist(b.x, b.y, x, y) < radius) { b.active = false; spawnSpark(b.x, b.y, 120, 2, GLOW.cyan, 0.3); }
    });
    this.empRing = { x, y, t: 0.5, max: 0.5, r: radius };
  }

  // ---------- enemies ----------
  updateEnemies(eDt, realDt) {
    const p = this.player;
    this.enemies.each((e) => {
      e.t += eDt;
      if (e.flash > 0) e.flash -= realDt;
      if (e.stun > 0) { e.stun -= eDt; return; }
      const def = e.def;
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const speed = def.speed * this.diff.speed;
      let ax = 0, ay = 0;

      switch (def.ai) {
        case "chaser": {
          const orbit = 260 + (e.t % 3) * 20;
          if (d > orbit) { ax = dx / d; ay = dy / d; }
          else { ax = -dy / d * 0.8; ay = dx / d * 0.8; }
          this.enemyShoot(e, d, 520, eDt);
          break;
        }
        case "sniper": {
          const want = def.range;
          if (d < want - 60) { ax = -dx / d; ay = -dy / d; }
          else if (d > want + 60) { ax = dx / d; ay = dy / d; }
          else { ax = -dy / d * 0.6; ay = dx / d * 0.6; }
          // telegraphed shot
          e.fireT -= eDt;
          if (e.fireT <= 0 && d < want + 200) {
            if (!e.telegraph) e.telegraph = 0.55;
          }
          if (e.telegraph > 0) {
            e.telegraph -= eDt;
            if (e.telegraph <= 0) {
              this.spawnEnemyBullet(e.x, e.y, Math.atan2(dy, dx), def.bulletSpeed, def.dmg);
              e.fireT = 1 / def.fireRate;
              e.telegraph = 0;
            }
          }
          break;
        }
        case "strafer": {
          const orbit = 330;
          if (d > orbit + 60) { ax = dx / d; ay = dy / d; }
          else { ax = -dy / d; ay = dx / d; }
          e.fireT -= eDt;
          if (e.fireT <= 0 && d < 700) {
            const n = def.volley || 1;
            for (let i = 0; i < n; i++) {
              const a = Math.atan2(dy, dx) + (i - (n - 1) / 2) * 0.16;
              this.spawnEnemyBullet(e.x, e.y, a, def.bulletSpeed, def.dmg);
            }
            e.fireT = 1 / def.fireRate;
            this.emit("sfx", "enemyShot");
          }
          break;
        }
        case "kamikaze": {
          ax = dx / d; ay = dy / d;
          if (d < 30 + e.r) {
            this.hurtPlayer(def.dmg);
            this.destroyEnemy(e, false);
            return;
          }
          break;
        }
        case "bomber": {
          const orbit = 420;
          if (d > orbit) { ax = dx / d; ay = dy / d; }
          else { ax = -dy / d * 0.7; ay = dx / d * 0.7; }
          e.fireT -= eDt;
          if (e.fireT <= 0 && d < 720) {
            // lob a bomb that bursts into a ring
            const b = this.spawnEnemyBullet(e.x, e.y, Math.atan2(dy, dx), def.bulletSpeed, def.dmg);
            if (b) { b.bomb = 1.3; b.size = 9; }
            e.fireT = 1 / def.fireRate;
          }
          break;
        }
        case "ghost": {
          e.alpha = 0.25 + 0.75 * Math.abs(Math.sin(e.t * 0.9));
          const orbit = 300;
          if (d > orbit) { ax = dx / d; ay = dy / d; }
          else { ax = -dy / d; ay = dx / d; }
          if (e.t % 6 < eDt && d < 900) { // teleport hop
            e.x = p.x + Math.cos(simRng.angle()) * 420;
            e.y = p.y + Math.sin(simRng.angle()) * 420;
            spawnGlow(e.x, e.y, 150, 8, GLOW.violet, 0.4, 12);
          }
          if (e.alpha > 0.6) this.enemyShoot(e, d, 620, eDt);
          break;
        }
        case "turret": {
          e.fireT -= eDt;
          if (e.fireT <= 0 && d < 820) {
            this.spawnEnemyBullet(e.x, e.y, Math.atan2(dy, dx), def.bulletSpeed, def.dmg);
            e.fireT = 1 / def.fireRate;
          }
          break;
        }
      }
      e.vx += ax * speed * 3 * eDt; e.vy += ay * speed * 3 * eDt;
      const v = Math.hypot(e.vx, e.vy);
      if (v > speed) { e.vx = e.vx / v * speed; e.vy = e.vy / v * speed; }
      e.x += e.vx * eDt; e.y += e.vy * eDt;
      e.angle = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2;

      // contact damage
      if (d < e.r + 18 && def.ai !== "kamikaze") {
        this.hurtPlayer(def.dmg * 0.5 * eDt * 4);
      }
      // shield regen for shield ships
      if (def.shield && e.shieldHp < def.shield * this.diff.hp) e.shieldHp += 4 * eDt;
    });
  }

  enemyShoot(e, d, maxRange, eDt) {
    const def = e.def;
    if (!def.fireRate) return;
    e.fireT -= eDt;
    if (e.fireT <= 0 && d < maxRange) {
      const p = this.player;
      const lead = d / def.bulletSpeed * 0.5;
      const a = Math.atan2(p.y + p.vy * lead - e.y, p.x + p.vx * lead - e.x);
      this.spawnEnemyBullet(e.x, e.y, a, def.bulletSpeed, def.dmg);
      e.fireT = 1 / def.fireRate;
      this.emit("sfx", "enemyShot");
    }
  }

  spawnEnemyBullet(x, y, a, speed, dmg) {
    const b = this.bullets.get();
    if (!b) return null;
    b.x = x; b.y = y;
    b.vx = Math.cos(a) * speed; b.vy = Math.sin(a) * speed;
    b.life = 3.2; b.dmg = dmg * this.diff.dmg * this.ngMul.dmg;
    b.size = 5; b.friendly = false; b.pierce = 0; b.splash = 0; b.bomb = 0;
    b.glow = GLOW.green;
    return b;
  }

  damageEnemy(e, dmg, silent) {
    if (e.shieldHp > 0) {
      e.shieldHp -= dmg;
      if (!silent) this.emit("sfx", "shieldHit");
      spawnGlow(e.x, e.y, 90, 3, GLOW.teal, 0.25, 10);
      if (e.shieldHp < 0) { e.hp += e.shieldHp; e.shieldHp = 0; }
    } else {
      e.hp -= dmg;
      e.flash = 0.08;
    }
    if (e.hp <= 0) this.destroyEnemy(e, true);
  }

  destroyEnemy(e, reward) {
    e.active = false;
    const big = e.def.score >= 250;
    explosion(e.x, e.y, big, e.def.sprite === "drone" ? GLOW.magenta : GLOW.orange);
    this.emit("sfx", "explode", big);
    this.shake(big ? 5 : 2);
    if (big) this.hitStop = Math.max(this.hitStop, JUICE.hitStopBig);
    if (!reward) return;
    this.kills++;
    this.emit("kill", this.kills);
    // kill streak
    this.streakCount++;
    this.streakT = JUICE.streakWindow;
    if (this.streakCount >= 2) this.emit("streak", this.streakCount);
    // perk hooks
    const p = this.player, st = this.stats;
    if (this.perkFlags.has("lifesteal")) p.hull = Math.min(st.maxHull, p.hull + 2);
    if (this.perkFlags.has("shieldOnKill")) p.shield = Math.min(st.maxShield, p.shield + 3);
    if (this.perkFlags.has("splitOnKill") && !this._splitting) {
      this._splitting = true;
      spawnGlow(e.x, e.y, 160, 6, GLOW.cyan, 0.3, 12);
      this.splashDamage(e.x, e.y, 80, 14 * this.perkMods.dmg);
      this._splitting = false;
    }
    this.combo = Math.min(WORLD.comboMax, this.combo + 1);
    this.comboT = WORLD.comboWindow + this.perkMods.comboWindow;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    if (this.combo >= 8) this.emit("achieve", "combo8");
    this.addScore(e.def.score);
    // drops
    const r = this.diff.reward * this.ngMul.reward * this.perkMods.drops;
    this.dropPickup(e.x, e.y, "credit", Math.max(1, Math.round(e.def.credit * r)));
    if (simRng.chance(0.3)) this.dropPickup(e.x + 14, e.y, "crystal");
    if (simRng.chance(0.12)) this.dropPickup(e.x - 14, e.y, "energy");
    if (simRng.chance(POWERUP_DROP * this.perkMods.drops)) this.dropPickup(e.x, e.y + 14, "power", 0, POWERUPS[simRng.int(0, POWERUPS.length - 1)]);
    const artChance = e.def.score >= 500 ? 0.1 : ARTIFACT_DROP;
    if (simRng.chance(artChance)) this.dropPickup(e.x, e.y - 14, "artifact");
  }

  addScore(base) {
    const mult = Math.max(1, this.combo);
    this.score += base * mult;
  }

  dropPickup(x, y, kind, value = 0, sub = "") {
    const pk = this.pickups.get();
    if (!pk) return;
    pk.x = x; pk.y = y;
    const a = simRng.angle();
    pk.vx = Math.cos(a) * 60; pk.vy = Math.sin(a) * 60;
    pk.kind = kind; pk.value = value; pk.sub = sub; pk.t = 14;
  }

  updatePickups(dt) {
    const p = this.player, st = this.stats;
    const magnetR = (st.magnetR + this.perkMods.magnet) * (p.buffs.magnet > 0 ? 3 : 1);
    this.pickups.each((pk) => {
      pk.t -= dt;
      if (pk.t <= 0) { pk.active = false; return; }
      const dx = p.x - pk.x, dy = p.y - pk.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < magnetR && p.alive) {
        pk.vx += dx / d * 900 * dt; pk.vy += dy / d * 900 * dt;
      } else { pk.vx *= 1 - 2 * dt; pk.vy *= 1 - 2 * dt; }
      pk.x += pk.vx * dt; pk.y += pk.vy * dt;
      if (d < 30 && p.alive) {
        pk.active = false;
        this.collect(pk);
      }
    });
  }

  collect(pk) {
    const p = this.player, st = this.stats;
    switch (pk.kind) {
      case "credit": this.creditsEarned += pk.value || 5; this.emit("sfx", "pickup"); floatText(pk.x, pk.y, "+" + (pk.value || 5), "#ffd75c"); break;
      case "crystal": this.crystalsEarned++; this.emit("sfx", "pickup"); floatText(pk.x, pk.y, "+1 ◆", "#ff5ad1"); break;
      case "energy": p.energy = Math.min(st.maxEnergy, p.energy + 25); this.emit("sfx", "pickup"); floatText(pk.x, pk.y, "+ENERGY", "#7de0ff"); break;
      case "artifact":
        this.artifactsEarned++; this.emit("sfx", "artifact"); this.emit("artifact");
        floatText(pk.x, pk.y, "RARE ARTIFACT!", "#b0ff8a", 16);
        this.addScore(500);
        break;
      case "power": this.applyPowerup(pk.sub, pk); break;
    }
  }

  applyPowerup(kind, pk) {
    const p = this.player, st = this.stats;
    this.emit("sfx", "power");
    this.emit("powerup", kind);
    switch (kind) {
      case "health": p.hull = Math.min(st.maxHull, p.hull + st.maxHull * 0.3); break;
      case "shield": p.shield = st.maxShield; break;
      case "emp": this.empBlast(p.x, p.y, WORLD.empRadius * this.perkMods.empRadius, WORLD.empDamage, WORLD.empStun); break;
      case "nuke": {
        this.emit("sfx", "nuke");
        this.shake(16);
        this.nukeFlash = 0.6;
        this.enemies.each((e) => this.damageEnemy(e, 500, true));
        if (this.boss && !this.boss.entering) this.damageBoss(300);
        break;
      }
      default: p.buffs[kind] = POWERUP_TIME[kind] || 8;
    }
    floatText(pk.x, pk.y, kind.toUpperCase(), "#7de0ff", 15);
  }

  // ---------- bullets & missiles ----------
  updateBullets(dt, eDt) {
    const p = this.player;
    this.bullets.each((b) => {
      const useDt = b.friendly ? dt : eDt;
      b.life -= useDt;
      if (b.life <= 0) { if (b.bomb) this.burstBomb(b); b.active = false; return; }
      if (b.bomb) {
        b.bomb -= useDt;
        if (b.bomb <= 0) { this.burstBomb(b); b.active = false; return; }
      }
      b.x += b.vx * useDt; b.y += b.vy * useDt;
      const A = WORLD.arena + 200;
      if (b.x < -A || b.x > A || b.y < -A || b.y > A) { b.active = false; return; }

      if (b.friendly) {
        // vs enemies
        let hit = false;
        this.enemies.each((e) => {
          if (hit && b.pierce <= b.hits) return;
          if (Math.abs(e.x - b.x) > e.r + 12 || Math.abs(e.y - b.y) > e.r + 12) return;
          if (dist(e.x, e.y, b.x, b.y) < e.r + b.size) {
            this.hitEnemy(b, e);
            hit = true;
          }
        });
        // vs boss
        const bs = this.boss;
        if (bs && !bs.entering && bs.dying <= 0 && dist(bs.x, bs.y, b.x, b.y) < bs.r + b.size) {
          this.damageBoss(b.dmg);
          spawnSpark(b.x, b.y, 200, 4, b.glow, 0.3);
          if (b.splash) this.splashDamage(b.x, b.y, b.splash, b.dmg * 0.6);
          if (b.crit) floatText(b.x, b.y, Math.round(b.dmg) + "!", "#ffd75c");
          b.active = false;
        }
        // vs meteors
        this.meteors.each((m) => {
          if (dist(m.x, m.y, b.x, b.y) < m.r + b.size) {
            m.hp -= b.dmg;
            spawnSpark(b.x, b.y, 150, 3, GLOW.white, 0.25);
            if (m.hp <= 0) this.destroyMeteor(m, true);
            b.active = false;
          }
        });
      } else {
        // vs player
        const pd = dist(p.x, p.y, b.x, b.y);
        if (p.alive && p.iframes <= 0 && pd < 16 + b.size) {
          this.hurtPlayer(b.dmg);
          b.active = false;
          spawnSpark(b.x, b.y, 180, 5, GLOW.green, 0.3);
        } else if (p.alive && p.iframes > 0 && pd < 40 + b.size && this.nearMissT <= 0) {
          // dodged through a bullet: brief slow-mo reward
          this.nearMissT = JUICE.nearMissTime;
          this.emit("closeCall");
        }
      }
    });
    if (this.empRing) { this.empRing.t -= dt; if (this.empRing.t <= 0) this.empRing = null; }
    if (this.nukeFlash > 0) this.nukeFlash -= dt;
  }

  hitEnemy(b, e) {
    this.damageEnemy(e, b.dmg);
    spawnSpark(b.x, b.y, 200, 4, b.glow, 0.3);
    if (b.crit) floatText(b.x, b.y, Math.round(b.dmg) + "!", "#ffd75c", 15);
    else floatText(b.x, b.y, String(Math.round(b.dmg)), "rgba(230,240,255,0.85)", 11);
    // knockback scales with damage
    const kv = Math.hypot(b.vx, b.vy) || 1;
    const kb = Math.min(220, b.dmg * 4);
    e.vx += b.vx / kv * kb; e.vy += b.vy / kv * kb;
    if (b.splash) this.splashDamage(b.x, b.y, b.splash, b.dmg * 0.6);
    b.hits++;
    if (b.hits > b.pierce) {
      // ricochet: one bounce toward the nearest other enemy
      if (this.perkFlags.has("ricochet") && !b.bounced) {
        let best = null, bd = 480 * 480;
        this.enemies.each((o) => {
          if (o === e) return;
          const d2 = (o.x - b.x) ** 2 + (o.y - b.y) ** 2;
          if (d2 < bd) { bd = d2; best = o; }
        });
        if (best) {
          const a = Math.atan2(best.y - b.y, best.x - b.x);
          const sp = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
          b.bounced = true; b.hits = 0; b.life = Math.max(b.life, 0.5);
          spawnGlow(b.x, b.y, 80, 3, b.glow, 0.25, 8);
        } else b.active = false;
      } else b.active = false;
    }
    this.emit("sfx", "hit");
  }

  splashDamage(x, y, r, dmg) {
    spawnGlow(x, y, 260, 10, GLOW.violet, 0.4, 16);
    this.enemies.each((e) => { if (dist(e.x, e.y, x, y) < r + e.r) this.damageEnemy(e, dmg, true); });
    if (this.boss && !this.boss.entering && dist(this.boss.x, this.boss.y, x, y) < r + this.boss.r) this.damageBoss(dmg);
  }

  burstBomb(b) {
    spawnGlow(b.x, b.y, 200, 8, GLOW.green, 0.4, 14);
    for (let i = 0; i < 6; i++) {
      this.spawnEnemyBullet(b.x, b.y, (i / 6) * TAU, 240, b.dmg * 0.6 / (this.diff.dmg * this.ngMul.dmg));
    }
  }

  updateMissiles(dt) {
    this.missiles.each((m) => {
      m.life -= dt;
      if (m.life <= 0) { m.active = false; return; }
      // acquire nearest target
      let best = null, bd = 1e9;
      this.enemies.each((e) => {
        const d = dist(e.x, e.y, m.x, m.y);
        if (d < bd) { bd = d; best = e; }
      });
      let tx, ty, tr;
      if (this.boss && !this.boss.entering && this.boss.dying <= 0) {
        const d = dist(this.boss.x, this.boss.y, m.x, m.y);
        if (d < bd || !best) { best = this.boss; bd = d; }
      }
      if (best) {
        const want = Math.atan2(best.y - m.y, best.x - m.x);
        let da = want - m.a;
        while (da > Math.PI) da -= TAU;
        while (da < -Math.PI) da += TAU;
        m.a += Math.max(-MISSILE.turn * dt, Math.min(MISSILE.turn * dt, da));
      }
      const sp = MISSILE.speed;
      m.vx = Math.cos(m.a) * sp; m.vy = Math.sin(m.a) * sp;
      m.x += m.vx * dt; m.y += m.vy * dt;
      spawnGlow(m.x, m.y, 30, 1, GLOW.orange, 0.25, 5);
      // impact
      let boom = false;
      if (best && dist(best.x, best.y, m.x, m.y) < (best.r || 20) + 10) boom = true;
      if (boom) {
        m.active = false;
        const dmg = MISSILE.dmg * this.stats.dmgMul * this.perkMods.dmg * (this.player.buffs.double > 0 ? 2 : 1);
        this.splashDamage(m.x, m.y, MISSILE.splash * this.perkMods.missileSplash, dmg);
        explosion(m.x, m.y, false, GLOW.orange);
        this.emit("sfx", "explode", false);
        this.shake(3);
      }
    });
  }

  // ---------- hazards ----------
  updateHazards(dt, eDt) {
    const p = this.player;
    const hz = this.pdef.hazard;
    this.hazardT -= dt;
    if (hz === "meteors" && this.hazardT <= 0 && this.state !== "victory") {
      this.spawnMeteor(); this.hazardT = simRng.range(2.2, 4.5);
    }
    if (hz === "factory" && this.hazardT <= 0 && (this.state === "wave" || this.state === "boss")) {
      this.spawnEnemy("drone"); this.hazardT = 7;
    }
    if (hz === "storm" && this.hazardT <= 0 && this.state !== "victory") {
      // telegraphed lightning strike near the player
      this.strikes.push({ x: p.x + simRng.range(-360, 360), y: p.y + simRng.range(-360, 360), t: 1.0, r: 90 });
      this.hazardT = simRng.range(1.6, 3.2);
    }
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      s.t -= dt;
      if (s.t <= 0) {
        if (p.alive && dist(p.x, p.y, s.x, s.y) < s.r) this.hurtPlayer(18);
        this.enemies.each((e) => { if (dist(e.x, e.y, s.x, s.y) < s.r) this.damageEnemy(e, 40, true); });
        spawnGlow(s.x, s.y, 400, 16, GLOW.cyan, 0.4, 16);
        this.emit("sfx", "rail");
        this.shake(5);
        this.strikes.splice(i, 1);
      }
    }
    // spore clouds: DoT
    for (const c of this.clouds) {
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (Math.abs(c.x) > 2000) c.vx *= -1;
      if (Math.abs(c.y) > 2000) c.vy *= -1;
      if (p.alive && dist(p.x, p.y, c.x, c.y) < c.r) this.hurtPlayer(6 * dt, true);
    }
    // gravity wells
    for (const w of this.wells) {
      const dx = w.x - p.x, dy = w.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < w.r * 2.2) {
        const f = w.pull * Math.min(1, w.r / d);
        p.vx += dx / d * f * dt; p.vy += dy / d * f * dt;
        if (d < 40) this.hurtPlayer(20 * dt, true);
      }
    }
    // meteors move + collide
    this.meteors.each((m) => {
      m.x += m.vx * eDt; m.y += m.vy * eDt;
      m.rot += m.rotV * eDt;
      if (Math.abs(m.x - p.x) > 2400 || Math.abs(m.y - p.y) > 2400) {
        if (m.flaming) m.active = false;
        else { // drift wrap for field asteroids
          if (Math.abs(m.x) > 2200) m.vx *= -1;
          if (Math.abs(m.y) > 2200) m.vy *= -1;
        }
      }
      if (m.flaming) spawnGlow(m.x, m.y, 40, 1, GLOW.orange, 0.3, m.r * 0.4);
      if (p.alive && p.iframes <= 0 && dist(m.x, m.y, p.x, p.y) < m.r + 16) {
        this.hurtPlayer(m.flaming ? 22 : 14);
        this.destroyMeteor(m, false);
      }
    });
  }

  destroyMeteor(m, reward) {
    m.active = false;
    explosion(m.x, m.y, false, GLOW.orange);
    this.emit("sfx", "explode", false);
    if (reward) {
      this.addScore(50);
      const n = simRng.int(1, 3);
      for (let i = 0; i < n; i++) this.dropPickup(m.x + simRng.range(-14, 14), m.y + simRng.range(-14, 14), "crystal");
      if (simRng.chance(0.4)) this.dropPickup(m.x, m.y, "credit", 10);
    }
  }

  // ---------- boss ----------
  updateBoss(eDt, dt) {
    const b = this.boss, p = this.player;
    if (b.dying > 0) {
      b.dying -= dt;
      if (fxRng.next() < 0.4) explosion(b.x + fxRng.range(-b.r, b.r), b.y + fxRng.range(-b.r, b.r), fxRng.next() < 0.3, GLOW.orange);
      if (b.dying <= 0) {
        explosion(b.x, b.y, true, GLOW.white);
        explosion(b.x, b.y, true, GLOW.orange);
        this.shake(18);
        this.hitStop = Math.max(this.hitStop, JUICE.hitStopBoss);
        this.boss = null;
        this.onBossDead();
      }
      return;
    }
    if (b.stun > 0) { b.stun -= eDt; return; }
    b.angle += eDt * 0.3;

    if (b.entering) {
      const ty = p.y - 420;
      b.y += (ty - b.y) * Math.min(1, eDt * 1.2);
      b.x += (p.x - b.x) * Math.min(1, eDt * 0.6);
      if (Math.abs(b.y - ty) < 60) { b.entering = false; b.patT = 0; }
      return;
    }

    // phase from hp
    const def = b.def;
    const frac = b.hp / b.maxHp;
    const phase = Math.min(def.phases - 1, Math.floor((1 - frac) * def.phases));
    if (phase !== b.phase) {
      b.phase = phase;
      b.flash = 0.5;
      this.hitStop = Math.max(this.hitStop, JUICE.hitStopBig);
      this.emit("sfx", "alarm");
      this.shake(8);
      // phase-change burst
      for (let i = 0; i < 16; i++) this.spawnEnemyBullet(b.x, b.y, (i / 16) * TAU, 220 + phase * 30, def.dmg * 0.8);
      spawnGlow(b.x, b.y, 500, 30, GLOW.magenta, 0.6, 20);
    }
    if (b.flash > 0) b.flash -= dt;

    // movement: keep distance unless charging
    const dx = p.x - b.x, dy = p.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    if (b.chargeV) {
      b.x += b.chargeV.x * eDt; b.y += b.chargeV.y * eDt;
      b.chargeV.t -= eDt;
      spawnGlow(b.x, b.y, 100, 2, GLOW.magenta, 0.3, 14);
      if (p.alive && p.iframes <= 0 && d < b.r + 20) { this.hurtPlayer(def.dmg * 1.5); }
      if (b.chargeV.t <= 0) b.chargeV = null;
    } else {
      const want = 380;
      const sp = def.speed * this.diff.speed * (1 + b.phase * 0.15);
      const strafe = Math.sin(this.time * 0.7) * 0.8;
      let mx = 0, my = 0;
      if (d > want + 60) { mx = dx / d; my = dy / d; }
      else if (d < want - 60) { mx = -dx / d; my = -dy / d; }
      mx += -dy / d * strafe; my += dx / d * strafe;
      b.x += mx * sp * eDt; b.y += my * sp * eDt;
    }

    // patterns cycle within current phase
    b.patT -= eDt;
    if (b.patT <= 0 && !b.beam && !b.chargeV) {
      const pats = def.patterns;
      const pat = pats[b.patternI % pats.length];
      b.patternI++;
      b.patT = 2.6 - Math.min(1.2, b.phase * 0.3);
      this.runBossPattern(pat, d, dx, dy);
    }

    // active beam
    if (b.beam) {
      const bm = b.beam;
      bm.t += eDt;
      if (bm.t < bm.warn) {
        // telegraph only
      } else {
        bm.a += bm.rotV * eDt;
        // damage if player near the ray
        if (p.alive && p.iframes <= 0) {
          const rel = Math.atan2(p.y - b.y, p.x - b.x);
          let da = rel - bm.a;
          while (da > Math.PI) da -= TAU;
          while (da < -Math.PI) da += TAU;
          if (Math.abs(da) < 0.09 && d < bm.len) this.hurtPlayer(def.dmg * 2.2 * eDt * 3);
        }
        if (fxRng.next() < 0.5) {
          const rr = fxRng.range(b.r, bm.len);
          spawnGlow(b.x + Math.cos(bm.a) * rr, b.y + Math.sin(bm.a) * rr, 40, 1, GLOW.magenta, 0.2, 8);
        }
      }
      if (bm.t > bm.warn + bm.dur) b.beam = null;
    }
  }

  runBossPattern(pat, d, dx, dy) {
    const b = this.boss, def = b.def;
    const aimA = Math.atan2(dy, dx);
    if (pat === "ring") {
      const n = 14 + b.phase * 4;
      for (let i = 0; i < n; i++) this.spawnEnemyBullet(b.x, b.y, (i / n) * TAU + b.spiralA, 240, def.dmg);
      b.spiralA += 0.3;
      this.emit("sfx", "enemyShot");
    } else if (pat === "aimed") {
      const n = 5 + b.phase;
      for (let i = 0; i < n; i++) this.spawnEnemyBullet(b.x, b.y, aimA + (i - (n - 1) / 2) * 0.13, 420, def.dmg);
      this.emit("sfx", "enemyShot");
    } else if (pat === "spiral") {
      // schedule a short spiral burst via bomb-less rapid ring segments
      const n = 24;
      for (let i = 0; i < n; i++) {
        const bl = this.spawnEnemyBullet(b.x, b.y, b.spiralA + i * 0.26, 200 + i * 6, def.dmg * 0.9);
        if (bl) bl.life = 4;
      }
      b.spiralA += 0.9;
      this.emit("sfx", "plasma");
    } else if (pat === "beamsweep") {
      b.beam = { a: aimA, rotV: (b.patternI % 2 ? 1 : -1) * (0.7 + b.phase * 0.15), t: 0, warn: 0.9, dur: 2.6, len: 900 };
      this.emit("sfx", "alarm");
    } else if (pat === "charge") {
      const sp = 640 + b.phase * 60;
      b.chargeV = { x: dx / d * sp, y: dy / d * sp, t: Math.min(1.1, d / sp + 0.15) };
      this.emit("sfx", "boost");
    } else if (pat === "lightning") {
      for (let i = 0; i < 3 + b.phase; i++) {
        this.strikes.push({ x: this.player.x + simRng.range(-300, 300), y: this.player.y + simRng.range(-300, 300), t: 1.0, r: 90 });
      }
    } else if (pat === "ghost") {
      b.x = this.player.x + Math.cos(simRng.angle()) * 500;
      b.y = this.player.y + Math.sin(simRng.angle()) * 500;
      spawnGlow(b.x, b.y, 300, 20, GLOW.violet, 0.5, 18);
    } else if (pat === "cross") {
      // four rotating arms of bullets
      const arms = 4, per = 3 + b.phase;
      for (let a = 0; a < arms; a++) {
        const base = b.spiralA + a * (TAU / arms);
        for (let i = 0; i < per; i++) this.spawnEnemyBullet(b.x, b.y, base, 300 + i * 90, def.dmg);
      }
      b.spiralA += 0.42;
      this.emit("sfx", "enemyShot");
    } else if (pat === "wall") {
      // a dense wall aimed at the player with a small gap to dodge through
      const n = 16 + b.phase * 2, spanA = 1.1, gap = simRng.int(2, n - 3);
      for (let i = 0; i < n; i++) {
        if (i === gap || i === gap + 1) continue;
        this.spawnEnemyBullet(b.x, b.y, aimA + (i / (n - 1) - 0.5) * spanA, 360, def.dmg);
      }
      this.emit("sfx", "enemyShot");
    } else if (pat === "nova") {
      // two expanding rings at different speeds, offset
      const n = 16 + b.phase * 2;
      for (let i = 0; i < n; i++) {
        this.spawnEnemyBullet(b.x, b.y, (i / n) * TAU, 210, def.dmg);
        this.spawnEnemyBullet(b.x, b.y, (i / n) * TAU + Math.PI / n, 330, def.dmg);
      }
      this.emit("sfx", "plasma");
    } else if (pat === "snipe") {
      // three fast precise shots straight at the player
      for (let i = 0; i < 3; i++) this.spawnEnemyBullet(b.x, b.y, aimA + (i - 1) * 0.05, 620, def.dmg * 1.1);
      this.emit("sfx", "enemyShot");
    } else if (pat.startsWith("spawn:")) {
      const type = pat.slice(6);
      const n = 2 + Math.floor(b.phase / 2);
      for (let i = 0; i < n; i++) this.spawnEnemy(type, 1, true);
    }
  }

  damageBoss(dmg) {
    const b = this.boss;
    if (!b || b.entering || b.dying > 0) return;
    b.hp -= dmg;
    b.hitFlash = 0.06;
  }

  onBossDead() {
    if (this.mode === "bossrush") {
      this.rushIdx++;
      this.addScore(3000);
      if (this.rushIdx >= 10) { this.setState("victory"); this.emit("achieve", "bossRush"); return; }
      // heal + draft between bosses
      const p = this.player, st = this.stats;
      p.hull = Math.min(st.maxHull, p.hull + st.maxHull * 0.35);
      p.shield = st.maxShield;
      this.offerDraft();
      this.setState("bossWarn");
    } else if (this.mode === "gauntlet") {
      this.gauntletIdx++;
      this.addScore(GAUNTLET.scorePerBoss);
      if (this.gauntletIdx === 10) this.emit("achieve", "gauntlet10");
      // heal + draft between bosses, then straight into the next one — infinite loop
      const p = this.player, st = this.stats;
      p.hull = Math.min(st.maxHull, p.hull + st.maxHull * GAUNTLET.healFrac);
      p.shield = st.maxShield;
      this.offerDraft();
      this.setState("bossWarn");
    } else if (this.mode === "endless") {
      this.emit("music", "combat");
      this.setState("between");
    } else {
      this.setState("victory");
    }
  }

  // ---------- damage to player ----------
  hurtPlayer(dmg, dot = false) {
    const p = this.player, st = this.stats;
    if (!p.alive || p.iframes > 0 || p.buffs.invuln > 0 || this.state === "victory") return;
    dmg *= (1 - st.armor);
    this.tookDamage = true;
    p.hitT = 0;
    if (p.shield > 0) {
      p.shield -= dmg;
      if (!dot) this.emit("sfx", "shieldHit");
      p.shieldFlash = 0.3;
      if (p.shield < 0) { p.hull += p.shield; p.shield = 0; }
    } else {
      p.hull -= dmg;
      if (!dot) { this.emit("sfx", "hit"); this.shake(4); }
      this.hurtFlash = 0.25;
    }
    if (p.hull <= 25 && !this._lowWarned) { this._lowWarned = true; this.emit("sfx", "alarm"); }
    if (p.hull > 30) this._lowWarned = false;
    if (p.hull <= 0) {
      p.hull = 0; p.alive = false; p.deadT = 0;
      explosion(p.x, p.y, true, GLOW.orange);
      explosion(p.x, p.y, true, GLOW.white);
      this.shake(14);
      this.setState("defeat");
    }
  }

  shake(amt) { if (this.shakeEnabled) this.cam.shake = Math.min(18, Math.max(this.cam.shake, amt)); }

  // ---------- rendering ----------
  render(g, w, h) {
    this._w = w; this._h = h;
    const cam = this.cam;
    const sx = cam.x - w / 2 + (cam.shake ? (fxRng.next() - 0.5) * cam.shake : 0);
    const sy = cam.y - h / 2 + (cam.shake ? (fxRng.next() - 0.5) * cam.shake : 0);

    // nebula background with soft parallax
    if (this.bg) {
      const bw = Math.max(w, h * 16 / 9) * 1.15;
      const bh = bw * 9 / 16;
      const ox = -((cam.x * 0.05) % 80) - 40, oy = -((cam.y * 0.05) % 80) - 40;
      g.drawImage(this.bg, (w - bw) / 2 + ox, (h - bh) / 2 + oy, bw, bh);
    } else {
      g.fillStyle = PAL.space0; g.fillRect(0, 0, w, h);
    }

    // planet orb (world-anchored, slow spin)
    if (this.planetImg) {
      const px = -900 - sx * 0.25, py = -700 - sy * 0.25;
      if (px > -600 && px < w + 600 && py > -600 && py < h + 600) {
        g.save();
        g.translate(px, py);
        g.rotate(this.planetRot);
        g.drawImage(this.planetImg, -256, -256);
        g.restore();
      }
    }

    // parallax star dust (world-space, wrapping around camera)
    g.save();
    for (const s of this.dust) {
      const xx = wrap(s.x - cam.x * s.z, 1400) + w / 2 - 700;
      const yy = wrap(s.y - cam.y * s.z, 1400) + h / 2 - 700;
      g.globalAlpha = 0.25 + s.z * 0.5;
      g.fillStyle = s.z > 0.8 ? "#dfe9ff" : "#8b96c9";
      g.fillRect(xx, yy, s.z > 0.8 ? 2 : 1, s.z > 0.8 ? 2 : 1);
    }
    g.restore();
    g.globalAlpha = 1;

    // arena boundary glow
    this.drawArenaBounds(g, sx, sy, w, h);

    // gravity wells
    for (const wl of this.wells) {
      const x = wl.x - sx, y = wl.y - sy;
      if (x < -400 || x > w + 400 || y < -400 || y > h + 400) continue;
      const gr = g.createRadialGradient(x, y, 8, x, y, wl.r);
      gr.addColorStop(0, "rgba(10,6,22,0.95)");
      gr.addColorStop(0.35, "rgba(60,32,110,0.4)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(x - wl.r, y - wl.r, wl.r * 2, wl.r * 2);
      g.save();
      g.translate(x, y);
      g.rotate(this.time * 1.6);
      g.strokeStyle = "rgba(199,107,255,0.5)";
      g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, 30 + Math.sin(this.time * 3) * 6, 0.4, 2.6); g.stroke();
      g.beginPath(); g.arc(0, 0, 48 + Math.cos(this.time * 2.2) * 8, 3.5, 5.6); g.stroke();
      g.restore();
    }

    // spore clouds
    for (const c of this.clouds) {
      const x = c.x - sx, y = c.y - sy;
      if (x < -c.r - 80 || x > w + c.r + 80 || y < -c.r - 80 || y > h + c.r + 80) continue;
      const gr = g.createRadialGradient(x, y, 10, x, y, c.r);
      gr.addColorStop(0, "rgba(125,255,154,0.16)");
      gr.addColorStop(0.7, "rgba(80,180,90,0.10)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(x - c.r, y - c.r, c.r * 2, c.r * 2);
    }

    // lightning telegraphs
    for (const s of this.strikes) {
      const x = s.x - sx, y = s.y - sy;
      g.save();
      g.globalAlpha = 0.5 + Math.sin(this.time * 20) * 0.2;
      g.strokeStyle = "#7de0ff";
      g.lineWidth = 2;
      g.setLineDash([6, 6]);
      g.beginPath(); g.arc(x, y, s.r * (1.4 - s.t * 0.4), 0, TAU); g.stroke();
      g.setLineDash([]);
      g.restore();
    }

    // pickups
    const atlas = this.atlas;
    this.pickups.each((pk) => {
      const x = pk.x - sx, y = pk.y - sy;
      if (x < -40 || x > w + 40 || y < -40 || y > h + 40) return;
      const bob = Math.sin(this.time * 4 + pk.x) * 3;
      const spr = atlas.pickups[pk.kind] || atlas.pickups.power;
      const blink = pk.t < 3 && Math.sin(this.time * 12) > 0 ? 0.3 : 1;
      g.globalAlpha = blink;
      g.drawImage(spr, x - 24, y - 24 + bob);
      g.globalAlpha = 1;
    });

    // meteors
    this.meteors.each((m) => {
      const x = m.x - sx, y = m.y - sy;
      if (x < -80 || x > w + 80 || y < -80 || y > h + 80) return;
      g.save();
      g.translate(x, y);
      g.rotate(m.rot);
      const spr = atlas.asteroids[m.spr];
      const s = m.r * 2.4;
      g.drawImage(spr, -s / 2, -s / 2, s, s);
      g.restore();
    });

    // enemies
    this.enemies.each((e) => {
      const x = e.x - sx, y = e.y - sy;
      if (x < -80 || x > w + 80 || y < -80 || y > h + 80) return;
      const spr = this.enemySprite(e);
      g.save();
      g.translate(x, y);
      g.rotate(e.angle || 0);
      g.globalAlpha = e.type === "ghost" ? e.alpha : 1;
      if (e.stun > 0) g.globalAlpha *= 0.5 + Math.sin(this.time * 16) * 0.3;
      const s = e.r * 3;
      g.drawImage(spr, -s / 2, -s / 2, s, s);
      if (e.flash > 0) {
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = e.flash * 8;
        g.drawImage(spr, -s / 2, -s / 2, s, s);
      }
      g.restore();
      // shield bubble
      if (e.shieldHp > 0) {
        g.save();
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = 0.35;
        g.strokeStyle = "#41f7d2";
        g.lineWidth = 2;
        g.beginPath(); g.arc(x, y, e.r + 10, 0, TAU); g.stroke();
        g.restore();
      }
      // sniper telegraph line
      if (e.telegraph > 0) {
        const p = this.player;
        g.save();
        g.globalAlpha = 0.5;
        g.strokeStyle = "#ff5ad1";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(p.x - sx, p.y - sy);
        g.stroke();
        g.restore();
      }
    });

    // boss
    if (this.boss) this.drawBoss(g, sx, sy, w, h);

    // player
    if (this.player.alive) this.drawPlayer(g, sx, sy);

    // missiles
    this.missiles.each((m) => {
      const x = m.x - sx, y = m.y - sy;
      g.save();
      g.translate(x, y);
      g.rotate(m.a + Math.PI / 2);
      g.drawImage(atlas.missile, -16, -16);
      g.restore();
    });

    // bullets (additive)
    g.save();
    g.globalCompositeOperation = "lighter";
    const glows = [atlas.glowCyan, atlas.glowMagenta, atlas.glowTeal, atlas.glowViolet, atlas.glowOrange, atlas.glowWhite, atlas.glowGreen];
    this.bullets.each((b) => {
      const x = b.x - sx, y = b.y - sy;
      if (x < -30 || x > w + 30 || y < -30 || y > h + 30) return;
      const spr = glows[b.glow];
      const s = b.size * 3.2;
      // motion streak
      g.globalAlpha = 0.45;
      g.drawImage(spr, x - b.vx * 0.012 - s / 2, y - b.vy * 0.012 - s / 2, s, s);
      g.globalAlpha = 1;
      g.drawImage(spr, x - s / 2, y - s / 2, s, s);
    });
    g.restore();

    // EMP ring
    if (this.empRing) {
      const r = this.empRing;
      const f = 1 - r.t / r.max;
      g.save();
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 1 - f;
      g.strokeStyle = "#7de0ff";
      g.lineWidth = 6 * (1 - f) + 1;
      g.beginPath(); g.arc(r.x - sx, r.y - sy, r.r * f, 0, TAU); g.stroke();
      g.restore();
    }

    drawParticles(g, sx, sy, w, h);
    drawTexts(g, sx, sy);

    // nuke / damage screen flashes
    if (this.nukeFlash > 0 && !this.reducedFlash) {
      g.fillStyle = `rgba(255,240,220,${Math.min(0.85, this.nukeFlash)})`;
      g.fillRect(0, 0, w, h);
    }
    if (this.hurtFlash > 0) {
      if (!this.reducedFlash) {
        const gr = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.75);
        gr.addColorStop(0, "rgba(0,0,0,0)");
        gr.addColorStop(1, `rgba(255,40,60,${this.hurtFlash})`);
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
      }
      this.hurtFlash -= 0.02;
    }
  }

  enemySprite(e) {
    const a = this.atlas, t = e.type;
    if (t === "scout") return a.scout;
    if (t === "sniper") return a.scoutSniper;
    if (t === "ghost") return a.scoutGhost;
    if (t === "pirate") return a.scoutPirate;
    if (t === "heavy") return a.heavy;
    if (t === "shield") return a.heavyShield;
    if (t === "elite") return a.heavyElite;
    if (t === "drone") return a.drone;
    if (t === "bomber") return a.bomber;
    if (t === "turret") return a.turret;
    return a.scout;
  }

  drawPlayer(g, sx, sy) {
    const p = this.player, atlas = this.atlas;
    const x = p.x - sx, y = p.y - sy;
    // shield bubble
    if (p.shieldFlash > 0 || p.buffs.invuln > 0) {
      g.save();
      g.globalCompositeOperation = "lighter";
      const a = p.buffs.invuln > 0 ? 0.5 + Math.sin(this.time * 10) * 0.2 : p.shieldFlash;
      g.globalAlpha = Math.max(0, a);
      const gr = g.createRadialGradient(x, y, 16, x, y, 34);
      gr.addColorStop(0, "rgba(125,224,255,0)");
      gr.addColorStop(0.8, "rgba(125,224,255,0.5)");
      gr.addColorStop(1, "rgba(125,224,255,0)");
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, 34, 0, TAU); g.fill();
      g.restore();
      if (p.shieldFlash > 0) p.shieldFlash -= 0.02;
    }
    g.save();
    g.translate(x, y);
    g.rotate(p.aim + Math.PI / 2);
    if (p.iframes > 0) g.globalAlpha = 0.5 + Math.sin(this.time * 30) * 0.3;
    g.drawImage(atlas.hero, -32, -32, 64, 64);
    g.restore();
  }

  drawBoss(g, sx, sy, w, h) {
    const b = this.boss, atlas = this.atlas;
    const x = b.x - sx, y = b.y - sy;
    const spr = b.kind === "mech" ? atlas.bossMech : atlas.bossOrganic;
    const s = b.r * 3.2;
    g.save();
    g.translate(x, y);
    g.rotate(b.kind === "organic" ? b.angle * 0.5 : Math.sin(b.angle) * 0.15);
    if (b.dying > 0) g.globalAlpha = Math.max(0.2, b.dying / 2.2);
    g.drawImage(spr, -s / 2, -s / 2, s, s);
    if (b.hitFlash > 0) {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = b.hitFlash * 10;
      g.drawImage(spr, -s / 2, -s / 2, s, s);
      b.hitFlash -= 0.016;
    }
    g.restore();
    // beam
    if (b.beam) {
      const bm = b.beam;
      g.save();
      if (bm.t < bm.warn) {
        g.globalAlpha = 0.5 + Math.sin(this.time * 20) * 0.3;
        g.strokeStyle = "#ff5ad1";
        g.lineWidth = 2;
        g.setLineDash([10, 8]);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(bm.a) * bm.len, y + Math.sin(bm.a) * bm.len);
        g.stroke();
        g.setLineDash([]);
      } else {
        g.globalCompositeOperation = "lighter";
        const ex = x + Math.cos(bm.a) * bm.len, ey = y + Math.sin(bm.a) * bm.len;
        const gr = g.createLinearGradient(x, y, ex, ey);
        gr.addColorStop(0, "rgba(255,90,209,0.95)");
        gr.addColorStop(1, "rgba(255,90,209,0)");
        g.strokeStyle = gr;
        g.lineWidth = 14 + Math.sin(this.time * 30) * 4;
        g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke();
        g.strokeStyle = "rgba(255,255,255,0.9)";
        g.lineWidth = 4;
        g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke();
      }
      g.restore();
    }
  }

  drawArenaBounds(g, sx, sy, w, h) {
    const A = WORLD.arena;
    g.save();
    g.strokeStyle = "rgba(125,224,255,0.22)";
    g.lineWidth = 2;
    g.setLineDash([14, 18]);
    g.strokeRect(-A - sx, -A - sy, A * 2, A * 2);
    g.setLineDash([]);
    g.restore();
  }

  // data for HUD / radar
  radarBlips(out) {
    out.length = 0;
    this.enemies.each((e) => out.push({ x: e.x, y: e.y, k: 0 }));
    if (this.boss) out.push({ x: this.boss.x, y: this.boss.y, k: 1 });
    this.pickups.each((p) => { if (p.kind === "artifact" || p.kind === "power") out.push({ x: p.x, y: p.y, k: 2 }); });
    return out;
  }

  devStats() {
    return { bullets: this.bullets.count(), enemies: this.enemies.count(), particles: particleCount() };
  }
}

function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
function wrap(v, range) { return ((v % range) + range) % range; }
