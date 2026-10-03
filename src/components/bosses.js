// Boss framework: a boss walks, then runs an attack = a queue of "acts" (windup → action → rest).
// Act: { t, stand, flash, mul (damage taken ×), shield, fade, start(g,b), tick(g,b,dt), end(g,b) }
import { spr, drawHero } from "./sprites.js";
import { sfx } from "./audio.js";
import { SHADOW, EYE_KEYS } from "./biomes/void_enemies.js";
import { BALL } from "./biomes/dungeon_enemies.js";
import { BOULDER } from "./biomes/ice_enemies.js";
import { INGOT, FIREBALL } from "./biomes/lava_enemies.js";
import { TRIDENT, SOUL_SKULL } from "./biomes/crypt_enemies.js";
import { W, H, WALL, clamp, burst, hurt, shootE, addHz, after, msg, pc, segDist } from "./engine.js";
import { spawnEnemy, spawnAt, ENEMIES } from "./enemies.js";
import { LOOP } from "./stages.js";

const TAU = 6.283;   // close enough to 2π for angles here (kept as-is so the attack patterns don't change)

export function spawnBoss(g, def) {
  const w = def.mirror ? 16 : def.spr[0].length;
  const h = def.mirror ? 16 : def.spr.length;
  const hp = Math.ceil(def.hp * (1 + LOOP.hp * g.loop));
  g.boss = {
    def, x: W / 2 - w / 2, y: WALL - h, w, h, hp, max: hp,
    mode: "enter", enterT: 0.8, act: null, queue: [], walkT: 1.2, ai: 0,
    atk: def.atk, phaseI: 0, spdMul: 1, hit: 0, slow: 0, dx: 0, dy: 1, face: 1, scatterI: 0, st: 0, sa: 0,
  };
  msg(g, def.name + " appears", 2);
  sfx("bossIn");
}

export function bossDamageMul(g, b) {
  const actMul = b.act?.mul || 1;
  const riftsUp = b.def.riftShield && g.en.some(e => e.type === "rift" && e.hp > 0);
  return actMul * (riftsUp ? 0.5 : 1);
}

// ---------- small helpers ----------

const bc = b => [b.x + b.w / 2, b.y + b.h / 2];   // boss centre

// turn the boss to face the player (sets b.dx/b.dy) and return the angle
function aim(g, b) {
  const [x, y] = bc(b);
  const [px, py] = pc(g);
  const dist = Math.hypot(px - x, py - y) || 1;
  b.dx = (px - x) / dist;
  b.dy = (py - y) / dist;
  return Math.atan2(py - y, px - x);
}

// just the angle to the player, without touching b.dx/b.dy
function aimA(g, b) {
  const [x, y] = bc(b);
  const [px, py] = pc(g);
  return Math.atan2(py - y, px - x);
}

// random point within r of the player (squashed vertically a bit)
function near(g, r) {
  const [px, py] = pc(g);
  const a = Math.random() * TAU;
  const d = Math.random() * r;
  return [px + Math.cos(a) * d, py + Math.sin(a) * d * 0.7];
}

// wind/rest/once/charge build "acts" — the smallest unit stepBoss consumes. stand freezes movement (a windup or
// rest beat), flash blinks the boss white, mul multiplies damage taken during the act (e.g. briefly vulnerable
// mid-charge), shield blocks shots from the front (checked in stepShots, engine.js).
const wind = (t = 0.5, o = {}) => ({ t, stand: true, flash: true, ...o });
const rest = (t = 0.5) => ({ t, stand: true });
const once = end => ({ t: 0, stand: true, end });

function charge(g, b, o = {}) {
  const speed = o.cs ?? b.def.cs ?? 140;
  return [
    wind(o.wind ?? 0.5, { start: (g, b) => aim(g, b), shield: o.shield }),
    {
      t: o.dur ?? 0.55,
      shield: o.shield,
      tick: (g, b, dt) => {
        b.x += b.dx * speed * dt;
        b.y += b.dy * speed * dt;
        // the Frost Golem leaves a trail of ice
        if (b.def.trail === "ice" && (b.st -= dt) <= 0) {
          b.st = 0.1;
          g.tempPatches.push({ x: b.x + b.w / 2, y: b.y + b.h, rx: 7, ry: 4, l: 4 });
        }
      },
    },
    ...(o.after || [rest(0.5)]),
  ];
}

