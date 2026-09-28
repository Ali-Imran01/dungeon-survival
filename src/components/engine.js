// Game world: state, update, rendering, stages/bosses, XP + upgrades
import { PAL, WHITE, HIT, DIM, WISP, HAWK, FAMILIAR, SLIME, SLIME_BOSS, LORD, ICONS, spr, drawHero } from "./sprites.js";
import { sfx } from "./audio.js";
import { CLASSES } from "./classes.js";
import { XP, UPGRADES, rollChoices } from "./upgrades.js";
import { RAT, RAT_KING, JAILER, DUNGEON_EPAL } from "./dungeon_enemies.js";
import { drawHUD } from "./hud.js";

export let W = 240, H = 135;
export const fitSize = gb => { [W, H] = gb ? [160, 144] : [240, 135]; return [W, H]; };
export const WALL = 14, TILE = 12;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CAPS = { attackInterval: 0.5, cooldown: 0.5, moveSpeed: 1.4, damage: 1.6 };

const SLIME_KING = { name: "Slime King", spr: SLIME_BOSS, pal: { ...PAL, g: "#6fcf6a", G: "#c9f59a", E: "#fff27a" }, hp: 24, sp: 18, cs: 140, atk: ["charge"], ring: 0, bc: "#c9f59a" };
const RAT_KING_C = { name: "Rat King", spr: RAT_KING, pal: DUNGEON_EPAL, hp: 30, sp: 20, cs: 120, atk: ["lunge", "squeak", "lunge"], bc: "#b8a69c", scatterAt: [0.66, 0.33] };
const JAILER_C = { name: "The Jailer", spr: JAILER, pal: DUNGEON_EPAL, hp: 60, sp: 12, cs: 110, ring: 0, atk: ["ballSwing", "ballThrow", "releasePrisoners", "ballThrow"], phase2: ["chainHook", "ballSwing", "ballThrow", "releasePrisoners"], bc: "#d4a82a", final: true };

// Each stage: 3 encounters [miniboss1, miniboss2, stageBoss]. Stages 2-5 (Ice/Lava/Crypt/Void) TODO.
export const STAGES = [
  { name: "Dungeon", encounters: [SLIME_KING, RAT_KING_C, JAILER_C], spawnTable: [["slime", 1]] },
  null, null, null, null,
];
const KILL_GATE = [15, 15, 20];

// ---------- Upgrades ----------
export function stat(g, key) {
  let v = 0;
  for (const id in g.owned) {
    const u = UPGRADES.find(u => u.id === id); if (!u) continue;
    const val = u.fx[key]; if (val == null) continue;
    v += Array.isArray(val) ? val[Math.min(g.owned[id], val.length) - 1] : val * g.owned[id];
  }
  return v;
}
export function applyUpgrade(g, u) {
  g.owned[u.id] = (g.owned[u.id] || 0) + 1;
  if (u.fx.maxHp) g.maxHp += u.fx.maxHp;
  if (u.fx.heal) g.p.hp = Math.min(g.maxHp, g.p.hp + u.fx.heal);
}
export function pickUpgrade(g, u) { applyUpgrade(g, u); g.levelUp = null; }
export function pickStageUpgrade(g, u) {
  if (u) applyUpgrade(g, u);
  g.stageClear = null; g.stage++; g.enc = 0; g.rerollUsed = false; g.sinceBoss = 0; g.bossClock = 0;
}
export function rerollStageChoices(g) {
  if (g.stageClear && !g.rerollUsed) { g.rerollUsed = true; g.stageClear.choices = rollChoices(g.cls, g.owned, g.stage, "rare"); }
}
function gainXP(g, n) {
  g.xp += n;
  while (g.xp >= XP.need(g.lv)) { g.xp -= XP.need(g.lv); g.lv++; g.levelUp = { choices: rollChoices(g.cls, g.owned, g.stage) }; }
}
function dropShard(g, x, y, kind) { g.shards.push({ x: clamp(x, 4, W - 6), y: clamp(y, WALL + 4, H - 6), amt: XP.shard[kind] ?? 1, l: 12 }); }

