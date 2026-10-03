// Stage 3 — Lava Forge. Rule: fire vents erupt on a timer and burn anything standing on them (player AND enemies).
import { rng, painter, lightXs } from "./shared.js";

export const LAVA = {
  name: "Lava Forge",
  pal: {
    floorA: "#2b1d1f", floorB: "#301f21", grout: "#1b1113", ash: "#3d2a2a",
    crackEdge: "#8c2a1a", crack: "#ff6a2a", crackHot: "#ffd166",
    brick: "#3a2426", brickHi: "#52302f", brickLo: "#2e1c1e", mortar: "#1e1214", wallTop: "#5a3634",
    seam: "#ff6a2a", chain: "#5a5460", bowl: "#4a4450",
    fire: "#ff8a2a", fireHot: "#ffd166", fireDeep: "#d9433a", ember: "#ffb347",
    ventRim: "#4a4450", ventHole: "#140c0d", ventWarm: "#8c2a1a",
  },
  slime: { g: "#d9433a", G: "#ffb26b" },
  vent: { cycle: 6, warnAt: 3.5, eruptAt: 4.5, r: 9, dmgEnemy: 2 },   // seconds; player takes 1 heart (normal i-frames)
};

// returns { cv, vents } ; vents = [{x, y, off}] (off = phase offset in seconds)
export function buildLava(W, H, WALL, TILE = 12, doc = document, room = 0) {
  const P = LAVA.pal;
  const cv = doc.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d");
  const r = rng(41 + room * 13);
  const px = painter(c);

  // floor tiles
  for (let ty = WALL; ty < H; ty += TILE) {
    for (let tx = 0; tx < W; tx += TILE) {
      px(tx, ty, ((tx / TILE) + ((ty - WALL) / TILE)) % 2 ? P.floorB : P.floorA, TILE, TILE);
      px(tx, ty, P.grout, TILE, 1);
      px(tx, ty, P.grout, 1, TILE);

      const v = r();
      if (v < 0.09) {
        // glowing crack, hottest in the middle
        const dir = r() < 0.5 ? 1 : -1;
        let x = tx + (dir > 0 ? 2 : 9);
        let y = ty + 3;
        for (let i = 0; i < 5; i++) {
          px(x, y, i === 2 ? P.crackHot : P.crack);
          px(x, y + 1, P.crackEdge);
          if (r() < 0.7) x += dir;
          y++;
        }
      } else if (v < 0.35) {
        // ash specks
        for (let i = 0; i < 3; i++) px(tx + 2 + (r() * 8 | 0), ty + 2 + (r() * 8 | 0), P.ash);
      }
    }
  }

  // vents (gameplay): spread out, away from the spawn point, each on a different phase
  const vents = [];
  const count = W > 200 ? 5 : 4;
  for (let i = 0, tries = 0; i < count && tries < 80; tries++) {
    const v = { x: 16 + r() * (W - 32), y: WALL + 16 + r() * (H - WALL - 28), off: (i * 1.3) % LAVA.vent.cycle };
    if (Math.hypot(v.x - W / 2, v.y - H / 2) < 28) continue;
    if (vents.some(q => Math.hypot(q.x - v.x, q.y - v.y) < 36)) continue;
    vents.push(v);
    i++;
  }

  // iron grate, drawn into the floor
  for (const v of vents) {
    for (let y = -4; y <= 4; y++) {
      for (let x = -7; x <= 7; x++) {
        const d = (x / 7) ** 2 + (y / 4) ** 2;
        if (d <= 1) px(Math.round(v.x + x), Math.round(v.y + y), d > 0.6 ? P.ventRim : P.ventHole);
      }
    }
    for (let x = -4; x <= 4; x += 2) px(Math.round(v.x + x), Math.round(v.y - 2), P.ventRim, 1, 5);
  }

  // back wall: forge bricks with glowing seams
  px(0, 0, P.mortar, W, WALL);
  for (let y = 2; y < WALL - 2; y += 4) {
    for (let x = (y / 4 % 2) * 4 - 4; x < W; x += 8) {
      const v = r();
      px(x + 1, y + 1, v < 0.2 ? P.brickLo : P.brick, 7, 3);
      px(x + 1, y + 1, P.brickHi, 7, 1);
      if (v > 0.88) px(x, y + 2, P.seam, 1, 2);
    }
  }
  px(0, 0, P.wallTop, W, 2);
  px(0, 2, P.mortar, W, 1);
  px(0, WALL - 2, P.grout, W, 2);
  px(0, WALL, "#140c0d", W, 2);

  // hanging chains
  for (let x = 12; x < W; x += 30 + (r() * 20 | 0)) {
    const len = 3 + (r() * 5 | 0);
    for (let y = 0; y < len; y++) px(x + (y % 2), WALL + y, P.chain);
  }

  // brazier bowls (the fire is drawn each frame by drawLavaAmbient)
  for (const lx of lightXs(W, room)) {
    px(lx - 5, 4, P.bowl, 11, 3);
    px(lx - 4, 7, P.bowl, 9, 1);
    px(lx - 1, 8, P.bowl, 3, 4);
    px(lx - 6, 3, "#5a3634", 13, 1);
  }
  return { cv, vents };
}