// n bullets evenly around the boss
function ringShot(g, b, n, sp, off = 0, o = {}) {
  const [x, y] = bc(b);
  for (let k = 0; k < n; k++) {
    shootE(g, x, y, k / n * TAU + off, sp, { c: b.def.bc, ...o });
  }
  sfx("bossShot");
}

// n bullets in a fan aimed at the player
function fan(g, b, n, spread, sp, o = {}) {
  const [x, y] = bc(b);
  const a = aimA(g, b);
  for (let k = 0; k < n; k++) {
    const offset = n > 1 ? -spread + 2 * spread * k / (n - 1) : 0;
    shootE(g, x, y, a + offset, sp, { c: b.def.bc, ...o });
  }
  sfx("bossShot");
}

function teleport(g, b, x, y) {
  burst(g, b.x + b.w / 2, b.y + b.h / 2, 12, b.def.bc);
  b.x = clamp(x - b.w / 2, 0, W - b.w);
  b.y = clamp(y - b.h / 2, WALL, H - b.h);
  burst(g, b.x + b.w / 2, b.y + b.h / 2, 12, b.def.bc);
}

// jump to one side of the player
function blinkNear(g, b) {
  const [px, py] = pc(g);
  teleport(g, b, px + (Math.random() < 0.5 ? -40 : 40), py + (Math.random() - 0.5) * 30);
}

