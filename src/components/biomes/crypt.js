// Stage 4 — Flooded Crypt. Rule: shallow water slows the player to 60% (dash/roll/blink ignore it); the undead don't care.
import { rng, painter, lightXs } from "./shared.js";

export const CRYPT = {
  name: "Flooded Crypt",
  pal: {
    floorA: "#262a2c", floorB: "#2a2f30", grout: "#171a1b", moss: "#2f4a38", crack: "#1c2021", bone: "#8a8474",
    water: "#1d3a44", waterEdge: "#2a5260", waterHi: "#5f9aa8",
    brick: "#34383a", brickHi: "#454b4d", brickLo: "#2b2f30", mortar: "#1c1f20", wallTop: "#4a5052",
    niche: "#15181a", skull: "#b8b09c", candle: "#d8d2c0", flame: "#7dff9a", flameCore: "#e6ffe9", drip: "#8fc3cf",
  },
  slowMul: 0.6,
};

// pools = [{ blobs: [{x,y,r}] }] — each pool is a union of circles (ellipses squashed 0.6 in y)
export function buildCrypt(W, H, WALL, TILE = 12, doc = document, grow = 1, room = 0) {
  const P = CRYPT.pal;
  const cv = doc.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d");
  const r = rng(59 + room * 13);
  const px = painter(c);

  // floor tiles
  for (let ty = WALL; ty < H; ty += TILE) {
    for (let tx = 0; tx < W; tx += TILE) {
      px(tx, ty, ((tx / TILE) + ((ty - WALL) / TILE)) % 2 ? P.floorB : P.floorA, TILE, TILE);
      px(tx, ty, P.grout, TILE, 1);
      px(tx, ty, P.grout, 1, TILE);

      const v = r();
      if (v < 0.16) {
        // moss along the top and bottom of the tile
        for (let i = 0; i < 5; i++) {
          px(tx + 1 + (r() * 10 | 0), ty + 1 + (r() * 3 | 0) + (i > 2 ? 7 : 0), P.moss);
        }
      } else if (v < 0.24) {
        // crack
        let x = tx + 3;
        let y = ty + 2;
        for (let i = 0; i < 6; i++) {
          px(x, y, P.crack);
          x += r() < 0.6 ? 1 : 0;
          y++;
        }
      } else if (v < 0.29) {
        // stray bone
        const x = tx + 3 + (r() * 5 | 0);
        const y = ty + 5 + (r() * 3 | 0);
        px(x, y, P.bone, 4, 1);
        px(x - 1, y - 1, P.bone);
        px(x + 4, y + 1, P.bone);
      }
    }
  }

  // water pools (gameplay): each one is three overlapping blobs, kept away from the spawn point and each other
  const pools = [];
  const count = W > 200 ? 4 : 3;
  for (let i = 0, tries = 0; i < count && tries < 80; tries++) {
    const cx = 22 + r() * (W - 44);
    const cy = WALL + 20 + r() * (H - WALL - 34);
    if (Math.hypot(cx - W / 2, cy - H / 2) < 32 || pools.some(p => Math.hypot(p.blobs[0].x - cx, p.blobs[0].y - cy) < 50)) continue;
    const blobs = [];
    for (let k = 0; k < 3; k++) {
      blobs.push({ x: cx + (r() - 0.5) * 22, y: cy + (r() - 0.5) * 8, r: (10 + r() * 8) * grow });
    }
    pools.push({ blobs });
    i++;
  }

  // is (x, y) inside any pool? `pad` grows (+) or shrinks (-) the pools
  const inPool = (x, y, pad = 0) =>
    pools.some(p => p.blobs.some(b => ((x - b.x) / (b.r + pad)) ** 2 + ((y - b.y) / ((b.r + pad) * 0.6)) ** 2 < 1));

  for (let y = WALL + 2; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (inPool(x, y)) px(x, y, inPool(x, y, -2.5) ? P.water : P.waterEdge);
    }
  }
  for (const p of pools) {
    for (const b of p.blobs) {
      px(Math.round(b.x - b.r * 0.4), Math.round(b.y - 1), P.waterHi, 4, 1);
      px(Math.round(b.x + b.r * 0.2), Math.round(b.y + 2), P.waterHi, 2, 1);
    }
  }

  // back wall: crypt stone with burial niches
  px(0, 0, P.mortar, W, WALL);
  for (let y = 2; y < WALL - 2; y += 4) {
    for (let x = (y / 4 % 2) * 4 - 4; x < W; x += 8) {
      const v = r();
      px(x + 1, y + 1, v < 0.25 ? P.brickLo : P.brick, 7, 3);
      px(x + 1, y + 1, P.brickHi, 7, 1);
    }
  }
  // niches with a little skull each (skipping any that would sit under a candelabra)
  for (let x = 10; x < W - 10; x += 26 + (r() * 10 | 0)) {
    if (lightXs(W, room).some(l => Math.abs(l - x) < 10)) continue;
    px(x, 3, P.niche, 8, 7);
    px(x + 2, 6, P.skull, 3, 2);
    px(x + 2, 7, P.niche);
    px(x + 4, 7, P.niche);
  }
  px(0, 0, P.wallTop, W, 2);
  px(0, 2, P.mortar, W, 1);
  px(0, WALL - 2, P.grout, W, 2);
  px(0, WALL, "#101213", W, 2);

  // candelabras (the flames are drawn each frame by drawCryptAmbient)
  for (const lx of lightXs(W, room)) {
    px(lx - 4, 8, "#4a4450", 9, 1);
    for (const o of [-3, 0, 3]) px(lx + o, 5 + (o ? 1 : 0), P.candle, 1, 3 - (o ? 1 : 0));
  }
  return { cv, pools, inWater: (x, y) => inPool(x, y) };
}

