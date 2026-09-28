// Dungeon Survival engine: world state, update loop, combat, progression, rendering.
// Content lives in stages.js (biomes/enemies/bosses), enemies.js (regular AI), bosses.js (boss AI + attacks).
import { PAL, DIM, WISP, HAWK, FAMILIAR, ICONS, spr, drawHero } from "./sprites.js";
import { sfx } from "./audio.js";
import { PU, applyPU, pickPU, tickFx, lv } from "./powerups.js";
import { CLASSES } from "./classes.js";
import { STAGES, KILLS_NEED, PHASE_FALLBACK, SPAWN_BASE } from "./stages.js";
import { XP, SHARD, rollChoices, computeMods, UPGRADES } from "./upgrades.js";
import { stepEnemies, spawnMob, drawEnemies, enemyLights } from "./enemies.js";
import { spawnBoss, stepBoss, drawBoss, bossDamageMul } from "./bosses.js";
import { drawHUD } from "./hud.js";
import { onIce } from "./biomes/ice.js";
import { ventState, inVent, LAVA } from "./biomes/lava.js";
import { drawDarkness, VOID } from "./biomes/void.js";

export let W = 240, H = 135;
export const fitSize = gb => { [W, H] = gb ? [160, 144] : [240, 135]; return [W, H]; };
export const WALL = 14;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DOC = () => globalThis.document;

// ---------- state ----------
export function newGame(cls = "warden", stage = 1) {
  const C = CLASSES[cls];
  const g = {
    cls, maxHp: C.hp, t: 0, score: 0, kills: 0, totalKills: 0, over: false, won: false,
    p: { x: W / 2 - 8, y: H / 2 - 8, vx: 0, vy: 0, face: 1, dash: 0, dashV: [1, 0], dashSp: 0, dashHit: new Set(), cd: 0, inv: 0, hp: C.hp, moving: false, dir: null,
         atk: 0, acd: 0, hitDone: true, shield: false, chillT: 0, swings: 0, pull: 0, slowArea: false },
    stage, phase: 0, phaseClock: 0, boss: null, biome: null, biomeGrow: 1, ventT: 0, vision: W < 200 ? VOID.vision.playerGB : VOID.vision.player,
    bounds: null, collapse: 0, tempPatches: [],
    en: [], shots: [], eb: [], hz: [], parts: [], rings: [], pu: [], shards: [], timers: [],
    fx: {}, owned: {}, mods: computeMods({}, cls), lv: 1, xp: 0, levelQueue: 0, pending: null, rerolls: 1,
    guardT: 30, harvestN: 0, swUsed: false, puT: 15, spawn: 1, fire: 0, novaT: 0, msg: "", msgT: 0,
    comp: { x: W / 2 + 12, y: H / 2, mode: "perch", cd: 1, ch: 2, rc: 0, vx: 1, tgt: null, extra: 0 },
  };
  resetBounds(g); stageMsg(g);
  return g;
}
const resetBounds = g => { g.bounds = { x0: 0, y0: WALL - 8, x1: W - 16, y1: H - 17 }; };
const stageMsg = g => { g.msg = `STAGE ${g.stage}: ${STAGES[g.stage - 1].name}`; g.msgT = 2.5; };
export const stageOf = g => STAGES[g.stage - 1];
function ensureBiome(g) {
  const key = `${g.stage}|${W}|${g.biomeGrow}`;
  if (g.biome && g.biome.key === key) return;
  g.biome = { ...stageOf(g).build(W, H, WALL, DOC(), g), key };
}

// ---------- helpers used by classes / enemies / bosses ----------
export const center = (g, t) => [t.x + t.w / 2, t.y + t.h / 2];
export const alive = (g, t) => !!t && (t === g.boss ? t.hp > 0 : t.hp > 0 && g.en.includes(t));
export const pc = g => [g.p.x + 8, g.p.y + 10];
export function burst(g, x, y, n, c, sp = 80) { for (let i = 0; i < n; i++) g.parts.push({ x, y, vx: (Math.random() - 0.5) * sp, vy: (Math.random() - 0.5) * sp, l: 0.5, c }); }
export const after = (g, t, fn) => g.timers.push({ t, fn });
export const addHz = (g, h) => { const o = { t: 0, delay: 0, dur: 0, ...h }; g.hz.push(o); return o; };
export function shootE(g, x, y, a, sp, o = {}) { g.eb.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, sp, l: 5, c: "#ff4a6a", size: 1, ...o, ox: x, oy: y, dist: 0 }); }
export function nearest(g, x, y, range, filter) {
  let best = null, bd = range;
  const test = (t, pad) => { const [tx, ty] = center(g, t), d = Math.hypot(tx - x, ty - y) - pad; if (d < bd && (!filter || filter(Math.atan2(ty - y, tx - x)))) { bd = d; best = { x: tx, y: ty, ref: t, d }; } };
  for (const e of g.en) if (e.hp > 0 && !(e.rise > 0) && !e.harmless) test(e, 0);
  if (g.boss && g.boss.mode !== "enter") test(g.boss, g.boss.w / 2 - 4);
  return best;
}
export function fireShot(g, o) { g.shots.push({ ...o, vx: Math.cos(o.a) * o.sp, vy: Math.sin(o.a) * o.sp, pierce: o.pierce || 0, hitSet: new Set() }); }
export const onIceAt = (g, x, y) => stageOf(g).rule === "ice" && !!g.biome && (onIce(g.biome.patches, x, y) || onIce(g.tempPatches, x, y));
export const inWaterAt = (g, x, y) => stageOf(g).rule === "water" && !!g.biome?.inWater?.(x, y);
export function msg(g, m, t = 1.4) { g.msg = m; g.msgT = t; }

