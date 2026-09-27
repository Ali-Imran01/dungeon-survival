// Game world: state, update, rendering, bosses
import { PAL, WHITE, HIT, DIM, WISP, HAWK, FAMILIAR, SLIME, SLIME_BOSS, LORD, ICONS, spr, drawHero } from "./sprites.js";
import { sfx } from "./audio.js";
import { PU, applyPU, pickPU, tickFx, lv } from "./powerups.js";
import { CLASSES } from "./classes.js";

export let W = 240, H = 135;
export const fitSize = gb => { [W, H] = gb ? [160, 144] : [240, 135]; return [W, H]; };
export const WALL = 14, TILE = 12;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const BOSSES = [
  { name:"Slime King",  spr:SLIME_BOSS, pal:{ ...PAL, g:"#6fcf6a", G:"#c9f59a", E:"#fff27a" }, hp:24, sp:18, cs:140, atk:["charge"], ring:0, bc:"#c9f59a" },
  { name:"Ember Slime", spr:SLIME_BOSS, pal:{ ...PAL, g:"#e0582a", G:"#ffb26b", E:"#fff27a" }, hp:30, sp:18, cs:140, atk:["ring","charge"], ring:8, bc:"#ff9f1c" },
  { name:"Frost Slime", spr:SLIME_BOSS, pal:{ ...PAL, g:"#4f8fd9", G:"#bfe3ff", E:"#ffffff" }, hp:36, sp:16, cs:150, atk:["spiral","charge"], ring:0, bc:"#bfe3ff" },
  { name:"Void Slime",  spr:SLIME_BOSS, pal:{ ...PAL, g:"#7a3fb0", G:"#c79bff", E:"#5ef2ff" }, hp:42, sp:16, cs:160, atk:["blink","ring"], ring:10, bc:"#c79bff" },
  { name:"Hollow Lord", spr:LORD, pal:{ ...PAL, h:"#2b2140", H:"#4a3570", E:"#ff4a6a" }, hp:80, sp:14, cs:130, atk:["ring","charge","spiral","blink"], ring:12, bc:"#ff4a6a", summon:true, final:true },
];

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
  return { cls, maxHp: C.hp, p:{ x:W/2-8, y:H/2-8, face:1, dash:0, dashV:[1,0], dashSp:0, cd:0, inv:0, hp:C.hp, moving:false, dir:null, atk:0, acd:0, hitDone:true, shield:false },
    fx:{}, pu:[], puT:15, msg:"", msgT:0, boss:null, bossDone:0, sinceBoss:0, bossClock:0, eb:[], won:false, en:[], shots:[], parts:[], rings:[], novaT:0,
    t:0, kills:0, spawn:1, fire:0, over:false, comp:{ x:W/2+12, y:H/2, mode:"perch", cd:1, ch:2, rc:0, vx:1, tgt:null } };
}
export function orbit(g, t) {
  const p = g.p, c = g.comp, k = CLASSES[g.cls].companion;
  if (k === "hawk") { if (c.mode === "perch") { c.x = p.x + 8 - p.face * 10; c.y = p.y - 2 + Math.sin(t * 4) * 1.5; c.vx = p.face; } }
  else if (k === "familiar") { const a = t * 2.2; c.x = p.x + 8 + Math.cos(a) * 14; c.y = p.y + 6 + Math.sin(a) * 10; }
  else { const a = t * 3; c.x = p.x + 8 + Math.cos(a) * 13; c.y = p.y + 6 + Math.sin(a) * 7; }
}
// Ranger's hawk: swoops at enemies that get within 50px, knocks them back
function stepHawk(g, dt, cx, cy) {
  const c = g.comp, p = g.p, px = p.x + 8 - p.face * 10, py = p.y - 2 + Math.sin(g.t * 4) * 1.5;
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
        burst(g, tx, ty, 8, "#a8741a", 90); dealDmg(g, t, 1); c.mode = "return"; c.cd = 2.5;
      } else { c.x += dx / d * s; c.y += dy / d * s; }
    }
  } else {
    const dx = px - c.x, dy = py - c.y, d = Math.hypot(dx, dy) || 1, s = 170 * dt; c.vx = dx;
    if (d < s + 1) c.mode = "perch"; else { c.x += dx / d * s; c.y += dy / d * s; }
  }
}
// Mage's familiar: orbits, blocks enemy bullets (2 charges, 1.5s recharge each), bumps back and slows enemies it touches
function stepFamiliar(g, dt) {
  const c = g.comp;
  if (c.ch < 2 && (c.rc -= dt) <= 0) { c.ch++; c.rc = 1.5; }
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
export function useAbility(g) { const p = g.p; if (g.over || p.cd > 0) return; CLASSES[g.cls].ability(g, p.dir); p.cd = CLASSES[g.cls].abilityCd; }
export function burst(g, x, y, n, c, sp = 80) { for (let i = 0; i < n; i++) g.parts.push({ x, y, vx: (Math.random() - 0.5) * sp, vy: (Math.random() - 0.5) * sp, l: 0.5, c }); }

const center = (g, t) => t === g.boss ? [t.x + t.w / 2, t.y + t.h / 2] : [t.x + 4, t.y + 3];
const alive = (g, t) => !!t && (t === g.boss ? t.hp > 0 : t.hp > 0 && g.en.includes(t));

// nearest enemy or boss within range; filter(angle) optional
export function nearest(g, x, y, range, filter) {
  let best = null, bd = range;
  const test = (t, pad) => { const [tx, ty] = center(g, t), d = Math.hypot(tx - x, ty - y) - pad; if (d < bd && (!filter || filter(Math.atan2(ty - y, tx - x)))) { bd = d; best = { x: tx, y: ty, ref: t, d }; } };
  for (const e of g.en) if (e.hp > 0) test(e, 0);
  if (g.boss && g.boss.mode !== "enter") test(g.boss, g.boss.w / 2 - 4);
  return best;
}
export function fireShot(g, o) { g.shots.push({ ...o, vx: Math.cos(o.a) * o.sp, vy: Math.sin(o.a) * o.sp, pierce: o.pierce || 0, hitSet: new Set() }); }

function dealDmg(g, t, n) {
  if (t === g.boss) return damageBoss(g, n);
  t.hp -= n; t.hit = 0.1; if (t.hp <= 0) kill(g, t);
}
function splash(g, x, y, r, n, except) {
  for (const e of g.en) if (e !== except && e.hp > 0 && Math.hypot(e.x + 4 - x, e.y + 3 - y) < r) dealDmg(g, e, n);
  const b = g.boss; if (b && b !== except && Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y) < r + b.w / 2) dealDmg(g, b, n);
}
// Mage orbs chill everything in the splash: slowed for 1s (bosses to 75%)
function chill(g, x, y, r) {
  for (const e of g.en) if (Math.hypot(e.x + 4 - x, e.y + 3 - y) < r + 2) e.slow = Math.max(e.slow, 1);
  const b = g.boss; if (b && Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y) < r + b.w / 2) b.slow = Math.max(b.slow, 1);
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

