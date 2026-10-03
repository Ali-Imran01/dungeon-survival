// Regular enemies: definitions, spawning and AI.
import { SLIME, spr } from "./sprites.js";
import { FROST_BAT, ICE_EPAL } from "./biomes/ice_enemies.js";
import { CINDER, FIRE_IMP, FIREBALL, LAVA_EPAL } from "./biomes/lava_enemies.js";
import { SKELETON, BONE_PILE, DROWNED, CRYPT_EPAL } from "./biomes/crypt_enemies.js";
import { VOID_SHADE, VOID_EYE, DARK_BOLT, RIFT, VOID_EPAL, EYE_KEYS } from "./biomes/void_enemies.js";
import { RAT, DUNGEON_EPAL } from "./biomes/dungeon_enemies.js";
import { LAVA } from "./biomes/lava.js";
import { NEC } from "./classes.js";
import { W, H, WALL, clamp, burst, hurt, shootE, onIceAt, stageOf, msg, pc } from "./engine.js";
import { sfx } from "./audio.js";
import { LOOP, GATE } from "./stages.js";

// xp: shards dropped · pts: score · sp: speed · summon: never counts toward stage progress
export const ENEMIES = {
  slime:    { w: 8,  h: 5,  hp: 2, sp: 26, xp: 1, spr: SLIME, slides: true },
  bat:      { w: 9,  h: 6,  hp: 1, sp: 44, xp: 1, frames: FROST_BAT, pal: ICE_EPAL, fly: true, wave: true },
  magma:    { w: 8,  h: 5,  hp: 3, sp: 26, xp: 1, spr: SLIME, pal: { ...LAVA_EPAL }, split: true, dieC: "#ff8a2a" },
  cinder:   { w: 5,  h: 4,  hp: 1, sp: 46, xp: 0, spr: CINDER, pal: LAVA_EPAL, life: 4, summon: true, pts: 0 },
  imp: {
    w: 10, h: 11, hp: 2, sp: 34, xp: 2, frames: FIRE_IMP, pal: LAVA_EPAL,
    ranged: { keep: 60, every: 2.5, sp: 55, spr: FIREBALL },
  },
  skeleton: { w: 10, h: 12, hp: 2, sp: 34, xp: 1, spr: SKELETON, pal: CRYPT_EPAL, pile: true, dieC: "#e8e4d8" },
  pile:     { w: 8,  h: 3,  hp: 1, sp: 0,  xp: 0, spr: BONE_PILE, pal: CRYPT_EPAL, harmless: true, summon: true, pts: 0 },
  drowned:  { w: 10, h: 13, hp: 3, sp: 28, xp: 2, spr: DROWNED, pal: CRYPT_EPAL, lunge: true, fromWater: true },
  shade:    { w: 10, h: 12, hp: 2, sp: 36, xp: 2, spr: VOID_SHADE, pal: VOID_EPAL, blink: true, eyes: true },
  eye: {
    w: 9, h: 9, hp: 2, sp: 26, xp: 2, spr: VOID_EYE, pal: VOID_EPAL, fly: true, eyes: true, light: 30,
    ranged: { keep: 70, every: 3, sp: 45, spr: DARK_BOLT },
  },
  rat:      { w: 9,  h: 5,  hp: 1, sp: 48, xp: 0, spr: RAT, pal: DUNGEON_EPAL, summon: true, pts: 0 },
  rift: {
    w: 7, h: 9, hp: 4, sp: 0, xp: 0, spr: RIFT, pal: VOID_EPAL, fixed: true, eyes: true, light: 18,
    turret: { every: 2, sp: 50 }, summon: true, pts: 0,
  },
};

