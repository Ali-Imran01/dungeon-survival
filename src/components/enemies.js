// Regular enemies: definitions, spawning and AI.
import { SLIME, spr } from "./sprites.js";
import { FROST_BAT, ICE_EPAL } from "./biomes/ice_enemies.js";
import { CINDER, FIRE_IMP, FIREBALL, LAVA_EPAL } from "./biomes/lava_enemies.js";
import { SKELETON, BONE_PILE, DROWNED, CRYPT_EPAL } from "./biomes/crypt_enemies.js";
import { VOID_SHADE, VOID_EYE, DARK_BOLT, RIFT, VOID_EPAL, EYE_KEYS } from "./biomes/void_enemies.js";
import { RAT, DUNGEON_EPAL } from "./biomes/dungeon_enemies.js";
import { LAVA } from "./biomes/lava.js";
import { W, H, WALL, clamp, burst, hurt, shootE, onIceAt, stageOf, msg, pc } from "./engine.js";
import { sfx } from "./audio.js";

// xp: shards dropped · pts: score · sp: speed · summon: never counts toward stage progress
export const ENEMIES = {
  slime:    { w: 8,  h: 5,  hp: 2, sp: 26, xp: 1, spr: SLIME, slides: true },
  bat:      { w: 9,  h: 6,  hp: 1, sp: 44, xp: 1, frames: FROST_BAT, pal: ICE_EPAL, fly: true, wave: true },
  magma:    { w: 8,  h: 5,  hp: 3, sp: 26, xp: 1, spr: SLIME, pal: { ...LAVA_EPAL }, split: true, dieC: "#ff8a2a" },
  cinder:   { w: 5,  h: 4,  hp: 1, sp: 46, xp: 0, spr: CINDER, pal: LAVA_EPAL, life: 4, summon: true, pts: 0 },
  imp:      { w: 10, h: 11, hp: 2, sp: 34, xp: 2, frames: FIRE_IMP, pal: LAVA_EPAL, ranged: { keep: 60, every: 2.5, sp: 55, spr: FIREBALL } },
  skeleton: { w: 10, h: 12, hp: 2, sp: 34, xp: 1, spr: SKELETON, pal: CRYPT_EPAL, pile: true, dieC: "#e8e4d8" },
  pile:     { w: 8,  h: 3,  hp: 1, sp: 0,  xp: 0, spr: BONE_PILE, pal: CRYPT_EPAL, harmless: true, summon: true, pts: 0 },
  drowned:  { w: 10, h: 13, hp: 3, sp: 28, xp: 2, spr: DROWNED, pal: CRYPT_EPAL, lunge: true, fromWater: true },
  shade:    { w: 10, h: 12, hp: 2, sp: 36, xp: 2, spr: VOID_SHADE, pal: VOID_EPAL, blink: true, eyes: true },
  eye:      { w: 9,  h: 9,  hp: 2, sp: 26, xp: 2, spr: VOID_EYE, pal: VOID_EPAL, fly: true, eyes: true, light: 30, ranged: { keep: 70, every: 3, sp: 45, spr: DARK_BOLT } },
  rat:      { w: 9,  h: 5,  hp: 1, sp: 48, xp: 0, spr: RAT, pal: DUNGEON_EPAL, summon: true, pts: 0 },
  rift:     { w: 7,  h: 9,  hp: 4, sp: 0,  xp: 0, spr: RIFT, pal: VOID_EPAL, fixed: true, eyes: true, light: 18, turret: { every: 2, sp: 50 }, summon: true, pts: 0 },
};