// ---------- attack library ----------
// Every entry is (g,b) => [...acts] — an "attack" is nothing but an array of acts assembled from the combinators
// above, plus a few one-off inline acts for bespoke behavior (spiral, soulStorm, ...). stepBoss just walks the
// array; adding attack #46 means composing existing pieces, not touching the interpreter below.
const ATK = {
  charge: (g, b) => charge(g, b),
  lunge: (g, b) => charge(g, b, { dur: 0.3, cs: 120 }),
  shieldCharge: (g, b) => charge(g, b, { shield: true, cs: 130 }),
  blink: (g, b) => [once(blinkNear), ...charge(g, b, { wind: 0.45 })],

  ring: (g, b) => [
    wind(0.3, { end: (g, b) => ringShot(g, b, b.def.ring || 8, 60, b.ai * 0.3) }),
    rest(0.6),
  ],

  spiral: (g, b) => [
    {
      t: 1.2,
      stand: true,
      start: (g, b) => {
        b.st = 0;
        b.sa = Math.random() * 6;
      },
      tick: (g, b, dt) => {
        if ((b.st -= dt) <= 0) {
          b.st = 0.09;
          b.sa += 0.45;
          ringShot(g, b, 3, 70, b.sa);
        }
      },
    },
    rest(0.4),
  ],

  // ----- Stage 1 -----
  squeak: (g, b) => [wind(0.6, { end: g => spawnAt(g, "rat", 3) }), rest(0.4)],

  releasePrisoners: (g, b) => [
    wind(0.6, {
      end: g => {
        for (let i = 0; i < 2; i++) {
          spawnEnemy(g, "slime", 20 + Math.random() * (W - 40), WALL - 2, { summon: true, xp: 0 });
        }
      },
    }),
    rest(0.4),
  ],

  ballSwing: (g, b) => {
    const radius = b.riot ? 32 : 26;
    const spin = b.riot ? 7 : 5;
    return [
      // telegraph the ball's orbit, then swing it
      { t: 0.6, stand: true, start: (g, b) => { b.ball = { a: 0, r: radius, tele: true }; } },
      {
        t: 2.5,
        stand: true,
        start: (g, b) => { b.ball.tele = false; },
        tick: (g, b, dt) => {
          b.ball.a += spin * dt;
          const [x, y] = bc(b);
          const ballX = x + Math.cos(b.ball.a) * radius;
          const ballY = y + Math.sin(b.ball.a) * radius * 0.7;
          const [px, py] = pc(g);
          if (Math.hypot(px - ballX, py - ballY) < 6) hurt(g);
        },
        end: (g, b) => { b.ball = null; },
      },
      rest(0.4),
    ];
  },

  ballThrow: (g, b) => [
    wind(0.5, {
      start: (g, b) => {
        const a = aim(g, b);
        const [x, y] = bc(b);
        addHz(g, {
          k: "line", nodmg: true, x1: x, y1: y, x2: x + Math.cos(a) * 90, y2: y + Math.sin(a) * 90,
          w: 6, delay: 0.5, c: "#d4a82a",
        });
      },
    }),
    once((g, b) => {
      const [x, y] = bc(b);
      shootE(g, x, y, Math.atan2(b.dy, b.dx), 110, { spr: BALL, pal: b.def.pal, size: 3, ret: 90, l: 4 });
    }),
    rest(0.8),
  ],

  chainHook: (g, b) => [
    {
      t: 0.6,
      stand: true,
      start: (g, b) => {
        const [x, y] = bc(b);
        const [px, py] = pc(g);
        b.hook = { x2: px, y2: py };
        addHz(g, { k: "line", nodmg: true, x1: x, y1: y, x2: px, y2: py, w: 6, delay: 0.6, c: "#cfd6e6" });
      },
      end: (g, b) => {
        const [x, y] = bc(b);
        const [px, py] = pc(g);
        // caught if the player is still near the line the hook was thrown along
        if (segDist(px, py, x, y, b.hook.x2, b.hook.y2) < 7) {
          g.p.pull = 120;
          after(g, 0.3, () => { g.p.pull = 0; });
          msg(g, "Hooked!", 1);
        }
        b.hook = null;
      },
    },
    {
      t: 0.9,
      stand: true,
      start: (g, b) => {
        const [x, y] = bc(b);
        addHz(g, { k: "circle", x, y, r: 22, delay: 0.8, c: "#d4a82a" });
      },
    },
    rest(0.4),
  ],

  // ----- Stage 2 -----
  stomp: (g, b) => [
    wind(0.6),
    once((g, b) => {
      ringShot(g, b, 10, 55, 0, { c: "#b8e3ff" });
      g.tempPatches.push({ x: b.x + b.w / 2, y: b.y + b.h, rx: 18, ry: 10, l: 6 });
      burst(g, b.x + b.w / 2, b.y + b.h, 12, "#b8e3ff");
    }),
    rest(0.5),
  ],

  boulder: (g, b) => [
    wind(0.4, {
      end: (g, b) => fan(g, b, 1, 0, 45, { spr: BOULDER, pal: b.def.pal, size: 2, split: 5, splitAt: 3.8, c: "#b8e3ff" }),
    }),
    rest(0.4),
  ],

  volley: (g, b) => [
    wind(0.35, { end: (g, b) => fan(g, b, 3, 0.2, 90, { c: "#b8e3ff", chill: 1.5 }) }),
    rest(0.5),
  ],

  // Ice Wraith: drifts towards the player, half-transparent and takes half damage
  fade: (g, b) => [{
    t: 1.2,
    fade: true,
    mul: 0.5,
    tick: (g, b, dt) => {
      const a = aim(g, b);
      b.x += Math.cos(a) * 70 * dt;
      b.y += Math.sin(a) * 70 * dt;
    },
  }],

  icicleRain: (g, b) => [
    wind(0.3, {
      end: g => {
        for (let i = 0; i < 5; i++) {
          // the first one lands right on the player, the rest scatter around them
          const [x, y] = i ? near(g, 26) : pc(g);
          addHz(g, { k: "circle", x, y, r: 6, delay: 0.9, c: "#b8e3ff", spike: "#e8ffff" });
        }
      },
    }),
    rest(0.6),
  ],

  summonBats: (g, b) => [wind(0.5, { end: g => spawnAt(g, "bat", 3) }), rest(0.4)],

  frostRing: (g, b) => [
    wind(0.5, {
      end: (g, b) => {
        const [x, y] = bc(b);
        addHz(g, { k: "ringwave", x, y, r: 6, sp: 45, max: 170, gapA: Math.random() * TAU, gapW: 0.87, c: "#b8e3ff" });
      },
    }),
    rest(0.8),
  ],

  // ----- Stage 3 -----
  slam: (g, b) => [
    wind(0.7, {
      start: (g, b) => {
        const a = aim(g, b);
        const [x, y] = bc(b);
        addHz(g, {
          k: "line", x1: x, y1: y, x2: x + Math.cos(a) * 140, y2: y + Math.sin(a) * 140,
          w: 8, delay: 0.7, c: "#ff8a2a", spike: "#ffd166",
        });
      },
    }),
    rest(0.5),
  ],

  ingot: (g, b) => [
    wind(0.3, {
      end: (g, b) => fan(g, b, 1, 0, 70, { spr: INGOT, pal: b.def.pal, size: 2, bounce: 2, l: 6, c: "#ff8a2a" }),
    }),
    rest(0.5),
  ],

  // heat up the lava vents close to the smith
  stoke: (g, b) => [
    wind(0.6, {
      end: (g, b) => {
        const [x, y] = bc(b);
        let vents = 0;
        for (const v of g.biome.vents || []) {
          if (Math.hypot(v.x - x, v.y - y) < 60) {
            v.force = g.t + 1.5;
            vents++;
          }
        }
        burst(g, x, b.y + b.h, 14, "#ff8a2a", 120);
        if (vents) msg(g, "The vents roar!", 1);
      },
    }),
    rest(0.5),
  ],

  // Salamander: circles the player leaving burning ground, then pants (vulnerable, takes double)
  sprint: (g, b) => [
    {
      t: 1.4,
      start: (g, b) => {
        const [x, y] = bc(b);
        const [px, py] = pc(g);
        b.sa = Math.atan2(y - py, x - px);
        b.st = 0;
      },
      tick: (g, b, dt) => {
        b.sa += 2.2 * dt;
        const [px, py] = pc(g);
        const targetX = px + Math.cos(b.sa) * 45 - b.w / 2;
        const targetY = py + Math.sin(b.sa) * 32 - b.h / 2;
        const dist = Math.hypot(targetX - b.x, targetY - b.y) || 1;
        b.x += (targetX - b.x) / dist * Math.min(dist, 120 * dt);
        b.y += (targetY - b.y) / dist * Math.min(dist, 120 * dt);
        b.face = Math.sign(targetX - b.x) || b.face;

        if ((b.st -= dt) <= 0) {
          b.st = 0.12;
          addHz(g, { k: "area", x: b.x + b.w / 2, y: b.y + b.h, r: 5, dur: 2, effect: "burn", c: "#ff8a2a" });
        }
      },
    },
    { t: 1, stand: true, mul: 2, pant: true },
  ],

  spit: (g, b) => [
    wind(0.35, { end: (g, b) => fan(g, b, 5, 0.5, 70, { spr: FIREBALL, pal: b.def.pal, c: "#ff8a2a" }) }),
    rest(0.5),
  ],

  meteors: (g, b) => [
    wind(0.3, {
      end: g => {
        for (let i = 0; i < 4; i++) {
          const [x, y] = i ? near(g, 34) : pc(g);
          addHz(g, { k: "circle", x, y, r: 9, delay: 1.0, c: "#ff8a2a", fire: 2 });
        }
      },
    }),
    rest(0.6),
  ],

  breath: (g, b) => [
    wind(0.5, {
      start: (g, b) => {
        const a = aim(g, b);
        const [x, y] = bc(b);
        addHz(g, {
          k: "cone", x, y, follow: true, a: a - 0.78, spread: 1.05, r: 60,
          delay: 0.5, dur: 1.2, sweep: 1.57, c: "#ff8a2a",
        });
      },
    }),
    rest(1.2),
    rest(0.4),
  ],

  summonImps: (g, b) => [
    wind(0.5, {
      end: g => {
        for (const x of [W * 0.2, W * 0.8]) spawnEnemy(g, "imp", x - 5, WALL, { summon: true, xp: 0 });
      },
    }),
    rest(0.4),
  ],

  // the arena splits into 6 columns that erupt left to right; one random column (1-4) is safe
  eruption: (g, b) => [
    wind(0.3, {
      end: g => {
        const columns = 6;
        const safe = 1 + (Math.random() * 4 | 0);
        const colW = W / columns;
        for (let k = 0; k < columns; k++) {
          if (k === safe) continue;
          addHz(g, { k: "rect", x: k * colW, y: WALL, w: colW, h: H - WALL, delay: 0.6 + k * 0.35, c: "#ff8a2a" });
        }
        msg(g, "Find the safe column!", 1.2);
      },
    }),
    rest(2.4),
  ],

  // ----- Stage 4 -----
  sweep: (g, b) => [
    wind(0.5, {
      start: (g, b) => {
        const a = aim(g, b);
        const [x, y] = bc(b);
        addHz(g, { k: "cone", x, y, a, spread: 1.75, r: 28, delay: 0.5, dur: 0.15, sweep: 0, c: "#7dff9a" });
      },
    }),
    rest(0.4),
  ],

  dirt: (g, b) => [
    wind(0.3, {
      end: g => {
        for (let i = 0; i < 3; i++) {
          const [x, y] = i ? near(g, 28) : pc(g);
          addHz(g, { k: "circle", x, y, r: 6, delay: 0.9, c: "#8a6a4a" });
        }
      },
    }),
    rest(0.5),
  ],

  // Gravekeeper raises skeletons; takes double damage while doing it
  raise: (g, b) => [
    {
      t: 1.2,
      stand: true,
      flash: true,
      mul: 2,
      end: (g, b) => {
        const [x, y] = bc(b);
        for (let i = 0; i < 3; i++) {
          spawnEnemy(g, "skeleton", x + Math.cos(i * 2.1) * 20 - 5, y + Math.sin(i * 2.1) * 14 - 6,
            { summon: true, xp: 0, noPile: true });
        }
      },
    },
    rest(0.4),
  ],

  trident: (g, b) => [
    wind(0.4, { start: (g, b) => aim(g, b) }),
    once((g, b) => fan(g, b, 1, 0, 120, { spr: TRIDENT, pal: b.def.pal, size: 2, ret: 90, l: 5, c: "#7a7486" })),
    rest(0.7),
  ],

  tide: (g, b) => [
    wind(0.4, {
      end: g => {
        const dir = Math.random() < 0.5 ? 1 : -1;
        addHz(g, {
          k: "linewave", x: dir > 0 ? -4 : W + 4, dir, sp: 50,
          gapY: WALL + 10 + Math.random() * (H - WALL - 40), gapH: 24, c: "#4f9f96",
        });
      },
    }),
    rest(0.8),
  ],

  soulChains: (g, b) => [
    wind(0.4, {
      end: (g, b) => fan(g, b, 3, 0.5, 40, { spr: SOUL_SKULL, pal: b.def.pal, size: 2, home: 2, l: 4, hp: 1, c: "#7dff9a" }),
    }),
    rest(0.5),
  ],

  boneSpears: (g, b) => [
    wind(0.8, {
      start: (g, b) => {
        const a = aim(g, b);
        const [x, y] = bc(b);
        addHz(g, {
          k: "line", x1: x, y1: y, x2: x + Math.cos(a) * 150, y2: y + Math.sin(a) * 150,
          w: 6, delay: 0.8, c: "#b8b09c", spike: "#e8e4d8",
        });
      },
    }),
    rest(0.5),
  ],

  raiseDead: (g, b) => [
    wind(0.6, {
      end: g => {
        spawnAt(g, "skeleton", 2, { noPile: true });
        // a drowned also climbs out of a random pool (if the stage has any)
        const pool = g.biome.pools?.[Math.random() * g.biome.pools.length | 0]?.blobs[0];
        if (pool) spawnEnemy(g, "drowned", pool.x - 5, pool.y - 11, { rise: 1, summon: true, xp: 0 });
      },
    }),
    rest(0.4),
  ],

  pull: (g, b) => [
    {
      t: 1.5,
      stand: true,
      flash: true,
      start: g => {
        g.p.pull = 40;
        msg(g, "Resist the pull!", 1.2);
      },
      end: g => { g.p.pull = 0; },
    },
    rest(0.4),
  ],

  poolBlink: (g, b) => [
    once((g, b) => {
      const pools = g.biome.pools || [];
      const pool = pools[Math.random() * pools.length | 0];
      if (pool) teleport(g, b, pool.blobs[0].x, pool.blobs[0].y - 6);
    }),
    rest(0.3),
  ],

  // ----- Stage 5 -----
  openRifts: (g, b) => [
    wind(0.6, {
      end: g => {
        // top up to 3 rifts, each at least 40px from the player (gives up after 10 tries)
        const have = g.en.filter(e => e.type === "rift").length;
        const [px, py] = pc(g);
        for (let i = have; i < 3; i++) {
          let x, y;
          let tries = 0;
          do {
            x = 20 + Math.random() * (W - 40);
            y = WALL + 12 + Math.random() * (H - WALL - 30);
          } while (Math.hypot(x - px, y - py) < 40 && ++tries < 10);
          spawnEnemy(g, "rift", x, y, { summon: true, xp: 0 });
        }
        msg(g, "Close the rifts!", 1.2);
      },
    }),
    rest(0.5),
  ],

  web: (g, b) => [
    wind(0.3, {
      end: g => {
        for (let i = 0; i < 3; i++) {
          const [x, y] = near(g, 30);
          addHz(g, { k: "area", x, y, r: 10, dur: 5, effect: "slow", c: "#cfd6e6" });
        }
      },
    }),
    rest(0.4),
  ],

  hollowGrasp: (g, b) => [
    once(g => {
      // four strikes, half a second apart, each aimed at wherever the player is at that moment
      for (let i = 0; i < 4; i++) {
        after(g, i * 0.5, () => {
          const [x, y] = pc(g);
          addHz(g, { k: "circle", x, y, r: 6, delay: 0.8, c: "#ff4a6a", spike: "#5b3f8c" });
        });
      }
    }),
    rest(2.2),
  ],

  summonShades: (g, b) => [wind(0.5, { end: g => spawnAt(g, "shade", 3) }), rest(0.4)],

  // rotating ring of bullets with two gaps opposite each other
  soulStorm: (g, b) => [
    {
      t: 4,
      stand: true,
      start: (g, b) => {
        b.st = 0;
        b.sa = Math.random() * 6;
        msg(g, "Soul storm!", 1.2);
      },
      tick: (g, b, dt) => {
        if ((b.st -= dt) > 0) return;
        b.st = 0.35;
        b.sa += 0.35;
        const [x, y] = bc(b);
        for (let k = 0; k < 18; k++) {
          const a = k / 18 * TAU;
          const inGap = [b.sa, b.sa + Math.PI].some(gapA => Math.abs(Math.atan2(Math.sin(a - gapA), Math.cos(a - gapA))) < 0.4);
          if (inGap) continue;
          shootE(g, x, y, a, 55, { c: b.def.bc });
        }
        sfx("bossShot");
      },
    },
    rest(0.8),
  ],

  // ----- Mirror Self: copies the player's class -----
  mirrorAttack: (g, b) => {
    const pink = { c: "#ff4fd8" };
    if (g.cls === "assassin") return ATK.blink(g, b);
    if (g.cls === "necromancer") {
      return [
        wind(0.3, { end: (g, b) => fan(g, b, 1, 0, 90, { c: "#8f6bd1" }) }),
        rest(0.7),
      ];
    }
    if (g.cls === "warden") {
      return charge(g, b, {
        wind: 0.4, dur: 0.3, cs: 150,
        after: [
          once((g, b) => {
            const [x, y] = bc(b);
            addHz(g, { k: "circle", x, y, r: 20, delay: 0.15, c: "#ff4fd8" });
          }),
          rest(0.4),
        ],
      });
    }
    if (g.cls === "ranger") {
      return [
        wind(0.3, { end: (g, b) => fan(g, b, 3, 0.15, 110, pink) }),
        { t: 0.3, stand: true, end: (g, b) => fan(g, b, 3, 0.15, 110, pink) },
        rest(0.3),
      ];
    }
    if (g.cls === "gunner") {
      return [
        wind(0.3, { end: (g, b) => fan(g, b, 3, 0.1, 120, pink) }),
        { t: 0.18, stand: true, end: (g, b) => fan(g, b, 3, 0.1, 120, pink) },
        rest(0.35),
      ];
    }
    // mage
    return [
      wind(0.4, { end: (g, b) => fan(g, b, 2, 0.4, 50, { c: "#ff4fd8", size: 2, home: 2, l: 3 }) }),
      rest(0.4),
    ];
  },

  mirrorAbility: (g, b) => {
    let movement;
    if (g.cls === "warden") {
      movement = charge(g, b, { wind: 0.2, dur: 0.25, cs: 190, after: [] });
    } else if (g.cls === "ranger" || g.cls === "gunner") {
      // backs away from the player while firing
      movement = [{
        t: 0.25,
        tick: (g, b, dt) => {
          const a = aimA(g, b) + Math.PI;
          b.x += Math.cos(a) * 170 * dt;
          b.y += Math.sin(a) * 170 * dt;
        },
        end: (g, b) => fan(g, b, 1, 0, 110, { c: "#ff4fd8" }),
      }];
    } else {
      // everyone else: teleport away from the player
      movement = [once((g, b) => {
        const [px, py] = pc(g);
        const [x, y] = bc(b);
        const a = Math.atan2(y - py, x - px);
        teleport(g, b, x + Math.cos(a) * 40, y + Math.sin(a) * 30);
      })];
    }
    return [...movement, { t: 1, stand: true, mul: 2, pant: true }];
  },
};