// animated: green candle flames, drips + ripples, drifting mist
export function drawCryptAmbient(ctx, W, H, WALL, now, pools, room = 0) {
  const P = CRYPT.pal;
  const f = Math.floor(now / 130) % 3;

  for (const lx of lightXs(W, room)) {
    for (const o of [-3, 0, 3]) {
      const top = o ? 4 : 3;
      ctx.fillStyle = P.flame;
      ctx.fillRect(lx + o, top - (f === (o + 3) / 3 % 3 ? 1 : 0), 1, 2);
      ctx.fillStyle = P.flameCore;
      ctx.fillRect(lx + o, top + 1, 1, 1);
    }
  }

  // ripple rings spreading from one blob of each pool
  pools.forEach((p, i) => {
    const blob = p.blobs[i % p.blobs.length];
    const k = ((now / 1000 + i * 0.7) % 1.8) / 1.8;
    const radius = 2 + k * 8;
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = P.waterHi;
    for (let a = 0; a < 6.28; a += 0.5) {
      ctx.fillRect(Math.round(blob.x + Math.cos(a) * radius), Math.round(blob.y + Math.sin(a) * radius * 0.5), 1, 1);
    }
  });

  // water dripping from the ceiling
  ctx.globalAlpha = 1;
  ctx.fillStyle = P.drip;
  for (let i = 0; i < 6; i++) {
    const x = (i * 43 + 17) % W;
    const y = WALL + ((now / 1000 * 40 + i * 13) % 30);
    ctx.fillRect(x, Math.round(y), 1, 2);
  }

  // three slow bands of mist
  ctx.fillStyle = "#c8dcdc";
  for (let i = 0; i < 3; i++) {
    const y = WALL + 20 + i * 35;
    const x = ((now / 1000 * (6 + i * 2) + i * 80) % (W + 60)) - 60;
    for (let k = 0; k < 4; k++) {
      ctx.globalAlpha = 0.07 - Math.abs(k - 1.5) * 0.02;
      ctx.fillRect(Math.round(x) + Math.abs(k - 1.5) * 8, y + k, 60 - Math.abs(k - 1.5) * 16, 1);
    }
  }
  ctx.globalAlpha = 1;
}