export function spawnEnemy(g, type, x, y, o = {}) {
  const def = ENEMIES[type];
  const isSummon = o.summon || def.summon;
  const hpMul = isSummon ? 1 : (1 + 0.2 * g.phase) * (1 + LOOP.hp * g.loop);
  const speedMul = (1 + 0.05 * g.phase) * Math.min(LOOP.speedCap, 1 + LOOP.speed * g.loop);

  // t and fireT each take a random number, in this order
  const t = Math.random() * 3;
  const fireT = def.ranged ? 1 + Math.random() : 0;

  const e = {
    type, ...def, x, y,
    hp: Math.ceil(def.hp * hpMul),
    sp: def.sp * speedMul,
    hit: 0, slow: 0, slowMul: 0.5, vx: 0, vy: 0,
    t, fireT,
    ...o,
  };
  if (!e.pal) e.pal = stageOf(g).slimePal;
  g.en.push(e);
  return e;
}

// random spot just outside the screen on one of the given sides (0 = left, 1 = right, 2 = bottom),
// retrying a few times so it doesn't land right on top of the player
function edgePoint(g, w, h, sides = [0, 1, 2]) {
  const [px, py] = pc(g);
  let x, y;
  for (let i = 0; i < 6; i++) {
    const side = sides[Math.random() * sides.length | 0];
    const r = Math.random();
    x = side === 0 ? -w - 2 : side === 1 ? W + 2 : 4 + r * (W - 16);
    y = side === 2 ? H + 2 : WALL + 2 + r * (H - WALL - 10);
    if (Math.hypot(x - px, y - py) > 40) break;
  }
  return [x, y];
}

export function spawnMob(g, stage) {
  // weighted pick from the stage's spawn table
  let roll = Math.random();
  let type = stage.spawn[0][0];
  for (const [t, weight] of stage.spawn) {
    roll -= weight;
    if (roll < 0) {
      type = t;
      break;
    }
  }
  const def = ENEMIES[type];

  // Drowned rise out of a pool at least 50px from the player
  if (def.fromWater) {
    const [px, py] = pc(g);
    const blobs = (g.biome.pools || []).flatMap(p => p.blobs).filter(b => Math.hypot(b.x - px, b.y - py) > 50);
    if (blobs.length) {
      const blob = blobs[Math.random() * blobs.length | 0];
      spawnEnemy(g, type, blob.x - def.w / 2, blob.y - def.h + 2, { rise: 1 });
      return;
    }
  }

  // on-screen cap: the spawn is skipped, the timer keeps running
  const liveRegulars = g.en.filter(e => !e.summon).length + g.gates.length;
  if (liveRegulars >= (W < 200 ? GATE.capGB : GATE.cap)) return;

  // telegraph first, the enemy appears when the marker expires
  const [x, y] = edgePoint(g, def.w, def.h, g.sides);
  g.gates.push({ type, x, y, t: GATE.delay });
}

// Spawn bookkeeping, once per frame: gates count down and release their enemy; the active spawn sides rotate.
export function stepSpawns(g, dt) {
  if (g.boss || g.door) g.gates = [];

  for (const gate of g.gates) gate.t -= dt;
  const due = g.gates.filter(gate => gate.t <= 0);
  g.gates = g.gates.filter(gate => gate.t > 0);
  for (const gate of due) {
    spawnEnemy(g, gate.type, gate.x, gate.y);
    // bats come in pairs
    if (gate.type === "bat") spawnEnemy(g, gate.type, gate.x + (gate.x < 0 ? -8 : 8), gate.y + 6);
  }

  g.sideT -= dt;
  if (g.sideT <= 0) {
    // from phase 1 on two sides are active at once
    const count = g.phase >= 1 ? 2 : 1;
    const pick = [0, 1, 2].filter(s => !g.sides.includes(s) || count === 2);
    const chosen = [];
    while (chosen.length < count) {
      const s = (pick.length ? pick : [0, 1, 2])[Math.random() * (pick.length || 3) | 0];
      if (!chosen.includes(s)) chosen.push(s);
      pick.splice(pick.indexOf(s), 1);
    }
    g.sides = chosen;
    g.sideT = GATE.sideTime;
  }
}

