// Stage 1 — Dungeon. No special rule (tutorial pace).
const rng = a => () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const LIGHTS = [[[0.2, 0.5, 0.8], [0.25, 0.75]], [[0.35, 0.65], [0.5]], [[0.15, 0.38, 0.62, 0.85], [0.2, 0.5, 0.8]]];   // per room: [desktop, Game Boy]
const torchXs = (W, room = 0) => LIGHTS[room][W > 200 ? 0 : 1].map(f => Math.round(W * f));
const FLOOR = [{ a: "#241e31", b: "#211b2d", line: "#1a1524", hi: "#2b2440" }, { a: "#1c2538", b: "#192133", line: "#121a29", hi: "#26324d" }, { a: "#2a1e2c", b: "#261b28", line: "#1a1220", hi: "#3a2540" }];   // room 2 = cold blue-grey stone, room 3 = deep maroon
export const DUNGEON = { name: "Dungeon", slime: { g: "#6fcf6a", G: "#c9f59a" } };

export function buildDungeon(W, H, WALL, TILE = 12, doc = document, room = 0) {
  const cv = doc.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cv.getContext("2d"), F = FLOOR[room], r = rng(7 + room * 13), px = (x, y, col, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  for (let ty = WALL; ty < H; ty += TILE) for (let tx = 0; tx < W; tx += TILE) {
    const alt = ((tx / TILE) + ((ty - WALL) / TILE)) % 2;
    px(tx, ty, alt ? F.a : F.b, TILE, TILE);
    px(tx, ty, F.line, TILE, 1); px(tx, ty, F.line, 1, TILE); px(tx + 1, ty + 1, F.hi, 2, 1);
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
  for (const tx of torchXs(W, room)) { px(tx - 5, 3, "#4a3f5e", 10, 8); px(tx - 3, 2, "#4f4466", 6, 10); px(tx - 1, 6, "#5a4a2a", 3, 1); px(tx, 7, "#5a4a2a", 1, 3); }
  return { cv };
}
export function drawDungeonAmbient(ctx, W, H, WALL, now, room = 0) {
  const f = Math.floor(now / 140) % 3;
  for (const tx of torchXs(W, room)) {
    ctx.fillStyle = "#ff9f1c"; ctx.fillRect(tx - 1, 4 - (f === 1), 3, 2 + (f === 1));
    ctx.fillStyle = "#fff27a"; ctx.fillRect(tx + (f === 2 ? -1 : 0), 4, 1, 2);
    ctx.fillStyle = "#e0582a"; ctx.fillRect(tx - 1 + (f % 2) * 2, 3 - (f === 1), 1, 1);
  }
}
