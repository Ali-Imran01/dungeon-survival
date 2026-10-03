// Stage 5 — The Void. Rule: darkness. You only see a circle around you (and around light sources).
// Enemy eyes and all projectiles are drawn ABOVE the darkness so threats are always readable.
import { rng, painter } from "./shared.js";

export const VOID = {
  name: "The Void",
  pal: {
    floorA: "#140f22", floorB: "#17112a", grout: "#0b0814", rune: "#3b2a66", runeHot: "#8a6fd1",
    star: "#e8e4f5", starDim: "#6b5a9a", sky: "#07050e", rock: "#1c1530", rockHi: "#2e2350",
    edge: "#2e1d52", dark: "rgba(5,3,10,0.94)",
  },
  vision: { player: 52, playerGB: 44, eclipse: 36, eye: 30, companion: 14, bullet: 0 },
};

export function buildVoid(W, H, WALL, TILE = 12, doc = document, room = 0) {
  const P = VOID.pal;
  const cv = doc.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d");
  const r = rng(77 + room * 13);
  const px = painter(c);

  // abyss background everywhere first
  px(0, 0, P.sky, W, H);
  for (let i = 0; i < W * H / 90; i++) {
    px(r() * W | 0, r() * H | 0, r() < 0.2 ? P.star : P.starDim);
  }

  // floating platform tiles; outer ring crumbles into the void
  for (let ty = WALL; ty < H; ty += TILE) {
    for (let tx = 0; tx < W; tx += TILE) {
      const onEdge = tx < TILE || tx >= W - TILE || ty >= H - TILE;
      const v = r();
      if (onEdge && v < 0.45) {
        // missing tile, sometimes with floating debris where it used to be
        if (v < 0.2) {
          px(tx + 3, ty + 4, P.rock, 5, 3);
          px(tx + 3, ty + 4, P.rockHi, 5, 1);
        }
        continue;
      }
      px(tx, ty, ((tx / TILE) + ((ty - WALL) / TILE)) % 2 ? P.floorB : P.floorA, TILE, TILE);
      px(tx, ty, P.grout, TILE, 1);
      px(tx, ty, P.grout, 1, TILE);
      if (v > 0.8) {
        // faint rune cross
        px(tx + 3, ty + 6, P.rune, 6, 1);
        px(tx + 6, ty + 3, P.rune, 1, 6);
      } else if (v > 0.72) {
        // rune square
        px(tx + 4, ty + 4, P.rune, 4, 1);
        px(tx + 4, ty + 7, P.rune, 4, 1);
        px(tx + 4, ty + 4, P.rune, 1, 4);
        px(tx + 7, ty + 4, P.rune, 1, 4);
      }
    }
  }

  // central sigil (arena marker): outer ring, inner ring and 8 spokes between them
  const cx = W / 2;
  const cy = (H + WALL) / 2 + 2;
  const radius = Math.min(W, H - WALL) * 0.3;
  for (let a = 0; a < 6.283; a += 0.07) {
    px(Math.round(cx + Math.cos(a) * radius), Math.round(cy + Math.sin(a) * radius * 0.6), P.rune);
  }
  for (let a = 0; a < 6.283; a += 0.1) {
    px(Math.round(cx + Math.cos(a) * radius * 0.55), Math.round(cy + Math.sin(a) * radius * 0.33), P.rune);
  }
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * 6.283;
    for (let t = 0.62; t <= 0.92; t += 0.06) {
      px(Math.round(cx + Math.cos(a) * radius * t), Math.round(cy + Math.sin(a) * radius * 0.6 * t), P.rune);
    }
  }

  // top band: platform edge over the abyss with floating rocks (replaces the wall)
  for (let x = 6; x < W; x += 18 + (r() * 16 | 0)) {
    const y = 2 + (r() * 6 | 0);
    const w = 4 + (r() * 6 | 0);
    px(x, y, P.rock, w, 3);
    px(x, y, P.rockHi, w, 1);
    px(x + 1, y + 3, P.rock, w - 2, 1);
  }
  px(0, WALL - 1, P.edge, W, 1);
  px(0, WALL, P.grout, W, 2);
  return { cv };
}

// animated: pulsing rune sigil + twinkling stars (under darkness)
export function drawVoidAmbient(ctx, W, H, WALL, now) {
  const P = VOID.pal;
  const cx = W / 2;
  const cy = (H + WALL) / 2 + 2;
  const radius = Math.min(W, H - WALL) * 0.3;
  const k = (now / 60 | 0) % 90;

  // six bright runes travelling around the sigil
  ctx.fillStyle = P.runeHot;
  for (let i = 0; i < 6; i++) {
    const a = (k + i * 15) / 90 * 6.283;
    ctx.fillRect(Math.round(cx + Math.cos(a) * radius), Math.round(cy + Math.sin(a) * radius * 0.6), 1, 1);
  }

  // stars in the top band take turns twinkling
  for (let i = 0; i < 8; i++) {
    if (((now / 400 | 0) + i) % 5) continue;
    ctx.fillStyle = P.star;
    ctx.fillRect((i * 67 + 11) % W, (i * 23) % WALL, 1, 1);
  }
}

// Darkness layer. lights = [{x, y, r}]. Stepped (pixel) falloff. Call AFTER world, BEFORE eyes/projectiles/HUD.
let darkCanvas = null;

export function drawDarkness(ctx, W, H, lights, doc = document) {
  if (!darkCanvas || darkCanvas.width !== W || darkCanvas.height !== H) {
    darkCanvas = doc.createElement("canvas");
    darkCanvas.width = W;
    darkCanvas.height = H;
  }
  const d = darkCanvas.getContext("2d");

  // fill everything with darkness...
  d.globalCompositeOperation = "source-over";
  d.clearRect(0, 0, W, H);
  d.fillStyle = VOID.pal.dark;
  d.fillRect(0, 0, W, H);

  // ...then punch each light out as three nested discs (stepped falloff, brighter towards the middle)
  d.globalCompositeOperation = "destination-out";
  for (const light of lights) {
    for (const [scale, alpha] of [[1, 0.35], [0.82, 0.65], [0.64, 1]]) {
      const R = light.r * scale;
      d.fillStyle = `rgba(0,0,0,${alpha})`;
      for (let y = -R; y <= R; y++) {
        const halfWidth = Math.round(Math.sqrt(R * R - y * y));
        d.fillRect(Math.round(light.x - halfWidth), Math.round(light.y + y), halfWidth * 2, 1);
      }
    }
  }
  ctx.drawImage(darkCanvas, 0, 0);
}