// Markers sit at the screen edge where the enemy will walk in; the active spawn sides glow along the wall.
export function drawGates(ctx, g, now) {
  if (g.boss || g.door) return;

  const pulse = 0.35 + 0.25 * Math.sin(now / 160);
  ctx.fillStyle = `rgba(255,74,106,${pulse})`;
  for (const side of g.sides) {
    if (side === 0) ctx.fillRect(0, WALL, 1, H - WALL);
    else if (side === 1) ctx.fillRect(W - 1, WALL, 1, H - WALL);
    else ctx.fillRect(0, H - 1, W, 1);
  }

  for (const gate of g.gates) {
    const x = Math.round(clamp(gate.x, 4, W - 5));
    const y = Math.round(clamp(gate.y, WALL + 4, H - 5));
    const imminent = gate.t < 0.25;
    const visible = imminent || Math.floor(now / 90) % 2;   // blinks, then goes solid right before it spawns
    if (!visible) continue;
    ctx.fillStyle = imminent ? "#ffffff" : "#ff4a6a";
    ctx.fillRect(x, y - 3, 1, 7);
    ctx.fillRect(x - 3, y, 7, 1);
    ctx.fillRect(x - 1, y - 1, 3, 3);
  }
}

export function spawnAt(g, type, n, o = {}) {
  for (let i = 0; i < n; i++) {
    const [x, y] = edgePoint(g, ENEMIES[type].w, ENEMIES[type].h);
    spawnEnemy(g, type, x, y, { summon: true, xp: 0, ...o });
  }
}