function dropPU(g, x, y) { g.pu.push({ k: pickPU(g), x: clamp(x, 4, W - 11), y: clamp(y, WALL + 4, H - 10), l: 10 }); }
function hurt(g) {
  const p = g.p; if (p.inv > 0) return false;
  if (p.shield) { p.shield = false; p.inv = 0.8; g.msg = "Shield broke"; g.msgT = 1.2; sfx("shield"); }
  else { p.hp--; p.inv = 1; navigator.vibrate?.(60); sfx("hurt"); }
  if (p.hp <= 0) { g.over = true; sfx("over"); }
  return true;
}
function shoot(g, x, y, a, sp, c) { g.eb.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, l: 4, c }); }
function spawnBoss(g) {
  const i = g.bossDone, C = BOSSES[i], w = C.spr[0].length, h = C.spr.length;
  for (const e of g.en) burst(g, e.x + 4, e.y + 3, 4, "#6fcf6a");
  g.en = [];
  g.boss = { i, x: W / 2 - w / 2, y: WALL - h, w, h, hp: C.hp, max: C.hp, mode: "enter", t: 0.8, ai: 0, hit: 0, dx: 0, dy: 1, slow: 0 };
  g.msg = C.name + " appears"; g.msgT = 2; g.sinceBoss = 0; g.bossClock = 0; sfx("bossIn");
}
function damageBoss(g, n) {
  const b = g.boss; if (!b) return; b.hp -= n; b.hit = 0.1; sfx("hit");
  if (b.hp > 0) return;
  const C = BOSSES[b.i]; burst(g, b.x + b.w / 2, b.y + b.h / 2, 30, C.bc, 140);
  g.boss = null; g.eb = []; g.kills += 5; g.bossDone++; g.sinceBoss = 0; g.bossClock = 0; navigator.vibrate?.([40, 40, 80]);
  if (C.final) { g.won = true; g.over = true; sfx("win"); return; }
  sfx("bossDie");
  dropPU(g, b.x, b.y + b.h / 2); dropPU(g, b.x + b.w, b.y + b.h / 2);
  g.msg = C.name + " defeated"; g.msgT = 2;
}
function startAtk(g, b, a) {
  const C = BOSSES[b.i], bx = b.x + b.w / 2, by = b.y + b.h / 2;
  const aim = () => { const ax = g.p.x + 8 - (b.x + b.w / 2), ay = g.p.y + 10 - (b.y + b.h / 2), d = Math.hypot(ax, ay) || 1; b.dx = ax / d; b.dy = ay / d; };
  if (a === "charge") { aim(); b.mode = "wind"; b.t = 0.5; sfx("wind"); }
  else if (a === "ring") { for (let k = 0; k < C.ring; k++) shoot(g, bx, by, k / C.ring * 6.283 + b.ai * 0.3, 60, C.bc); sfx("bossShot"); b.mode = "rest"; b.t = 0.6; }
  else if (a === "spiral") { b.mode = "spiral"; b.t = 1.2; b.st = 0; b.ang = Math.random() * 6; }
  else if (a === "blink") {
    burst(g, bx, by, 12, C.bc);
    b.x = clamp(g.p.x + 8 - b.w / 2 + (Math.random() < 0.5 ? -40 : 40), 0, W - b.w);
    b.y = clamp(g.p.y + 8 - b.h / 2 + (Math.random() - 0.5) * 30, WALL, H - b.h);
    burst(g, b.x + b.w / 2, b.y + b.h / 2, 12, C.bc); aim(); b.mode = "wind"; b.t = 0.45; sfx("wind");
  }
}
function stepBoss(g, dt, cx, cy) {
  const b = g.boss; if (!b) return; const C = BOSSES[b.i], sl = b.slow > 0 ? 0.75 : 1;
  b.t -= dt; b.hit -= dt; b.slow -= dt;
  const bx = b.x + b.w / 2, by = b.y + b.h / 2, ax = cx - bx, ay = cy - by, d = Math.hypot(ax, ay) || 1;
  if (b.mode === "enter") { b.y += 30 * dt; if (b.t <= 0) { b.mode = "walk"; b.t = 1.2; } return; }
  if (b.mode === "walk") { b.x += ax / d * C.sp * sl * dt; b.y += ay / d * C.sp * sl * dt; if (b.t <= 0) startAtk(g, b, C.atk[b.ai++ % C.atk.length]); }
  else if (b.mode === "wind") { if (b.t <= 0) { b.mode = "charge"; b.t = 0.55; } }
  else if (b.mode === "charge") { b.x += b.dx * C.cs * sl * dt; b.y += b.dy * C.cs * sl * dt; if (b.t <= 0) { b.mode = "rest"; b.t = 0.5; } }
  else if (b.mode === "spiral") { if ((b.st -= dt) <= 0) { b.st = 0.09; b.ang += 0.45; for (let k = 0; k < 3; k++) shoot(g, bx, by, b.ang + k * 2.094, 70, C.bc); sfx("bossShot"); } if (b.t <= 0) { b.mode = "rest"; b.t = 0.4; } }
  else if (b.mode === "rest") { if (b.t <= 0) { b.mode = "walk"; b.t = 1.3 + Math.random() * 0.6; } }
  b.x = clamp(b.x, 0, W - b.w); b.y = clamp(b.y, WALL - 4, H - b.h);
  if (d < b.w / 2 + 3 && hurt(g)) { g.p.x = clamp(g.p.x + ax / d * 14, 0, W - 16); g.p.y = clamp(g.p.y + ay / d * 14, WALL - 8, H - 17); }
  if (C.summon && !b.summoned && b.hp <= b.max / 2) {
    b.summoned = true; g.msg = "The Lord calls its hollows"; g.msgT = 1.6;
    for (let k = 0; k < 4; k++) g.en.push({ x: bx + (k % 2 ? 14 : -18), y: by + (k < 2 ? 12 : -14), hp: 2, sp: 38, hit: 0, slow: 0 });
  }
}
function spawnMob(g) {
  const px = g.p.x + 8, py = g.p.y + 10; let x, y;
  for (let i = 0; i < 6; i++) {
    const side = Math.random() * 3 | 0, r = Math.random();
    x = side === 0 ? -10 : side === 1 ? W + 2 : 4 + r * (W - 16);
    y = side === 2 ? H + 2 : WALL + 2 + r * (H - WALL - 10);
    if (Math.hypot(x + 4 - px, y + 3 - py) > 40) break;
  }
  g.en.push({ x, y, hp: 2 + (g.t > 40), sp: Math.min(42, 22 + g.t * 0.3), hit: 0, slow: 0 });
}
function kill(g, e) { sfx("kill"); if (Math.random() < 0.12) dropPU(g, e.x, e.y); if (!g.boss) g.sinceBoss++; g.kills++; burst(g, e.x + 4, e.y + 3, 6, PAL.o); }

