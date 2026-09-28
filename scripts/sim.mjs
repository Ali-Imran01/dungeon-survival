// Balance simulation: node scripts/sim.mjs [runs]   (plays full 5-stage runs with a simple bot)
// no-dependency canvas stub: the bot never looks at pixels
const ctx = new Proxy({}, { get: () => () => {} });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
const E = await import("../src/components/engine.js");
const { newGame, step, triggerAbility, fitSize, nearest, chooseUpgrade } = E;
fitSize(false);
const RUNS = +process.argv[2] || 6;
function bot(g) {
  const p = g.p, cx = p.x + 8, cy = p.y + 10, t = nearest(g, cx, cy, 999);
  let dx = 0, dy = 0;
  for (const b of g.eb) { const d = Math.hypot(b.x - cx, b.y - cy); if (d < 20) { dx += (cx - b.x) / d * 1.5; dy += (cy - b.y) / d * 1.5; } }
  for (const h of g.hz) if (h.owner !== "player" && h.x !== undefined) { const d = Math.hypot(h.x - cx, h.y - cy); if (d < (h.r || 10) + 8) { dx += (cx - h.x) / (d || 1) * 2; dy += (cy - h.y) / (d || 1) * 2; } }
  if (t) {
    const vx = t.x - cx, vy = t.y - cy, d = Math.hypot(vx, vy) || 1;
    if (g.cls === "warden") { if (d > 12) { dx += vx / d; dy += vy / d; } }
    else { const want = 60; if (d < want - 10) { dx -= vx / d; dy -= vy / d; } else if (d > want + 30) { dx += vx / d; dy += vy / d; } else { dx += -vy / d * 0.7; dy += vx / d * 0.7; } }
    if (nearest(g, cx, cy, 16) && p.cd <= 0) triggerAbility(g);
  }
  const s = g.shards[0]; if (s && Math.hypot(s.x - cx, s.y - cy) < 60) { dx += (s.x - cx) / 60; dy += (s.y - cy) / 60; }
  const u = g.pu[0]; if (u && !g.en.some(e => Math.hypot(e.x - cx, e.y - cy) < 25)) { const d = Math.hypot(u.x - cx, u.y - cy) || 1; dx += (u.x - cx) / d * 0.8; dy += (u.y - cy) / d * 0.8; }
  const B = g.bounds; if (p.x < B.x0 + 20) dx += 0.6; if (p.x > B.x1 - 20) dx -= 0.6; if (p.y < B.y0 + 16) dy += 0.6; if (p.y > B.y1 - 16) dy -= 0.6;
  return { dx, dy };
}
function run(cls, god) {
  const g = newGame(cls), bossT = {}; let bs = null, bn = null, errs = 0;
  for (let i = 0; i < 60 * 1500 && !g.over; i++) {
    if (g.pending) { chooseUpgrade(g, g.pending.choices[Math.random() * g.pending.choices.length | 0].id); continue; }
    if (god) { g.p.inv = 5; g.p.hp = Math.max(g.p.hp, 1); }
    step(g, 1 / 60, new Set(), bot(g));
    if (g.boss && !bs) { bs = g.t; bn = g.boss.def.name; } if (!g.boss && bs) { bossT[bn] = +(g.t - bs).toFixed(1); bs = null; }
  }
  return { g, bossT };
}
const avg = a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : "-";
const res = {}, bossTable = {};
for (const cls of ["warden", "ranger", "mage"]) {
  const god = [], mortal = [], stages = [], wins = [];
  for (let r = 0; r < RUNS; r++) {
    const a = run(cls, true); god.push(a.g.t); for (const [k, v] of Object.entries(a.bossT)) (bossTable[k] ||= {})[cls] = [...((bossTable[k] || {})[cls] || []), v];
    const b = run(cls, false); mortal.push(b.g.t); stages.push(b.g.stage + b.g.phase / 3); wins.push(b.g.won ? 1 : 0);
  }
  res[cls] = { fullRunGod_s: avg(god), mortalSurvive_s: avg(mortal), mortalReach: avg(stages), wins: wins.reduce((a, b) => a + b, 0) + "/" + RUNS };
}
console.table(res);
const bt = {}; for (const [k, v] of Object.entries(bossTable)) bt[k] = { warden: avg(v.warden || []), ranger: avg(v.ranger || []), mage: avg(v.mage || []) };
console.log("boss fight seconds (god mode):"); console.table(bt);