// ---------- damage ----------
export function dealDmg(g, t, n, fromPlayer = true) {
  if (fromPlayer) n *= g.mods.dmg;
  if (t === g.boss) return damageBoss(g, n * bossDamageMul(g, t));
  if (t.harmless) { t.hp = 0; burst(g, t.x + 4, t.y + 1, 6, "#e8e4d8"); return; }
  t.hp -= n; t.hit = 0.1; if (t.hp <= 0) kill(g, t);
}
function splash(g, x, y, r, n, except) {
  for (const e of g.en) if (e !== except && e.hp > 0 && !(e.rise > 0) && Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y) < r) dealDmg(g, e, n);
  const b = g.boss; if (b && b !== except && Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y) < r + b.w / 2) dealDmg(g, b, n);
}
function chill(g, x, y, r) {
  const m = g.mods;
  for (const e of g.en) if (Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y) < r + 2) { e.slow = Math.max(e.slow || 0, m.chillTime); e.slowMul = m.chillMul; }
  const b = g.boss; if (b && Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y) < r + b.w / 2) b.slow = Math.max(b.slow, m.chillTime);
}
export function meleeHit(g, reach, dmg, all = false) {
  const p = g.p, [cx, cy] = pc(g), arc = g.mods.arc; let hit = 0;
  const front = ex => all || ex * p.face > -6 - arc * 0.2;
  for (const e of g.en) {
    const ex = e.x + e.w / 2 - cx, ey = e.y + e.h / 2 - cy, d = Math.hypot(ex, ey) || 1;
    if (e.hp > 0 && !(e.rise > 0) && d < reach && front(ex)) { if (!e.harmless && !e.fixed) { e.x += ex / d * 10; e.y += ey / d * 10; } hit++; dealDmg(g, e, dmg); }
  }
  const b = g.boss;
  if (b && b.mode !== "enter") { const ex = b.x + b.w / 2 - cx, ey = b.y + b.h / 2 - cy; if (Math.hypot(ex, ey) < reach + b.w / 2 - 2 && (all || ex * p.face > -(b.w / 2 + 4))) { hit++; dealDmg(g, b, dmg); } }
  for (const s of g.eb) if (s.hp && Math.hypot(s.x - cx, s.y - cy) < reach) { s.hp = 0; s.l = 0; burst(g, s.x, s.y, 5, s.c); }
  if (hit) { navigator.vibrate?.(15); sfx("hit"); }
}
export function hurt(g, dmg = 1) {
  const p = g.p; if (p.inv > 0 || g.over) return false;
  if (p.shield) { p.shield = false; p.inv = 0.8; msg(g, "Shield broke", 1.2); sfx("shield"); return true; }
  p.hp -= dmg; p.inv = 1; navigator.vibrate?.(60); sfx("hurt");
  if (p.hp <= 0 && g.mods.secondWind && !g.swUsed) { g.swUsed = true; p.hp = 1; p.inv = 2; msg(g, "Second wind!", 1.6); burst(g, p.x + 8, p.y + 8, 20, "#e8ffff", 120); }
  if (p.hp <= 0) { g.over = true; sfx("over"); }
  return true;
}
function kill(g, e) {
  sfx("kill"); burst(g, e.x + e.w / 2, e.y + e.h / 2, 6, e.dieC || PAL.o);
  g.score += e.pts ?? 1; g.totalKills++;
  if (e.xp) dropShards(g, e.x + e.w / 2, e.y + e.h / 2, e.xp);
  if (!e.summon && !g.boss) { g.kills++; if (Math.random() < 0.12) dropPU(g, e.x, e.y); }
  if (g.mods.healEvery && ++g.harvestN >= g.mods.healEvery) { g.harvestN = 0; if (g.p.hp < g.maxHp) { g.p.hp++; msg(g, "+1 heart", 1); } }
  if (e.onDeath) e.onDeath(g, e);
}
export function damageBoss(g, n) {
  const b = g.boss; if (!b || b.mode === "enter") return; b.hp -= n; b.hit = 0.1; sfx("hit");
  if (b.hp > 0) return;
  const def = b.def, stageBoss = g.phase === 2;
  burst(g, b.x + b.w / 2, b.y + b.h / 2, 30, def.bc, 140); navigator.vibrate?.([40, 40, 80]);
  g.boss = null; g.eb = []; g.hz = g.hz.filter(h => h.owner === "player"); g.en = g.en.filter(e => !e.summon);
  g.score += stageBoss ? 10 : 5; dropShards(g, b.x + b.w / 2, b.y + b.h / 2, stageBoss ? XP.shard.stageBoss : XP.shard.miniboss);
  if (def.final) { g.won = true; g.over = true; sfx("win"); return; }
  sfx("bossDie");
  if (!stageBoss) { dropPU(g, b.x, b.y + b.h / 2); dropPU(g, b.x + b.w, b.y + b.h / 2); msg(g, def.name + " defeated", 2); g.phase++; g.kills = 0; g.phaseClock = 0; return; }
  msg(g, `STAGE ${g.stage} CLEAR`, 2); g.clearing = true;
  after(g, 1.4, () => { collectAll(g); g.clearing = false; g.pending = { type: "stage", choices: rollChoices(g.cls, g.owned, g.stage, "rare") }; });
}
export function nextStage(g) {
  g.stage++; g.phase = 0; g.boss = null; g.kills = 0; g.phaseClock = 0; g.biomeGrow = 1; g.tempPatches = []; g.collapse = 0;
  g.en = []; g.eb = []; g.hz = []; g.shots = []; g.pu = []; g.shards = []; g.timers = []; g.spawn = 1.5; g.swUsed = false; g.rerolls = 1;
  g.vision = W < 200 ? VOID.vision.playerGB : VOID.vision.player; resetBounds(g);
  Object.assign(g.p, { x: W / 2 - 8, y: H / 2 - 8, vx: 0, vy: 0, inv: 1.5, chillT: 0, pull: 0 });
  stageMsg(g); g.biome = null;
}
function dropShards(g, x, y, v) { const n = Math.min(6, Math.ceil(v / 5)); for (let i = 0; i < n; i++) g.shards.push({ x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 8, v: v / n, t: 0 }); }
function collectAll(g) { for (const s of g.shards) addXP(g, s.v); g.shards = []; }
function addXP(g, v) { g.xp += v; while (g.xp >= XP.need(g.lv)) { g.xp -= XP.need(g.lv); g.lv++; g.levelQueue++; } }
export function dropPU(g, x, y) { g.pu.push({ k: pickPU(g), x: clamp(x, 4, W - 11), y: clamp(y, WALL + 4, H - 10), l: 10 }); }