export function step(g, dt, k, tc) {
  if (g.over) return;
  const p = g.p, C = CLASSES[g.cls]; g.t += dt;
  let dx = (k.has("d") || k.has("arrowright")) - (k.has("a") || k.has("arrowleft"));
  let dy = (k.has("s") || k.has("arrowdown")) - (k.has("w") || k.has("arrowup"));
  if (tc) { dx = tc.dx; dy = tc.dy; }
  const m = Math.hypot(dx, dy); p.moving = m > 0.2;
  if (m > 1) { dx /= m; dy /= m; }
  p.dir = p.moving ? [dx / (m || 1), dy / (m || 1)] : null;
  if (Math.abs(dx) > 0.1 && p.atk <= 0) p.face = Math.sign(dx);
  const spd = C.speed * (1 + 0.35 * lv(g, "boots"));
  const vx = p.dash > 0 ? p.dashV[0] * p.dashSp : dx * spd, vy = p.dash > 0 ? p.dashV[1] * p.dashSp : dy * spd;
  p.x = clamp(p.x + vx * dt, 0, W - 16); p.y = clamp(p.y + vy * dt, WALL - 8, H - 17);
  p.dash -= dt; p.cd -= dt; p.inv -= dt; p.atk -= dt; p.acd -= dt;
  const cx = p.x + 8, cy = p.y + 10;
  if (!g.boss && !g.over) { g.bossClock += dt; if (g.sinceBoss >= (g.bossDone === 4 ? 20 : 15) || g.bossClock >= 60) spawnBoss(g); }
  if (!g.boss && (g.spawn -= dt) <= 0) { g.spawn = Math.max(0.45, 1.3 - g.t * 0.015); spawnMob(g); }
  for (const e of g.en) {
    const ax = cx - (e.x + 4), ay = cy - (e.y + 3), d = Math.hypot(ax, ay) || 1, sl = e.slow > 0 ? 0.5 : 1;
    e.x += ax / d * e.sp * sl * dt; e.y += ay / d * e.sp * sl * dt; e.hit -= dt; e.slow -= dt;
    if (d < 8 && hurt(g)) { e.x -= ax / d * 14; e.y -= ay / d * 14; }
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
  tickFx(g, dt); g.msgT -= dt;
  // Frost nova pulses
  const nv = lv(g, "nova");
  if (nv) {
    if ((g.novaT -= dt) <= 0) {
      g.novaT = 2; const R = 28 * (1 + 0.3 * (nv - 1));
      for (const e of g.en) if (Math.hypot(e.x + 4 - cx, e.y + 3 - cy) < R) e.slow = 1.5;
      if (g.boss && Math.hypot(g.boss.x + g.boss.w / 2 - cx, g.boss.y + g.boss.h / 2 - cy) < R + g.boss.w / 2) g.boss.slow = 1.5;
      g.rings.push({ x: cx, y: cy - 2, r: 3, max: R, l: 0.35 }); sfx("nova");
    }
  } else g.novaT = 0;
  for (const r of g.rings) { r.r += (r.max - 3) / 0.35 * dt; r.l -= dt; }
  g.rings = g.rings.filter(r => r.l > 0);
  if ((g.puT -= dt) <= 0) { g.puT = 18; dropPU(g, 10 + Math.random() * (W - 30), WALL + 8 + Math.random() * (H - WALL - 24)); }
  for (const u of g.pu) {
    u.l -= dt;
    if (Math.hypot(u.x + 3.5 - cx, u.y + 3.5 - cy) < 10) {
      const name = applyPU(g, u.k); u.l = 0; sfx("pickup"); g.msg = name; g.msgT = 1.4; navigator.vibrate?.(20);
      burst(g, u.x + 3, u.y + 3, 10, PU[u.k].c, 90);
    }
  }
  g.pu = g.pu.filter(u => u.l > 0);
  // Warden's wisp
  if (C.companion === "wisp") orbit(g, g.t);
  if (C.companion === "wisp" && (g.fire -= dt) <= 0) {
    const su = lv(g, "surge"), wx = g.comp.x, wy = g.comp.y, t = nearest(g, wx, wy, 110 + 40 * (su > 0));
    if (t) { g.fire = 1.5 / (1 + 2 * su); sfx("shot"); fireShot(g, { kind: "wisp", x: wx, y: wy, a: Math.atan2(t.y - wy, t.x - wx), sp: 170, dmg: 1, l: 1 }); }
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
      if (s.splash) { chill(g, s.x, s.y, s.splash); splash(g, s.x, s.y, s.splash, 1, t); burst(g, s.x, s.y, 10, "#5ef2ff", 100); g.rings.push({ x: s.x, y: s.y, r: 2, max: s.splash, l: 0.2 }); sfx("orbHit"); }
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
    ctx.fillStyle = "#2a2338"; ctx.fillRect(e.x + 1, e.y + 5, 6, 1);
    spr(ctx, SLIME, e.x, e.y + (Math.floor(now / 200) % 2), false, e.hit > 0 ? HIT : PAL);
    if (e.slow > 0) { ctx.fillStyle = "#b9d0ff"; ctx.fillRect(Math.round(e.x) + 2, Math.round(e.y) - 1, 1, 1); ctx.fillRect(Math.round(e.x) + 5, Math.round(e.y) - 2, 1, 1); }
  }
  if (g.boss) {
    const b = g.boss, C = BOSSES[b.i], flash = b.hit > 0 || (b.mode === "wind" && Math.floor(now / 70) % 2);
    ctx.fillStyle = "#17121f"; ctx.fillRect(Math.round(b.x + 2), Math.round(b.y + b.h), b.w - 4, 2);
    spr(ctx, C.spr, b.x, b.y + (b.mode === "walk" ? Math.floor(now / 250) % 2 : 0), false, flash ? WHITE : C.pal);
  }
  for (const u of g.pu) {
    if (u.l < 3 && Math.floor(now / 120) % 2) continue;
    const by = Math.round(Math.sin(now / 250 + u.x) * 1.5);
    ctx.fillStyle = "#17121f"; ctx.fillRect(u.x + 1, u.y + 8, 5, 1);
    spr(ctx, ICONS[u.k], u.x, u.y + by - 1, false, PAL);
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
}