const rng = a => () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const torchXs = () => W > 200 ? [Math.round(W * 0.2), Math.round(W / 2), Math.round(W * 0.8)] : [Math.round(W * 0.25), Math.round(W * 0.75)];
let bgCache = { key: "", cv: null };
function getBg() {
  const key = W + "x" + H; if (bgCache.key === key) return bgCache.cv;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cv.getContext("2d"), r = rng(7), px = (x, y, col, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  for (let ty = WALL; ty < H; ty += TILE) for (let tx = 0; tx < W; tx += TILE) {
    const alt = ((tx / TILE) + ((ty - WALL) / TILE)) % 2;
    px(tx, ty, alt ? "#241e31" : "#211b2d", TILE, TILE);
    px(tx, ty, "#1a1524", TILE, 1); px(tx, ty, "#1a1524", 1, TILE); px(tx + 1, ty + 1, "#2b2440", 2, 1);
    const v = r();
    if (v < 0.14) { let x = tx + 3 + (r() * 5 | 0), y = ty + 3; for (let i = 0; i < 5; i++) { px(x, y, "#17121f"); x += r() < 0.5 ? 1 : 0; y++; } }
    else if (v < 0.22) { for (let i = 0; i < 4; i++) px(tx + 2 + (r() * 8 | 0), ty + 2 + (r() * 8 | 0), "#2c3a33"); }
    else if (v < 0.28) { const x = tx + 3 + (r() * 6 | 0), y = ty + 4 + (r() * 5 | 0); px(x, y, "#3a3350", 2, 1); px(x, y + 1, "#1a1524", 2, 1); }
  }
  const cx = W / 2, cy = (H + WALL) / 2 + 2, rad = Math.min(W, H - WALL) * 0.32;
  for (let a = 0; a < Math.PI * 2; a += 0.09) if ((a * 11 | 0) % 3) px(Math.round(cx + Math.cos(a) * rad), Math.round(cy + Math.sin(a) * rad * 0.6), "#2c2542");
  px(0, 0, "#2a2338", W, WALL);
  for (let y = 2; y < WALL - 2; y += 4) for (let x = (y / 4 % 2) * 4 - 4; x < W; x += 8) { px(x + 1, y + 1, r() < 0.15 ? "#322a47" : "#3a3150", 7, 3); px(x + 1, y + 1, "#453b5e", 7, 1); }
  px(0, 0, "#4a3f66", W, 2); px(0, 2, "#1a1524", W, 1); px(0, WALL - 2, "#120e1a", W, 2); px(0, WALL, "#17131f", W, 2);
  for (const tx of torchXs()) { px(tx - 5, 3, "#4a3f5e", 10, 8); px(tx - 3, 2, "#4f4466", 6, 10); px(tx - 1, 6, "#5a4a2a", 3, 1); px(tx, 7, "#5a4a2a", 1, 3); }
  bgCache = { key, cv }; return cv;
}
function drawTorches(ctx, now) {
  const f = Math.floor(now / 140) % 3;
  for (const tx of torchXs()) {
    ctx.fillStyle = "#ff9f1c"; ctx.fillRect(tx - 1, 4 - (f === 1), 3, 2 + (f === 1));
    ctx.fillStyle = "#fff27a"; ctx.fillRect(tx + (f === 2 ? -1 : 0), 4, 1, 2);
    ctx.fillStyle = "#e0582a"; ctx.fillRect(tx - 1 + (f % 2) * 2, 3 - (f === 1), 1, 1);
  }
}

export function newGame(cls = "warden") {
  const C = CLASSES[cls];
  return { cls, maxHp: C.hp,
    p: { x: W/2-8, y: H/2-8, face: 1, dash: 0, dashV: [1,0], dashSp: 0, cd: 0, inv: 0, hp: C.hp, moving: false, dir: null, atk: 0, acd: 0, hitDone: true, shield: false, shieldT: 0, swings: 0, dashHit: null },
    stage: 0, enc: 0, xp: 0, lv: 1, owned: {}, levelUp: null, stageClear: null, rerollUsed: false, usedCheatDeath: false, shieldClock: 0, killClock: 0,
    msg: "", msgT: 0, boss: null, sinceBoss: 0, bossClock: 0, eb: [], won: false, en: [], shots: [], parts: [], rings: [], shards: [], fields: [], novaT: 0,
    t: 0, kills: 0, spawn: 1, fire: 0, over: false, comp: { x: W/2+12, y: H/2, mode: "perch", cd: 1, ch: 2, rc: 0, vx: 1, tgt: null } };
}
export function orbit(g, t) {
  const p = g.p, c = g.comp, k = CLASSES[g.cls].companion;
  if (k === "hawk") { if (c.mode === "perch") { c.x = p.x + 8 - p.face * 10; c.y = p.y - 2 + Math.sin(t * 4) * 1.5; c.vx = p.face; } }
  else if (k === "familiar") { const a = t * 2.2; c.x = p.x + 8 + Math.cos(a) * 14; c.y = p.y + 6 + Math.sin(a) * 10; }
  else { const a = t * 3; c.x = p.x + 8 + Math.cos(a) * 13; c.y = p.y + 6 + Math.sin(a) * 7; }
}
// Ranger's hawk: swoops at enemies that get within 50px, knocks them back
function stepHawk(g, dt, cx, cy) {
  const c = g.comp, p = g.p, px = p.x + 8 - p.face * 10, py = p.y - 2 + Math.sin(g.t * 4) * 1.5, bond = stat(g, "companion");
  c.cd -= dt;
  if (c.mode === "perch") {
    const k = Math.min(1, dt * 10); c.x += (px - c.x) * k; c.y += (py - c.y) * k; c.vx = p.face;
    if (c.cd <= 0) { const t = nearest(g, cx, cy, 50); if (t) { c.mode = "dive"; c.tgt = t.ref; sfx("hawk"); } }
  } else if (c.mode === "dive") {
    if (!alive(g, c.tgt)) c.mode = "return";
    else {
      const [tx, ty] = center(g, c.tgt), dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy) || 1, s = 230 * dt; c.vx = dx;
      if (d < 5 + s) {
        const t = c.tgt;
        if (t !== g.boss) { const kx = tx - cx, ky = ty - cy, kd = Math.hypot(kx, ky) || 1; t.x += kx / kd * 22; t.y += ky / kd * 22; t.slow = Math.max(t.slow || 0, 0.6); }
        burst(g, tx, ty, 8, "#a8741a", 90); dealDmg(g, t, 1); c.mode = "return"; c.cd = 2.5 / (1 + 0.5 * bond);
      } else { c.x += dx / d * s; c.y += dy / d * s; }
    }
  } else {
    const dx = px - c.x, dy = py - c.y, d = Math.hypot(dx, dy) || 1, s = 170 * dt; c.vx = dx;
    if (d < s + 1) c.mode = "perch"; else { c.x += dx / d * s; c.y += dy / d * s; }
  }
}
// Mage's familiar: orbits, blocks enemy bullets (2+bond charges, 1.5s recharge each), bumps back and slows enemies it touches
function stepFamiliar(g, dt) {
  const c = g.comp, maxCh = 2 + stat(g, "companion");
  if (c.ch < maxCh && (c.rc -= dt) <= 0) { c.ch++; c.rc = 1.5; }
  if (c.ch > 0) for (const b of g.eb) if (b.l > 0 && Math.hypot(b.x - c.x, b.y - c.y) < 7) {
    b.l = 0; c.ch--; if (c.rc <= 0) c.rc = 1.5; burst(g, c.x, c.y, 8, "#b9d0ff", 60); sfx("block"); if (!c.ch) break;
  }
  const mx = g.p.x + 8, my = g.p.y + 10;
  for (const e of g.en) {
    e.bump = (e.bump || 0) - dt;
    if (e.bump <= 0 && Math.hypot(e.x + 4 - c.x, e.y + 3 - c.y) < 8) {
      const kx = e.x + 4 - mx, ky = e.y + 3 - my, kd = Math.hypot(kx, ky) || 1;
      e.x += kx / kd * 12; e.y += ky / kd * 12; e.slow = Math.max(e.slow, 1); e.bump = 0.5;
    }
  }
}
export function useAbility(g) {
  const p = g.p; if (g.over || p.cd > 0 || g.levelUp || g.stageClear) return;
  CLASSES[g.cls].ability(g, p.dir);
  p.cd = CLASSES[g.cls].abilityCd * Math.max(CAPS.cooldown, 1 + stat(g, "cooldown"));
}
export function burst(g, x, y, n, c, sp = 80) { for (let i = 0; i < n; i++) g.parts.push({ x, y, vx: (Math.random() - 0.5) * sp, vy: (Math.random() - 0.5) * sp, l: 0.5, c }); }