// one-off effects when a boss crosses a phase threshold (keys match `enter` in stages.js)
function enterPhase(g, b, kind) {
  const effects = {
    riot: () => {
      b.riot = true;
      b.spdMul = 1.15;
      msg(g, "RIOT!", 1.4);
    },
    whiteout: () => {
      // the ice patches grow, two more appear, and the boss speeds up
      for (const p of g.biome.patches || []) {
        g.tempPatches.push({ x: p.x, y: p.y, rx: p.rx * 1.4, ry: p.ry * 1.4 });
      }
      for (let i = 0; i < 2; i++) {
        g.tempPatches.push({
          x: 30 + Math.random() * (W - 60),
          y: WALL + 20 + Math.random() * (H - WALL - 40),
          rx: 16,
          ry: 8,
        });
      }
      b.spdMul = 1.25;
      msg(g, "WHITEOUT!", 1.4);
    },
    eruption: () => {
      b.spdMul = 1.15;
      msg(g, "THE FORGE ERUPTS!", 1.4);
    },
    flood: () => {
      g.biomeGrow = 1.5;
      msg(g, "THE CRYPT FLOODS!", 1.4);
    },
    eclipse: () => {
      g.vision = 36;
      spawnAt(g, "shade", 3);
      msg(g, "ECLIPSE", 1.6);
    },
    collapse: () => {
      g.collapse = 0.001;
      b.spdMul = 1.2;
      msg(g, "THE VOID COLLAPSES!", 1.6);
    },
  };

  effects[kind]?.();
  burst(g, b.x + b.w / 2, b.y + b.h / 2, 20, b.def.bc, 140);
  sfx("bossIn");
}