// vent phase: "idle" | "warn" | "erupt"
export function ventState(v, t) {
  const { cycle, warnAt, eruptAt } = LAVA.vent;
  const k = (t + v.off) % cycle;
  return k >= eruptAt ? "erupt" : k >= warnAt ? "warn" : "idle";
}

export const inVent = (v, x, y) => ((x - v.x) / LAVA.vent.r) ** 2 + ((y - v.y) / (LAVA.vent.r * 0.6)) ** 2 < 1;

// animated: brazier fire, vents, rising embers (call every frame after bg)
export function drawLavaAmbient(ctx, W, H, WALL, now, vents, t, room = 0) {
  const P = LAVA.pal;
  const f = Math.floor(now / 110) % 3;

  for (const lx of lightXs(W, room)) {
    ctx.fillStyle = P.fireDeep;
    ctx.fillRect(lx - 4, 2, 9, 2);
    ctx.fillStyle = P.fire;
    ctx.fillRect(lx - 3, 0 - (f === 1), 7, 3);
    ctx.fillRect(lx - 1 + (f - 1), -1, 2, 1);
    ctx.fillStyle = P.fireHot;
    ctx.fillRect(lx - 1, 1, 3, 2);
  }

  for (const v of vents) {
    const state = ventState(v, t);
    const x = Math.round(v.x);
    const y = Math.round(v.y);

    // about to erupt: grate flickers, now and then an ember pops out
    if (state === "warn") {
      ctx.fillStyle = Math.floor(now / 120) % 2 ? P.crack : P.ventWarm;
      for (let k = -4; k <= 4; k += 2) ctx.fillRect(x + k + 1, y - 1, 1, 3);
      if (Math.floor(now / 90) % 3 === 0) {
        ctx.fillStyle = P.ember;
        ctx.fillRect(x + ((now / 50 | 0) % 7) - 3, y - 4, 1, 1);
      }
    }

    // erupting: orange glow on the floor and a column of fire
    if (state === "erupt") {
      ctx.fillStyle = "rgba(255,106,42,.35)";
      for (let yy = -5; yy <= 5; yy++) {
        for (let xx = -9; xx <= 9; xx++) {
          if ((xx / 9) ** 2 + (yy / 5.4) ** 2 < 1) ctx.fillRect(x + xx, y + yy, 1, 1);
        }
      }
      const height = 10 + ((now / 80 | 0) % 3) * 2;
      ctx.fillStyle = P.fireDeep;
      ctx.fillRect(x - 5, y - 3, 11, 4);
      ctx.fillStyle = P.fire;
      ctx.fillRect(x - 4, y - height + 2, 9, height);
      ctx.fillRect(x - 2 - f, y - height - 1, 2, 3);
      ctx.fillRect(x + 1 + f, y - height, 2, 3);
      ctx.fillStyle = P.fireHot;
      ctx.fillRect(x - 2, y - height + 5, 5, height - 5);
    }
  }

  // rising embers
  for (let i = 0; i < 22; i++) {
    const seed = i * 71.7;
    const speed = 10 + (i % 4) * 4;
    const y = H - ((now / 1000 * speed + seed * 5) % (H + 10));
    const x = (seed * 11 + Math.sin(now / 700 + i) * 4) % W;
    ctx.globalAlpha = 0.5 + (i % 2) * 0.3;
    ctx.fillStyle = i % 3 ? P.ember : P.fireHot;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  ctx.globalAlpha = 1;
}