// ---------- choices (called by the UI) ----------
export function chooseUpgrade(g, id) {
  const u = UPGRADES.find(q => q.id === id); if (!u || !g.pending) return;
  g.owned[id] = (g.owned[id] || 0) + 1; g.mods = computeMods(g.owned, g.cls);
  if (u.fx.maxHp) { g.maxHp += u.fx.maxHp; g.p.hp = Math.min(g.maxHp, g.p.hp + (u.fx.heal || 0)); }
  const wasStage = g.pending.type === "stage"; g.pending = null; sfx("pickup"); msg(g, u.name, 1.2);
  if (wasStage) nextStage(g);
}
export function rerollChoices(g) {
  if (!g.pending || g.rerolls <= 0) return; g.rerolls--;
  g.pending.choices = rollChoices(g.cls, g.owned, g.stage, g.pending.type === "stage" ? "rare" : "common");
}
export function triggerAbility(g) {
  const p = g.p; if (g.over || g.pending || p.cd > 0) return;
  p.dashHit = new Set();
  CLASSES[g.cls].ability(g, p.dir); p.cd = CLASSES[g.cls].abilityCd * g.mods.cd;
  if (g.mods.dashShield && g.cls === "warden") p.inv = Math.max(p.inv, g.mods.dashShield);
}

// ---------- companions ----------
export function orbit(g, t) {
  const p = g.p, c = g.comp, k = CLASSES[g.cls].companion;
  if (k === "hawk") { if (c.mode === "perch") { c.x = p.x + 8 - p.face * 10; c.y = p.y - 2 + Math.sin(t * 4) * 1.5; c.vx = p.face; } }
  else if (k === "familiar") { const a = t * 2.2; c.x = p.x + 8 + Math.cos(a) * 14; c.y = p.y + 6 + Math.sin(a) * 10; }
  else { const a = t * 3; c.x = p.x + 8 + Math.cos(a) * 13; c.y = p.y + 6 + Math.sin(a) * 7; }
}
function stepCompanion(g, dt, C) {
  const c = g.comp, p = g.p, [cx, cy] = pc(g), bond = g.mods.companion;
  if (C.companion === "wisp") {
    orbit(g, g.t);
    if ((g.fire -= dt) <= 0) {
      const su = lv(g, "surge"), t = nearest(g, c.x, c.y, 110 + 40 * (su > 0));
      if (t) {
        g.fire = 1.5 / (1 + 2 * su); sfx("shot");
        const shot = () => { const tt = nearest(g, c.x, c.y, 160); if (tt) fireShot(g, { kind: "wisp", x: c.x, y: c.y, a: Math.atan2(tt.y - c.y, tt.x - c.x), sp: 170, dmg: 1, l: 1 }); };
        shot(); for (let i = 0; i < bond; i++) after(g, 0.12 * (i + 1), shot);
      }
    }
  } else if (C.companion === "hawk") {
    const px = p.x + 8 - p.face * 10, py = p.y - 2 + Math.sin(g.t * 4) * 1.5; c.cd -= dt;
    if (c.mode === "perch") {
      const k = Math.min(1, dt * 10); c.x += (px - c.x) * k; c.y += (py - c.y) * k; c.vx = p.face;
      if (c.cd <= 0) { const t = nearest(g, cx, cy, 50); if (t) { c.mode = "dive"; c.tgt = t.ref; c.extra = bond; sfx("hawk"); } }
    } else if (c.mode === "dive") {
      if (!alive(g, c.tgt)) c.mode = "return";
      else {
        const [tx, ty] = center(g, c.tgt), dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy) || 1, s = 230 * dt; c.vx = dx;
        if (d < 5 + s) {
          const t = c.tgt;
          if (t !== g.boss && !t.fixed) { const kx = tx - cx, ky = ty - cy, kd = Math.hypot(kx, ky) || 1; t.x += kx / kd * 22; t.y += ky / kd * 22; t.slow = Math.max(t.slow || 0, 0.6); t.slowMul = 0.5; }
          burst(g, tx, ty, 8, "#a8741a", 90); dealDmg(g, t, 1); c.cd = 2.5;
          const nx = c.extra > 0 ? nearest(g, cx, cy, 60) : null;
          if (nx && nx.ref !== t) { c.extra--; c.tgt = nx.ref; } else c.mode = "return";
        } else { c.x += dx / d * s; c.y += dy / d * s; }
      }
    } else {
      const dx = px - c.x, dy = py - c.y, d = Math.hypot(dx, dy) || 1, s = 170 * dt; c.vx = dx;
      if (d < s + 1) c.mode = "perch"; else { c.x += dx / d * s; c.y += dy / d * s; }
    }
  } else if (C.companion === "familiar") {
    orbit(g, g.t); const max = 2 + bond;
    if (c.ch < max && (c.rc -= dt) <= 0) { c.ch++; c.rc = 1.5; }
    if (c.ch > 0) for (const b of g.eb) if (b.l > 0 && Math.hypot(b.x - c.x, b.y - c.y) < 7) { b.l = 0; c.ch--; if (c.rc <= 0) c.rc = 1.5; burst(g, c.x, c.y, 8, "#b9d0ff", 60); sfx("block"); if (!c.ch) break; }
    for (const e of g.en) {
      e.bump = (e.bump || 0) - dt;
      if (!e.fixed && !e.harmless && e.bump <= 0 && Math.hypot(e.x + e.w / 2 - c.x, e.y + e.h / 2 - c.y) < 8) {
        const kx = e.x + e.w / 2 - cx, ky = e.y + e.h / 2 - cy, kd = Math.hypot(kx, ky) || 1;
        e.x += kx / kd * 12; e.y += ky / kd * 12; e.slow = Math.max(e.slow || 0, 1); e.slowMul = 0.5; e.bump = 0.5;
      }
    }
  }
}