export function spawnEnemy(g, type, x, y, o = {}) {
  const d = ENEMIES[type], hpMul = o.summon || d.summon ? 1 : 1 + 0.2 * g.phase;
  const e = { type, ...d, x, y, hp: Math.ceil(d.hp * hpMul), sp: d.sp * (1 + 0.05 * g.phase), hit: 0, slow: 0, slowMul: 0.5, vx: 0, vy: 0, t: Math.random() * 3, fireT: d.ranged ? 1 + Math.random() : 0, ...o };
  if (!e.pal) e.pal = stageOf(g).slimePal;
  g.en.push(e); return e;
}
function edgePoint(g, w, h) {
  const [px, py] = pc(g); let x, y;
  for (let i = 0; i < 6; i++) {
    const side = Math.random() * 3 | 0, r = Math.random();
    x = side === 0 ? -w - 2 : side === 1 ? W + 2 : 4 + r * (W - 16);
    y = side === 2 ? H + 2 : WALL + 2 + r * (H - WALL - 10);
    if (Math.hypot(x - px, y - py) > 40) break;
  }
  return [x, y];
}
export function spawnMob(g, S) {
  let r = Math.random(), type = S.spawn[0][0];
  for (const [t, w] of S.spawn) { if ((r -= w) < 0) { type = t; break; } }
  const d = ENEMIES[type];
  if (d.fromWater) {                                          // Drowned rise out of a pool ≥50px from the player
    const [px, py] = pc(g), pools = (g.biome.pools || []).flatMap(p => p.blobs).filter(b => Math.hypot(b.x - px, b.y - py) > 50);
    if (pools.length) { const b = pools[Math.random() * pools.length | 0]; spawnEnemy(g, type, b.x - d.w / 2, b.y - d.h + 2, { rise: 1 }); return; }
  }
  const [x, y] = edgePoint(g, d.w, d.h);
  spawnEnemy(g, type, x, y);
  if (type === "bat") spawnEnemy(g, type, x + (x < 0 ? -8 : 8), y + 6);
}
export function spawnAt(g, type, n, o = {}) { for (let i = 0; i < n; i++) { const [x, y] = edgePoint(g, ENEMIES[type].w, ENEMIES[type].h); spawnEnemy(g, type, x, y, { summon: true, xp: 0, ...o }); } }

export function stepEnemies(g, dt, cx, cy) {
  for (const e of g.en) {
    e.t += dt; e.hit -= dt; e.slow -= dt;
    if (e.rise > 0) { e.rise -= dt; continue; }
    if (e.life !== undefined && (e.life -= dt) <= 0) { e.hp = 0; burst(g, e.x + 2, e.y + 2, 4, "#ff8a2a"); continue; }
    const ex = e.x + e.w / 2, ey = e.y + e.h / 2, ax = cx - ex, ay = cy - ey, d = Math.hypot(ax, ay) || 1, sl = e.slow > 0 ? e.slowMul : 1, sp = e.sp * sl;
    if (e.harmless) {                                         // bone pile: reassembles unless walked over / hit
      e.re = (e.re ?? 3) - dt;
      if (d < 8) { e.hp = 0; burst(g, ex, ey, 6, "#e8e4d8"); continue; }
      if (e.re <= 0) { e.hp = 0; spawnEnemyReplace(g, "skeleton", e.x - 1, e.y - 9, { hp: 1, summon: true, xp: 0 }); burst(g, ex, ey, 6, "#e8e4d8"); }
      continue;
    }
    if (e.healer !== undefined) {                             // Rat King's scattered rats: return and heal him
      e.healer -= dt;
      if (e.healer <= 0) { e.hp = 0; if (g.boss) { g.boss.hp = Math.min(g.boss.max, g.boss.hp + 2); msg(g, "The rats return!", 1); burst(g, ex, ey, 6, "#b8a69c"); } continue; }
      const k = e.healer < 1.5 && g.boss ? -1 : 1, bx = g.boss ? g.boss.x + g.boss.w / 2 : cx, by = g.boss ? g.boss.y + g.boss.h / 2 : cy;
      const tx = k < 0 ? bx - ex : -ax, ty = k < 0 ? by - ey : -ay, td = Math.hypot(tx, ty) || 1;
      e.x += tx / td * sp * dt; e.y += ty / td * sp * dt; e.x = clamp(e.x, 0, W - e.w); e.y = clamp(e.y, WALL, H - e.h);
      continue;
    }
    let mx = ax / d, my = ay / d, s = sp;
    if (e.turret) { if ((e.fireT -= dt) <= 0) { e.fireT = e.turret.every; shootE(g, ex, ey, Math.atan2(ay, ax), e.turret.sp, { c: "#ff4fd8" }); } mx = my = 0; }
    else if (e.ranged) {
      const R = e.ranged;
      if (d < R.keep - 10) { mx = -mx; my = -my; } else if (d < R.keep + 15) { const t = mx; mx = -my * 0.7; my = t * 0.7; }
      if ((e.fireT -= dt) <= 0) { e.fireT = R.every; shootE(g, ex, ey, Math.atan2(ay, ax), R.sp, { spr: R.spr, pal: e.pal, size: 1, c: "#ff8a2a" }); }
      e.wind = e.fireT < 0.4;
    } else if (e.wave) { const t = mx; mx += -my * Math.cos(e.t * 7) * 0.8; my += t * Math.cos(e.t * 7) * 0.8; }
    else if (e.blink) { e.bt = (e.bt ?? 2.5) - dt; e.shimmer = e.bt < 0.3; if (e.bt <= 0) { e.bt = 2.5; e.x += mx * 20; e.y += my * 20; burst(g, ex, ey, 5, "#5b3f8c"); } }
    else if (e.lunge) { e.lc = (e.lc ?? 0) - dt; if (e.lt > 0) { e.lt -= dt; mx = e.ldx; my = e.ldy; s = 90; } else if (d < 24 && e.lc <= 0) { e.lt = 0.3; e.lc = 2; e.ldx = mx; e.ldy = my; } }
    if (e.slides && onIceAt(g, ex, e.y + e.h)) { e.vx += (mx * s - e.vx) * Math.min(1, 3 * dt); e.vy += (my * s - e.vy) * Math.min(1, 3 * dt); }
    else { e.vx = mx * s; e.vy = my * s; }
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (e.x > -20 && e.x < W + 10 && e.y > WALL - 6 && e.y < H + 10) { e.x = clamp(e.x, -e.w, W); e.y = clamp(e.y, WALL - 4, H); }
    if (!e.fixed && d < e.w / 2 + 4 && hurt(g)) { e.x -= ax / d * 14; e.y -= ay / d * 14; }
  }
}
function spawnEnemyReplace(g, type, x, y, o) { g.en.push({ type, ...ENEMIES[type], x, y, hit: 0, slow: 0, slowMul: 0.5, vx: 0, vy: 0, t: 0, pal: ENEMIES[type].pal, ...o, onDeath: pileOnDeath }); }
function pileOnDeath(g, e) { if (e.hp <= 0 && !e.noPile) g.en.push({ type: "pile", ...ENEMIES.pile, x: e.x + 1, y: e.y + 9, hit: 0, slow: 0, vx: 0, vy: 0, t: 0, re: 3 }); }
function magmaOnDeath(g, e) { for (const o of [-4, 4]) g.en.push({ type: "cinder", ...ENEMIES.cinder, x: e.x + 2 + o, y: e.y, hit: 0, slow: 0, slowMul: 0.5, vx: 0, vy: 0, t: 0 }); }
// attach death behaviours once (keeps the table above as plain data)
ENEMIES.skeleton.onDeath = pileOnDeath; ENEMIES.magma.onDeath = magmaOnDeath;
ENEMIES.magma.pal = { ...LAVA_EPAL, g: LAVA.slime.g, G: LAVA.slime.G };

