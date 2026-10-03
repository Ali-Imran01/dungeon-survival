// Dungeon Survival engine: world state, update loop, combat, progression, rendering.
// Content lives in stages.js (biomes/enemies/bosses), enemies.js (regular AI), bosses.js (boss AI + attacks).
// Note: this file and classes.js/enemies.js/bosses.js import from each other (engine exports combat helpers
// they call, they export step/spawn functions engine calls). Fine in ES modules as long as nothing runs at
// module-eval time — every cross-import here is only ever called from inside a function, after load finishes.
import { PAL, DIM, WHITE, WISP, HAWK, FAMILIAR, BOMB, BOMB_PAL, CAT, CAT_PAL, IMP, IMP_PAL, SKEL, SKEL_PAL, ICONS, spr, drawHero } from "./sprites.js";
import { sfx } from "./audio.js";
import { PU, applyPU, pickPU, tickFx, lv } from "./powerups.js";
import { CLASSES, GUN, ASN, NEC, stepLanding } from "./classes.js";
import { STAGES, KILLS_NEED, PHASE_FALLBACK, SPAWN_BASE, LOOP } from "./stages.js";
import { XP, SHARD, rollChoices, computeMods, UPGRADES } from "./upgrades.js";
import { stepEnemies, spawnMob, drawEnemies, enemyLights, stepSpawns, drawGates } from "./enemies.js";
import { spawnBoss, stepBoss, drawBoss, bossDamageMul } from "./bosses.js";
import { drawHUD } from "./hud.js";
import { onIce } from "./biomes/ice.js";
import { ventState, inVent, LAVA } from "./biomes/lava.js";
import { drawDarkness, VOID } from "./biomes/void.js";

export let W = 240;
export let H = 135;

// desktop is 240x135, the compact Game Boy-style layout is 160x144
export function fitSize(gb) {
  [W, H] = gb ? [160, 144] : [240, 135];
  return [W, H];
}

export const WALL = 14;

// Passive armour (every class): plates absorb hits before hearts.
// A broken plate returns after `repair` s while some armour remains. When the LAST plate breaks, a blast pushes mobs
// away, and the first plate takes `firstRepair` s to return (then `repair` s for each of the rest).
// Hearts only take damage at 0 plates.
export const ARMOR = {
  plates: 3, repair: 5, firstRepair: 15, resetOnHit: false,
  blast: { r: 34, push: 38, dmg: 0.5, inv: 1.5, stun: 0.8 },
};

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DOC = () => globalThis.document;

// ---------- state ----------
export function newGame(cls = "warden", stage = 1, opts = {}) {
  const C = CLASSES[cls];
  const g = {
    cls, maxHp: C.hp, t: 0, score: 0, kills: 0, totalKills: 0, over: false, won: false, endless: false, loop: 0,
    rooms: opts.rooms ?? true, gates: [], sides: [2], sideT: 7, room: 0, door: null, trans: null,
    p: {
      x: W / 2 - 8, y: H / 2 - 8, vx: 0, vy: 0, face: 1,
      dash: 0, dashV: [1, 0], dashSp: 0, dashHit: new Set(),
      cd: 0, inv: 0, hp: C.hp, moving: false, dir: null,
      atk: 0, acd: 0, hitDone: true, shield: false, chillT: 0, swings: 0, pull: 0, slowArea: false,
      ammo: C.mag || 0, reload: 0, reloading: false, aimT: 0, aimA: 0,
      charges: 1, chT: 0, ambush: 0, hitAt: 0.1,
    },
    bombs: [], rush: { n: 0, t: 0 }, decoy: null, minions: [], fog: [], ts: 1,
    stage, phase: 0, phaseClock: 0, boss: null, biome: null, biomeGrow: 1, ventT: 0,
    vision: W < 200 ? VOID.vision.playerGB : VOID.vision.player,
    bounds: null, collapse: 0, tempPatches: [],
    en: [], shots: [], eb: [], hz: [], parts: [], rings: [], pu: [], shards: [], timers: [],
    fx: {}, owned: {}, mods: computeMods({}, cls), lv: 1, xp: 0, levelQueue: 0, pending: null, rerolls: 1,
    armor: { n: ARMOR.plates, max: ARMOR.plates, t: 0 },
    stats: { plates: 0, blasts: 0, heartHits: 0, noArmorT: 0 },
    guardT: 30, harvestN: 0, swUsed: false, puT: 15, spawn: 1, fire: 0, novaT: 0, msg: "", msgT: 0,
    comp: { x: W / 2 + 12, y: H / 2, mode: "perch", cd: 1, ch: 2, rc: 0, vx: 1, tgt: null, extra: 0 },
  };
  resetBounds(g);
  stageMsg(g);
  return g;
}

function resetBounds(g) {
  g.bounds = { x0: 0, y0: WALL - 8, x1: W - 16, y1: H - 17 };
}

function stageMsg(g) {
  const loopLabel = g.loop ? ` · LOOP ${g.loop + 1}` : "";
  g.msg = `STAGE ${g.stage}: ${STAGES[g.stage - 1].name}${loopLabel}`;
  g.msgT = 2.5;
}

export const stageOf = g => STAGES[g.stage - 1];

// (re)build the stage's background canvas when the stage, screen size, flood level or room changes
function ensureBiome(g) {
  const key = `${g.stage}|${W}|${g.biomeGrow}|${g.room}`;
  if (g.biome && g.biome.key === key) return;
  g.biome = { ...stageOf(g).build(W, H, WALL, DOC(), g), key };

  // room 2 reads differently from room 1 (stage 1 has its own palette)
  const tint = g.room && stageOf(g).roomTint;
  if (tint) {
    const c = g.biome.cv.getContext("2d");
    c.globalCompositeOperation = "source-atop";
    c.globalAlpha = 0.16 * g.room;
    c.fillStyle = tint;
    c.fillRect(0, 0, W, H);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
  }
}

// ---------- helpers used by classes / enemies / bosses ----------
export const center = (g, t) => [t.x + t.w / 2, t.y + t.h / 2];
export const alive = (g, t) => !!t && (t === g.boss ? t.hp > 0 : t.hp > 0 && g.en.includes(t));
export const pc = g => [g.p.x + 8, g.p.y + 10];   // player centre

export function burst(g, x, y, n, c, sp = 80) {
  for (let i = 0; i < n; i++) {
    g.parts.push({ x, y, vx: (Math.random() - 0.5) * sp, vy: (Math.random() - 0.5) * sp, l: 0.5, c });
  }
}

export const after = (g, t, fn) => g.timers.push({ t, fn });

// timed hazard (telegraphed circle, line, cone ...). Returns the hazard so callers can tweak it.
export function addHz(g, h) {
  const hazard = { t: 0, delay: 0, dur: 0, ...h };
  g.hz.push(hazard);
  return hazard;
}

// enemy / boss bullet; `o` overrides the defaults
export function shootE(g, x, y, a, sp, o = {}) {
  g.eb.push({
    x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, sp, l: 5, c: "#ff4a6a", size: 1,
    ...o,
    ox: x, oy: y, dist: 0,
  });
}

// closest living enemy (or the boss) within `range` of (x, y). `filter` gets the angle to the target.
export function nearest(g, x, y, range, filter) {
  let best = null;
  let bestDist = range;
  const test = (t, pad) => {
    const [tx, ty] = center(g, t);
    const d = Math.hypot(tx - x, ty - y) - pad;
    if (d < bestDist && (!filter || filter(Math.atan2(ty - y, tx - x)))) {
      bestDist = d;
      best = { x: tx, y: ty, ref: t, d };
    }
  };
  for (const e of g.en) {
    if (e.hp > 0 && !(e.rise > 0) && !e.harmless) test(e, 0);
  }
  if (g.boss && g.boss.mode !== "enter") test(g.boss, g.boss.w / 2 - 4);
  return best;
}

export function fireShot(g, o) {
  g.shots.push({ ...o, vx: Math.cos(o.a) * o.sp, vy: Math.sin(o.a) * o.sp, pierce: o.pierce || 0, hitSet: new Set() });
}

export const onIceAt = (g, x, y) =>
  stageOf(g).rule === "ice" && !!g.biome && (onIce(g.biome.patches, x, y) || onIce(g.tempPatches, x, y));
export const inWaterAt = (g, x, y) => stageOf(g).rule === "water" && !!g.biome?.inWater?.(x, y);

export function msg(g, m, t = 1.4) {
  g.msg = m;
  g.msgT = t;
}

// ---------- damage ----------
export function dealDmg(g, t, n, fromPlayer = true) {
  if (fromPlayer) n *= g.mods.dmg;
  if (t.mark > 0) n *= ASN.markMul;                     // Shade Cat mark: +50% damage taken

  // Soul Rot (Necromancer): 30% of the damage lands again 2s later
  if (fromPlayer && g.mods.replay) {
    const replayDmg = n * 0.3;
    after(g, 2, () => {
      if (t === g.boss ? g.boss.hp > 0 : g.en.includes(t) && t.hp > 0) {
        dealDmg(g, t, replayDmg, false);
        burst(g, t.x + t.w / 2, t.y + t.h / 2, 3, "#9fe8ee", 40);
      }
    });
  }

  if (t === g.boss) return damageBoss(g, n * bossDamageMul(g, t));
  if (t.harmless) {
    t.hp = 0;
    burst(g, t.x + 4, t.y + 1, 6, "#e8e4d8");
    return;
  }
  t.hp -= n;
  t.hit = 0.1;
  if (t.hp <= 0) kill(g, t);
}

// damage everything within r of (x, y) except one target (the one that was hit directly)
function splash(g, x, y, r, n, except) {
  for (const e of g.en) {
    if (e !== except && e.hp > 0 && !(e.rise > 0) && Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y) < r) {
      dealDmg(g, e, n);
    }
  }
  const b = g.boss;
  if (b && b !== except && Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y) < r + b.w / 2) dealDmg(g, b, n);
}

// slow everything within r of (x, y)
function chill(g, x, y, r) {
  const m = g.mods;
  for (const e of g.en) {
    if (Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y) < r + 2) {
      e.slow = Math.max(e.slow || 0, m.chillTime);
      e.slowMul = m.chillMul;
    }
  }
  const b = g.boss;
  if (b && Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y) < r + b.w / 2) b.slow = Math.max(b.slow, m.chillTime);
}

const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// Sword sweep = a sector centred on p.swingA (base 110°, +20° per Wide Arc). `reach` is measured from the hero's
// centre to the target's EDGE, so what the slash arc shows is what actually gets hit. all = full circle (whirlwind).
// meleeHit and drawSwing/drawStab (below) both read the same p.swing.reach/arc — the hit sector and the drawn arc
// can't drift apart because they're literally the same numbers, not two independent ones kept in sync by hand.
export function meleeHit(g, reach, dmg, all = false, arcDeg, o = {}) {
  const p = g.p;
  const [cx, cy] = pc(g);
  const half = (arcDeg ?? 110 + g.mods.arc) * Math.PI / 360;
  const centreAngle = p.swingA ?? (p.face > 0 ? 0 : Math.PI);
  const knock = o.knock ?? 10;
  let hits = 0;

  // is the thing at offset (ex, ey) with radius r inside the swing?
  const inSector = (ex, ey, r) =>
    all || Math.abs(angDiff(Math.atan2(ey, ex), centreAngle)) <= half + Math.atan2(r, Math.hypot(ex, ey) || 1);

  for (const e of [...g.en]) {
    const ex = e.x + e.w / 2 - cx;
    const ey = e.y + e.h / 2 - cy;
    const dist = Math.hypot(ex, ey) || 1;
    const r = (e.w + e.h) / 4;
    if (e.hp > 0 && !(e.rise > 0) && dist - r < reach && inSector(ex, ey, r)) {
      if (!e.harmless && !e.fixed) {
        e.x += ex / dist * knock;
        e.y += ey / dist * knock;
      }
      if (o.stun && !e.harmless) e.stun = Math.max(e.stun || 0, o.stun);
      hits++;
      dealDmg(g, e, dmg);
    }
  }

  const b = g.boss;
  if (b && b.mode !== "enter") {
    const ex = b.x + b.w / 2 - cx;
    const ey = b.y + b.h / 2 - cy;
    const dist = Math.hypot(ex, ey) || 1;
    if (dist - b.w / 2 < reach && inSector(ex, ey, b.w / 2)) {
      hits++;
      if (o.stun) b.stun = Math.max(b.stun || 0, o.stun);
      dealDmg(g, b, dmg);
    }
  }

  // swords also cut enemy bullets out of the air
  for (const s of g.eb) {
    if (!s.hp) continue;
    const ex = s.x - cx;
    const ey = s.y - cy;
    if (Math.hypot(ex, ey) < reach && inSector(ex, ey, 0)) {
      s.hp = 0;
      s.l = 0;
      burst(g, s.x, s.y, 5, s.c);
    }
  }

  if (hits) {
    navigator.vibrate?.(15);
    sfx("hit");
  }
}