// ---------- hazards: telegraphed circles / lines / rects / cones / areas / waves ----------
function segDist(px, py, x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1, t = clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1); return Math.hypot(px - x1 - t * dx, py - y1 - t * dy); }
function stepHazards(g, dt) {
  const [cx, cy] = pc(g);
  for (const h of g.hz) {
    h.t += dt;
    if (h.follow && g.boss) { h.x = g.boss.x + g.boss.w / 2; h.y = g.boss.y + g.boss.h / 2; }
    if (h.owner === "player") {
      for (const e of g.en) if (Math.hypot(e.x + e.w / 2 - h.x, e.y + e.h / 2 - h.y) < h.r) {
        if (h.k === "trap" && !h.hit.has(e)) { h.hit.add(e); dealDmg(g, e, h.dmg); }
        if (h.k === "frost") { e.slow = Math.max(e.slow || 0, 1); e.slowMul = 0.5; }
      }
      const b = g.boss;
      if (h.k === "trap" && b && !h.hit.has(b) && Math.hypot(b.x + b.w / 2 - h.x, b.y + b.h / 2 - h.y) < h.r + b.w / 2) { h.hit.add(b); dealDmg(g, b, h.dmg); }
      if (h.k === "frost" && b && Math.hypot(b.x + b.w / 2 - h.x, b.y + b.h / 2 - h.y) < h.r + b.w / 2) b.slow = Math.max(b.slow, 0.5);
      h.done = h.t > h.dur; continue;
    }
    if (h.t < h.delay) continue;
    const first = !h.fired; h.fired = true;
    switch (h.k) {
      case "circle": if (first) { if (Math.hypot(cx - h.x, (cy - h.y) / 0.7) < h.r + 3) hurt(g); burst(g, h.x, h.y, 8, h.c || "#ff4a6a", 90); if (h.fire) addHz(g, { k: "area", x: h.x, y: h.y, r: h.r * 0.8, dur: h.fire, effect: "burn", c: "#ff8a2a" }); h.show = 0.3; } break;
      case "line": if (first) { if (!h.nodmg && segDist(cx, cy, h.x1, h.y1, h.x2, h.y2) < h.w / 2 + 3) hurt(g); h.show = h.nodmg ? 0 : 0.35; } break;
      case "rect": if (first) { if (cx > h.x && cx < h.x + h.w && cy > h.y && cy < h.y + h.h) hurt(g); h.show = 0.4; } break;
      case "cone": { h.a += (h.sweep || 0) / (h.dur || 1) * dt; const d = Math.hypot(cx - h.x, cy - h.y), a = Math.atan2(cy - h.y, cx - h.x), da = Math.abs(Math.atan2(Math.sin(a - h.a), Math.cos(a - h.a))); if (d < h.r && da < h.spread / 2) hurt(g); break; }
      case "area": { if (Math.hypot(cx - h.x, (cy - h.y) / 0.7) < h.r) { if (h.effect === "burn") hurt(g); else g.p.slowArea = true; } break; }
      case "ringwave": { h.r += h.sp * dt; const d = Math.hypot(cx - h.x, (cy - h.y) / 0.7), a = Math.atan2(cy - h.y, cx - h.x), inGap = Math.abs(Math.atan2(Math.sin(a - h.gapA), Math.cos(a - h.gapA))) < h.gapW / 2; if (Math.abs(d - h.r) < 3 && !inGap) hurt(g); if (h.r > h.max) h.done = true; break; }
      case "linewave": { h.x += h.dir * h.sp * dt; if (Math.abs(cx - h.x) < 3 && !(cy > h.gapY && cy < h.gapY + h.gapH)) { if (hurt(g)) g.p.x = clamp(g.p.x + h.dir * 14, g.bounds.x0, g.bounds.x1); } if (h.x < -10 || h.x > W + 10) h.done = true; break; }
    }
    if (h.show !== undefined) h.show -= dt;
    if (h.k !== "ringwave" && h.k !== "linewave" && h.t > h.delay + Math.max(h.dur || 0, 0.4)) h.done = true;
  }
  g.hz = g.hz.filter(h => !h.done);
}