const center = (g, t) => t === g.boss ? [t.x + t.w / 2, t.y + t.h / 2] : [t.x + 4, t.y + 3];
const alive = (g, t) => !!t && (t === g.boss ? t.hp > 0 : t.hp > 0 && g.en.includes(t));
const encOf = (g, b) => STAGES[g.stage].encounters[b.i];

// nearest enemy or boss within range; filter(angle) optional; exclude = Set of refs to skip
export function nearest(g, x, y, range, filter, exclude) {
  let best = null, bd = range;
  const test = (t, pad) => { if (exclude && exclude.has(t)) return; const [tx, ty] = center(g, t), d = Math.hypot(tx - x, ty - y) - pad; if (d < bd && (!filter || filter(Math.atan2(ty - y, tx - x)))) { bd = d; best = { x: tx, y: ty, ref: t, d }; } };
  for (const e of g.en) if (e.hp > 0) test(e, 0);
  if (g.boss && g.boss.mode !== "enter") test(g.boss, g.boss.w / 2 - 4);
  return best;
}
export function fireShot(g, o) { g.shots.push({ ...o, vx: Math.cos(o.a) * o.sp, vy: Math.sin(o.a) * o.sp, pierce: o.pierce || 0, hitSet: new Set() }); }
export function dropField(g, x, y, r, life, kind) { g.fields.push({ x, y, r, life, kind, hitSet: new Set() }); }

function dealDmg(g, t, n) {
  n *= Math.min(CAPS.damage, 1 + stat(g, "damage"));
  if (t === g.boss) return damageBoss(g, n);
  t.hp -= n; t.hit = 0.1; if (t.hp <= 0) kill(g, t);
}
function splash(g, x, y, r, n, except) {
  for (const e of g.en) if (e !== except && e.hp > 0 && Math.hypot(e.x + 4 - x, e.y + 3 - y) < r) dealDmg(g, e, n);
  const b = g.boss; if (b && b !== except && Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y) < r + b.w / 2) dealDmg(g, b, n);
}
// Mage orbs chill everything in the splash: slowed (bosses to 75%)
function chill(g, x, y, r, t = 1) {
  for (const e of g.en) if (Math.hypot(e.x + 4 - x, e.y + 3 - y) < r + 2) e.slow = Math.max(e.slow, t);
  const b = g.boss; if (b && Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y) < r + b.w / 2) b.slow = Math.max(b.slow, t);
}
export function meleeHit(g, reach, dmg) {
  const p = g.p, cx = p.x + 8, cy = p.y + 10; let hit = 0;
  for (const e of g.en) {
    const ex = e.x + 4 - cx, ey = e.y + 3 - cy, d = Math.hypot(ex, ey) || 1;
    if (e.hp > 0 && d < reach && ex * p.face > -6) { e.x += ex / d * 10; e.y += ey / d * 10; hit++; dealDmg(g, e, dmg); }
  }
  const b = g.boss;
  if (b) { const ex = b.x + b.w / 2 - cx, ey = b.y + b.h / 2 - cy; if (Math.hypot(ex, ey) < reach + b.w / 2 - 2 && ex * p.face > -(b.w / 2 + 4)) { hit++; dealDmg(g, b, dmg); } }
  if (hit) { navigator.vibrate?.(15); sfx("hit"); }
}
// Whirlwind: hits everything around the player regardless of facing
export function meleeHitAll(g, reach, dmg) {
  const p = g.p, cx = p.x + 8, cy = p.y + 10; let hit = 0;
  for (const e of g.en) { const ex = e.x + 4 - cx, ey = e.y + 3 - cy, d = Math.hypot(ex, ey) || 1; if (e.hp > 0 && d < reach) { e.x += ex / d * 10; e.y += ey / d * 10; hit++; dealDmg(g, e, dmg); } }
  const b = g.boss; if (b && Math.hypot(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy) < reach + b.w / 2 - 2) { hit++; dealDmg(g, b, dmg); }
  if (hit) { navigator.vibrate?.(15); sfx("hit"); burst(g, cx, cy, 10, PAL.X, 100); }
}

function hurt(g) {
  const p = g.p; if (p.inv > 0) return false;
  if (p.shield) { p.shield = false; p.shieldT = 0; p.inv = 0.8; g.msg = "Shield broke"; g.msgT = 1.2; sfx("shield"); }
  else {
    p.hp--;
    if (p.hp <= 0 && stat(g, "cheatDeath") && !g.usedCheatDeath) { g.usedCheatDeath = true; p.hp = 1; p.inv = 1.5; g.msg = "Second Wind!"; g.msgT = 1.6; navigator.vibrate?.(80); sfx("shield"); return true; }
    p.inv = 1; navigator.vibrate?.(60); sfx("hurt");
  }
  if (p.hp <= 0) { g.over = true; sfx("over"); }
  return true;
}
function shoot(g, x, y, a, sp, c) { g.eb.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, l: 4, c }); }
function spawnRat(g, x, y, opts = {}) { g.en.push({ x: clamp(x, 0, W - 9), y: clamp(y, WALL, H - 9), hp: 1, sp: 50, hit: 0, slow: 0, kind: "rat", flee: !!opts.flee, fleeT: opts.fleeT || 0, home: opts.home || null }); }
function spawnSlimeAt(g, x, y) { g.en.push({ x: clamp(x, 0, W - 9), y: clamp(y, WALL, H - 9), hp: 2, sp: 30, hit: 0, slow: 0, kind: "slime" }); }

