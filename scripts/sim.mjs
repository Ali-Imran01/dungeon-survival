// Balance simulation: node scripts/sim.mjs [runs] [--armor=on|off|on-1] [--mortal]
//   --nec.dmg=2 --nec.interval=0.9 (Necromancer tuning)   --asn.markMul=1.3 --asn.interval=0.34 (Assassin tuning)   --god (boss timings only)   --gun.reload=2 --gun.dmg=1.6 --gun.pellet=0.6 --gun.bomb=3 (Gunner tuning)
//   --classes=warden,ranger,mage,gunner (default)
//   difficulty: --pressure=1.5 (spawn interval ÷) --bosshp=1.3 (boss HP ×)
//   tuning: --plates=N --repair=S --first=S --reset (repair restarts on every hit)
//   --armor=off   no armour plates (old behaviour)   --armor=on-1   armour + one fewer heart per class   --mortal   skip the god-mode boss timings
// no-dependency canvas stub: the bot never looks at pixels
const ctx = new Proxy({}, { get: () => () => {} });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
const E = await import("../src/components/engine.js");
const { newGame, step, triggerAbility, fitSize, nearest, chooseUpgrade, continueEndless, ARMOR } = E;
const { CLASSES } = await import("../src/components/classes.js");
fitSize(false);
const CLS = (process.argv.find(a => a.startsWith("--classes=")) || "--classes=warden,ranger,mage,gunner,assassin,necromancer").split("=")[1].split(",");
const { GUN, ASN, NEC } = await import("../src/components/classes.js");
for (const a of process.argv) { let m = a.match(/^--gun\.(\w+)=([\d.]+)$/); if (m) GUN[m[1]] = +m[2]; m = a.match(/^--asn\.(\w+)=([\d.]+)$/); if (m) ASN[m[1]] = +m[2]; m = a.match(/^--nec.(\w+)=([\d.]+)$/); if (m) NEC[m[1]] = +m[2]; }          // e.g. --gun.reload=2 --gun.dmg=1.6
const GOD_ONLY = process.argv.includes("--god"), ENDLESS = process.argv.includes("--endless"), ROOMS = !process.argv.includes("--norooms");   // rooms are on by default in stage 1; --norooms plays the old single room;   // --endless: keep going after the Hollow Lord, report depth (loop*5 + stage)
const RUNS = +process.argv.find(a => /^\d+$/.test(a)) || 6;
const MODE = (process.argv.find(a => a.startsWith("--armor=")) || "--armor=on").split("=")[1], MORTAL_ONLY = process.argv.includes("--mortal");
const flag = (n, d) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? +a.split("=")[1] : d; };
ARMOR.plates = flag("plates", ARMOR.plates); ARMOR.repair = flag("repair", ARMOR.repair); ARMOR.firstRepair = flag("first", ARMOR.firstRepair); ARMOR.resetOnHit = process.argv.includes("--reset");
if (MODE === "off") ARMOR.plates = 0;
{ // difficulty compensation experiments: --pressure=1.5 (spawn faster) --bosshp=1.3 (boss & miniboss HP)
  const { STAGES, SPAWN_BASE } = await import("../src/components/stages.js");
  const pr = flag("pressure", 1), bh = flag("bosshp", 1);
  for (let i = 0; i < SPAWN_BASE.length; i++) SPAWN_BASE[i] /= pr;
  for (const st of STAGES) { for (const m of st.minis) if (m.hp) m.hp = Math.round(m.hp * bh); st.boss.hp = Math.round(st.boss.hp * bh); }
}
if (MODE === "on-1") for (const k in CLASSES) CLASSES[k].hp -= 1;
function bot(g) {
  const p = g.p, cx = p.x + 8, cy = p.y + 10, t = nearest(g, cx, cy, 999);
  if (g.door) return { dx: E.W - 10 - cx, dy: g.door.y - cy };                  // rooms prototype: walk to the open door
  let dx = 0, dy = 0;
  for (const b of g.eb) { const d = Math.hypot(b.x - cx, b.y - cy); if (d < 20) { dx += (cx - b.x) / d * 1.5; dy += (cy - b.y) / d * 1.5; } }
  for (const h of g.hz) if (h.owner !== "player" && h.x !== undefined) { const d = Math.hypot(h.x - cx, h.y - cy); if (d < (h.r || 10) + 8) { dx += (cx - h.x) / (d || 1) * 2; dy += (cy - h.y) / (d || 1) * 2; } }
  if (t) {
    const vx = t.x - cx, vy = t.y - cy, d = Math.hypot(vx, vy) || 1;
    if (g.cls === "warden") { if (d > 21) { dx += vx / d; dy += vy / d; } else if (d < 15) { dx -= vx / d * 0.8; dy -= vy / d * 0.8; } }   // stay just inside sword reach (~25px)
    else if (g.cls === "assassin") {                                                 // reach 16: stay close; Step in to engage, then stab
      if (d > ASN.reach - 2) { dx += vx / d; dy += vy / d; } else if (d < ASN.reach - 6) { dx -= vx / d * 0.8; dy -= vy / d * 0.8; }
      if (p.cd <= 0 && p.charges > 0 && d > 22 && d < 85) triggerAbility(g);
    }
    else if (g.cls === "gunner") { if (d > 32) { dx += vx / d; dy += vy / d; } else if (d < 16) { dx -= vx / d * 0.8; dy -= vy / d * 0.8; } }   // shotgun: stay 16-32px from the target (reach 40)
    else { const want = 60; if (d < want - 10) { dx -= vx / d; dy -= vy / d; } else if (d > want + 30) { dx += vx / d; dy += vy / d; } else { dx += -vy / d * 0.7; dy += vx / d * 0.7; } }
    if (nearest(g, cx, cy, g.cls === "necromancer" ? 80 : 16) && p.cd <= 0) triggerAbility(g);
  }
  const s = g.shards[0]; if (s && Math.hypot(s.x - cx, s.y - cy) < 60) { dx += (s.x - cx) / 60; dy += (s.y - cy) / 60; }
  const u = g.pu[0]; if (u && !g.en.some(e => Math.hypot(e.x - cx, e.y - cy) < 25)) { const d = Math.hypot(u.x - cx, u.y - cy) || 1; dx += (u.x - cx) / d * 0.8; dy += (u.y - cy) / d * 0.8; }
  const B = g.bounds; if (p.x < B.x0 + 20) dx += 0.6; if (p.x > B.x1 - 20) dx -= 0.6; if (p.y < B.y0 + 16) dy += 0.6; if (p.y > B.y1 - 16) dy -= 0.6;
  return { dx, dy };
}
function run(cls, god) {
  const g = newGame(cls, 1, { rooms: ROOMS }), bossT = {}; let bs = null, bn = null, errs = 0;
  for (let i = 0; i < 60 * (ENDLESS ? 4000 : 1500) && !g.over; i++) {
    if (g.pending) { chooseUpgrade(g, g.pending.choices[Math.random() * g.pending.choices.length | 0].id); continue; }
    if (god) { g.p.inv = 5; g.p.hp = Math.max(g.p.hp, 1); }
    step(g, 1 / 60, new Set(), bot(g));
    if (ENDLESS && !god && g.over && g.won) { g.wonOnce = true; continueEndless(g); }
    if (g.boss && !bs) { bs = g.t; bn = g.boss.def.name; } if (!g.boss && bs) { bossT[bn] = +(g.t - bs).toFixed(1); bs = null; }
  }
  return { g, bossT };
}
const avg = a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : "-";
const res = {}, bossTable = {};
for (const cls of CLS) {
  const god = [], mortal = [], stages = [], wins = [], plates = [], blasts = [], hearts = [], noArm = [], depths = [];
  for (let r = 0; r < RUNS; r++) {
    if (!MORTAL_ONLY) { const a = run(cls, true); god.push(a.g.t); for (const [k, v] of Object.entries(a.bossT)) (bossTable[k] ||= {})[cls] = [...((bossTable[k] || {})[cls] || []), v]; }
    if (GOD_ONLY) continue;
    const b = run(cls, false); mortal.push(b.g.t); stages.push(b.g.stage + b.g.phase / 3); wins.push(b.g.won || b.g.wonOnce ? 1 : 0); depths.push(b.g.loop * 5 + b.g.stage);
    plates.push(b.g.stats.plates); blasts.push(b.g.stats.blasts); hearts.push(b.g.stats.heartHits); noArm.push(b.g.stats.noArmorT / Math.max(1, b.g.t) * 100);
  }
  res[cls] = { ...(MORTAL_ONLY ? {} : { fullRunGod_s: avg(god) }), mortalSurvive_s: avg(mortal), stageReached: avg(stages), ...(ENDLESS ? { endlessDepth: avg(depths) } : {}), wins: wins.reduce((a, b) => a + b, 0) + "/" + RUNS, platesBroken: avg(plates), blasts: avg(blasts), heartHits: avg(hearts), "noArmour_%": avg(noArm) };
}
console.log(`armour mode: ${MODE}  (plates ${ARMOR.plates}, hearts ${Object.values(CLASSES).map(c => c.hp).join("/")})`);
console.table(res);
if (!MORTAL_ONLY) { const bt = {}; for (const [k, v] of Object.entries(bossTable)) bt[k] = Object.fromEntries(CLS.map(c => [c, avg(v[c] || [])])); console.log("boss fight seconds (god mode):"); console.table(bt); }