// ---------- main update ----------
export function step(g, dt, k, tc) {
  if (g.over || g.pending) return;
  ensureBiome(g);
  const p = g.p, C = CLASSES[g.cls], m = g.mods, S = stageOf(g); g.t += dt; g.ventT += dt;
  for (const tm of g.timers) tm.t -= dt;
  const due = g.timers.filter(tm => tm.t <= 0); g.timers = g.timers.filter(tm => tm.t > 0); due.forEach(tm => tm.fn());
  if (g.pending) return;
  let dx = (k.has("d") || k.has("arrowright")) - (k.has("a") || k.has("arrowleft"));
  let dy = (k.has("s") || k.has("arrowdown")) - (k.has("w") || k.has("arrowup"));
  if (tc) { dx = tc.dx; dy = tc.dy; }
  const mag = Math.hypot(dx, dy); p.moving = mag > 0.2; if (mag > 1) { dx /= mag; dy /= mag; }
  p.dir = p.moving ? [dx / (mag || 1), dy / (mag || 1)] : null;
  if (Math.abs(dx) > 0.1 && p.atk <= 0) p.face = Math.sign(dx);
  const [cx0, cy0] = pc(g), wet = inWaterAt(g, cx0, cy0 + 5), slick = onIceAt(g, cx0, cy0 + 5);
  let spd = C.speed * (1 + 0.35 * lv(g, "boots")) * m.move;
  if (p.chillT > 0 || p.slowArea || wet) spd *= 0.6;
  p.slowArea = false;
  const acc = slick ? 3 : 30; p.vx += (dx * spd - p.vx) * Math.min(1, acc * dt); p.vy += (dy * spd - p.vy) * Math.min(1, acc * dt);
  let vx = p.dash > 0 ? p.dashV[0] * p.dashSp : p.vx, vy = p.dash > 0 ? p.dashV[1] * p.dashSp : p.vy;
  if (p.pull > 0 && g.boss) { const [bx, by] = center(g, g.boss), ddx = bx - cx0, ddy = by - cy0, d = Math.hypot(ddx, ddy) || 1; vx += ddx / d * p.pull; vy += ddy / d * p.pull; }
  const B = g.bounds; p.x = clamp(p.x + vx * dt, B.x0, B.x1); p.y = clamp(p.y + vy * dt, B.y0, B.y1);
  p.dash -= dt; p.cd -= dt; p.inv -= dt; p.atk -= dt; p.acd -= dt; p.chillT -= dt;
  const [cx, cy] = pc(g);
  if (p.dash > 0 && m.dashDamage && g.cls === "warden") for (const e of g.en) if (!p.dashHit.has(e) && Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < 10) { p.dashHit.add(e); dealDmg(g, e, m.dashDamage); }
  // progression: kills → miniboss 1 → miniboss 2 → stage boss (with a fallback timer)
  if (!g.boss && !g.clearing) {
    g.phaseClock += dt;
    if (g.kills >= KILLS_NEED[g.phase] || g.phaseClock >= PHASE_FALLBACK) {
      for (const e of g.en) burst(g, e.x + e.w / 2, e.y + e.h / 2, 4, "#8a83a0");
      g.en = []; spawnBoss(g, g.phase < 2 ? S.minis[g.phase] : S.boss);
    } else if ((g.spawn -= dt) <= 0) { g.spawn = Math.max(0.45, SPAWN_BASE[g.stage - 1] * (1 - 0.12 * g.phase)); spawnMob(g, S); }
  }
  stepEnemies(g, dt, cx, cy);
  C.attack(g, cx, cy);
  stepBoss(g, dt, cx, cy);
  stepCompanion(g, dt, C);
  stepHazards(g, dt);
  stepRule(g, dt, cx, cy, S);
  stepEnemyShots(g, dt, cx, cy);
  g.tempPatches = g.tempPatches.filter(tp => tp.l === undefined || (tp.l -= dt) > 0);
  tickFx(g, dt); g.msgT -= dt;
  if (m.shieldEvery) { g.guardT -= dt; if (g.guardT <= 0) { g.guardT = m.shieldEvery; if (!p.shield) { p.shield = true; msg(g, "Guardian spark", 1); } } }
  const nv = lv(g, "nova");
  if (nv) { if ((g.novaT -= dt) <= 0) { g.novaT = 2; const R = 28 * (1 + 0.3 * (nv - 1)); for (const e of g.en) if (Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < R) { e.slow = 1.5; e.slowMul = 0.5; } if (g.boss && Math.hypot(g.boss.x + g.boss.w / 2 - cx, g.boss.y + g.boss.h / 2 - cy) < R + g.boss.w / 2) g.boss.slow = 1.5; g.rings.push({ x: cx, y: cy - 2, r: 3, max: R, l: 0.35 }); sfx("nova"); } } else g.novaT = 0;
  for (const r of g.rings) { r.r += (r.max - 3) / 0.35 * dt; r.l -= dt; }
  g.rings = g.rings.filter(r => r.l > 0);
  if (!g.boss && (g.puT -= dt) <= 0) { g.puT = 18; dropPU(g, 10 + Math.random() * (W - 30), WALL + 8 + Math.random() * (H - WALL - 24)); }
  for (const u of g.pu) { u.l -= dt; if (Math.hypot(u.x + 3.5 - cx, u.y + 3.5 - cy) < 10) { const name = applyPU(g, u.k); u.l = 0; sfx("pickup"); msg(g, name); navigator.vibrate?.(20); burst(g, u.x + 3, u.y + 3, 10, PU[u.k].c, 90); } }
  g.pu = g.pu.filter(u => u.l > 0);
  const mr = XP.magnet * m.magnet;
  for (const s of g.shards) { s.t += dt; const d = Math.hypot(cx - s.x, cy - s.y); if (d < mr || s.t > 6) { const sp = 140 * dt; s.x += (cx - s.x) / (d || 1) * sp; s.y += (cy - s.y) / (d || 1) * sp; } if (d < 5) { addXP(g, s.v); s.v = 0; } }
  g.shards = g.shards.filter(s => s.v > 0);
  stepShots(g, dt);
  g.en = g.en.filter(e => e.hp > 0);
  for (const q of g.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.l -= dt; }
  g.parts = g.parts.filter(q => q.l > 0);
  if (g.levelQueue > 0 && !g.pending && !g.over && !g.clearing) { g.levelQueue--; g.pending = { type: "level", choices: rollChoices(g.cls, g.owned, g.stage) }; sfx("pickup"); }
}