// Plate-break state machine: a normal break just (re)starts the repair timer; the LAST plate breaking is special —
// it also fires blast() and switches to the longer firstRepair timer instead of repair (see armour regen in step()).
function breakPlate(g) {
  const p = g.p;
  const armor = g.armor;
  armor.n--;
  g.stats.plates++;
  p.inv = 1;
  navigator.vibrate?.(40);
  sfx("armor");
  burst(g, p.x + 8, p.y + 8, 8, "#cfd6e6", 90);

  if (armor.n === 0) {
    armor.t = ARMOR.firstRepair;
    blast(g);
    p.inv = ARMOR.blast.inv;
    msg(g, "ARMOUR BROKEN!", 1.4);
  } else if (ARMOR.resetOnHit || armor.t <= 0) {
    armor.t = ARMOR.repair;                 // resetOnHit: repair only starts after `repair` s without a hit
  }
}

// Blast when the last plate breaks: pushes mobs away, 0.5 dmg (scales with damage upgrades), clears bullets, staggers bosses.
function blast(g) {
  const B = ARMOR.blast;
  const [cx, cy] = pc(g);
  g.stats.blasts++;
  sfx("blast");

  for (const e of [...g.en]) {
    if (e.rise > 0) continue;
    const ex = e.x + e.w / 2 - cx;
    const ey = e.y + e.h / 2 - cy;
    const dist = Math.hypot(ex, ey) || 1;
    if (dist < B.r + e.w / 2) {
      if (!e.harmless && !e.fixed) {
        e.x += ex / dist * B.push;
        e.y += ey / dist * B.push;
      }
      dealDmg(g, e, B.dmg);
    }
  }

  const b = g.boss;
  if (b && b.mode !== "enter") {
    const ex = b.x + b.w / 2 - cx;
    const ey = b.y + b.h / 2 - cy;
    const dist = Math.hypot(ex, ey) || 1;
    if (dist < B.r + b.w / 2) {
      b.x += ex / dist * 6;
      b.y += ey / dist * 6;
      b.stun = B.stun;
      dealDmg(g, b, B.dmg);
    }
  }

  for (const s of g.eb) {
    if (Math.hypot(s.x - cx, s.y - cy) < B.r) {
      s.l = 0;
      burst(g, s.x, s.y, 3, s.c);
    }
  }
  g.rings.push({ x: cx, y: cy - 2, r: 4, max: B.r * 1.15, l: 0.3, big: true });
  burst(g, cx, cy - 2, 22, "#ffffff", 150);
}

// returns true if the hit connected (shield / plate / heart), false if the player was invulnerable
export function hurt(g, dmg = 1) {
  const p = g.p;
  if (p.inv > 0 || g.over) return false;

  if (p.shield) {
    p.shield = false;
    p.inv = 0.8;
    msg(g, "Shield broke", 1.2);
    sfx("shield");
    return true;
  }
  if (g.armor.n > 0) {
    breakPlate(g);
    return true;
  }

  // no armour left, it hits a heart
  g.stats.heartHits++;
  p.hp -= dmg;
  p.inv = 1;
  navigator.vibrate?.(60);
  sfx("hurt");
  if (p.hp <= 0 && g.mods.secondWind && !g.swUsed) {
    g.swUsed = true;
    p.hp = 1;
    p.inv = 2;
    msg(g, "Second wind!", 1.6);
    burst(g, p.x + 8, p.y + 8, 20, "#e8ffff", 120);
  }
  if (p.hp <= 0) {
    g.over = true;
    sfx("over");
  }
  return true;
}

function kill(g, e) {
  sfx("kill");
  burst(g, e.x + e.w / 2, e.y + e.h / 2, 6, e.dieC || PAL.o);
  g.score += e.pts ?? 1;
  g.totalKills++;
  if (e.xp) dropShards(g, e.x + e.w / 2, e.y + e.h / 2, e.xp);

  // only regular mobs count towards the next boss, and only outside boss fights; 12% drop a power-up
  if (!e.summon && !g.boss) {
    g.kills++;
    if (Math.random() < 0.12) dropPU(g, e.x, e.y);
  }

  // Soul Harvest: heal a heart every N kills
  if (g.mods.healEvery && ++g.harvestN >= g.mods.healEvery) {
    g.harvestN = 0;
    if (g.p.hp < g.maxHp) {
      g.p.hp++;
      msg(g, "+1 heart", 1);
    }
  }

  if (e.onDeath) e.onDeath(g, e);
  CLASSES[g.cls].onKill?.(g, e);
}

export function damageBoss(g, n) {
  const b = g.boss;
  if (!b || b.mode === "enter") return;
  b.hp -= n;
  b.hit = 0.1;
  sfx("hit");
  if (b.hp > 0) return;

  // boss is dead
  const def = b.def;
  const stageBoss = g.phase === 2;
  burst(g, b.x + b.w / 2, b.y + b.h / 2, 30, def.bc, 140);
  navigator.vibrate?.([40, 40, 80]);
  g.boss = null;
  g.eb = [];
  g.hz = g.hz.filter(h => h.owner === "player");
  g.en = g.en.filter(e => !e.summon);
  g.score += stageBoss ? 10 : 5;
  dropShards(g, b.x + b.w / 2, b.y + b.h / 2, stageBoss ? XP.shard.stageBoss : XP.shard.miniboss);

  if (def.final && !g.endless) {
    g.won = true;
    g.over = true;
    sfx("win");
    return;
  }
  sfx("bossDie");

  // miniboss: two power-ups, move on to the next phase (and open the door to the next room)
  if (!stageBoss) {
    dropPU(g, b.x, b.y + b.h / 2);
    dropPU(g, b.x + b.w, b.y + b.h / 2);
    msg(g, def.name + " defeated", 2);
    g.phase++;
    g.kills = 0;
    g.phaseClock = 0;
    if (g.rooms) openDoor(g);
    return;
  }

  // stage boss: stage clear, then the upgrade pick
  msg(g, `STAGE ${g.stage} CLEAR`, 2);
  g.clearing = true;
  after(g, 1.4, () => {
    collectAll(g);
    g.clearing = false;
    offer(g, "stage");
  });
}

// ---------- rooms: each phase is a room (regulars → its boss). A boss dying opens a door on the right wall → fade → next room ----------
function openDoor(g) {
  g.door = { x: W - 6, y: (H + WALL) / 2 };
  msg(g, "The door opens", 2);
  sfx("pickup");
}

function stepTrans(g, dt) {
  const trans = g.trans;
  trans.t += dt;

  // screen is fully faded at 0.3s: swap to the next room behind the fade
  if (trans.t >= 0.3 && !trans.swapped) {
    trans.swapped = true;
    collectAll(g);
    g.room = g.phase;
    g.door = null;
    g.biome = null;
    g.en = [];
    g.eb = [];
    g.hz = [];
    g.shots = [];
    g.gates = [];
    g.kills = 0;
    g.phaseClock = 0;
    g.spawn = 1.5;
    g.sides = [2];
    g.sideT = 7;
    Object.assign(g.p, { x: 4, y: (H + WALL) / 2 - 10, vx: 0, vy: 0, inv: 1 });
  }
  if (trans.t >= 0.6) g.trans = null;
}

// After the campaign win the UI offers "Continue": same run, same build, stage 1 again with LOOP scaling
export function continueEndless(g) {
  g.endless = true;
  g.won = false;
  g.over = false;
  collectAll(g);
  offer(g, "stage");
}

// Open an upgrade pick. With every upgrade maxed (long endless runs) there is nothing to offer: skip the pick,
// but still advance a stage clear.
function offer(g, type) {
  const choices = rollChoices(g.cls, g.owned, g.stage, type === "stage" ? "rare" : "common");
  if (choices.length) g.pending = { type, choices };
  else if (type === "stage") g.autoNext = true;    // applied at the top of step(), never mid-step
}

export function nextStage(g) {
  if (g.stage >= STAGES.length) {
    g.stage = 1;
    g.loop++;
  } else {
    g.stage++;
  }

  g.room = 0;
  g.door = null;
  g.trans = null;
  g.phase = 0;
  g.boss = null;
  g.kills = 0;
  g.phaseClock = 0;
  g.biomeGrow = 1;
  g.tempPatches = [];
  g.collapse = 0;

  g.gates = [];
  g.sides = [2];
  g.sideT = 7;
  g.en = [];
  g.eb = [];
  g.hz = [];
  g.shots = [];
  g.pu = [];
  g.shards = [];
  g.timers = [];
  g.spawn = 1.5;
  g.swUsed = false;
  g.rerolls = 1;

  g.vision = W < 200 ? VOID.vision.playerGB : VOID.vision.player;
  resetBounds(g);
  Object.assign(g.p, { x: W / 2 - 8, y: H / 2 - 8, vx: 0, vy: 0, inv: 1.5, chillT: 0, pull: 0 });

  // stage clear repairs all armour
  g.armor.n = g.armor.max;
  g.armor.t = 0;
  g.fog = [];
  g.minions = [];
  stageMsg(g);
  g.biome = null;
}

function dropShards(g, x, y, value) {
  const n = Math.min(6, Math.ceil(value / 5));
  for (let i = 0; i < n; i++) {
    g.shards.push({ x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 8, v: value / n, t: 0 });
  }
}

function collectAll(g) {
  for (const s of g.shards) addXP(g, s.v);
  g.shards = [];
}

function addXP(g, v) {
  g.xp += v;
  while (g.xp >= XP.need(g.lv)) {
    g.xp -= XP.need(g.lv);
    g.lv++;
    g.levelQueue++;
  }
}

export function dropPU(g, x, y) {
  g.pu.push({ k: pickPU(g), x: clamp(x, 4, W - 11), y: clamp(y, WALL + 4, H - 10), l: 10 });
}

// ---------- choices (called by the UI) ----------
export function chooseUpgrade(g, id) {
  const upgrade = UPGRADES.find(q => q.id === id);
  if (!upgrade || !g.pending) return;

  g.owned[id] = (g.owned[id] || 0) + 1;
  g.mods = computeMods(g.owned, g.cls);

  // a few upgrades change state right away instead of just feeding g.mods
  if (upgrade.fx.maxHp) {
    g.maxHp += upgrade.fx.maxHp;
    g.p.hp = Math.min(g.maxHp, g.p.hp + (upgrade.fx.heal || 0));
  }
  if (upgrade.fx.mag && g.cls === "gunner") g.p.ammo += upgrade.fx.mag;
  if (upgrade.fx.charges && g.cls === "assassin") g.p.charges += 1;

  const wasStage = g.pending.type === "stage";
  g.pending = null;
  sfx("pickup");
  msg(g, upgrade.name, 1.2);
  if (wasStage) nextStage(g);
}

export function rerollChoices(g) {
  if (!g.pending || g.rerolls <= 0) return;
  g.rerolls--;
  g.pending.choices = rollChoices(g.cls, g.owned, g.stage, g.pending.type === "stage" ? "rare" : "common");
}

export function triggerAbility(g) {
  const p = g.p;
  if (g.over || g.pending || p.cd > 0) return;
  p.dashHit = new Set();

  // an ability can return its own cooldown (Shadow Step does); otherwise use the class default
  const result = CLASSES[g.cls].ability(g, p.dir);
  p.cd = typeof result === "number" ? result : CLASSES[g.cls].abilityCd * g.mods.cd;

  if (g.mods.dashShield && g.cls === "warden") p.inv = Math.max(p.inv, g.mods.dashShield);
}

// ---------- companions ----------
// idle position for the companions that circle the player
export function orbit(g, t) {
  const p = g.p;
  const c = g.comp;
  const kind = CLASSES[g.cls].companion;
  if (kind === "hawk") {
    if (c.mode === "perch") {
      c.x = p.x + 8 - p.face * 10;
      c.y = p.y - 2 + Math.sin(t * 4) * 1.5;
      c.vx = p.face;
    }
  } else if (kind === "familiar") {
    const a = t * 2.2;
    c.x = p.x + 8 + Math.cos(a) * 14;
    c.y = p.y + 6 + Math.sin(a) * 10;
  } else {
    const a = t * 3;
    c.x = p.x + 8 + Math.cos(a) * 13;
    c.y = p.y + 6 + Math.sin(a) * 7;
  }
}

