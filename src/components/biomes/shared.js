// Helpers every biome's background builder uses.

// seeded random (mulberry32), so a stage's floor looks the same every time it's built
export function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// fillRect with a colour in one call: px(x, y, "#fff", w, h)
export function painter(ctx) {
  return (x, y, color, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
}

// where the wall lights (torches / lamps / braziers / candles) sit, as fractions of the screen width.
// One list per room (stage 1 has three rooms), each with a desktop and a Game Boy-width layout.
const LIGHTS = [
  [[0.2, 0.5, 0.8], [0.25, 0.75]],
  [[0.35, 0.65], [0.5]],
  [[0.15, 0.38, 0.62, 0.85], [0.2, 0.5, 0.8]],
];

export function lightXs(W, room = 0) {
  return LIGHTS[room][W > 200 ? 0 : 1].map(f => Math.round(W * f));
}