export function stepBoss(g, dt, cx, cy) {
  const b = g.boss;
  if (!b) return;

  b.hit -= dt;
  b.slow -= dt;
  if (b.mark > 0) b.mark -= dt;
  if (b.stasis > 0) b.stasis -= dt;

  // staggered by an armour blast
  if (b.stun > 0) {
    b.stun -= dt;
    return;
  }

  // walking in from the top
  if (b.mode === "enter") {
    b.y += 30 * dt;
    b.enterT -= dt;
    if (b.enterT <= 0) b.mode = "fight";
    return;
  }

  // phase change: swap the attack list, drop whatever was queued
  const phase = b.def.phases?.[b.phaseI];
  if (phase && b.hp <= b.max * phase.at) {
    b.phaseI++;
    b.atk = phase.atk;
    b.ai = 0;
    b.queue = [];
    if (b.act) {
      b.act.end?.(g, b);
      b.act = null;
    }
    enterPhase(g, b, phase.enter);
  }

  // Rat King: scatters rats at certain HP thresholds, they come back and heal him
  const scatterAt = b.def.scatterAt;
  if (scatterAt && b.scatterI < scatterAt.length && b.hp <= b.max * scatterAt[b.scatterI]) {
    b.scatterI++;
    const [x, y] = bc(b);
    for (let i = 0; i < 4; i++) {
      spawnEnemy(g, "rat", x - 4 + Math.cos(i * 1.57) * 10, y + Math.sin(i * 1.57) * 8,
        { summon: true, xp: 0, healer: 5 });
    }
    msg(g, "Kill the rats before they return!", 1.6);
  }

  const speedMul = (b.slow > 0 ? 0.75 : 1) * g.ts * (b.stasis > 0 ? 0.7 : 1);
  const [bx, by] = bc(b);
  const ax = cx - bx;
  const ay = cy - by;
  const dist = Math.hypot(ax, ay) || 1;

  // generic act interpreter: doesn't know or care which attack is running, just pulls the next act off b.queue,
  // ticks it every frame, and advances (calling end()) once its timer runs out — see the block right below
  if (!b.act && b.queue.length) {
    b.act = b.queue.shift();
    b.act.start?.(g, b);
  }
  if (b.act) {
    const act = b.act;
    act.t -= dt * b.spdMul;
    if (act.tick) act.tick(g, b, dt * speedMul);
    if (act.t <= 0) {
      act.end?.(g, b);
      b.act = null;
      if (b.queue.length) {
        b.act = b.queue.shift();
        b.act.start?.(g, b);
      } else {
        b.walkT = (1.3 + Math.random() * 0.6) / b.spdMul;   // pause before the next attack
      }
    }
  } else {
    // no act running: walk towards the player until it's time for the next attack
    b.x += ax / dist * b.def.sp * speedMul * dt;
    b.y += ay / dist * b.def.sp * speedMul * dt;
    b.face = Math.sign(ax) || b.face;
    b.walkT -= dt;
    if (b.walkT <= 0) {
      b.queue = ATK[b.atk[b.ai++ % b.atk.length]](g, b);
    }
  }

  b.shield = !!b.act?.shield;
  b.x = clamp(b.x, 0, W - b.w);
  b.y = clamp(b.y, WALL - 4, H - b.h);

  // contact: only attacks that move the boss (charge / lunge / sprint) hurt; a walking boss just shoves you back
  if (!b.act?.fade && dist < b.w / 2 + 3) {
    const attacking = b.act && !b.act.stand;
    if (!attacking || hurt(g)) {
      const push = attacking ? 14 : 3;
      g.p.x = clamp(g.p.x + ax / dist * push, g.bounds.x0, g.bounds.x1);
      g.p.y = clamp(g.p.y + ay / dist * push, g.bounds.y0, g.bounds.y1);
    }
  }
}