// One function, six companion types, branched by C.companion; each branch is its own small inline state machine
// rather than a shared FSM. Most follow perch/orbit → spot a target → travel/act → return to perch. c.mode holds
// the state name, c.tgt the current target; c.extra is a leftover-action counter (extra hawk dives / cat pounces
// from bond level) — it means something different in each branch, it isn't a shared concept across companions.
function stepCompanion(g, dt, C) {
  const c = g.comp;
  const p = g.p;
  const [cx, cy] = pc(g);
  const bond = g.mods.companion;

  if (C.companion === "wisp") {
    orbit(g, g.t);
    g.fire -= dt;
    if (g.fire <= 0) {
      const surge = lv(g, "surge");
      const target = nearest(g, c.x, c.y, 110 + 40 * (surge > 0));
      if (target) {
        g.fire = 1.5 / (1 + 2 * surge);
        sfx("shot");
        const shoot = () => {
          const t = nearest(g, c.x, c.y, 160);
          if (t) fireShot(g, { kind: "wisp", x: c.x, y: c.y, a: Math.atan2(t.y - c.y, t.x - c.x), sp: 170, dmg: 1, l: 1 });
        };
        shoot();
        // Companion Bond: extra shots in quick succession
        for (let i = 0; i < bond; i++) after(g, 0.12 * (i + 1), shoot);
      }
    }
  } else if (C.companion === "hawk") {
    // perch spot: just behind the player's shoulder
    const perchX = p.x + 8 - p.face * 10;
    const perchY = p.y - 2 + Math.sin(g.t * 4) * 1.5;
    c.cd -= dt;

    if (c.mode === "perch") {
      const k = Math.min(1, dt * 10);
      c.x += (perchX - c.x) * k;
      c.y += (perchY - c.y) * k;
      c.vx = p.face;
      if (c.cd <= 0) {
        const target = nearest(g, cx, cy, 50);
        if (target) {
          c.mode = "dive";
          c.tgt = target.ref;
          c.extra = bond;
          sfx("hawk");
        }
      }
    } else if (c.mode === "dive") {
      if (!alive(g, c.tgt)) {
        c.mode = "return";
      } else {
        const [tx, ty] = center(g, c.tgt);
        const dx = tx - c.x;
        const dy = ty - c.y;
        const dist = Math.hypot(dx, dy) || 1;
        const step = 230 * dt;
        c.vx = dx;

        if (dist < 5 + step) {
          // reached the target: knock it back a bit, slow it and hit it
          const t = c.tgt;
          if (t !== g.boss && !t.fixed) {
            const kx = tx - cx;
            const ky = ty - cy;
            const kd = Math.hypot(kx, ky) || 1;
            t.x += kx / kd * 22;
            t.y += ky / kd * 22;
            t.slow = Math.max(t.slow || 0, 0.6);
            t.slowMul = 0.5;
          }
          burst(g, tx, ty, 8, "#a8741a", 90);
          dealDmg(g, t, 1);
          c.cd = 2.5;

          // Bond: dive again at a different enemy nearby
          const next = c.extra > 0 ? nearest(g, cx, cy, 60) : null;
          if (next && next.ref !== t) {
            c.extra--;
            c.tgt = next.ref;
          } else {
            c.mode = "return";
          }
        } else {
          c.x += dx / dist * step;
          c.y += dy / dist * step;
        }
      }
    } else {
      // returning to the perch
      const dx = perchX - c.x;
      const dy = perchY - c.y;
      const dist = Math.hypot(dx, dy) || 1;
      const step = 170 * dt;
      c.vx = dx;
      if (dist < step + 1) {
        c.mode = "perch";
      } else {
        c.x += dx / dist * step;
        c.y += dy / dist * step;
      }
    }
  } else if (C.companion === "boneimp") {
    stepBoneImp(g, dt);
  } else if (C.companion === "cat") {
    stepCat(g, dt);
  } else if (C.companion === "bomb") {
    stepBombs(g, dt);
  } else if (C.companion === "familiar") {
    orbit(g, g.t);

    // recharges bullet-blocking charges one at a time
    const maxCharges = 2 + bond;
    if (c.ch < maxCharges) {
      c.rc -= dt;
      if (c.rc <= 0) {
        c.ch++;
        c.rc = 1.5;
      }
    }

    // each charge eats one enemy bullet that touches the familiar
    if (c.ch > 0) {
      for (const bullet of g.eb) {
        if (bullet.l > 0 && Math.hypot(bullet.x - c.x, bullet.y - c.y) < 7) {
          bullet.l = 0;
          c.ch--;
          if (c.rc <= 0) c.rc = 1.5;
          burst(g, c.x, c.y, 8, "#b9d0ff", 60);
          sfx("block");
          if (!c.ch) break;
        }
      }
    }

    // and nudges (and slows) enemies it bumps into
    for (const e of g.en) {
      e.bump = (e.bump || 0) - dt;
      if (!e.fixed && !e.harmless && e.bump <= 0 && Math.hypot(e.x + e.w / 2 - c.x, e.y + e.h / 2 - c.y) < 8) {
        const kx = e.x + e.w / 2 - cx;
        const ky = e.y + e.h / 2 - cy;
        const kd = Math.hypot(kx, ky) || 1;
        e.x += kx / kd * 12;
        e.y += ky / kd * 12;
        e.slow = Math.max(e.slow || 0, 1);
        e.slowMul = 0.5;
        e.bump = 0.5;
      }
    }
  }
}

// Bomb Buddy (Gunner): waddles to the densest cluster within 90 px, arms for 0.6 s, explodes (3 dmg, r 22, knockback 12),
// rebuilds in 6 s
function newBomb(g, i) {
  return {
    x: g.p.x + 8 + (i ? 12 : -12), y: g.p.y + 14,
    mode: "follow", t: 0, i, tgt: null, arm: 0, beep: 0, scan: 0.5, face: 1, giveUp: 0,
  };
}

// best bomb target near (x, y): the enemy with the most neighbours (a boss counts if the crowd is thin)
function bombCluster(g, x, y, range) {
  const list = g.en.filter(e => e.hp > 0 && !(e.rise > 0) && !e.harmless && !e.fixed);
  const boss = g.boss && g.boss.mode !== "enter" ? g.boss : null;
  let best = null;
  let bestCount = 0;
  for (const e of list) {
    if (Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y) > range) continue;
    let count = 0;
    for (const other of list) {
      if (Math.hypot(other.x - e.x, other.y - e.y) < 22) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = e;
    }
  }
  if (boss && bestCount < 3 && Math.hypot(boss.x + boss.w / 2 - x, boss.y + boss.h / 2 - y) < range + 20) return boss;
  if (best && (bestCount >= 2 || Math.hypot(best.x - x, best.y - y) < 45)) return best;
  return null;
}

function bombBoom(g, bomb) {
  const R = 22;
  sfx("boom");
  burst(g, bomb.x, bomb.y, 18, "#ff8a2a", 130);
  burst(g, bomb.x, bomb.y, 8, "#ffd166", 100);
  g.rings.push({ x: bomb.x, y: bomb.y, r: 3, max: R * 1.15, l: 0.25, big: true });

  const damage = GUN.bomb + g.mods.companion;
  for (const e of [...g.en]) {
    if (e.hp <= 0 || e.rise > 0 || e.harmless) continue;
    const ex = e.x + e.w / 2 - bomb.x;
    const ey = e.y + e.h / 2 - bomb.y;
    const dist = Math.hypot(ex, ey) || 1;
    if (dist < R + e.w / 2) {
      dealDmg(g, e, damage);
      if (!e.fixed) {
        e.x += ex / dist * 12;
        e.y += ey / dist * 12;
      }
    }
  }
  const boss = g.boss;
  if (boss && boss.mode !== "enter" && Math.hypot(boss.x + boss.w / 2 - bomb.x, boss.y + boss.h / 2 - bomb.y) < R + boss.w / 2) {
    dealDmg(g, boss, damage);
  }
}

function stepBombs(g, dt) {
  const [cx, cy] = pc(g);
  while (g.bombs.length < g.mods.bots) g.bombs.push(newBomb(g, g.bombs.length));
  const ease = k => Math.min(1, dt * k);

  for (const b of g.bombs) {
    // each bomb's spot beside the player (left / right)
    const homeX = cx + (b.i ? 12 : -12);
    const homeY = cy + 4;

    if (b.mode === "rebuild") {
      b.t -= dt;
      b.x += (homeX - b.x) * ease(8);
      b.y += (homeY - b.y) * ease(8);
      if (b.t <= 0) {
        b.mode = "follow";
        burst(g, b.x, b.y, 4, "#ffd166", 40);
        sfx("armorUp");
      }
    } else if (b.mode === "follow") {
      b.x += (homeX - b.x) * ease(6);
      b.y += (homeY - b.y) * ease(6);
      b.scan -= dt;
      if (b.scan <= 0) {
        b.scan = 0.3;
        const target = bombCluster(g, cx, cy, 90);
        if (target) {
          b.tgt = target;
          b.mode = "hunt";
          b.giveUp = 4;
        }
      }
    } else if (b.mode === "hunt") {
      b.giveUp -= dt;
      if (!alive(g, b.tgt) || b.giveUp <= 0) {
        b.mode = "follow";
        continue;
      }
      const [tx, ty] = center(g, b.tgt);
      const dx = tx - b.x;
      const dy = ty - b.y;
      const dist = Math.hypot(dx, dy) || 1;
      b.face = Math.sign(dx) || b.face;
      if (dist < (b.tgt === g.boss ? g.boss.w / 2 + 3 : 7)) {
        b.mode = "arm";
        b.arm = 0.6;
        b.beep = 0;
      } else {
        b.x += dx / dist * 62 * dt;
        b.y += dy / dist * 62 * dt;
      }
    } else if (b.mode === "arm") {
      b.arm -= dt;
      b.beep -= dt;
      if (b.beep <= 0) {
        b.beep = 0.15;
        sfx("beep");
      }
      if (b.arm <= 0) {
        bombBoom(g, b);
        b.mode = "rebuild";
        b.t = GUN.bombCd;
      }
    }
  }
}

function drawBombs(ctx, g, now) {
  for (const b of g.bombs) {
    const x = Math.round(b.x - 3);
    const y = Math.round(b.y - 3 + (b.mode === "follow" ? Math.sin(now / 250 + b.i) : 0));
    const frame = Math.floor(now / 120) % 2;

    // rebuilding: faded ghost with a little progress bar
    if (b.mode === "rebuild") {
      ctx.globalAlpha = 0.5;
      spr(ctx, BOMB[0], x, y, false, DIM);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#120e1a";
      ctx.fillRect(x, y + 7, 6, 1);
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(x, y + 7, Math.round(6 * (1 - b.t / GUN.bombCd)), 1);
      continue;
    }

    ctx.fillStyle = "#17121f";
    ctx.fillRect(x + 1, y + 6, 4, 1);
    const flash = b.mode === "arm" && Math.floor(now / 70) % 2;
    spr(ctx, BOMB[b.mode === "hunt" ? frame : 0], x, y, b.face < 0, flash ? WHITE : BOMB_PAL);
  }
}