function stepRule(g, dt, cx, cy, S) {
  if (S.rule === "lava") {
    for (const v of g.biome.vents) {
      const forced = g.t < (v.force || 0), st = forced ? "erupt" : ventState(v, g.ventT);
      if (st !== "erupt") continue;
      const cyc = forced ? "f" + Math.floor(v.force * 10) : "c" + Math.floor((g.ventT + v.off) / LAVA.vent.cycle), id = cyc + ":" + v.x;
      if (inVent(v, cx, cy + 4)) hurt(g);
      for (const e of g.en) if (!e.harmless && !e.fly && inVent(v, e.x + e.w / 2, e.y + e.h) && e.ventCyc !== id) { e.ventCyc = id; dealDmg(g, e, LAVA.vent.dmgEnemy, false); }
      const b = g.boss; if (b && !b.def.floats && inVent(v, b.x + b.w / 2, b.y + b.h - 2) && b.ventCyc !== id) { b.ventCyc = id; damageBoss(g, 3); msg(g, "Burned by the vent!", 1); }
    }
  }
  if (g.collapse > 0) {
    g.collapse = Math.min(1, g.collapse + dt / 10);
    const mx = W * 0.075 * g.collapse, my = (H - WALL) * 0.075 * g.collapse;
    g.bounds = { x0: mx, y0: WALL - 8 + my, x1: W - 16 - mx, y1: H - 17 - my };
  }
}
function stepEnemyShots(g, dt, cx, cy) {
  for (const b of g.eb) {
    if (b.home) { const want = Math.atan2(cy - b.y, cx - b.x), a = Math.atan2(b.vy, b.vx), da = clamp(Math.atan2(Math.sin(want - a), Math.cos(want - a)), -b.home * dt, b.home * dt); b.vx = Math.cos(a + da) * b.sp; b.vy = Math.sin(a + da) * b.sp; }
    b.x += b.vx * dt; b.y += b.vy * dt; b.l -= dt; b.dist += b.sp * dt;
    if (b.ret && !b.back && b.dist > b.ret) b.back = true;
    if (b.back) { const src = g.boss ? center(g, g.boss) : [b.ox, b.oy], d = Math.hypot(src[0] - b.x, src[1] - b.y) || 1; b.vx = (src[0] - b.x) / d * b.sp; b.vy = (src[1] - b.y) / d * b.sp; if (d < 6) b.l = 0; }
    if (b.bounce > 0) { if (b.x < 2 || b.x > W - 2) { b.vx *= -1; b.bounce--; b.x = clamp(b.x, 2, W - 2); } if (b.y < WALL || b.y > H - 2) { b.vy *= -1; b.bounce--; b.y = clamp(b.y, WALL, H - 2); } }
    if (b.split && (b.l < b.splitAt || b.x < 2 || b.x > W - 2 || b.y < WALL || b.y > H - 2)) { for (let i = 0; i < b.split; i++) shootE(g, b.x, b.y, i / b.split * 6.283, 55, { c: b.c }); b.l = 0; burst(g, b.x, b.y, 8, b.c); continue; }
    if (!b.ret && !(b.bounce > 0) && (b.x < -4 || b.y < -4 || b.x > W + 4 || b.y > H + 4)) b.l = 0;
    else if (Math.hypot(b.x - cx, b.y - cy + 2) < 4 + b.size && hurt(g)) { if (!b.ret) b.l = 0; if (b.chill) g.p.chillT = b.chill; }
  }
  g.eb = g.eb.filter(b => b.l > 0);
}
function stepShots(g, dt) {
  for (const s of g.shots) {
    if (s.kind === "orb") {
      if (!alive(g, s.tgt)) s.tgt = nearest(g, s.x, s.y, 90)?.ref;
      if (s.tgt) { const [tx, ty] = center(g, s.tgt), want = Math.atan2(ty - s.y, tx - s.x), diff = Math.atan2(Math.sin(want - s.a), Math.cos(want - s.a)); s.a += clamp(diff, -4 * dt, 4 * dt); s.vx = Math.cos(s.a) * s.sp; s.vy = Math.sin(s.a) * s.sp; }
      if (Math.random() < 0.4) g.parts.push({ x: s.x, y: s.y, vx: 0, vy: 0, l: 0.2, c: "#2bb6d9" });
    }
    s.x += s.vx * dt; s.y += s.vy * dt; s.l -= dt;
    if (s.x < -6 || s.y < -6 || s.x > W + 6 || s.y > H + 6) { s.l = 0; continue; }
    if (s.l <= 0 && s.kind === "orb") { burst(g, s.x, s.y, 4, "#2bb6d9", 40); continue; }
    for (const b of g.eb) if (b.hp && Math.hypot(b.x - s.x, b.y - s.y) < 4) { b.hp--; if (b.hp <= 0) { b.l = 0; burst(g, b.x, b.y, 6, b.c); } s.l = 0; break; }
    if (s.l <= 0) continue;
    const hitT = t => {
      s.hitSet.add(t); dealDmg(g, t, s.dmg);
      if (s.splash) { chill(g, s.x, s.y, s.splash); splash(g, s.x, s.y, s.splash, 1, t); burst(g, s.x, s.y, 10, "#5ef2ff", 100); g.rings.push({ x: s.x, y: s.y, r: 2, max: s.splash, l: 0.2 }); sfx("orbHit"); }
      if (s.split) for (const da of [-0.8, 0.8]) g.shots.push({ kind: "orb", x: s.x, y: s.y, a: s.a + da, sp: 110, vx: Math.cos(s.a + da) * 110, vy: Math.sin(s.a + da) * 110, dmg: 1, l: 0.8, tgt: null, pierce: 0, hitSet: new Set([t]) });
      if (s.bounce > 0) { const nt = nearest(g, s.x, s.y, 70, null); if (nt && !s.hitSet.has(nt.ref)) { s.bounce--; s.a = Math.atan2(nt.y - s.y, nt.x - s.x); s.vx = Math.cos(s.a) * s.sp; s.vy = Math.sin(s.a) * s.sp; s.l = 0.6; return; } }
      if (s.pierce > 0) s.pierce--; else s.l = 0;
    };
    const b = g.boss;
    if (b && b.mode !== "enter" && !s.hitSet.has(b) && Math.abs(s.x - (b.x + b.w / 2)) < b.w / 2 && Math.abs(s.y - (b.y + b.h / 2)) < b.h / 2) {
      if (b.shield && Math.abs(b.dx) > 0.3 && Math.sign(s.vx) === -Math.sign(b.dx)) { s.l = 0; burst(g, s.x, s.y, 4, "#cfd6e6"); sfx("block"); continue; }
      hitT(b);
    }
    if (s.l <= 0) continue;
    for (const e of g.en) if (e.hp > 0 && !(e.rise > 0) && !s.hitSet.has(e) && Math.abs(s.x - (e.x + e.w / 2)) < e.w / 2 + 1 && Math.abs(s.y - (e.y + e.h / 2)) < e.h / 2 + 1) { hitT(e); if (s.l <= 0) break; }
  }
  g.shots = g.shots.filter(s => s.l > 0);
}