export function stepEnemies(g, dt, cx, cy) {
  for (const e of g.en) {
    e.t += dt;
    e.hit -= dt;
    e.slow -= dt;
    if (e.mark > 0) e.mark -= dt;
    if (e.stasis > 0) e.stasis -= dt;

    if (e.rise > 0) {
      e.rise -= dt;
      continue;
    }
    if (e.life !== undefined && (e.life -= dt) <= 0) {
      e.hp = 0;
      burst(g, e.x + 2, e.y + 2, 4, "#ff8a2a");
      continue;
    }
    if (e.stun > 0) {                                       // pinned by the Shade Cat / an Ambush
      e.stun -= dt;
      continue;
    }

    const ex = e.x + e.w / 2;
    const ey = e.y + e.h / 2;

    // Afterimage decoy pulls nearby chasers
    let tx = cx;
    let ty = cy;
    let decoyed = false;
    if (g.decoy && !e.fixed && !e.ranged && !e.turret && Math.hypot(g.decoy.x - ex, g.decoy.y - ey) < 90) {
      tx = g.decoy.x;
      ty = g.decoy.y;
      decoyed = true;
    }

    const ax = tx - ex;
    const ay = ty - ey;
    const d = Math.hypot(ax, ay) || 1;
    const slowMul = e.slow > 0 ? e.slowMul : 1;
    const sp = e.sp * slowMul * g.ts * (e.stasis > 0 ? NEC.fogSlow : 1);

    // bone pile: reassembles unless walked over / hit
    if (e.harmless) {
      e.re = (e.re ?? 3) - dt;
      if (d < 8) {
        e.hp = 0;
        burst(g, ex, ey, 6, "#e8e4d8");
        continue;
      }
      if (e.re <= 0) {
        e.hp = 0;
        spawnEnemyReplace(g, "skeleton", e.x - 1, e.y - 9, { hp: 1, summon: true, xp: 0 });
        burst(g, ex, ey, 6, "#e8e4d8");
      }
      continue;
    }

    // Rat King's scattered rats: run off, then return and heal him
    if (e.healer !== undefined) {
      e.healer -= dt;
      if (e.healer <= 0) {
        e.hp = 0;
        if (g.boss) {
          g.boss.hp = Math.min(g.boss.max, g.boss.hp + 2);
          msg(g, "The rats return!", 1);
          burst(g, ex, ey, 6, "#b8a69c");
        }
        continue;
      }
      const returning = e.healer < 1.5 && g.boss;
      const bossX = g.boss ? g.boss.x + g.boss.w / 2 : cx;
      const bossY = g.boss ? g.boss.y + g.boss.h / 2 : cy;
      const dirX = returning ? bossX - ex : -ax;
      const dirY = returning ? bossY - ey : -ay;
      const dirLen = Math.hypot(dirX, dirY) || 1;
      e.x += dirX / dirLen * sp * dt;
      e.y += dirY / dirLen * sp * dt;
      e.x = clamp(e.x, 0, W - e.w);
      e.y = clamp(e.y, WALL, H - e.h);
      continue;
    }

    let mx = ax / d;
    let my = ay / d;
    let speed = sp;

    if (e.turret) {
      e.fireT -= dt;
      if (e.fireT <= 0) {
        e.fireT = e.turret.every;
        shootE(g, ex, ey, Math.atan2(ay, ax), e.turret.sp, { c: "#ff4fd8" });
      }
      mx = my = 0;
    } else if (e.ranged) {
      const ranged = e.ranged;
      if (d < ranged.keep - 10) {
        // too close: back off
        mx = -mx;
        my = -my;
      } else if (d < ranged.keep + 15) {
        // about the right range: circle the player
        const oldMx = mx;
        mx = -my * 0.7;
        my = oldMx * 0.7;
      }
      e.fireT -= dt;
      if (e.fireT <= 0) {
        e.fireT = ranged.every;
        shootE(g, ex, ey, Math.atan2(ay, ax), ranged.sp, { spr: ranged.spr, pal: e.pal, size: 1, c: "#ff8a2a" });
      }
      e.wind = e.fireT < 0.4;
    } else if (e.wave) {
      // bats weave side to side
      const oldMx = mx;
      mx += -my * Math.cos(e.t * 7) * 0.8;
      my += oldMx * Math.cos(e.t * 7) * 0.8;
    } else if (e.blink) {
      e.bt = (e.bt ?? 2.5) - dt;
      e.shimmer = e.bt < 0.3;
      if (e.bt <= 0) {
        e.bt = 2.5;
        e.x += mx * 20;
        e.y += my * 20;
        burst(g, ex, ey, 5, "#5b3f8c");
      }
    } else if (e.lunge) {
      e.lc = (e.lc ?? 0) - dt;
      if (e.lt > 0) {
        // mid-lunge: keep going in the locked direction
        e.lt -= dt;
        mx = e.ldx;
        my = e.ldy;
        speed = 90;
      } else if (d < 24 && e.lc <= 0) {
        e.lt = 0.3;
        e.lc = 2;
        e.ldx = mx;
        e.ldy = my;
      }
    }

    if (e.slides && onIceAt(g, ex, e.y + e.h)) {
      // on ice they slide: velocity eases towards the wanted direction
      e.vx += (mx * speed - e.vx) * Math.min(1, 3 * dt);
      e.vy += (my * speed - e.vy) * Math.min(1, 3 * dt);
    } else {
      e.vx = mx * speed;
      e.vy = my * speed;
    }
    e.x += e.vx * dt;
    e.y += e.vy * dt;

    // once on screen, keep them inside the arena
    if (e.x > -20 && e.x < W + 10 && e.y > WALL - 6 && e.y < H + 10) {
      e.x = clamp(e.x, -e.w, W);
      e.y = clamp(e.y, WALL - 4, H);
    }

    // touching the player hurts and bounces the enemy back
    if (!e.fixed && !decoyed && d < e.w / 2 + 4 && hurt(g)) {
      e.x -= ax / d * 14;
      e.y -= ay / d * 14;
    }
  }
}

function spawnEnemyReplace(g, type, x, y, o) {
  g.en.push({
    type, ...ENEMIES[type], x, y,
    hit: 0, slow: 0, slowMul: 0.5, vx: 0, vy: 0, t: 0,
    pal: ENEMIES[type].pal,
    ...o,
    onDeath: pileOnDeath,
  });
}