// Gunner's hand cannon, drawn along the aim direction while shooting (2 px barrel, grip, muzzle flash)
function drawGun(ctx, g) {
  const p = g.p;
  const [cx, cy] = pc(g);
  const a = p.aimA;
  // (ux, uy) points along the barrel, (nx, ny) is perpendicular to it
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const nx = -uy;
  const ny = ux;
  const baseX = cx + ux * 3;
  const baseY = cy - 1 + uy * 3;
  const LEN = 9;

  // pixel `along` the barrel and `side` units off to the side
  const at = (along, side) => [Math.round(baseX + ux * along + nx * side), Math.round(baseY + uy * along + ny * side)];

  // dark outline first
  ctx.fillStyle = "#120e1a";
  for (let i = -1; i <= LEN + 1; i += 0.5) {
    for (let k = -2; k <= 1; k++) {
      const [x, y] = at(i, k);
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // barrel: lighter on top, darker underneath, and darker near the grip
  for (let i = 0; i <= LEN; i += 0.5) {
    let [x, y] = at(i, 0);
    ctx.fillStyle = i < 3 ? "#5d6478" : "#cfd6e6";
    ctx.fillRect(x, y, 1, 1);
    [x, y] = at(i, -1);
    ctx.fillStyle = i < 3 ? "#3a3448" : "#8a93a8";
    ctx.fillRect(x, y, 1, 1);
  }

  // grip
  const [gx, gy] = at(1, 1.5);
  ctx.fillStyle = "#3a2a1e";
  ctx.fillRect(gx, gy, 1, 1);
  const [gx2, gy2] = at(1.5, 2.5);
  ctx.fillRect(gx2, gy2, 1, 1);

  // muzzle flash
  if (p.atk > 0) {
    const [x, y] = at(LEN + 3, -0.5);
    ctx.fillStyle = "#fff2b0";
    ctx.fillRect(x, y, 1, 1);
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(x - 1, y, 1, 1);
    ctx.fillRect(x + 1, y, 1, 1);
    ctx.fillRect(x, y - 1, 1, 1);
    ctx.fillRect(x, y + 1, 1, 1);
  }
}

// Shade Cat (Assassin): every 6 s pounces on the nearest unmarked enemy within 100 px, pins it 0.8 s and marks it
// (+50% damage for 4 s)
function catTarget(g, x, y, range) {
  let best = null;
  let bestDist = range;
  for (const e of g.en) {
    if (e.hp > 0 && !(e.rise > 0) && !e.harmless && !e.fixed && !(e.mark > 0)) {
      const d = Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
  }
  // an unmarked boss in range always wins
  const b = g.boss;
  if (b && b.mode !== "enter" && !(b.mark > 0) && Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y) < range + 12) best = b;
  return best;
}

function stepCat(g, dt) {
  const c = g.comp;
  const p = g.p;
  const [cx, cy] = pc(g);
  const bond = g.mods.companion;
  // perch spot beside the player, on the side they're not facing
  const homeX = cx + (p.face > 0 ? -12 : 12);
  const homeY = cy + 5;
  c.cd -= dt;

  // move the cat towards a point at `speed` px/s, returns the distance it had left
  const goto = (tx, ty, speed) => {
    const dx = tx - c.x;
    const dy = ty - c.y;
    const dist = Math.hypot(dx, dy) || 1;
    c.vx = dx;
    const step = Math.min(dist, speed * dt);
    c.x += dx / dist * step;
    c.y += dy / dist * step;
    return dist;
  };

  if (c.mode === "pounce") {
    if (!alive(g, c.tgt)) {
      c.mode = "return";
      return;
    }
    const [tx, ty] = center(g, c.tgt);
    if (goto(tx, ty, 220) < 6) {
      const t = c.tgt;
      t.mark = ASN.markT;
      if (t !== g.boss) t.stun = Math.max(t.stun || 0, 0.8);
      burst(g, tx, ty, 8, "#ff4a5a", 80);
      sfx("hit");
      c.cd = ASN.catCd;

      // Bond: pounce again on another enemy
      const next = c.extra > 0 ? catTarget(g, cx, cy, 70) : null;
      if (next) {
        c.extra--;
        c.tgt = next;
      } else {
        c.mode = "return";
      }
    }
  } else if (c.mode === "return") {
    if (goto(homeX, homeY, 180) < 3) c.mode = "perch";
  } else {
    const k = Math.min(1, dt * 7);
    c.x += (homeX - c.x) * k;
    c.y += (homeY - c.y) * k;
    c.vx = homeX - c.x;
    if (c.cd <= 0) {
      const target = catTarget(g, cx, cy, 100);
      if (target) {
        c.mode = "pounce";
        c.tgt = target;
        c.extra = bond;
        sfx("pounce");
      }
    }
  }
}

const MARK = ["..K..", ".KRK.", "KRrRK", ".KRK.", "..K.."];
const MARK_PAL = { K: "#120e1a", R: "#ff4a5a", r: "#ff9aa5" };

// the little red diamond floating above marked enemies
function drawMarks(ctx, g, now) {
  for (const e of g.en) {
    if (e.mark > 0 && e.hp > 0) {
      spr(ctx, MARK, e.x + e.w / 2 - 2, e.y - 7 + Math.round(Math.sin(now / 160 + e.x)), false, MARK_PAL);
    }
  }
  const b = g.boss;
  if (b && b.mark > 0) spr(ctx, MARK, b.x + b.w / 2 - 2, b.y - 7 + Math.round(Math.sin(now / 160)), false, MARK_PAL);
}

// Assassin's daggers: thrust along the aim direction (alternating hands); an Ambush adds the second dagger and a red crescent
const STAB_TRAIL = ["#ffffff", "#ff4a5a", "#d9433a", "#8c2a30"];

function drawStab(ctx, g) {
  const p = g.p;
  const w = p.swing;
  if (!w || p.atk <= 0) return;

  const [cx, cy] = pc(g);
  const total = w.ambush ? 0.24 : 0.16;
  const progress = clamp(1 - p.atk / total, 0, 1);
  const a = w.a;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const nx = -uy;
  const ny = ux;

  // how far the dagger is thrust out: quick start, full extension, then pulls back to 40%
  const f = progress < 0.3
    ? progress / 0.3 * 0.25
    : progress < 0.6
      ? 0.25 + (progress - 0.3) / 0.3 * 0.75
      : 1 - (progress - 0.6) / 0.4 * 0.6;

  // Ambush: red crescent sweeping across the arc, brightest at its leading edge
  if (w.ambush && progress > 0.25) {
    const sweep = clamp((progress - 0.25) / 0.4, 0, 1);
    const startAngle = a - ASN.ambushArc * Math.PI / 360;
    const totalArc = ASN.ambushArc * Math.PI / 180;
    const span = totalArc * sweep;
    const tail = Math.min(span, 1.4);
    ctx.globalAlpha = progress > 0.8 ? (1 - progress) / 0.2 : 1;
    for (let t = span - tail; t <= span; t += 0.04) {
      const behind = tail ? (span - t) / tail : 0;       // 0 at the leading edge, 1 at the tail
      const thick = 1 + Math.round(2 * (1 - behind));
      const angle = startAngle + t;
      ctx.fillStyle = STAB_TRAIL[behind < 0.06 ? 0 : behind < 0.4 ? 1 : behind < 0.7 ? 2 : 3];
      for (let r = w.reach - thick + 1; r <= w.reach; r++) {
        ctx.fillRect(Math.round(cx + Math.cos(angle) * r), Math.round(cy + Math.sin(angle) * r), 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  // one dagger, `off` pixels to the side of the aim line
  const dagger = off => {
    const tipR = 5 + (w.reach - 5) * f;
    const LEN = 9;
    const at = (i, k) => [
      Math.round(cx + ux * (tipR - LEN + i) + nx * (off + k)),
      Math.round(cy - 1 + uy * (tipR - LEN + i) + ny * (off + k)),
    ];
    // outline
    ctx.fillStyle = "#120e1a";
    for (let i = -1; i <= LEN + 1; i += 0.5) {
      for (let k = -1; k <= 1; k++) {
        const [x, y] = at(i, k);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // handle, guard, then the blade
    for (let i = 0; i <= LEN; i += 0.5) {
      ctx.fillStyle = i < 2 ? "#5a3a22" : i < 3 ? "#b9c2d6" : "#eef2fa";
      const [x, y] = at(i, 0);
      ctx.fillRect(x, y, 1, 1);
    }
  };
  dagger(w.ambush ? -2 : w.hand ? 2 : -2);
  if (w.ambush) dagger(2);

  // the off-hand dagger, held back at the hip
  if (!w.ambush) {
    const side = w.hand ? -1 : 1;
    ctx.fillStyle = "#eef2fa";
    ctx.fillRect(Math.round(cx + side * 7), Math.round(cy + 1), 1, 4);
    ctx.fillStyle = "#120e1a";
    ctx.fillRect(Math.round(cx + side * 7), Math.round(cy), 1, 1);
  }
}

const DECOY_PAL = new Proxy({}, { get: (_, k) => (k === "K" ? "#120e1a" : "#8a4a5a") });

// four red corner brackets showing where Shadow Step would land
function drawReticle(ctx, g, now) {
  const p = g.p;
  if (g.cls !== "assassin" || p.cd > 0 || p.charges <= 0 || p.atk > 0) return;
  const landing = stepLanding(g);
  if (!landing || Math.floor(now / 300) % 3 === 2) return;     // blinks off every third beat

  const x = Math.round(landing.nx);
  const y = Math.round(landing.ny);
  ctx.fillStyle = "#ff4a5a";
  ctx.globalAlpha = 0.85;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const offX = sx > 0 ? 1 : 0;
    const offY = sy > 0 ? 1 : 0;
    ctx.fillRect(x + sx * 6 - offX, y + sy * 6 - offY, 2, 1);      // horizontal arm
    ctx.fillRect(x + sx * 6, y + sy * 6 - offY, 1, 2);             // vertical arm
  }
  ctx.globalAlpha = 1;
}

// Grave fog (Necromancer's Bone Imp): enemies inside move at 40%, enemy bullets at 30%, bosses at 70%
const inEll = (b, x, y) => ((x - b.x) / b.r) ** 2 + ((y - b.y) / (b.r * 0.7)) ** 2 < 1;
const inFog = (g, x, y) => g.fog.some(b => inEll(b, x, y));

function stepFog(g, dt) {
  if (!g.fog.length) return;
  for (const puff of g.fog) {
    puff.t -= dt;
    for (const e of g.en) {
      if (e.hp > 0 && inEll(puff, e.x + e.w / 2, e.y + e.h / 2)) e.stasis = 0.12;
    }
    const boss = g.boss;
    if (boss && inEll(puff, boss.x + boss.w / 2, boss.y + boss.h / 2)) boss.stasis = 0.12;
  }
  g.fog = g.fog.filter(b => b.t > 0);
}

// up to n good spots for fog: the boss if it's close, then the densest clusters (at least 2 enemies, 30px apart)
function crowdSpots(g, x, y, range, n) {
  const list = g.en.filter(e =>
    e.hp > 0 && !(e.rise > 0) && !e.harmless && Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y) < range);

  // centre of mass of each enemy's neighbourhood
  const points = [];
  for (const e of list) {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (const other of list) {
      if (Math.hypot(other.x - e.x, other.y - e.y) < 24) {
        sumX += other.x + other.w / 2;
        sumY += other.y + other.h / 2;
        count++;
      }
    }
    points.push({ x: sumX / count, y: sumY / count, k: count });
  }
  points.sort((a, b) => b.k - a.k);

  const out = [];
  const boss = g.boss;
  if (boss && boss.mode !== "enter" && Math.hypot(boss.x + boss.w / 2 - x, boss.y + boss.h / 2 - y) < range + 20) {
    out.push({ x: boss.x + boss.w / 2, y: boss.y + boss.h / 2, k: 3 });
  }
  for (const pt of points) {
    if (pt.k < 2 || out.length >= n) continue;
    if (out.every(o => Math.hypot(o.x - pt.x, o.y - pt.y) > 30)) out.push(pt);
  }
  return out.slice(0, n);
}

// Bone Imp: every 8 s flies to the most crowded spot and drops grave fog (two with Twin Imps)
function stepBoneImp(g, dt) {
  const c = g.comp;
  const p = g.p;
  const [cx, cy] = pc(g);
  const homeX = cx + (p.face > 0 ? -13 : 13);
  const homeY = cy - 12 + Math.sin(g.t * 3) * 1.5;
  c.cd -= dt;

  const goto = (tx, ty, speed) => {
    const dx = tx - c.x;
    const dy = ty - c.y;
    const dist = Math.hypot(dx, dy) || 1;
    const step = Math.min(dist, speed * dt);
    c.x += dx / dist * step;
    c.y += dy / dist * step;
    return dist;
  };

  if (c.mode === "fly") {
    if (goto(c.spot.x, c.spot.y - 6, 140) < 4) {
      for (const spot of c.spots) {
        g.fog.push({ x: spot.x, y: spot.y, r: NEC.fogR, t: NEC.fogT + 1.5 * g.mods.companion });
      }
      sfx("bubble");
      burst(g, c.x, c.y, 8, "#7be07a", 60);
      c.cd = NEC.fogCd;
      c.mode = "return";
    }
  } else if (c.mode === "return") {
    if (goto(homeX, homeY, 160) < 3) c.mode = "perch";
  } else {
    const k = Math.min(1, dt * 6);
    c.x += (homeX - c.x) * k;
    c.y += (homeY - c.y) * k;
    if (c.cd <= 0) {
      const spots = crowdSpots(g, cx, cy, 110, g.mods.imps);
      if (spots.length) {
        c.spot = spots[0];
        c.spots = spots;
        c.mode = "fly";
      }
    }
  }
}

// Raise Dead skeletons: chase the nearest enemy or boss and hurt whatever they touch (each target at most every skelHitCd)
function stepMinions(g, dt) {
  if (!g.minions.length) return;
  const B = g.bounds;
  for (const m of g.minions) {
    m.t -= dt;
    const target = nearest(g, m.x, m.y, 9999);
    if (!target) continue;
    const dx = target.x - m.x;
    const dy = target.y - m.y;
    const dist = Math.hypot(dx, dy) || 1;
    const touch = 6 + (target.ref === g.boss ? 0 : (target.ref.w + target.ref.h) / 4);
    if (dist - (target.ref === g.boss ? g.boss.w / 2 - 4 : 0) > touch - 2) {
      const step = NEC.skelSpeed * dt;
      m.x = clamp(m.x + dx / dist * step, B.x0 + 8, B.x1 + 8);
      m.y = clamp(m.y + dy / dist * step, B.y0 + 10, B.y1 + 10);
      m.face = Math.sign(dx) || m.face;
    }
    if (target.d < touch && (m.hit.get(target.ref) || 0) <= g.t) {
      m.hit.set(target.ref, g.t + NEC.skelHitCd);
      dealDmg(g, target.ref, NEC.skelDmg);
      burst(g, target.x, target.y, 3, "#7be07a", 40);
    }
  }
  g.minions = g.minions.filter(m => m.t > 0);
}

function drawMinions(ctx, g, now) {
  for (const m of g.minions) {
    ctx.globalAlpha = m.t < 0.6 ? m.t / 0.6 : 1;
    ctx.fillStyle = "#17121f";
    ctx.fillRect(Math.round(m.x - 3), Math.round(m.y + 4), 6, 1);
    spr(ctx, SKEL[Math.floor(now / 200) % 2], m.x - 4, m.y - 5, m.face < 0, SKEL_PAL);
  }
  ctx.globalAlpha = 1;
}

function drawFog(ctx, g, now) {
  for (const b of g.fog) {
    const fade = b.t < 0.6 ? b.t / 0.6 : 1;
    ctx.globalAlpha = 0.2 * fade;
    ctx.fillStyle = "#5a3d99";
    ellipse(ctx, b.x, b.y, b.r, b.r * 0.7);
    ctx.globalAlpha = 0.8 * fade;
    ctx.fillStyle = "#7be07a";
    ring(ctx, b.x, b.y, b.r, b.r * 0.7, 0.09);
    ctx.globalAlpha = 0.5 * fade;
    ring(ctx, b.x, b.y, b.r * 0.6, b.r * 0.42, 0.25);

    // four wisps orbiting inside
    for (let i = 0; i < 4; i++) {
      const a = now / 900 + i * 1.57;
      ctx.fillStyle = "#d9ffd6";
      ctx.fillRect(Math.round(b.x + Math.cos(a) * b.r * 0.55), Math.round(b.y + Math.sin(a) * b.r * 0.38), 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}

// ---------- hazards: telegraphed circles / lines / rects / cones / areas / waves ----------

// distance from point (px, py) to the segment (x1,y1)-(x2,y2)
export function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy || 1;
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
  return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
}

function stepHazards(g, dt) {
  const [cx, cy] = pc(g);
  for (const h of g.hz) {
    h.t += dt;
    if (h.follow && g.boss) {
      h.x = g.boss.x + g.boss.w / 2;
      h.y = g.boss.y + g.boss.h / 2;
    }

    // the player's own hazards (spike trap, frost field) work against enemies
    if (h.owner === "player") {
      for (const e of g.en) {
        if (Math.hypot(e.x + e.w / 2 - h.x, e.y + e.h / 2 - h.y) < h.r) {
          if (h.k === "trap" && !h.hit.has(e)) {
            h.hit.add(e);
            dealDmg(g, e, h.dmg);
          }
          if (h.k === "frost") {
            e.slow = Math.max(e.slow || 0, 1);
            e.slowMul = 0.5;
          }
        }
      }
      const b = g.boss;
      if (h.k === "trap" && b && !h.hit.has(b) && Math.hypot(b.x + b.w / 2 - h.x, b.y + b.h / 2 - h.y) < h.r + b.w / 2) {
        h.hit.add(b);
        dealDmg(g, b, h.dmg);
      }
      if (h.k === "frost" && b && Math.hypot(b.x + b.w / 2 - h.x, b.y + b.h / 2 - h.y) < h.r + b.w / 2) {
        b.slow = Math.max(b.slow, 0.5);
      }
      h.done = h.t > h.dur;
      continue;
    }

    // still telegraphing
    if (h.t < h.delay) continue;
    const first = !h.fired;
    h.fired = true;

    switch (h.k) {
      case "circle":
        if (first) {
          if (Math.hypot(cx - h.x, (cy - h.y) / 0.7) < h.r + 3) hurt(g);
          burst(g, h.x, h.y, 8, h.c || "#ff4a6a", 90);
          if (h.fire) addHz(g, { k: "area", x: h.x, y: h.y, r: h.r * 0.8, dur: h.fire, effect: "burn", c: "#ff8a2a" });
          h.show = 0.3;
        }
        break;

      case "line":
        if (first) {
          if (!h.nodmg && segDist(cx, cy, h.x1, h.y1, h.x2, h.y2) < h.w / 2 + 3) hurt(g);
          h.show = h.nodmg ? 0 : 0.35;
        }
        break;

      case "rect":
        if (first) {
          if (cx > h.x && cx < h.x + h.w && cy > h.y && cy < h.y + h.h) hurt(g);
          h.show = 0.4;
        }
        break;

      case "cone": {
        h.a += (h.sweep || 0) / (h.dur || 1) * dt;
        const dist = Math.hypot(cx - h.x, cy - h.y);
        const angle = Math.atan2(cy - h.y, cx - h.x);
        const diff = Math.abs(Math.atan2(Math.sin(angle - h.a), Math.cos(angle - h.a)));
        if (dist < h.r && diff < h.spread / 2) hurt(g);
        break;
      }

      case "area":
        if (Math.hypot(cx - h.x, (cy - h.y) / 0.7) < h.r) {
          if (h.effect === "burn") hurt(g);
          else g.p.slowArea = true;
        }
        break;

      case "ringwave": {
        // expanding ring with a gap you can slip through
        h.r += h.sp * dt;
        const dist = Math.hypot(cx - h.x, (cy - h.y) / 0.7);
        const angle = Math.atan2(cy - h.y, cx - h.x);
        const inGap = Math.abs(Math.atan2(Math.sin(angle - h.gapA), Math.cos(angle - h.gapA))) < h.gapW / 2;
        if (Math.abs(dist - h.r) < 3 && !inGap) hurt(g);
        if (h.r > h.max) h.done = true;
        break;
      }

      case "linewave": {
        // vertical wall sweeping across the screen with a gap
        h.x += h.dir * h.sp * dt;
        const inGap = cy > h.gapY && cy < h.gapY + h.gapH;
        if (Math.abs(cx - h.x) < 3 && !inGap) {
          if (hurt(g)) g.p.x = clamp(g.p.x + h.dir * 14, g.bounds.x0, g.bounds.x1);
        }
        if (h.x < -10 || h.x > W + 10) h.done = true;
        break;
      }
    }

    if (h.show !== undefined) h.show -= dt;
    if (h.k !== "ringwave" && h.k !== "linewave" && h.t > h.delay + Math.max(h.dur || 0, 0.4)) h.done = true;
  }
  g.hz = g.hz.filter(h => !h.done);
}

// ---------- main update ----------
// One frame, in order: input → movement/physics → per-frame timer countdown → armour regen → stage/phase/boss
// progression → each subsystem gets its turn (enemies, class attack, boss, companion, hazards, biome rule, enemy
// shots) → cleanup (particles, shards→XP, queued level-ups). Most blocks are independent of each other — read it
// section by section rather than trying to hold the whole function in your head at once.
export function step(g, dt, k, tc) {
  if (g.over || g.pending) return;
  if (g.autoNext) {
    g.autoNext = false;
    nextStage(g);
  }
  if (g.trans) {
    stepTrans(g, dt);
    return;
  }
  ensureBiome(g);

  const p = g.p;
  const C = CLASSES[g.cls];
  const m = g.mods;
  const S = stageOf(g);
  g.t += dt;
  g.ventT += dt;

  // delayed callbacks (after()) that have come due
  for (const timer of g.timers) timer.t -= dt;
  const due = g.timers.filter(timer => timer.t <= 0);
  g.timers = g.timers.filter(timer => timer.t > 0);
  due.forEach(timer => timer.fn());
  if (g.pending) return;

  // ----- input + movement -----
  // k = set of held keys, tc = touch stick ({dx, dy}) which overrides the keyboard
  let dx = (k.has("d") || k.has("arrowright")) - (k.has("a") || k.has("arrowleft"));
  let dy = (k.has("s") || k.has("arrowdown")) - (k.has("w") || k.has("arrowup"));
  if (tc) {
    dx = tc.dx;
    dy = tc.dy;
  }
  const mag = Math.hypot(dx, dy);
  p.moving = mag > 0.2;
  if (mag > 1) {
    dx /= mag;
    dy /= mag;
  }
  p.dir = p.moving ? [dx / (mag || 1), dy / (mag || 1)] : null;
  if (Math.abs(dx) > 0.1 && p.atk <= 0) p.face = Math.sign(dx);

  const [cx0, cy0] = pc(g);
  const wet = inWaterAt(g, cx0, cy0 + 5);
  const slick = onIceAt(g, cx0, cy0 + 5);
  let speed = C.speed * (1 + 0.35 * lv(g, "boots")) * m.move * (1 + 0.25 * (g.rush.t > 0 ? g.rush.n : 0));
  if (g.rush.n) speed = Math.min(speed, C.speed * 1.8);          // Bloodrush speed cap
  if (p.chillT > 0 || p.slowArea || wet) speed *= 0.6;
  p.slowArea = false;

  // velocity eases towards the wanted one (much slower on ice, so you slide)
  const accel = slick ? 3 : 30;
  p.vx += (dx * speed - p.vx) * Math.min(1, accel * dt);
  p.vy += (dy * speed - p.vy) * Math.min(1, accel * dt);

  // a dash overrides normal movement
  let vx = p.dash > 0 ? p.dashV[0] * p.dashSp : p.vx;
  let vy = p.dash > 0 ? p.dashV[1] * p.dashSp : p.vy;
  if (p.pull > 0 && g.boss) {
    // Jailer's hook / Crypt Lich's pull
    const [bx, by] = center(g, g.boss);
    const pullX = bx - cx0;
    const pullY = by - cy0;
    const pullDist = Math.hypot(pullX, pullY) || 1;
    vx += pullX / pullDist * p.pull;
    vy += pullY / pullDist * p.pull;
  }
  const B = g.bounds;
  p.x = clamp(p.x + vx * dt, B.x0, B.x1);
  p.y = clamp(p.y + vy * dt, B.y0, B.y1);

  // every per-frame player timer/cooldown ticks down on this one line — new timers get added here, not scattered elsewhere
  p.dash -= dt; p.cd -= dt; p.inv -= dt; p.atk -= dt; p.acd -= dt; p.chillT -= dt; p.reload -= dt; p.aimT -= dt; p.ambush -= dt;
  g.rush.t -= dt;
  if (g.rush.t <= 0) g.rush.n = 0;
  if (g.decoy && (g.decoy.t -= dt) <= 0) g.decoy = null;

  const [cx, cy] = pc(g);

  // Shock Dash: enemies you pass through take damage (once each per dash)
  if (p.dash > 0 && m.dashDamage && g.cls === "warden") {
    for (const e of g.en) {
      if (!p.dashHit.has(e) && Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < 10) {
        p.dashHit.add(e);
        dealDmg(g, e, m.dashDamage);
      }
    }
  }

  // Slow Motion power-up: enemies and bullets slower
  g.ts = 1 - Math.min(0.55, 0.3 * lv(g, "slowmo"));

  stepFog(g, dt);
  stepMinions(g, dt);

  // ----- armour regen -----
  // counts armor.t down while under max plates; firstRepair (longer) applies only when regenerating up from 0 plates
  // — see the ARMOR comment near the top of the file and breakPlate() below for why
  const armor = g.armor;
  if (armor.n < armor.max) {
    if (armor.n === 0) g.stats.noArmorT += dt;
    if (armor.t <= 0) armor.t = armor.n === 0 ? ARMOR.firstRepair : ARMOR.repair;
    armor.t -= dt;
    if (armor.t <= 0) {
      armor.n++;
      sfx("armorUp");
      burst(g, p.x + 8, p.y + 8, 6, "#e4eaf6", 60);
      armor.t = armor.n < armor.max ? ARMOR.repair : 0;
    }
  }

  // ----- progression: kills → miniboss 1 → miniboss 2 → stage boss (with a fallback timer) -----
  // walking into the open door starts the room transition
  if (g.door) {
    const [dcx, dcy] = pc(g);
    if (dcx > W - 24 && Math.abs(dcy - g.door.y) < 14) g.trans = { t: 0 };
  }
  if (!g.boss && !g.clearing && !g.door) {
    g.phaseClock += dt;
    if (g.kills >= KILLS_NEED[g.phase] || g.phaseClock >= PHASE_FALLBACK) {
      // time for the boss: poof the regular enemies away
      for (const e of g.en) burst(g, e.x + e.w / 2, e.y + e.h / 2, 4, "#8a83a0");
      g.en = [];
      spawnBoss(g, g.phase < 2 ? S.minis[g.phase] : S.boss);
    } else {
      g.spawn -= dt;
      if (g.spawn <= 0) {
        g.spawn = Math.max(0.45, SPAWN_BASE[g.stage - 1] * (1 - 0.12 * g.phase) * LOOP.spawn ** g.loop);
        spawnMob(g, S);
      }
    }
  }

  // each subsystem below owns its own array (g.en, g.boss, g.comp, g.hz, g.eb) and mutates it independently — step()
  // is just the dispatcher, the actual behavior lives in enemies.js / bosses.js / classes.js / stepCompanion above
  stepSpawns(g, dt);
  stepEnemies(g, dt, cx, cy);
  C.attack(g, cx, cy);
  C.tick?.(g, dt);
  stepBoss(g, dt, cx, cy);
  stepCompanion(g, dt, C);
  stepHazards(g, dt);
  stepRule(g, dt, cx, cy, S);
  stepEnemyShots(g, dt, cx, cy);
  g.tempPatches = g.tempPatches.filter(tp => tp.l === undefined || (tp.l -= dt) > 0);
  tickFx(g, dt);
  g.msgT -= dt;

  // Guardian Spark: a free shield every so often
  if (m.shieldEvery) {
    g.guardT -= dt;
    if (g.guardT <= 0) {
      g.guardT = m.shieldEvery;
      if (!p.shield) {
        p.shield = true;
        msg(g, "Guardian spark", 1);
      }
    }
  }

  // Frost nova power-up: every 2s slows everything close to the player
  const nova = lv(g, "nova");
  if (nova) {
    g.novaT -= dt;
    if (g.novaT <= 0) {
      g.novaT = 2;
      const R = 28 * (1 + 0.3 * (nova - 1));
      for (const e of g.en) {
        if (Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < R) {
          e.slow = 1.5;
          e.slowMul = 0.5;
        }
      }
      if (g.boss && Math.hypot(g.boss.x + g.boss.w / 2 - cx, g.boss.y + g.boss.h / 2 - cy) < R + g.boss.w / 2) {
        g.boss.slow = 1.5;
      }
      g.rings.push({ x: cx, y: cy - 2, r: 3, max: R, l: 0.35 });
      sfx("nova");
    }
  } else {
    g.novaT = 0;
  }

  for (const ring of g.rings) {
    ring.r += (ring.max - 3) / 0.35 * dt;
    ring.l -= dt;
  }
  g.rings = g.rings.filter(r => r.l > 0);

  // a random power-up appears every 18s when there's no boss
  if (!g.boss) {
    g.puT -= dt;
    if (g.puT <= 0) {
      g.puT = 18;
      dropPU(g, 10 + Math.random() * (W - 30), WALL + 8 + Math.random() * (H - WALL - 24));
    }
  }

  // pick up power-ups by walking over them
  for (const pu of g.pu) {
    pu.l -= dt;
    if (Math.hypot(pu.x + 3.5 - cx, pu.y + 3.5 - cy) < 10) {
      const name = applyPU(g, pu.k);
      pu.l = 0;
      sfx("pickup");
      msg(g, name);
      navigator.vibrate?.(20);
      burst(g, pu.x + 3, pu.y + 3, 10, PU[pu.k].c, 90);
    }
  }
  g.pu = g.pu.filter(u => u.l > 0);

  // soul shards drift to the player inside the magnet radius, and turn into XP on contact
  const magnetRange = XP.magnet * m.magnet;
  for (const shard of g.shards) {
    shard.t += dt;
    const dist = Math.hypot(cx - shard.x, cy - shard.y);
    if (dist < magnetRange) {
      const pull = 140 * dt;
      shard.x += (cx - shard.x) / (dist || 1) * pull;
      shard.y += (cy - shard.y) / (dist || 1) * pull;
    }
    if (dist < 5) {
      addXP(g, shard.v);
      shard.v = 0;
    }
  }
  g.shards = g.shards.filter(s => s.v > 0);

  stepShots(g, dt);
  g.en = g.en.filter(e => e.hp > 0);
  for (const part of g.parts) {
    part.x += part.vx * dt;
    part.y += part.vy * dt;
    part.l -= dt;
  }
  g.parts = g.parts.filter(q => q.l > 0);

  // level-ups are queued (levelQueue++ in addXP) rather than shown the instant XP crosses the threshold, so hitting
  // a level mid-boss-fight doesn't yank up the pause screen; this drains one queued level per frame once it's safe
  if (g.levelQueue > 0 && !g.pending && !g.over && !g.clearing) {
    g.levelQueue--;
    offer(g, "level");
    if (g.pending) sfx("pickup");
  }
}

// stage-specific rules: lava vents burn, the void arena shrinks
function stepRule(g, dt, cx, cy, S) {
  if (S.rule === "lava") {
    for (const vent of g.biome.vents) {
      const forced = g.t < (vent.force || 0);               // the Molten Smith can stoke a vent early
      const state = forced ? "erupt" : ventState(vent, g.ventT);
      if (state !== "erupt") continue;

      // each eruption gets an id so one burst can only hurt a given enemy / boss once
      const cycle = forced ? "f" + Math.floor(vent.force * 10) : "c" + Math.floor((g.ventT + vent.off) / LAVA.vent.cycle);
      const id = cycle + ":" + vent.x;

      if (inVent(vent, cx, cy + 4)) hurt(g);
      for (const e of g.en) {
        if (!e.harmless && !e.fly && inVent(vent, e.x + e.w / 2, e.y + e.h) && e.ventCyc !== id) {
          e.ventCyc = id;
          dealDmg(g, e, LAVA.vent.dmgEnemy, false);
        }
      }
      const b = g.boss;
      if (b && !b.def.floats && inVent(vent, b.x + b.w / 2, b.y + b.h - 2) && b.ventCyc !== id) {
        b.ventCyc = id;
        damageBoss(g, 3);
        msg(g, "Burned by the vent!", 1);
      }
    }
  }

  // Hollow Lord's collapse: the walkable area closes in over 10s
  if (g.collapse > 0) {
    g.collapse = Math.min(1, g.collapse + dt / 10);
    const marginX = W * 0.075 * g.collapse;
    const marginY = (H - WALL) * 0.075 * g.collapse;
    g.bounds = { x0: marginX, y0: WALL - 8 + marginY, x1: W - 16 - marginX, y1: H - 17 - marginY };
  }
}

function stepEnemyShots(g, dt, cx, cy) {
  for (const b of g.eb) {
    // grave fog / Slow Motion crawl bullets
    const speedMul = g.ts * (inFog(g, b.x, b.y) ? NEC.bulletSlow : 1);
    const dtb = dt * speedMul;

    // homing bullets turn towards the player, at most b.home rad/s
    if (b.home) {
      const want = Math.atan2(cy - b.y, cx - b.x);
      const a = Math.atan2(b.vy, b.vx);
      const turn = clamp(Math.atan2(Math.sin(want - a), Math.cos(want - a)), -b.home * dtb, b.home * dtb);
      b.vx = Math.cos(a + turn) * b.sp;
      b.vy = Math.sin(a + turn) * b.sp;
    }
    b.x += b.vx * dtb;
    b.y += b.vy * dtb;
    b.l -= dt;
    b.dist += b.sp * dtb;

    // boomerang bullets (the Jailer's ball, tridents): fly out `ret` px, then come back to the boss
    if (b.ret && !b.back && b.dist > b.ret) b.back = true;
    if (b.back) {
      const src = g.boss ? center(g, g.boss) : [b.ox, b.oy];
      const dist = Math.hypot(src[0] - b.x, src[1] - b.y) || 1;
      b.vx = (src[0] - b.x) / dist * b.sp;
      b.vy = (src[1] - b.y) / dist * b.sp;
      if (dist < 6) b.l = 0;
    }

    // bouncing bullets reflect off the arena edges
    if (b.bounce > 0) {
      if (b.x < 2 || b.x > W - 2) {
        b.vx *= -1;
        b.bounce--;
        b.x = clamp(b.x, 2, W - 2);
      }
      if (b.y < WALL || b.y > H - 2) {
        b.vy *= -1;
        b.bounce--;
        b.y = clamp(b.y, WALL, H - 2);
      }
    }

    // splitting bullets (the boulder) burst into a ring when their timer ends or they hit a wall
    if (b.split && (b.l < b.splitAt || b.x < 2 || b.x > W - 2 || b.y < WALL || b.y > H - 2)) {
      for (let i = 0; i < b.split; i++) shootE(g, b.x, b.y, i / b.split * 6.283, 55, { c: b.c });
      b.l = 0;
      burst(g, b.x, b.y, 8, b.c);
      continue;
    }

    if (!b.ret && !(b.bounce > 0) && (b.x < -4 || b.y < -4 || b.x > W + 4 || b.y > H + 4)) {
      b.l = 0;
    } else if (Math.hypot(b.x - cx, b.y - cy + 2) < 4 + b.size && hurt(g)) {
      if (!b.ret) b.l = 0;
      if (b.chill) g.p.chillT = b.chill;
    }
  }
  g.eb = g.eb.filter(b => b.l > 0);
}

// player projectiles (arrows, orbs, pellets, wisp bolts ...)
function stepShots(g, dt) {
  for (const s of g.shots) {
    // the Mage's orb homes in on its target (or the nearest enemy if the target died)
    if (s.kind === "orb") {
      if (!alive(g, s.tgt)) s.tgt = nearest(g, s.x, s.y, 90)?.ref;
      if (s.tgt) {
        const [tx, ty] = center(g, s.tgt);
        const want = Math.atan2(ty - s.y, tx - s.x);
        const diff = Math.atan2(Math.sin(want - s.a), Math.cos(want - s.a));
        s.a += clamp(diff, -4 * dt, 4 * dt);
        s.vx = Math.cos(s.a) * s.sp;
        s.vy = Math.sin(s.a) * s.sp;
      }
      if (Math.random() < 0.4) g.parts.push({ x: s.x, y: s.y, vx: 0, vy: 0, l: 0.2, c: "#2bb6d9" });
    }

    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.l -= dt;
    if (s.x < -6 || s.y < -6 || s.x > W + 6 || s.y > H + 6) {
      s.l = 0;
      continue;
    }
    if (s.l <= 0 && s.kind === "orb") {
      burst(g, s.x, s.y, 4, "#2bb6d9", 40);
      continue;
    }

    // shots can knock down enemy bullets that have hp (e.g. the Jailer's ball)
    for (const bullet of g.eb) {
      if (bullet.hp && Math.hypot(bullet.x - s.x, bullet.y - s.y) < 4) {
        bullet.hp--;
        if (bullet.hp <= 0) {
          bullet.l = 0;
          burst(g, bullet.x, bullet.y, 6, bullet.c);
        }
        s.l = 0;
        break;
      }
    }
    if (s.l <= 0) continue;

    // what happens when this shot connects with target t
    const hitTarget = t => {
      s.hitSet.add(t);
      // kill: Deadshot one-hit-kill, bosses take a flat GUN.deadBoss
      dealDmg(g, t, s.kill ? (t === g.boss ? GUN.deadBoss : 9999) : s.dmg);

      if (s.splash) {
        chill(g, s.x, s.y, s.splash);
        splash(g, s.x, s.y, s.splash, 1, t);
        burst(g, s.x, s.y, 10, "#5ef2ff", 100);
        g.rings.push({ x: s.x, y: s.y, r: 2, max: s.splash, l: 0.2 });
        sfx("orbHit");
      }

      // Split Orb: two small orbs fly off at an angle
      if (s.split) {
        for (const da of [-0.8, 0.8]) {
          g.shots.push({
            kind: "orb", x: s.x, y: s.y, a: s.a + da, sp: 110,
            vx: Math.cos(s.a + da) * 110, vy: Math.sin(s.a + da) * 110,
            dmg: 1, l: 0.8, tgt: null, pierce: 0, hitSet: new Set([t]),
          });
        }
      }

      // Ricochet: redirect to another enemy nearby instead of ending here
      if (s.bounce > 0) {
        const next = nearest(g, s.x, s.y, 70, null);
        if (next && !s.hitSet.has(next.ref)) {
          s.bounce--;
          s.a = Math.atan2(next.y - s.y, next.x - s.x);
          s.vx = Math.cos(s.a) * s.sp;
          s.vy = Math.sin(s.a) * s.sp;
          s.l = 0.6;
          return;
        }
      }

      if (s.pierce > 0) s.pierce--;
      else s.l = 0;
    };

    const b = g.boss;
    if (b && b.mode !== "enter" && !s.hitSet.has(b) && Math.abs(s.x - (b.x + b.w / 2)) < b.w / 2 && Math.abs(s.y - (b.y + b.h / 2)) < b.h / 2) {
      // a shielded boss blocks shots coming at its front
      if (b.shield && Math.abs(b.dx) > 0.3 && Math.sign(s.vx) === -Math.sign(b.dx)) {
        s.l = 0;
        burst(g, s.x, s.y, 4, "#cfd6e6");
        sfx("block");
        continue;
      }
      hitTarget(b);
    }
    if (s.l <= 0) continue;

    for (const e of g.en) {
      if (e.hp > 0 && !(e.rise > 0) && !s.hitSet.has(e) &&
          Math.abs(s.x - (e.x + e.w / 2)) < e.w / 2 + 1 && Math.abs(s.y - (e.y + e.h / 2)) < e.h / 2 + 1) {
        hitTarget(e);
        if (s.l <= 0) break;
      }
    }
  }
  g.shots = g.shots.filter(s => s.l > 0);
}

// ---------- HUD + music helpers for the UI ----------
export function hudState(g, key) {
  const S = stageOf(g);
  const C = CLASSES[g.cls];
  const b = g.boss;
  return {
    hp: Math.max(0, g.p.hp),
    maxHp: g.maxHp,
    shield: g.p.shield,
    armor: {
      n: g.armor.n, max: g.armor.max, t: g.armor.t,
      dur: g.armor.n === 0 ? ARMOR.firstRepair : ARMOR.repair,
    },
    lv: g.lv,
    xp: g.xp,
    xpNeed: XP.need(g.lv),
    stage: g.stage,
    loop: g.loop,
    stageName: S.name,
    phase: g.phase,
    kills: Math.min(g.kills, KILLS_NEED[g.phase]),
    killsNeed: KILLS_NEED[g.phase],
    score: g.score,
    time: g.t,
    ability: { name: C.abilityName, cd: Math.max(0, g.p.cd), max: C.abilityCd * g.mods.cd, key },
    ambush: g.cls === "assassin"
      ? { t: Math.max(0, g.p.ambush), dur: 2, charges: g.p.charges, max: g.mods.charges }
      : null,
    ammo: C.mag
      ? {
        n: g.p.ammo, max: C.mag + g.mods.mag, reload: g.p.reloading ? Math.max(0, g.p.reload) : 0,
        dur: 1.5, inf: lv(g, "bottomless") > 0,
      }
      : null,
    fx: Object.entries(g.fx).filter(([, f]) => f.t > 0).map(([k, f]) => ({ k, lv: f.lv, t: f.t, dur: 8 })),
    boss: b
      ? {
        name: b.def.name, hp: Math.max(0, b.hp), max: b.max, color: b.def.bc,
        ticks: (b.def.phases || []).map(ph => ph.at),
      }
      : null,
    msg: g.msg,
    msgT: g.msgT,
    accent: S.accent,
  };
}

export const musicTrack = g => g.boss ? (g.boss.def.final ? "final" : "boss") : "normal";

// ---------- rendering ----------

// filled ellipse, one row of pixels at a time
export function ellipse(ctx, x, y, rx, ry) {
  for (let yy = -Math.round(ry); yy <= ry; yy++) {
    const halfWidth = Math.round(rx * Math.sqrt(Math.max(0, 1 - (yy / ry) ** 2)));
    ctx.fillRect(Math.round(x - halfWidth), Math.round(y + yy), halfWidth * 2, 1);
  }
}

// ellipse outline made of single pixels, `step` radians apart
export function ring(ctx, x, y, rx, ry, step = 0.4) {
  for (let a = 0; a < 6.283; a += step) {
    ctx.fillRect(Math.round(x + Math.cos(a) * rx), Math.round(y + Math.sin(a) * ry), 1, 1);
  }
}

function drawHz(ctx, g, now) {
  const blink = Math.floor(now / 110) % 2;
  for (const h of g.hz) {
    const tele = h.t < h.delay;     // still in the warning phase
    const c = h.c || "#ff4a6a";
    ctx.fillStyle = c;
    ctx.globalAlpha = tele ? (blink ? 0.9 : 0.5) : 1;

    if (h.k === "circle") {
      if (tele) {
        // dark disc with a blinking outline
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = "#0a0610";
        ellipse(ctx, h.x, h.y, h.r, h.r * 0.7);
        ctx.globalAlpha = blink ? 0.9 : 0.5;
        ctx.fillStyle = c;
        ring(ctx, h.x, h.y, h.r, h.r * 0.7);
      } else if (h.show > 0) {
        // three spikes poking up
        ctx.fillStyle = h.spike || c;
        for (const offset of [-3, 0, 3]) ctx.fillRect(Math.round(h.x + offset), Math.round(h.y - 5), 1, 5);
      }
    } else if (h.k === "line") {
      const n = Math.max(1, Math.hypot(h.x2 - h.x1, h.y2 - h.y1) / 3 | 0);
      for (let i = 0; i <= n; i++) {
        const x = h.x1 + (h.x2 - h.x1) * i / n;
        const y = h.y1 + (h.y2 - h.y1) * i / n;
        if (tele) {
          if (i % 2) ctx.fillRect(Math.round(x), Math.round(y), 2, 1);      // dashed warning line
        } else if (h.show > 0) {
          ctx.fillStyle = h.spike || c;
          ctx.fillRect(Math.round(x) - 1, Math.round(y) - 3, 2, 4);
        }
      }
    } else if (h.k === "rect") {
      if (tele) {
        ctx.globalAlpha = blink ? 0.25 : 0.12;
        ctx.fillRect(h.x, h.y, h.w, h.h);
      } else if (h.show > 0) {
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = "#ff8a2a";
        ctx.fillRect(h.x, h.y, h.w, h.h);
        ctx.fillStyle = "#ffd166";
        ctx.fillRect(h.x + 2, h.y, Math.max(0, h.w - 4), h.h);
      }
    } else if (h.k === "cone") {
      // dotted while warning, solid (hot colours towards the tip) once active
      for (let r = 8; r < h.r; r += tele ? 6 : 3) {
        for (let i = 0; i <= 10; i++) {
          if (tele && i % 2) continue;
          const a = h.a - h.spread / 2 + h.spread * i / 10;
          ctx.fillStyle = tele ? c : (r > h.r * 0.6 ? "#d9433a" : "#ffd166");
          ctx.fillRect(Math.round(h.x + Math.cos(a) * r), Math.round(h.y + Math.sin(a) * r), tele ? 1 : 2, tele ? 1 : 2);
        }
      }
    } else if (h.k === "area") {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = h.c || (h.effect === "burn" ? "#ff8a2a" : "#cfd6e6");
      ellipse(ctx, h.x, h.y, h.r, h.r * 0.7);
      ctx.globalAlpha = 0.9;
      ring(ctx, h.x, h.y, h.r, h.r * 0.7, 0.5);
    } else if (h.k === "trap") {
      ctx.fillStyle = "#cfd6e6";
      for (let i = -1; i <= 1; i++) ctx.fillRect(Math.round(h.x + i * 3), Math.round(h.y - 2), 1, 3);
    } else if (h.k === "frost") {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#b9d0ff";
      ellipse(ctx, h.x, h.y, h.r, h.r * 0.7);
    } else if (h.k === "ringwave") {
      for (let a = 0; a < 6.283; a += 0.18) {
        if (Math.abs(Math.atan2(Math.sin(a - h.gapA), Math.cos(a - h.gapA))) < h.gapW / 2) continue;   // skip the gap
        const x = h.x + Math.cos(a) * h.r;
        const y = h.y + Math.sin(a) * h.r * 0.7;
        ctx.fillStyle = c;
        ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
        ctx.fillStyle = "#fff";
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    } else if (h.k === "linewave") {
      for (let y = WALL; y < H; y += 2) {
        if (y > h.gapY && y < h.gapY + h.gapH) continue;
        ctx.fillStyle = y % 4 ? c : "#e8ffff";
        ctx.fillRect(Math.round(h.x) - 1, y, 3, 2);
      }
    }
    ctx.globalAlpha = 1;
  }
}

// Warden's blade + slash arc. Timeline of p.atk (0.26s): windup 0.26→0.16, slash 0.16→0.06 (hit at 0.11), follow-through →0.
const SWING_TRAIL = {
  steel: ["#ffffff", "#5ef2ff", "#2bb6d9", "#5b3f8c"],
  frenzy: ["#ffffff", "#ffd166", "#ff8a2a", "#a8501a"],
};

function drawSwing(ctx, g) {
  const p = g.p;
  const w = p.swing;
  if (!w || p.atk <= 0) return;

  const [cx, cy] = pc(g);
  const atk = p.atk;
  const totalArc = w.spin ? Math.PI * 2 : w.arc;
  const startAngle = w.spin ? w.a : w.a - w.dir * totalArc / 2;

  // where the blade points: draws back during the windup, then eases out across the arc
  let angle;
  if (atk > 0.16) {
    angle = startAngle - w.dir * 0.5 * ((0.26 - atk) / 0.1);
  } else {
    const s = clamp((0.16 - atk) / 0.1, 0, 1);
    angle = startAngle + w.dir * totalArc * (1 - (1 - s) * (1 - s));
  }

  // crescent trail behind the blade tip
  if (atk <= 0.16) {
    const span = Math.abs(angle - startAngle);
    const tail = Math.min(span, 1.7);
    const pal = w.fr ? SWING_TRAIL.frenzy : SWING_TRAIL.steel;
    ctx.globalAlpha = atk < 0.06 ? atk / 0.06 : 1;
    for (let t = span - tail; t <= span; t += 0.03) {
      const behind = tail ? (span - t) / tail : 0;
      const thick = 1 + Math.round(3 * (1 - behind));
      const trailAngle = startAngle + w.dir * t;
      ctx.fillStyle = behind < 0.05 ? pal[0] : behind < 0.4 ? pal[1] : behind < 0.7 ? pal[2] : pal[3];
      for (let r = w.reach - thick + 1; r <= w.reach; r++) {
        ctx.fillRect(Math.round(cx + Math.cos(trailAngle) * r), Math.round(cy + Math.sin(trailAngle) * r), 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  // great sword: pivots from the body, tip sits exactly on the arc's outer edge (= the reach that actually hits); 3 px wide
  const lunge = atk <= 0.16 && atk > 0.06 ? p.face : 0;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const nx = -uy;
  const ny = ux;
  const baseX = cx + lunge + ux * 3;
  const baseY = cy - 1 + uy * 3;
  const LEN = w.reach - 3;
  const at = (i, k) => [Math.round(baseX + ux * i + nx * k), Math.round(baseY + uy * i + ny * k)];

  // outline
  ctx.fillStyle = "#120e1a";
  for (let i = -1; i <= LEN + 1; i += 0.5) {
    for (let k = -2; k <= 2; k++) {
      const [x, y] = at(i, k);
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // grip, then the blade with a bright edge and a shaded edge
  for (let i = 0; i <= LEN; i += 0.5) {
    ctx.fillStyle = i < 3 ? "#3a2a1e" : i < 4.5 ? "#e0b93a" : "#ffffff";
    let [x, y] = at(i, 0);
    ctx.fillRect(x, y, 1, 1);
    if (i >= 4.5) {
      ctx.fillStyle = i > LEN - 3 ? "#e6edf9" : "#c8d3ea";
      [x, y] = at(i, 1);
      ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = i > LEN - 3 ? "#a8b4d0" : "#7d8bab";
      [x, y] = at(i, -1);
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // crossguard
  ctx.fillStyle = "#e0b93a";
  for (const k of [-2, -1, 1, 2]) {
    const [x, y] = at(4, k);
    ctx.fillRect(x, y, 1, 1);
  }

  // pommel
  const [px, py] = at(-0.5, 0);
  ctx.fillStyle = "#e0b93a";
  ctx.fillRect(px, py, 1, 1);
}

// player projectiles, one look per `kind`
function drawShots(ctx, g) {
  for (const s of g.shots) {
    const x = Math.round(s.x);
    const y = Math.round(s.y);
    if (s.kind === "wisp") {
      ctx.fillStyle = PAL.y;
      ctx.fillRect(x, y, 2, 2);
    } else if (s.kind === "bullet" || s.kind === "heavy") {
      const ux = Math.cos(s.a);
      const uy = Math.sin(s.a);
      const heavy = s.kind === "heavy";
      const len = heavy ? 6 : 3;
      for (let i = 0; i < len; i++) {
        ctx.fillStyle = i === 0 ? "#ffffff" : heavy ? "#ff8a2a" : "#ffd166";
        ctx.fillRect(Math.round(s.x - ux * i), Math.round(s.y - uy * i), heavy ? 2 : 1, heavy ? 2 : 1);
      }
    } else if (s.kind === "dead") {
      const ux = Math.cos(s.a);
      const uy = Math.sin(s.a);
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = i === 0 ? "#ffffff" : i < 4 ? "#ff4a6a" : "#8a2a3a";
        ctx.fillRect(Math.round(s.x - ux * i * 1.5), Math.round(s.y - uy * i * 1.5), i === 0 ? 2 : 1, i === 0 ? 2 : 1);
      }
    } else if (s.kind === "pellet") {
      ctx.fillStyle = "#ffb347";
      ctx.fillRect(x, y, 2, 2);
      ctx.fillStyle = "#fff0c0";
      ctx.fillRect(x, y, 1, 1);
    } else if (s.kind === "soul") {
      ctx.fillStyle = "#8f6bd1";
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y - 1, 1, 3);
      ctx.fillStyle = "#7be07a";
      ctx.fillRect(x, y, 1, 1);
      const ux = Math.cos(s.a);
      const uy = Math.sin(s.a);
      ctx.fillStyle = "#b9a0f0";
      ctx.fillRect(Math.round(s.x - ux * 3), Math.round(s.y - uy * 3), 1, 1);
    } else if (s.kind === "arrow") {
      const ux = Math.cos(s.a);
      const uy = Math.sin(s.a);
      ctx.fillStyle = "#7a5320";
      for (let i = 1; i < 4; i++) ctx.fillRect(Math.round(s.x - ux * i), Math.round(s.y - uy * i), 1, 1);
      ctx.fillStyle = s.dmg < 1 ? "#9aa3b8" : "#e8ffff";      // weaker side arrows have a duller tip
      ctx.fillRect(x, y, 1, 1);
    } else {
      // orbs and anything else: a little plus
      ctx.fillStyle = PAL.X;
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y - 1, 1, 3);
      ctx.fillStyle = PAL.w;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawCompanion(ctx, g, now) {
  const c = g.comp;
  const kind = CLASSES[g.cls].companion;
  const flap = Math.floor(now / 110) % 2;
  if (kind === "wisp") {
    spr(ctx, WISP, c.x - 2, c.y - 2, false, PAL);
  } else if (kind === "hawk") {
    spr(ctx, HAWK[c.mode === "dive" ? 1 : flap], c.x - 3, c.y - 2, c.vx < 0, PAL);
  } else if (kind === "bomb") {
    drawBombs(ctx, g, now);
  } else if (kind === "boneimp") {
    ctx.fillStyle = "#17121f";
    ctx.fillRect(Math.round(c.x - 2), Math.round(c.y + 7), 5, 1);
    spr(ctx, IMP[Math.floor(now / 350) % 2], c.x - 2, c.y - 2, false, IMP_PAL);
  } else if (kind === "cat") {
    spr(ctx, CAT[c.mode === "pounce" ? 1 : Math.floor(now / 260) % 2], c.x - 4, c.y - 3, c.vx > 0, CAT_PAL);
  } else {
    // familiar goes grey when it has no charges left
    spr(ctx, FAMILIAR[flap], c.x - 2, c.y - 2, false, c.ch > 0 ? PAL : DIM);
  }
}

// open door on the right wall + blinking arrow
function drawDoor(ctx, g, now) {
  const door = g.door;
  ctx.fillStyle = "#4a3f66";
  ctx.fillRect(door.x - 2, door.y - 14, 8, 28);
  ctx.fillStyle = "#07050e";
  ctx.fillRect(door.x, door.y - 12, 6, 24);
  if (Math.floor(now / 350) % 2) {
    ctx.fillStyle = "#ffd166";
    for (let i = 0; i < 4; i++) ctx.fillRect(door.x - 10 + i, door.y - 3 + i, 1, 7 - i * 2);
  }
}

// One straight top-to-bottom layer stack (biome → hazard telegraphs → pickups/shards → enemies → boss → hero →
// weapon overlay → companion → darkness mask on stage 5 → marks/reticles → projectiles → particles → HUD). The
// only non-linear part is the stage-5 darkness double-draw of enemies/boss below — see the comment there.
export function draw(ctx, g, now, tc, key = "SPC", showHud = true) {
  ensureBiome(g);
  const S = stageOf(g);
  const dark = S.rule === "dark";

  // background
  ctx.drawImage(g.biome.cv, 0, 0);
  S.ambient(ctx, g, W, H, WALL, now);
  for (const patch of g.tempPatches) {
    ctx.fillStyle = "#34628e";
    ellipse(ctx, patch.x, patch.y, patch.rx, patch.ry);
    ctx.fillStyle = "#8fd3ff";
    ctx.fillRect(Math.round(patch.x - patch.rx * 0.4), Math.round(patch.y - 1), 3, 1);
  }

  // the void arena closing in: black bars over the lost area
  if (g.collapse > 0) {
    const B = g.bounds;
    ctx.fillStyle = "#07050e";
    ctx.fillRect(0, WALL, Math.floor(B.x0), H);
    ctx.fillRect(Math.ceil(B.x1 + 16), WALL, W, H);
    ctx.fillRect(0, Math.ceil(B.y1 + 17), W, H);
  }
  if (!dark) drawHz(ctx, g, now);

  for (const r of g.rings) {
    ctx.fillStyle = r.big ? "#ffffff" : "#b9d0ff";
    ctx.globalAlpha = Math.min(1, r.l * 4);
    ring(ctx, r.x, r.y, r.r, r.r * 0.7, r.big ? 0.05 : 0.3);
    if (r.big) ring(ctx, r.x, r.y, r.r - 1.5, (r.r - 1.5) * 0.7, 0.07);
    ctx.globalAlpha = 1;
  }

  // pickups
  for (const s of g.shards) {
    spr(ctx, SHARD, s.x - 1, s.y - 1 + Math.round(Math.sin(now / 200 + s.x)), false, PAL);
  }
  for (const u of g.pu) {
    if (u.l < 3 && Math.floor(now / 120) % 2) continue;      // blinks when about to expire
    const bob = Math.round(Math.sin(now / 250 + u.x) * 1.5);
    ctx.fillStyle = "#17121f";
    ctx.fillRect(u.x + 1, u.y + 8, 5, 1);
    spr(ctx, ICONS[u.k], u.x, u.y + bob - 1, false, PAL);
  }

  drawEnemies(ctx, g, now, false);
  if (g.boss) drawBoss(ctx, g, now, false);
  drawFog(ctx, g, now);
  drawMinions(ctx, g, now);

  // Afterimage decoy
  if (g.decoy) {
    ctx.globalAlpha = 0.5 * Math.min(1, g.decoy.t);
    drawHero(ctx, g.cls, { x: g.decoy.x - 8, y: g.decoy.y - 10, face: g.p.face, moving: false, atk: 0 }, now, DECOY_PAL);
    ctx.globalAlpha = 1;
  }

  // the hero: ground shadow, the sprite (blinks while invulnerable), then the class weapon overlay
  const p = g.p;
  ctx.fillStyle = "#17121f";
  ctx.fillRect(p.x + 4, p.y + 16, 8, 1);
  const swordOut = g.cls === "warden" && p.atk > 0;
  const gunAim = g.cls === "gunner" && p.aimT > 0;
  const stabbing = g.cls === "assassin" && p.atk > 0;
  if (!(p.inv > 0 && Math.floor(now / 60) % 2)) {
    drawHero(ctx, g.cls, {
      x: p.x, y: p.y, face: p.face, moving: p.moving,
      atk: Math.max(0, p.atk), noWeapon: swordOut || gunAim || stabbing,
    }, now);
  }
  if (swordOut) drawSwing(ctx, g);
  if (gunAim) drawGun(ctx, g);
  if (stabbing) drawStab(ctx, g);

  // soul shield: ring of dots circling the hero
  if (p.shield) {
    ctx.fillStyle = PAL.Z;
    for (let a = 0; a < 6.28; a += 0.52) {
      ctx.fillRect(Math.round(p.x + 8 + Math.cos(a + now / 400) * 11), Math.round(p.y + 9 + Math.sin(a + now / 400) * 10), 1, 1);
    }
  }
  // chilled: two frost specks
  if (p.chillT > 0) {
    ctx.fillStyle = "#b9d0ff";
    ctx.fillRect(Math.round(p.x + 3), Math.round(p.y + 1), 1, 1);
    ctx.fillRect(Math.round(p.x + 12), Math.round(p.y + 3), 1, 1);
  }

  drawCompanion(ctx, g, now);

  // Stage 5 "dark" rule: enemies/boss were already drawn fully above (normal palette, eyesPass=false) BEFORE the
  // mask exists, because the mask needs every light source (player + companion + enemy-given lights) computed
  // first. drawDarkness paints black everywhere except small lit circles. This block redraws enemies/boss a
  // SECOND time with eyesPass=true, which swaps their palette for one where every color is transparent except the
  // eye keys, so only glowing eye pixels punch back through the black — full sprite visible only when lit, eyes
  // visible everywhere ("something is watching you in the dark").
  if (dark) {
    const [pcx, pcy] = pc(g);
    const c = g.comp;
    const lights = [
      { x: pcx, y: pcy - 2, r: g.vision },
      { x: c.x, y: c.y, r: VOID.vision.companion },
      ...enemyLights(g),
    ];
    for (const s of g.shots) {
      if (s.kind === "orb") lights.push({ x: s.x, y: s.y, r: 10 });
    }
    drawDarkness(ctx, W, H, lights, DOC());
    drawEnemies(ctx, g, now, true);
    if (g.boss) drawBoss(ctx, g, now, true);
    drawHz(ctx, g, now);
  }

  drawMarks(ctx, g, now);
  drawReticle(ctx, g, now);
  drawShots(ctx, g);

  // enemy bullets: sprite if they have one, otherwise a square with a white core
  for (const b of g.eb) {
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    if (b.spr) {
      spr(ctx, b.spr, x - (b.spr[0].length >> 1), y - (b.spr.length >> 1), false, b.pal || PAL);
    } else {
      const size = b.size;
      ctx.fillStyle = b.c;
      ctx.fillRect(x - size, y - size, size * 2 + 1, size * 2 + 1);
      ctx.fillStyle = "#fff";
      ctx.fillRect(x, y, 1, 1);
    }
  }

  for (const part of g.parts) {
    ctx.fillStyle = part.c || PAL.o;
    ctx.fillRect(Math.round(part.x), Math.round(part.y), 1, 1);
  }

  // touch joystick
  if (tc) {
    ctx.strokeStyle = "rgba(94,242,255,.35)";
    ctx.beginPath();
    ctx.arc(tc.jx, tc.jy, 10, 0, 7);
    ctx.stroke();
    ctx.fillStyle = "rgba(94,242,255,.7)";
    ctx.fillRect(Math.round(tc.jx + tc.dx * 8) - 2, Math.round(tc.jy + tc.dy * 8) - 2, 4, 4);
  }

  drawGates(ctx, g, now);
  if (g.door) drawDoor(ctx, g, now);

  // fade to black between rooms
  if (g.trans) {
    const t = g.trans.t;
    ctx.fillStyle = `rgba(7,5,14,${t < 0.3 ? t / 0.3 : Math.max(0, (0.6 - t) / 0.3)})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (showHud) drawHUD(ctx, hudState(g, key), W, H, now);
}