function spawnBoss(g) {
  const S = STAGES[g.stage], C = S.encounters[g.enc], w = C.spr[0].length, h = C.spr.length;
  for (const e of g.en) burst(g, e.x + 4, e.y + 3, 4, "#6fcf6a");
  g.en = [];
  g.boss = { i: g.enc, x: W / 2 - w / 2, y: WALL - h, w, h, hp: C.hp, max: C.hp, mode: "enter", t: 0.8, ai: 0, hit: 0, dx: 0, dy: 1, slow: 0, phase2: false, scatterHit: new Set(), ball: null };
  g.msg = C.name + " appears"; g.msgT = 2; g.sinceBoss = 0; g.bossClock = 0; sfx("bossIn");
}
function damageBoss(g, n) {
  const b = g.boss; if (!b) return; b.hp -= n; b.hit = 0.1; sfx("hit");
  if (b.hp > 0) return;
  const C = encOf(g, b);
  burst(g, b.x + b.w / 2, b.y + b.h / 2, 30, C.bc, 140);
  g.boss = null; g.eb = []; g.sinceBoss = 0; g.bossClock = 0; navigator.vibrate?.([40, 40, 80]);
  dropShard(g, b.x + b.w / 2, b.y + b.h / 2, C.final ? "stageBoss" : "miniboss");
  if (C.final) {
    if (!STAGES[g.stage + 1]) { g.won = true; g.over = true; sfx("win"); return; }
    sfx("bossDie"); g.msg = C.name + " defeated"; g.msgT = 2;
    g.stageClear = { choices: rollChoices(g.cls, g.owned, g.stage, "rare") };
    return;
  }
  sfx("bossDie"); g.enc++;
  g.msg = C.name + " defeated"; g.msgT = 2;
}
function atkList(C, b) { return b.phase2 && C.phase2 ? C.phase2 : C.atk; }
function startAtk(g, b, a) {
  const C = encOf(g, b), bx = b.x + b.w / 2, by = b.y + b.h / 2;
  const aim = () => { const ax = g.p.x + 8 - (b.x + b.w / 2), ay = g.p.y + 10 - (b.y + b.h / 2), d = Math.hypot(ax, ay); if (d < 1) { b.dx = 0; b.dy = 1; } else { b.dx = ax / d; b.dy = ay / d; } };
  if (a === "charge" || a === "lunge") { aim(); b.mode = "wind"; b.t = 0.5; sfx("wind"); }
  else if (a === "ring") { for (let k = 0; k < C.ring; k++) shoot(g, bx, by, k / C.ring * 6.283 + b.ai * 0.3, 60, C.bc); sfx("bossShot"); b.mode = "rest"; b.t = 0.6; }
  else if (a === "spiral") { b.mode = "spiral"; b.t = 1.2; b.st = 0; b.ang = Math.random() * 6; }
  else if (a === "blink") {
    burst(g, bx, by, 12, C.bc);
    b.x = clamp(g.p.x + 8 - b.w / 2 + (Math.random() < 0.5 ? -40 : 40), 0, W - b.w);
    b.y = clamp(g.p.y + 8 - b.h / 2 + (Math.random() - 0.5) * 30, WALL, H - b.h);
    burst(g, b.x + b.w / 2, b.y + b.h / 2, 12, C.bc); aim(); b.mode = "wind"; b.t = 0.45; sfx("wind");
  }
  else if (a === "squeak") { for (let k = 0; k < 3; k++) spawnRat(g, k % 2 ? -8 : W + 8, WALL + 10 + k * 14); b.mode = "rest"; b.t = 1.1; sfx("bossShot"); }
  else if (a === "ballSwing") { b.mode = "ballWind"; b.t = 0.6; sfx("wind"); }
  else if (a === "ballThrow") { aim(); b.mode = "ballWind2"; b.t = 0.4; sfx("wind"); }
  else if (a === "releasePrisoners") { spawnSlimeAt(g, 6, WALL + 10); spawnSlimeAt(g, W - 14, WALL + 10); b.mode = "rest"; b.t = 1.1; g.msg = "Slimes crawl from the walls"; g.msgT = 1.4; }
  else if (a === "chainHook") { aim(); b.mode = "chainWind"; b.t = 0.6; sfx("wind"); }
}
function stepBoss(g, dt, cx, cy) {
  const b = g.boss; if (!b) return; const C = encOf(g, b), sl = b.slow > 0 ? 0.75 : 1;
  b.t -= dt; b.hit -= dt; b.slow -= dt;
  const bx = b.x + b.w / 2, by = b.y + b.h / 2, ax = cx - bx, ay = cy - by, d = Math.hypot(ax, ay) || 1;
  if (C.phase2 && !b.phase2 && b.hp <= b.max / 2) { b.phase2 = true; b.ai = 0; g.msg = "Riot!"; g.msgT = 1.4; }
  if (C.scatterAt) C.scatterAt.forEach((frac, i) => {
    if (!b.scatterHit.has(i) && b.hp <= b.max * frac) {
      b.scatterHit.add(i);
      for (let k = 0; k < 4; k++) spawnRat(g, bx + (k % 2 ? 14 : -14), by + (k < 2 ? 12 : -12), { flee: true, fleeT: 5, home: b });
      g.msg = "The rats scatter!"; g.msgT = 1.4;
    }
  });
  if (b.mode === "enter") { b.y += 30 * dt; if (b.t <= 0) { b.mode = "walk"; b.t = 1.2; } return; }
  if (b.mode === "walk") { b.x += ax / d * C.sp * sl * dt; b.y += ay / d * C.sp * sl * dt; if (b.t <= 0) startAtk(g, b, atkList(C, b)[b.ai++ % atkList(C, b).length]); }
  else if (b.mode === "wind") { if (b.t <= 0) { b.mode = "charge"; b.t = 0.55; } }
  else if (b.mode === "charge") { b.x += b.dx * C.cs * sl * dt; b.y += b.dy * C.cs * sl * dt; if (b.t <= 0) { b.mode = "rest"; b.t = 0.5; } }
  else if (b.mode === "spiral") { if ((b.st -= dt) <= 0) { b.st = 0.09; b.ang += 0.45; for (let k = 0; k < 3; k++) shoot(g, bx, by, b.ang + k * 2.094, 70, C.bc); sfx("bossShot"); } if (b.t <= 0) { b.mode = "rest"; b.t = 0.4; } }
  else if (b.mode === "ballWind") { if (b.t <= 0) { b.mode = "ballSwing"; b.t = b.phase2 ? 2.8 : 2.2; b.swingAng = Math.random() * 6; } }
  else if (b.mode === "ballSwing") {
    b.swingAng += 3.4 * dt; const ringR = b.phase2 ? 32 : 26;
    if (Math.abs(d - ringR) < 6 && hurt(g)) { g.p.x = clamp(g.p.x + ax / d * 10, 0, W - 16); g.p.y = clamp(g.p.y + ay / d * 10, WALL - 8, H - 17); }
    if (b.t <= 0) { b.mode = "rest"; b.t = 0.5; }
  }
  else if (b.mode === "ballWind2") { if (b.t <= 0) { b.mode = "ballOut"; b.ball = { x: bx, y: by, vx: b.dx * 95, vy: b.dy * 95, dist: 0 }; sfx("bossShot"); } }
  else if (b.mode === "ballOut") {
    const ball = b.ball; ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.dist += Math.hypot(ball.vx, ball.vy) * dt;
    if (Math.hypot(ball.x - cx, ball.y - cy) < 6 && hurt(g)) {}
    if (ball.dist >= 90) { ball.vx = -ball.vx; ball.vy = -ball.vy; b.mode = "ballBack"; }
  }
  else if (b.mode === "ballBack") {
    const ball = b.ball; ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    if (Math.hypot(ball.x - cx, ball.y - cy) < 6 && hurt(g)) {}
    if (Math.hypot(ball.x - bx, ball.y - by) < 6) { b.ball = null; b.mode = "rest"; b.t = 0.6; }
  }
  else if (b.mode === "chainWind") { if (b.t <= 0) { b.mode = "chainPull"; b.t = 0.6; } }
  else if (b.mode === "chainPull") {
    g.p.x = clamp(g.p.x + ax / d * 50 * dt, 0, W - 16); g.p.y = clamp(g.p.y + ay / d * 50 * dt, WALL - 8, H - 17);
    if (b.t <= 0) { b.mode = "charge"; b.t = 0.4; }
  }
  else if (b.mode === "rest") { if (b.t <= 0) { b.mode = "walk"; b.t = 1.3 + Math.random() * 0.6; } }
  b.x = clamp(b.x, 0, W - b.w); b.y = clamp(b.y, WALL - 4, H - b.h);
  if ((b.mode === "charge" || b.mode === "walk") && d < b.w / 2 + 3 && hurt(g)) { g.p.x = clamp(g.p.x + ax / d * 14, 0, W - 16); g.p.y = clamp(g.p.y + ay / d * 14, WALL - 8, H - 17); }
}