export const enemyLights = g => g.en.filter(e => e.light && e.hp > 0).map(e => ({ x: e.x + e.w / 2, y: e.y + e.h / 2, r: e.light }));
const EYES_ONLY = pal => new Proxy({}, { get: (_, k) => EYE_KEYS.includes(k) ? pal[k] : "rgba(0,0,0,0)" });
const WHITEP = new Proxy({}, { get: () => "#ffffff" });
export function drawEnemies(ctx, g, now, eyesPass) {
  for (const e of g.en) {
    if (eyesPass && !e.eyes) continue;
    const f = e.frames ? e.frames[Math.floor((now + e.t * 300) / 150) % e.frames.length] : e.spr;
    const pal = eyesPass ? EYES_ONLY(e.pal) : e.hit > 0 ? WHITEP : e.pal;
    let y = e.y + (e.fly ? Math.round(Math.sin(now / 200 + e.t) * 1.5) : (Math.floor(now / 200) % 2) * (e.type === "slime" || e.type === "magma" ? 1 : 0));
    if (e.rise > 0) { const vis = Math.ceil(e.h * (1 - e.rise)); ctx.save(); ctx.beginPath(); ctx.rect(e.x - 2, e.y + e.h - vis - 2, e.w + 4, vis + 2); ctx.clip(); spr(ctx, f, e.x, e.y + e.h - vis, false, pal); ctx.restore(); continue; }
    if (!eyesPass) { ctx.fillStyle = "#17121f"; ctx.fillRect(Math.round(e.x + 1), Math.round(e.y + e.h), e.w - 2, 1); }
    if (e.shimmer && Math.floor(now / 60) % 2) continue;
    if (e.healer !== undefined && Math.floor(now / 100) % 2 && !eyesPass) { ctx.fillStyle = "#ff9aa5"; ctx.fillRect(Math.round(e.x + 4), Math.round(e.y - 2), 1, 1); }
    spr(ctx, f, e.x, y, e.type === "rat" && e.vx < -1, pal);
    if (!eyesPass && e.slow > 0) { ctx.fillStyle = "#b9d0ff"; ctx.fillRect(Math.round(e.x) + 2, Math.round(e.y) - 1, 1, 1); ctx.fillRect(Math.round(e.x) + e.w - 3, Math.round(e.y) - 2, 1, 1); }
    if (!eyesPass && e.wind) { ctx.fillStyle = "#ffd166"; ctx.fillRect(Math.round(e.x + e.w - 2), Math.round(e.y + 6), 2, 2); }
  }
}
export { sfx };