// ---------- HUD + music helpers for the UI ----------
export function hudState(g, key) {
  const S = stageOf(g), C = CLASSES[g.cls], b = g.boss;
  return {
    hp: Math.max(0, g.p.hp), maxHp: g.maxHp, shield: g.p.shield, lv: g.lv, xp: g.xp, xpNeed: XP.need(g.lv),
    stage: g.stage, stageName: S.name, phase: g.phase, kills: Math.min(g.kills, KILLS_NEED[g.phase]), killsNeed: KILLS_NEED[g.phase], score: g.score, time: g.t,
    ability: { name: C.abilityName, cd: Math.max(0, g.p.cd), max: C.abilityCd * g.mods.cd, key },
    fx: Object.entries(g.fx).filter(([, f]) => f.t > 0).map(([k, f]) => ({ k, lv: f.lv, t: f.t, dur: 8 })),
    boss: b ? { name: b.def.name, hp: Math.max(0, b.hp), max: b.max, color: b.def.bc, ticks: (b.def.phases || []).map(ph => ph.at) } : null,
    msg: g.msg, msgT: g.msgT, accent: S.accent,
  };
}
export const musicTrack = g => g.boss ? (g.boss.def.final ? "final" : "boss") : "normal";

// ---------- rendering ----------
export function ellipse(ctx, x, y, rx, ry) { for (let yy = -Math.round(ry); yy <= ry; yy++) { const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (yy / ry) ** 2))); ctx.fillRect(Math.round(x - hw), Math.round(y + yy), hw * 2, 1); } }
export function ring(ctx, x, y, rx, ry, st = 0.4) { for (let a = 0; a < 6.283; a += st) ctx.fillRect(Math.round(x + Math.cos(a) * rx), Math.round(y + Math.sin(a) * ry), 1, 1); }
function drawHz(ctx, g, now) {
  const blink = Math.floor(now / 110) % 2;
  for (const h of g.hz) {
    const tele = h.t < h.delay, c = h.c || "#ff4a6a";
    ctx.fillStyle = c; ctx.globalAlpha = tele ? (blink ? 0.9 : 0.5) : 1;
    if (h.k === "circle") {
      if (tele) { ctx.globalAlpha = 0.45; ctx.fillStyle = "#0a0610"; ellipse(ctx, h.x, h.y, h.r, h.r * 0.7); ctx.globalAlpha = blink ? 0.9 : 0.5; ctx.fillStyle = c; ring(ctx, h.x, h.y, h.r, h.r * 0.7); }
      else if (h.show > 0) { ctx.fillStyle = h.spike || c; for (const o of [-3, 0, 3]) ctx.fillRect(Math.round(h.x + o), Math.round(h.y - 5), 1, 5); }
    } else if (h.k === "line") {
      const n = Math.max(1, Math.hypot(h.x2 - h.x1, h.y2 - h.y1) / 3 | 0);
      for (let i = 0; i <= n; i++) { const x = h.x1 + (h.x2 - h.x1) * i / n, y = h.y1 + (h.y2 - h.y1) * i / n; if (tele) { if (i % 2) ctx.fillRect(Math.round(x), Math.round(y), 2, 1); } else if (h.show > 0) { ctx.fillStyle = h.spike || c; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 3, 2, 4); } }
    } else if (h.k === "rect") {
      if (tele) { ctx.globalAlpha = blink ? 0.25 : 0.12; ctx.fillRect(h.x, h.y, h.w, h.h); }
      else if (h.show > 0) { ctx.globalAlpha = 0.7; ctx.fillStyle = "#ff8a2a"; ctx.fillRect(h.x, h.y, h.w, h.h); ctx.fillStyle = "#ffd166"; ctx.fillRect(h.x + 2, h.y, Math.max(0, h.w - 4), h.h); }
    } else if (h.k === "cone") {
      for (let r = 8; r < h.r; r += tele ? 6 : 3) for (let i = 0; i <= 10; i++) { if (tele && i % 2) continue; const a = h.a - h.spread / 2 + h.spread * i / 10; ctx.fillStyle = tele ? c : (r > h.r * 0.6 ? "#d9433a" : "#ffd166"); ctx.fillRect(Math.round(h.x + Math.cos(a) * r), Math.round(h.y + Math.sin(a) * r), tele ? 1 : 2, tele ? 1 : 2); }
    } else if (h.k === "area") { ctx.globalAlpha = 0.35; ctx.fillStyle = h.c || (h.effect === "burn" ? "#ff8a2a" : "#cfd6e6"); ellipse(ctx, h.x, h.y, h.r, h.r * 0.7); ctx.globalAlpha = 0.9; ring(ctx, h.x, h.y, h.r, h.r * 0.7, 0.5); }
    else if (h.k === "trap") { ctx.fillStyle = "#cfd6e6"; for (let i = -1; i <= 1; i++) ctx.fillRect(Math.round(h.x + i * 3), Math.round(h.y - 2), 1, 3); }
    else if (h.k === "frost") { ctx.globalAlpha = 0.3; ctx.fillStyle = "#b9d0ff"; ellipse(ctx, h.x, h.y, h.r, h.r * 0.7); }
    else if (h.k === "ringwave") { for (let a = 0; a < 6.283; a += 0.18) { if (Math.abs(Math.atan2(Math.sin(a - h.gapA), Math.cos(a - h.gapA))) < h.gapW / 2) continue; const x = h.x + Math.cos(a) * h.r, y = h.y + Math.sin(a) * h.r * 0.7; ctx.fillStyle = c; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); ctx.fillStyle = "#fff"; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); } }
    else if (h.k === "linewave") { for (let y = WALL; y < H; y += 2) { if (y > h.gapY && y < h.gapY + h.gapH) continue; ctx.fillStyle = y % 4 ? c : "#e8ffff"; ctx.fillRect(Math.round(h.x) - 1, y, 3, 2); } }
    ctx.globalAlpha = 1;
  }
}