function pileOnDeath(g, e) {
  if (e.hp <= 0 && !e.noPile) {
    g.en.push({ type: "pile", ...ENEMIES.pile, x: e.x + 1, y: e.y + 9, hit: 0, slow: 0, vx: 0, vy: 0, t: 0, re: 3 });
  }
}

function magmaOnDeath(g, e) {
  for (const offset of [-4, 4]) {
    g.en.push({
      type: "cinder", ...ENEMIES.cinder, x: e.x + 2 + offset, y: e.y,
      hit: 0, slow: 0, slowMul: 0.5, vx: 0, vy: 0, t: 0,
    });
  }
}

// attach death behaviours once (keeps the table above as plain data)
ENEMIES.skeleton.onDeath = pileOnDeath;
ENEMIES.magma.onDeath = magmaOnDeath;
ENEMIES.magma.pal = { ...LAVA_EPAL, g: LAVA.slime.g, G: LAVA.slime.G };

export const enemyLights = g =>
  g.en.filter(e => e.light && e.hp > 0).map(e => ({ x: e.x + e.w / 2, y: e.y + e.h / 2, r: e.light }));

// palette that only shows the glowing parts (eyes) and is transparent everywhere else
const EYES_ONLY = pal => new Proxy({}, { get: (_, k) => EYE_KEYS.includes(k) ? pal[k] : "rgba(0,0,0,0)" });
const WHITEP = new Proxy({}, { get: () => "#ffffff" });

export function drawEnemies(ctx, g, now, eyesPass) {
  for (const e of g.en) {
    if (eyesPass && !e.eyes) continue;

    const frame = e.frames ? e.frames[Math.floor((now + e.t * 300) / 150) % e.frames.length] : e.spr;
    const pal = eyesPass ? EYES_ONLY(e.pal) : e.hit > 0 ? WHITEP : e.pal;

    // flyers bob, slimes squish up and down, everything else stays put
    const squishes = e.type === "slime" || e.type === "magma";
    const y = e.y + (e.fly
      ? Math.round(Math.sin(now / 200 + e.t) * 1.5)
      : (Math.floor(now / 200) % 2) * (squishes ? 1 : 0));

    // rising out of water: clip so only the part above the surface shows
    if (e.rise > 0) {
      const visible = Math.ceil(e.h * (1 - e.rise));
      ctx.save();
      ctx.beginPath();
      ctx.rect(e.x - 2, e.y + e.h - visible - 2, e.w + 4, visible + 2);
      ctx.clip();
      spr(ctx, frame, e.x, e.y + e.h - visible, false, pal);
      ctx.restore();
      continue;
    }

    // ground shadow
    if (!eyesPass) {
      ctx.fillStyle = "#17121f";
      ctx.fillRect(Math.round(e.x + 1), Math.round(e.y + e.h), e.w - 2, 1);
    }

    if (e.shimmer && Math.floor(now / 60) % 2) continue;

    // healer rats blink a pink dot above them
    if (e.healer !== undefined && Math.floor(now / 100) % 2 && !eyesPass) {
      ctx.fillStyle = "#ff9aa5";
      ctx.fillRect(Math.round(e.x + 4), Math.round(e.y - 2), 1, 1);
    }

    spr(ctx, frame, e.x, y, e.type === "rat" && e.vx < -1, pal);

    // slowed: two little frost specks
    if (!eyesPass && e.slow > 0) {
      ctx.fillStyle = "#b9d0ff";
      ctx.fillRect(Math.round(e.x) + 2, Math.round(e.y) - 1, 1, 1);
      ctx.fillRect(Math.round(e.x) + e.w - 3, Math.round(e.y) - 2, 1, 1);
    }

    // ranged enemy about to fire
    if (!eyesPass && e.wind) {
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(Math.round(e.x + e.w - 2), Math.round(e.y + 6), 2, 2);
    }
  }
}

export { sfx };