function spawnMob(g) {
  const px = g.p.x + 8, py = g.p.y + 10; let x, y;
  for (let i = 0; i < 6; i++) {
    const side = Math.random() * 3 | 0, r = Math.random();
    x = side === 0 ? -10 : side === 1 ? W + 2 : 4 + r * (W - 16);
    y = side === 2 ? H + 2 : WALL + 2 + r * (H - WALL - 10);
    if (Math.hypot(x + 4 - px, y + 3 - py) > 40) break;
  }
  g.en.push({ x, y, hp: 2 + (g.t > 40), sp: Math.min(42, 22 + g.t * 0.3), hit: 0, slow: 0, kind: "slime" });
}
function kill(g, e) {
  sfx("kill"); g.kills++; g.sinceBoss++; g.killClock++; burst(g, e.x + 4, e.y + 3, 6, PAL.o);
  dropShard(g, e.x + 4, e.y + 3, e.kind || "slime");
  const heEv = stat(g, "healEvery"); if (heEv && g.killClock >= heEv) { g.killClock = 0; g.p.hp = Math.min(g.maxHp, g.p.hp + 1); burst(g, g.p.x + 8, g.p.y + 8, 8, "#7dff9a"); }
}

export function step(g, dt, k, tc) {
  if (g.over || g.levelUp || g.stageClear) return;
  const p = g.p, C = CLASSES[g.cls]; g.t += dt;
  let dx = (k.has("d") || k.has("arrowright")) - (k.has("a") || k.has("arrowleft"));
  let dy = (k.has("s") || k.has("arrowdown")) - (k.has("w") || k.has("arrowup"));
  if (tc) { dx = tc.dx; dy = tc.dy; }
  const m = Math.hypot(dx, dy); p.moving = m > 0.2;
  if (m > 1) { dx /= m; dy /= m; }
  p.dir = p.moving ? [dx / (m || 1), dy / (m || 1)] : null;
  if (Math.abs(dx) > 0.1 && p.atk <= 0) p.face = Math.sign(dx);
  const spd = C.speed * Math.min(CAPS.moveSpeed, 1 + stat(g, "moveSpeed"));
  const vx = p.dash > 0 ? p.dashV[0] * p.dashSp : dx * spd, vy = p.dash > 0 ? p.dashV[1] * p.dashSp : dy * spd;
  p.x = clamp(p.x + vx * dt, 0, W - 16); p.y = clamp(p.y + vy * dt, WALL - 8, H - 17);
  if (p.dash > 0 && p.dashHit && stat(g, "dashDamage") > 0) {
    const cx0 = p.x + 8, cy0 = p.y + 10, dmg = stat(g, "dashDamage");
    for (const e of g.en) if (e.hp > 0 && !p.dashHit.has(e) && Math.hypot(e.x + 4 - cx0, e.y + 3 - cy0) < 10) { p.dashHit.add(e); dealDmg(g, e, dmg); }
    if (g.boss && !p.dashHit.has(g.boss) && Math.hypot(g.boss.x + g.boss.w / 2 - cx0, g.boss.y + g.boss.h / 2 - cy0) < g.boss.w / 2 + 6) { p.dashHit.add(g.boss); dealDmg(g, g.boss, dmg); }
  }
  p.dash -= dt; p.cd -= dt; p.inv -= dt; p.atk -= dt; p.acd -= dt;
  if (p.shieldT > 0) { p.shieldT -= dt; if (p.shieldT <= 0) { p.shieldT = 0; p.shield = false; } }
  const cx = p.x + 8, cy = p.y + 10;
  const gse = stat(g, "shieldEvery");
  if (gse) { g.shieldClock += dt; if (!p.shield && g.shieldClock >= gse) { p.shield = true; g.shieldClock = 0; g.msg = "Shield up"; g.msgT = 1; sfx("shield"); } }
  if (!g.boss && !g.over) { g.bossClock += dt; if (g.sinceBoss >= KILL_GATE[g.enc] || g.bossClock >= 60) spawnBoss(g); }
  if (!g.boss && (g.spawn -= dt) <= 0) { g.spawn = Math.max(0.45, 1.3 - g.t * 0.015); spawnMob(g); }
  for (const e of g.en) {
    let ax, ay;
    if (e.flee) {
      e.fleeT -= dt;
      if (e.fleeT > 0) { ax = (e.x + 4) - cx; ay = (e.y + 3) - cy; }
      else if (e.home && e.home === g.boss) { ax = (g.boss.x + g.boss.w / 2) - (e.x + 4); ay = (g.boss.y + g.boss.h / 2) - (e.y + 3); }
      else { ax = cx - (e.x + 4); ay = cy - (e.y + 3); e.flee = false; }
    } else { ax = cx - (e.x + 4); ay = cy - (e.y + 3); }
    const d = Math.hypot(ax, ay) || 1, sl = e.slow > 0 ? 0.5 : 1;
    e.x += ax / d * e.sp * sl * dt; e.y += ay / d * e.sp * sl * dt; e.hit -= dt; e.slow -= dt;
    if (e.flee && e.fleeT <= 0 && e.home && e.home === g.boss && Math.hypot(e.x + 4 - (g.boss.x + g.boss.w / 2), e.y + 3 - (g.boss.y + g.boss.h / 2)) < g.boss.w / 2 + 4) {
      g.boss.hp = Math.min(g.boss.max, g.boss.hp + 2); e.hp = 0; burst(g, e.x + 4, e.y + 3, 6, "#7dff9a"); sfx("pickup");
    }
    if (!e.flee && d < 8 && hurt(g)) { e.x -= ax / d * 14; e.y -= ay / d * 14; }
  }
  C.attack(g, cx, cy);
  stepBoss(g, dt, cx, cy);
  if (C.companion === "familiar") { orbit(g, g.t); stepFamiliar(g, dt); }
  else if (C.companion === "hawk") stepHawk(g, dt, cx, cy);
  for (const b of g.eb) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.l -= dt;
    if (b.x < -4 || b.y < -4 || b.x > W + 4 || b.y > H + 4) b.l = 0;
    else if (Math.hypot(b.x - cx, b.y - cy + 2) < 5 && hurt(g)) b.l = 0;
  }
  g.eb = g.eb.filter(b => b.l > 0);
  g.msgT -= dt;
  for (const r of g.rings) { r.r += (r.max - 3) / 0.35 * dt; r.l -= dt; }
  g.rings = g.rings.filter(r => r.l > 0);
  // XP shards: home toward player inside magnet radius, collect on contact
  const magnetR = XP.magnet * (1 + stat(g, "magnet"));
  for (const u of g.shards) {
    u.l -= dt;
    const dxs = cx - (u.x + 3.5), dys = cy - (u.y + 3.5), ds = Math.hypot(dxs, dys) || 1;
    if (ds < magnetR) { const s = Math.min(ds, 150 * dt); u.x += dxs / ds * s; u.y += dys / ds * s; }
    if (ds < 4) { gainXP(g, u.amt); u.l = 0; sfx("pickup"); burst(g, u.x + 3, u.y + 3, 8, PAL.X, 80); }
  }
  g.shards = g.shards.filter(u => u.l > 0);
  for (const f of g.fields) {
    f.life -= dt;
    for (const e of g.en) if (e.hp > 0 && Math.hypot(e.x + 4 - f.x, e.y + 3 - f.y) < f.r) {
      if (f.kind === "trap" && !f.hitSet.has(e)) { f.hitSet.add(e); dealDmg(g, e, 3); burst(g, e.x + 4, e.y + 3, 4, "#ff9aa5"); }
      if (f.kind === "frost") e.slow = Math.max(e.slow, 0.6);
    }
    if (f.kind === "frost" && g.boss && Math.hypot(g.boss.x + g.boss.w / 2 - f.x, g.boss.y + g.boss.h / 2 - f.y) < f.r + g.boss.w / 2) g.boss.slow = Math.max(g.boss.slow, 0.6);
  }
  g.fields = g.fields.filter(f => f.life > 0);
  // Warden's wisp
  if (C.companion === "wisp") orbit(g, g.t);
  if (C.companion === "wisp" && (g.fire -= dt) <= 0) {
    const bond = stat(g, "companion"), wx = g.comp.x, wy = g.comp.y, t = nearest(g, wx, wy, 110);
    if (t) {
      g.fire = 1.5; sfx("shot"); fireShot(g, { kind: "wisp", x: wx, y: wy, a: Math.atan2(t.y - wy, t.x - wx), sp: 170, dmg: 1, l: 1 });
      if (bond) { const t2 = nearest(g, wx, wy, 110, null, new Set([t.ref])); if (t2) fireShot(g, { kind: "wisp", x: wx, y: wy, a: Math.atan2(t2.y - wy, t2.x - wx), sp: 170, dmg: 1, l: 1 }); }
    }
  }
  // Player projectiles
  for (const s of g.shots) {
    if (s.kind === "orb") {
      if (!alive(g, s.tgt)) s.tgt = nearest(g, s.x, s.y, 90)?.ref;
      if (s.tgt) {
        const [tx, ty] = center(g, s.tgt), want = Math.atan2(ty - s.y, tx - s.x);
        const diff = Math.atan2(Math.sin(want - s.a), Math.cos(want - s.a));
        s.a += clamp(diff, -4 * dt, 4 * dt); s.vx = Math.cos(s.a) * s.sp; s.vy = Math.sin(s.a) * s.sp;
      }
      if (Math.random() < 0.4) g.parts.push({ x: s.x, y: s.y, vx: 0, vy: 0, l: 0.2, c: "#2bb6d9" });
    }
    s.x += s.vx * dt; s.y += s.vy * dt; s.l -= dt;
    if (s.x < -6 || s.y < -6 || s.x > W + 6 || s.y > H + 6) { s.l = 0; continue; }
    if (s.l <= 0 && s.kind === "orb") { burst(g, s.x, s.y, 4, "#2bb6d9", 40); continue; }
    const hitT = t => {
      s.hitSet.add(t); dealDmg(g, t, s.dmg);
      if (s.splash) {
        chill(g, s.x, s.y, s.splash, 1 + stat(g, "chillTime")); splash(g, s.x, s.y, s.splash, 1, t);
        burst(g, s.x, s.y, 10, "#5ef2ff", 100); g.rings.push({ x: s.x, y: s.y, r: 2, max: s.splash, l: 0.2 }); sfx("orbHit");
        if (stat(g, "split") && !s.didSplit) {
          s.didSplit = true;
          for (let i = 0; i < 2; i++) { const t2 = nearest(g, s.x, s.y, 90, null, s.hitSet); if (t2) fireShot(g, { kind: "orb", x: s.x, y: s.y, a: Math.atan2(t2.y - s.y, t2.x - s.x), sp: s.sp, dmg: s.dmg * 0.6, tgt: t2.ref, splash: s.splash * 0.7, l: 0.8, didSplit: true }); }
        }
      }
      if (s.kind === "arrow" && s.bounce > 0) {
        const t2 = nearest(g, s.x, s.y, 100, null, s.hitSet);
        if (t2) { s.bounce--; s.a = Math.atan2(t2.y - s.y, t2.x - s.x); s.vx = Math.cos(s.a) * s.sp; s.vy = Math.sin(s.a) * s.sp; s.l = 0.8; return; }
      }
      if (s.pierce > 0) s.pierce--; else s.l = 0;
    };
    const b = g.boss;
    if (b && !s.hitSet.has(b) && Math.abs(s.x - (b.x + b.w / 2)) < b.w / 2 && Math.abs(s.y - (b.y + b.h / 2)) < b.h / 2) hitT(b);
    if (s.l <= 0) continue;
    for (const e of g.en) {
      if (e.hp > 0 && !s.hitSet.has(e) && Math.abs(s.x - (e.x + 4)) < 5 && Math.abs(s.y - (e.y + 3)) < 4) { hitT(e); if (s.l <= 0) break; }
    }
  }
  g.shots = g.shots.filter(s => s.l > 0); g.en = g.en.filter(e => e.hp > 0);
  for (const q of g.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.l -= dt; }
  g.parts = g.parts.filter(q => q.l > 0);
}