const EYES_ONLY = pal => new Proxy({}, { get: (_, k) => EYE_KEYS.includes(k) ? pal[k] : "rgba(0,0,0,0)" });
const WHITEP = new Proxy({}, { get: () => "#ffffff" });
const MIRROR_EYES = new Proxy({}, { get: (_, k) => (k === "E" || k === "y" || k === "X") ? "#ff4fd8" : "rgba(0,0,0,0)" });

export function drawBoss(ctx, g, now, eyesPass) {
  const b = g.boss;
  const def = b.def;
  const act = b.act;
  const flash = !eyesPass && (
    b.hit > 0 ||
    (act?.flash && Math.floor(now / 70) % 2) ||
    (act?.pant && Math.floor(now / 100) % 2)
  );

  // ground shadow
  if (!eyesPass) {
    ctx.fillStyle = "#17121f";
    ctx.fillRect(Math.round(b.x + 2), Math.round(b.y + b.h), b.w - 4, 2);
  }

  // the Jailer's ball and chain
  if (b.ball && !eyesPass) {
    const [x, y] = bc(b);
    if (b.ball.tele) {
      // blinking dotted circle showing where the ball will swing
      ctx.fillStyle = "#d4a82a";
      for (let a = 0; a < TAU; a += 0.25) {
        if (Math.floor(now / 110) % 2) {
          ctx.fillRect(Math.round(x + Math.cos(a) * b.ball.r), Math.round(y + Math.sin(a) * b.ball.r * 0.7), 1, 1);
        }
      }
    } else {
      const ballX = x + Math.cos(b.ball.a) * b.ball.r;
      const ballY = y + Math.sin(b.ball.a) * b.ball.r * 0.7;
      ctx.fillStyle = "#7a7486";
      for (let t = 0.15; t < 1; t += 0.12) {
        ctx.fillRect(Math.round(x + (ballX - x) * t), Math.round(y + (ballY - y) * t), 1, 1);
      }
      spr(ctx, BALL, ballX - 3, ballY - 3, false, def.pal);
    }
  }

  if (act?.fade) ctx.globalAlpha = 0.35;
  if (def.mirror) {
    const pal = eyesPass ? MIRROR_EYES : flash ? WHITEP : SHADOW;
    drawHero(ctx, g.cls, { x: b.x, y: b.y, face: b.face, moving: !act?.stand, atk: act?.flash ? 0.2 : 0 }, now, pal);
  } else {
    const bob = !act && Math.floor(now / 250) % 2 ? 1 : 0;
    const pal = eyesPass ? EYES_ONLY(def.pal) : flash ? WHITEP : def.pal;
    spr(ctx, def.spr, b.x, b.y + bob, def.faces && b.face < 0, pal);
  }
  ctx.globalAlpha = 1;

  // front shield bar
  if (b.shield && !eyesPass) {
    ctx.fillStyle = "#cfd6e6";
    const shieldX = b.dx >= 0 ? b.x + b.w : b.x - 2;
    ctx.fillRect(Math.round(shieldX), Math.round(b.y + 3), 2, b.h - 6);
  }
}

export { ENEMIES };