export function draw(ctx, g, now, tc, key = "SPC") {
  ensureBiome(g);
  const S = stageOf(g), dark = S.rule === "dark";
  ctx.drawImage(g.biome.cv, 0, 0); S.ambient(ctx, g, W, H, WALL, now);
  for (const tp of g.tempPatches) { ctx.fillStyle = "#34628e"; ellipse(ctx, tp.x, tp.y, tp.rx, tp.ry); ctx.fillStyle = "#8fd3ff"; ctx.fillRect(Math.round(tp.x - tp.rx * 0.4), Math.round(tp.y - 1), 3, 1); }
  if (g.collapse > 0) { const B = g.bounds; ctx.fillStyle = "#07050e"; ctx.fillRect(0, WALL, Math.floor(B.x0), H); ctx.fillRect(Math.ceil(B.x1 + 16), WALL, W, H); ctx.fillRect(0, Math.ceil(B.y1 + 17), W, H); }
  if (!dark) drawHz(ctx, g, now);
  for (const r of g.rings) { ctx.fillStyle = "#b9d0ff"; ctx.globalAlpha = Math.min(1, r.l * 4); ring(ctx, r.x, r.y, r.r, r.r * 0.7, 0.3); ctx.globalAlpha = 1; }
  for (const s of g.shards) spr(ctx, SHARD, s.x - 1, s.y - 1 + Math.round(Math.sin(now / 200 + s.x)), false, PAL);
  for (const u of g.pu) { if (u.l < 3 && Math.floor(now / 120) % 2) continue; const by = Math.round(Math.sin(now / 250 + u.x) * 1.5); ctx.fillStyle = "#17121f"; ctx.fillRect(u.x + 1, u.y + 8, 5, 1); spr(ctx, ICONS[u.k], u.x, u.y + by - 1, false, PAL); }
  drawEnemies(ctx, g, now, false);
  if (g.boss) drawBoss(ctx, g, now, false);
  const p = g.p; ctx.fillStyle = "#17121f"; ctx.fillRect(p.x + 4, p.y + 16, 8, 1);
  if (!(p.inv > 0 && Math.floor(now / 60) % 2)) drawHero(ctx, g.cls, { x: p.x, y: p.y, face: p.face, moving: p.moving, atk: Math.max(0, p.atk) }, now);
  if (p.shield) { ctx.fillStyle = PAL.Z; for (let a = 0; a < 6.28; a += 0.52) ctx.fillRect(Math.round(p.x + 8 + Math.cos(a + now / 400) * 11), Math.round(p.y + 9 + Math.sin(a + now / 400) * 10), 1, 1); }
  if (p.chillT > 0) { ctx.fillStyle = "#b9d0ff"; ctx.fillRect(Math.round(p.x + 3), Math.round(p.y + 1), 1, 1); ctx.fillRect(Math.round(p.x + 12), Math.round(p.y + 3), 1, 1); }
  const c = g.comp, ck = CLASSES[g.cls].companion, fl2 = Math.floor(now / 110) % 2;
  if (ck === "wisp") spr(ctx, WISP, c.x - 2, c.y - 2, false, PAL);
  else if (ck === "hawk") spr(ctx, HAWK[c.mode === "dive" ? 1 : fl2], c.x - 3, c.y - 2, c.vx < 0, PAL);
  else spr(ctx, FAMILIAR[fl2], c.x - 2, c.y - 2, false, c.ch > 0 ? PAL : DIM);
  if (dark) {
    const [pcx, pcy] = pc(g), lights = [{ x: pcx, y: pcy - 2, r: g.vision }, { x: c.x, y: c.y, r: VOID.vision.companion }, ...enemyLights(g)];
    for (const s of g.shots) if (s.kind === "orb") lights.push({ x: s.x, y: s.y, r: 10 });
    drawDarkness(ctx, W, H, lights, DOC());
    drawEnemies(ctx, g, now, true); if (g.boss) drawBoss(ctx, g, now, true);
    drawHz(ctx, g, now);
  }
  for (const s of g.shots) {
    const x = Math.round(s.x), y = Math.round(s.y);
    if (s.kind === "wisp") { ctx.fillStyle = PAL.y; ctx.fillRect(x, y, 2, 2); }
    else if (s.kind === "arrow") { const ux = Math.cos(s.a), uy = Math.sin(s.a); ctx.fillStyle = "#7a5320"; for (let i = 1; i < 4; i++) ctx.fillRect(Math.round(s.x - ux * i), Math.round(s.y - uy * i), 1, 1); ctx.fillStyle = s.dmg < 1 ? "#9aa3b8" : "#e8ffff"; ctx.fillRect(x, y, 1, 1); }
    else { ctx.fillStyle = PAL.X; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); ctx.fillStyle = PAL.w; ctx.fillRect(x, y, 1, 1); }
  }
  for (const b of g.eb) {
    const x = Math.round(b.x), y = Math.round(b.y);
    if (b.spr) spr(ctx, b.spr, x - (b.spr[0].length >> 1), y - (b.spr.length >> 1), false, b.pal || PAL);
    else { const s = b.size; ctx.fillStyle = b.c; ctx.fillRect(x - s, y - s, s * 2 + 1, s * 2 + 1); ctx.fillStyle = "#fff"; ctx.fillRect(x, y, 1, 1); }
  }
  for (const q of g.parts) { ctx.fillStyle = q.c || PAL.o; ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1); }
  if (tc) { ctx.strokeStyle = "rgba(94,242,255,.35)"; ctx.beginPath(); ctx.arc(tc.jx, tc.jy, 10, 0, 7); ctx.stroke(); ctx.fillStyle = "rgba(94,242,255,.7)"; ctx.fillRect(Math.round(tc.jx + tc.dx * 8) - 2, Math.round(tc.jy + tc.dy * 8) - 2, 4, 4); }
  drawHUD(ctx, hudState(g, key), W, H, now);
}