export function draw(ctx, g, now, tc) {
  ctx.drawImage(getBg(), 0, 0); drawTorches(ctx, now);
  for (const r of g.rings) { ctx.fillStyle = "#b9d0ff"; ctx.globalAlpha = Math.min(1, r.l * 4); for (let a = 0; a < 6.28; a += 0.3) ctx.fillRect(Math.round(r.x + Math.cos(a) * r.r), Math.round(r.y + Math.sin(a) * r.r * 0.7), 1, 1); ctx.globalAlpha = 1; }
  for (const e of g.en) {
    const rat = e.kind === "rat", eSpr = rat ? RAT : SLIME, ePal = rat ? DUNGEON_EPAL : PAL;
    ctx.fillStyle = "#2a2338"; ctx.fillRect(e.x + 1, e.y + 5, 6, 1);
    spr(ctx, eSpr, e.x, e.y + (Math.floor(now / 200) % 2), false, e.hit > 0 ? HIT : ePal);
    if (e.slow > 0) { ctx.fillStyle = "#b9d0ff"; ctx.fillRect(Math.round(e.x) + 2, Math.round(e.y) - 1, 1, 1); ctx.fillRect(Math.round(e.x) + 5, Math.round(e.y) - 2, 1, 1); }
  }
  if (g.boss) {
    const b = g.boss, C = encOf(g, b), flash = b.hit > 0 || (b.mode === "wind" && Math.floor(now / 70) % 2);
    ctx.fillStyle = "#17121f"; ctx.fillRect(Math.round(b.x + 2), Math.round(b.y + b.h), b.w - 4, 2);
    if (b.mode === "ballSwing") { const bx = b.x + b.w / 2, by = b.y + b.h / 2, r0 = b.phase2 ? 32 : 26; ctx.fillStyle = C.bc; ctx.globalAlpha = 0.6; for (let a = 0; a < 6.28; a += 0.25) ctx.fillRect(Math.round(bx + Math.cos(a + b.swingAng) * r0), Math.round(by + Math.sin(a + b.swingAng) * r0 * 0.7), 1, 1); ctx.globalAlpha = 1; }
    if (b.mode === "chainWind" || b.mode === "chainPull") { ctx.fillStyle = "#7a7486"; const bx = b.x + b.w / 2, by = b.y + b.h / 2, px = g.p.x + 8, py = g.p.y + 10, n = 8; for (let i = 0; i < n; i++) ctx.fillRect(Math.round(bx + (px - bx) * i / n), Math.round(by + (py - by) * i / n), 1, 1); }
    if (b.ball) { ctx.fillStyle = "#7a7486"; ctx.fillRect(Math.round(b.ball.x) - 2, Math.round(b.ball.y) - 2, 5, 5); ctx.fillStyle = "#4a4450"; ctx.fillRect(Math.round(b.ball.x) - 1, Math.round(b.ball.y) - 1, 3, 3); }
    spr(ctx, C.spr, b.x, b.y + (b.mode === "walk" ? Math.floor(now / 250) % 2 : 0), false, flash ? WHITE : C.pal);
  }
  for (const u of g.shards) {
    if (u.l < 3 && Math.floor(now / 120) % 2) continue;
    const by = Math.round(Math.sin(now / 250 + u.x) * 1.5);
    spr(ctx, [".X.", "XYX", ".X."], u.x, u.y + by, false, PAL);
  }
  for (const f of g.fields) {
    ctx.fillStyle = f.kind === "trap" ? "rgba(255,154,165,.4)" : "rgba(94,242,255,.3)"; ctx.globalAlpha = Math.min(1, f.life);
    for (let a = 0; a < 6.28; a += 0.4) ctx.fillRect(Math.round(f.x + Math.cos(a) * f.r), Math.round(f.y + Math.sin(a) * f.r * 0.7), 1, 1);
    ctx.globalAlpha = 1;
  }
  const p = g.p;
  ctx.fillStyle = "#2a2338"; ctx.fillRect(p.x + 4, p.y + 16, 8, 1);
  if (!(p.inv > 0 && Math.floor(now / 60) % 2)) drawHero(ctx, g.cls, { x: p.x, y: p.y, face: p.face, moving: p.moving, atk: Math.max(0, p.atk) }, now);
  if (p.shield) { ctx.fillStyle = PAL.Z; for (let a = 0; a < 6.28; a += 0.52) ctx.fillRect(Math.round(p.x + 8 + Math.cos(a + now / 400) * 11), Math.round(p.y + 9 + Math.sin(a + now / 400) * 10), 1, 1); }
  const c = g.comp, ck = CLASSES[g.cls].companion, fl2 = Math.floor(now / 110) % 2;
  if (ck === "wisp") spr(ctx, WISP, c.x - 2, c.y - 2, false, PAL);
  else if (ck === "hawk") { ctx.fillStyle = "#17121f"; if (c.mode !== "perch") ctx.fillRect(Math.round(c.x) - 2, Math.round(c.y) + 6, 4, 1); spr(ctx, HAWK[c.mode === "dive" ? 1 : fl2], c.x - 3, c.y - 2, c.vx < 0, PAL); }
  else spr(ctx, FAMILIAR[fl2], c.x - 2, c.y - 2, false, c.ch > 0 ? PAL : DIM);
  for (const s of g.shots) {
    const x = Math.round(s.x), y = Math.round(s.y);
    if (s.kind === "wisp") { ctx.fillStyle = PAL.y; ctx.fillRect(x, y, 2, 2); }
    else if (s.kind === "arrow") { const ux = Math.cos(s.a), uy = Math.sin(s.a); ctx.fillStyle = "#7a5320"; for (let i = 1; i < 4; i++) ctx.fillRect(Math.round(s.x - ux * i), Math.round(s.y - uy * i), 1, 1); ctx.fillStyle = s.dmg < 1 ? "#9aa3b8" : "#e8ffff"; ctx.fillRect(x, y, 1, 1); }
    else { ctx.fillStyle = PAL.X; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); ctx.fillStyle = PAL.w; ctx.fillRect(x, y, 1, 1); }
  }
  for (const b of g.eb) { ctx.fillStyle = b.c; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3); ctx.fillStyle = "#fff"; ctx.fillRect(Math.round(b.x), Math.round(b.y), 1, 1); }
  for (const q of g.parts) { ctx.fillStyle = q.c || PAL.o; ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1); }
  if (tc) {
    ctx.strokeStyle = "rgba(94,242,255,.35)"; ctx.beginPath(); ctx.arc(tc.jx, tc.jy, 10, 0, 7); ctx.stroke();
    ctx.fillStyle = "rgba(94,242,255,.7)"; ctx.fillRect(Math.round(tc.jx + tc.dx * 8) - 2, Math.round(tc.jy + tc.dy * 8) - 2, 4, 4);
  }
  if (!g.over) {
    const S = STAGES[g.stage], b = g.boss, C = b ? encOf(g, b) : null;
    drawHUD(ctx, {
      hp: Math.max(0, g.p.hp), maxHp: g.maxHp, shield: g.p.shield,
      lv: g.lv, xp: g.xp, xpNeed: XP.need(g.lv),
      stage: g.stage + 1, stageName: S.name, phase: g.enc,
      kills: g.sinceBoss, killsNeed: KILL_GATE[g.enc], score: g.kills, time: g.t,
      ability: { name: CLASSES[g.cls].abilityName, cd: Math.max(0, p.cd), max: CLASSES[g.cls].abilityCd, key: CLASSES[g.cls].abilityName[0] },
      fx: [], boss: b ? { name: C.name, hp: b.hp, max: b.max, color: C.bc, ticks: C.phase2 ? [0.5] : [] } : null,
      msg: g.msg, msgT: g.msgT, accent: undefined,
    }, W, H, now);
  }
}
