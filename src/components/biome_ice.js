// Stage 2 — Ice Cave. Rule: slick ice patches make you slide.
const rng = a => () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
export const ICE = {
  name: "Ice Cave",
  pal: { floorA:"#1e2b44", floorB:"#223150", grout:"#172238", speck:"#3a5078", crack:"#5d7fa8",
         slick:"#34628e", slickEdge:"#2a4f76", shine:"#8fd3ff", wallTop:"#7fb0dd", brick:"#4a6f9e", brickHi:"#6a92c2", brickLo:"#3d5d86", mortar:"#2a3f63",
         icicle:"#b8e3ff", icicleLo:"#7fb0dd", crystal:"#5ef2ff", crystalCore:"#e8ffff", glow:"#2e4f7a", snow:"#e8f4ff" },
  slime: { g:"#7fc8e8", G:"#d8f3ff" },
};
const lightXs = W => W > 200 ? [Math.round(W * 0.2), Math.round(W / 2), Math.round(W * 0.8)] : [Math.round(W * 0.25), Math.round(W * 0.75)];

// returns { cv, patches } ; patches = [{x, y, rx, ry}] used by the slide rule
export function buildIce(W, H, WALL, TILE = 12, doc = document) {
  const P = ICE.pal, cv = doc.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cv.getContext("2d"), r = rng(23), px = (x, y, col, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  // floor tiles
  for (let ty = WALL; ty < H; ty += TILE) for (let tx = 0; tx < W; tx += TILE) {
    px(tx, ty, ((tx / TILE) + ((ty - WALL) / TILE)) % 2 ? P.floorB : P.floorA, TILE, TILE);
    px(tx, ty, P.grout, TILE, 1); px(tx, ty, P.grout, 1, TILE);
    const v = r();
    if (v < 0.1) { const dir = r() < 0.5 ? 1 : -1; let x = tx + (dir > 0 ? 2 : 9), y = ty + 3; for (let i = 0; i < 5; i++) { px(x, y, P.crack); if (r() < 0.7) x += dir; y++; } }       // light ice cracks
    else if (v < 0.34) for (let i = 0; i < 3; i++) px(tx + 2 + (r() * 8 | 0), ty + 2 + (r() * 8 | 0), P.speck);                                          // frost specks
    else if (v < 0.4) { const x = tx + 3 + (r() * 5 | 0), y = ty + 5; px(x, y, P.crystal); px(x + 1, y - 1, P.crystalCore); px(x + 2, y, P.crystal); px(x, y + 1, P.grout, 3, 1); } // tiny floor crystal
  }
  // slick ice patches (gameplay)
  const patches = [], n = W > 200 ? 5 : 4;
  for (let i = 0, tries = 0; i < n && tries < 60; tries++) {
    const p = { x: 18 + r() * (W - 36), y: WALL + 16 + r() * (H - WALL - 30), rx: 14 + r() * 12, ry: 7 + r() * 5 };
    if (Math.hypot(p.x - W / 2, p.y - H / 2) < 26) continue;                                 // keep spawn area clear
    if (patches.some(q => Math.hypot(q.x - p.x, q.y - p.y) < q.rx + p.rx)) continue;
    patches.push(p); i++;
  }
  for (const p of patches) {
    for (let y = -p.ry; y <= p.ry; y++) for (let x = -p.rx; x <= p.rx; x++) {
      const d = (x / p.rx) ** 2 + (y / p.ry) ** 2; if (d > 1) continue;
      px(Math.round(p.x + x), Math.round(p.y + y), d > 0.8 ? P.slickEdge : P.slick);
    }
    for (let k = 0; k < 3; k++) { const sx = Math.round(p.x - p.rx * 0.5 + k * p.rx * 0.35), sy = Math.round(p.y - p.ry * 0.3 + k * 2); px(sx, sy, P.shine, 3, 1); px(sx + 3, sy - 1, P.shine); }
  }
  // back wall: ice bricks
  px(0, 0, P.mortar, W, WALL);
  for (let y = 2; y < WALL - 2; y += 4) for (let x = (y / 4 % 2) * 4 - 4; x < W; x += 8) {
    const v = r(); px(x + 1, y + 1, v < 0.2 ? P.brickLo : P.brick, 7, 3); px(x + 1, y + 1, P.brickHi, 7, 1); if (v > 0.85) px(x + 3, y + 2, P.icicle);
  }
  px(0, 0, P.wallTop, W, 2); px(0, 2, P.mortar, W, 1); px(0, WALL - 2, P.grout, W, 2); px(0, WALL, "#141d30", W, 2);
  // icicles hanging over the floor edge
  for (let x = 1; x < W; x += 2 + (r() * 4 | 0)) { const len = 1 + (r() * 4 | 0); px(x, WALL, P.icicleLo, 1, len); px(x, WALL, P.icicle, 1, Math.max(1, len - 1)); }
  // crystal lamp sockets
  for (const lx of lightXs(W)) { px(lx - 5, 3, P.glow, 10, 8); px(lx - 3, 2, "#3a6190", 6, 10); }
  return { cv, patches };
}

// animated: crystal lamps + drifting snow (call every frame after bg)
export function drawIceAmbient(ctx, W, H, WALL, now) {
  const P = ICE.pal, f = Math.floor(now / 180) % 4;
  for (const lx of lightXs(W)) {
    ctx.fillStyle = P.crystal; ctx.fillRect(lx - 2, 5, 1, 3); ctx.fillRect(lx, 3, 1, 5); ctx.fillRect(lx + 2, 4, 1, 4);
    ctx.fillStyle = P.crystalCore; ctx.fillRect(lx, 4 + (f % 2), 1, 1);
    if (f === 0) { ctx.fillRect(lx - 3, 3, 1, 1); ctx.fillRect(lx + 3, 2, 1, 1); }
  }
  ctx.fillStyle = P.snow;
  for (let i = 0; i < 26; i++) {
    const seed = i * 97.13, speed = 8 + (i % 5) * 3, y = (now / 1000 * speed + seed * 7) % (H + 10) - 5;
    const x = (seed * 13 + Math.sin(now / 900 + i) * 6) % W;
    ctx.globalAlpha = 0.35 + (i % 3) * 0.2; ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  ctx.globalAlpha = 1;
}

export const onIce = (patches, x, y) => patches.some(p => ((x - p.x) / p.rx) ** 2 + ((y - p.y) / p.ry) ** 2 < 1);
