// Class configs: stats, auto-attack and ability. Upgrades arrive via g.mods (see upgrades.js computeMods).
import { sfx } from "./audio.js";
import { lv } from "./powerups.js";
import { atkInterval } from "./upgrades.js";
import { nearest, fireShot, meleeHit, burst, clamp, addHz, dealDmg, pc, after, alive, center, ARMOR } from "./engine.js";

// Gunner tuning (mutable so the balance sim can sweep it: --gun.reload=2 ...)
export const GUN = { range: 40, pellets: 4, spread: 0.12, pelletSpeed: 240, dmg: 2, interval: 1.0, reload: 2.6, deadInterval: 0.45, deadBoss: 3, bottomless: 0.15, bomb: 3, bombCd: 6 };   // tuned with the sim: total boss time 197 s (Ranger 174, Warden 243, Mage 319)

// Assassin tuning (mutable so the balance sim can sweep it: --asn.markMul=1.3 ...)
export const ASN = { stab: 1, interval: 0.34, reach: 16, arc: 90, ambushMul: 3, ambushArc: 120, stun: 0.5, markMul: 1.5, markT: 4, catCd: 6, stepCd: 3.5, range: 90, knock: 2, knockAmb: 6 };

// Where Shadow Step would land: just behind the nearest target (null when nothing is in range).
// Also drives the red landing-bracket reticle (drawReticle in engine.js) — the same function computes both the
// preview and the actual teleport target, so the preview can't ever lie about where you'll land.
export function stepLanding(g) {
  const [cx, cy] = pc(g), B = g.bounds, t = nearest(g, cx, cy, ASN.range); if (!t) return null;
  const dx = t.x - cx, dy = t.y - cy, d = Math.hypot(dx, dy) || 1, r = t.ref === g.boss ? g.boss.w / 2 : (t.ref.w + t.ref.h) / 4;
  return { nx: clamp(t.x + dx / d * (r + 9), B.x0 + 8, B.x1 + 8), ny: clamp(t.y + dy / d * (r + 9), B.y0 + 10, B.y1 + 10), t };
}
const stepCd = g => ASN.stepCd * g.mods.cd / (1 + 2 * lv(g, "phantom"));
const rushRate = g => 1 + 0.25 * (g.rush.t > 0 ? g.rush.n : 0);

// Chronomancer tuning (mutable so the balance sim can sweep it: --chr.dmg=1.5 ...)
// sim-tuned: dmg 2 kills 2-HP enemies in one hit; pierce 1 is needed against magma/cinder swarms; boss total ~203 s (Ranger 174, Gunner 197, Assassin 198, Warden 243, Mage 319)
export const CHR = { dmg: 2, interval: 1.0, speed: 150, pierce: 1, range: 110, echoDelay: 0.7, rewind: 2, bubbleCd: 8, bubbleR: 24, bubbleT: 3, bubbleSlow: 0.4, bulletSlow: 0.3 };
// Where Rewind would take you: the recorded position ~2 s ago (null until enough history exists)
export function rewindPoint(g) {
  const target = g.t - CHR.rewind; let e = null;
  for (const h of g.hist) { if (h.t <= target) e = h; else break; }
  return e;
}

export const CLASSES = {
  warden: {
    name: "Warden", role: "Melee tank", abilityName: "Dash", color: "#9b7fd9",
    desc: "A knight in shining armour who fights up close. His great sword sweeps a wide arc toward the nearest enemy, and his wisp shoots from range.",
    stats: { HP: 4, DMG: 3, RANGE: 1, SPEED: 3 },
    hp: 4, speed: 62, abilityCd: 1.2, companion: "wisp", companionName: "Wisp", pus: ["frenzy", "surge"],
    attack(g, cx, cy) {
      const p = g.p, m = g.mods, fr = lv(g, "frenzy"), reach = 24 + 6 * fr + m.reach;      // reach: hero centre → target edge
      if (p.atk > 0) {
        if (!p.hitDone && p.atk <= 0.11) {                                                 // mid-slash
          p.hitDone = true; p.swings++;
          meleeHit(g, p.swing.reach, 2, p.swing.spin);
        }
        return;
      }
      if (p.acd > 0) return;
      const t = nearest(g, cx, cy, reach + 4); if (!t) return;                            // start early: windup lets enemies step in
      const a = Math.atan2(t.y - cy, t.x - cx), spin = !!m.spinEvery && (p.swings + 1) % m.spinEvery === 0;
      sfx("swing"); p.atk = 0.26; p.acd = atkInterval(0.7, 1 + 0.4 * fr, m); p.hitDone = false;
      p.face = Math.sign(t.x - cx) || p.face; p.swingA = a;
      p.swing = { a, dir: p.swings % 2 ? 1 : -1, arc: (110 + m.arc) * Math.PI / 180, reach: spin ? reach + 4 : reach, spin, fr: fr > 0 };   // alternating slash direction
    },
    ability(g, dir) {
      const p = g.p; sfx("dash");
      p.dash = 0.15; p.dashV = dir || [p.face, 0]; p.dashSp = 190; p.inv = Math.max(p.inv, 0.35);
    },
  },

  ranger: {
    name: "Ranger", role: "Ranged DPS", abilityName: "Roll", color: "#6fcf6a",
    desc: "Survives by staying away. Fast arrows, and a hawk that swoops at enemies who get too close.",
    stats: { HP: 3, DMG: 3, RANGE: 5, SPEED: 5 },
    hp: 3, speed: 78, abilityCd: 1.2, companion: "hawk", companionName: "Hawk", pus: ["multishot", "pierce"],
    attack(g, cx, cy) {
      const p = g.p, m = g.mods; if (p.acd > 0) return;
      const t = nearest(g, cx, cy - 2, 120 * m.range); if (!t) return;
      volley(g, cx, cy - 2, Math.atan2(t.y - (cy - 2), t.x - cx));
      sfx("arrow"); p.atk = 0.16; p.acd = atkInterval(0.28, 1, m); p.face = Math.sign(t.x - cx) || p.face;
    },
    ability(g, dir) {
      const p = g.p, v = dir || [-p.face, 0], cx = p.x + 8, cy = p.y + 8;
      sfx("roll"); p.dash = 0.2; p.dashV = v; p.dashSp = 170; p.inv = Math.max(p.inv, 0.3);
      if (g.mods.rollTrap) addHz(g, { k: "trap", owner: "player", x: cx, y: cy + 4, r: 8, dur: 5, dmg: g.mods.rollTrap, hit: new Set() });
      const back = Math.atan2(-v[1], -v[0]);
      const t = nearest(g, cx, cy, 140, a => Math.abs(Math.atan2(Math.sin(a - back), Math.cos(a - back))) < Math.PI / 4);
      arrow(g, cx, cy, t ? Math.atan2(t.y - cy, t.x - cx) : back, 1);
    },
  },

  mage: {
    name: "Mage", role: "AoE control", abilityName: "Blink", color: "#5577d9",
    desc: "Survives by controlling the field. Splashing orbs, and a familiar that blocks bullets.",
    stats: { HP: 3, DMG: 3, RANGE: 4, SPEED: 2 },
    hp: 3, speed: 53, abilityCd: 2.0, companion: "familiar", companionName: "Familiar", pus: ["overload", "nova"],
    attack(g, cx, cy) {
      const p = g.p, m = g.mods; if (p.acd > 0) return;
      const t = nearest(g, cx, cy - 4, 125); if (!t) return;
      const ov = lv(g, "overload"), sx = cx + p.face * 5, sy = cy - 10;
      fireShot(g, { kind: "orb", x: sx, y: sy, a: Math.atan2(t.y - sy, t.x - sx), sp: 130, dmg: 2, tgt: t.ref, splash: 16 * (1 + 0.5 * ov) * m.splash, split: m.split, l: 1.2 });
      sfx("cast"); p.atk = 0.22; p.acd = atkInterval(0.7, 1 + 0.33 * ov, m); p.face = Math.sign(t.x - cx) || p.face;
    },
    ability(g, dir) {
      const p = g.p, B = g.bounds, cx = p.x + 8, cy = p.y + 10;
      let v = dir;
      if (!v) { const t = nearest(g, cx, cy, 200); if (t) { const d = Math.hypot(cx - t.x, cy - t.y) || 1; v = [(cx - t.x) / d, (cy - t.y) / d]; } else v = [p.face, 0]; }
      burst(g, cx, cy - 4, 12, "#5577d9");
      if (g.mods.blinkField) addHz(g, { k: "frost", owner: "player", x: cx, y: cy + 3, r: 20, dur: g.mods.blinkField });
      for (const dist of [36, 28, 20, 12]) {
        const nx = clamp(p.x + v[0] * dist, B.x0, B.x1), ny = clamp(p.y + v[1] * dist, B.y0, B.y1);
        const blocked = g.en.some(e => !e.harmless && Math.hypot(e.x + e.w / 2 - (nx + 8), e.y + e.h / 2 - (ny + 10)) < 9) || (g.boss && Math.hypot(g.boss.x + g.boss.w / 2 - (nx + 8), g.boss.y + g.boss.h / 2 - (ny + 10)) < g.boss.w / 2 + 4);
        if (!blocked) { p.x = nx; p.y = ny; break; }
      }
      burst(g, p.x + 8, p.y + 6, 12, "#b9d0ff"); sfx("blink"); p.inv = Math.max(p.inv, 0.25);
    },
  },

  gunner: {
    name: "Gunner", role: "Ranged burst", abilityName: "Recoil", color: "#e0913a",
    desc: "Blasts a 4-pellet shotgun spread at anything within 40px, then reloads. Recoil Jump blasts enemies, launches him away and reloads. His Bomb Buddy blows up crowds.",
    stats: { HP: 3, DMG: 4, RANGE: 1, SPEED: 2 },
    hp: 3, speed: 60, abilityCd: 3.5, mag: 6, companion: "bomb", companionName: "Bomb Buddy", pus: ["bottomless", "buckshot"],
    attack(g, cx, cy) {
      // Shotgun: 4 pellets that only reach GUN.range (40px). Deadshot power-up (key "buckshot"): one-hit-kill bullet, whole-screen range, no ammo use.
      const p = g.p, m = g.mods, bl = lv(g, "bottomless"), dead = lv(g, "buckshot") > 0, mag = 6 + m.mag;
      if (p.reloading && !dead) { if (p.reload > 0) return; p.reloading = false; p.ammo = mag; sfx("reload"); }
      if (p.ammo <= 0 && !bl && !dead) { p.reload = GUN.reload; p.reloading = true; sfx("reload"); return; }
      if (p.acd > 0) return;
      const t = nearest(g, cx, cy - 2, dead ? 999 : GUN.range); if (!t) return;
      const a = Math.atan2(t.y - (cy - 2), t.x - cx), sx = cx + Math.cos(a) * 11, sy = cy - 2 + Math.sin(a) * 11, last = p.ammo === 1 && m.deadEye && !bl;
      if (dead) fireShot(g, { kind: "dead", x: sx, y: sy, a, sp: 320, dmg: 1, kill: true, pierce: 0, l: 1 });
      else if (last) fireShot(g, { kind: "heavy", x: sx, y: sy, a, sp: 270, dmg: GUN.dmg * GUN.pellets, pierce: 99, l: 0.2 });
      else for (let i = 0; i < GUN.pellets; i++) fireShot(g, { kind: "pellet", x: sx, y: sy, a: a + (i - (GUN.pellets - 1) / 2) * GUN.spread + (Math.random() - 0.5) * 0.04, sp: GUN.pelletSpeed, dmg: GUN.dmg, pierce: 0, l: GUN.range / GUN.pelletSpeed + 0.02 });
      if (!bl && !dead) p.ammo--;
      sfx("gun"); p.atk = 0.12; p.aimA = a; p.aimT = 0.6; p.face = Math.sign(t.x - cx) || p.face; p.acd = atkInterval(dead ? GUN.deadInterval : GUN.interval, 1 + GUN.bottomless * bl, m);
    },
    ability(g, dir) {
      const p = g.p, m = g.mods, [cx, cy] = pc(g), t = nearest(g, cx, cy, 90);
      const a = t ? Math.atan2(t.y - cy, t.x - cx) : dir ? Math.atan2(-dir[1], -dir[0]) : (p.face > 0 ? Math.PI : 0);      // shell direction; the jump goes the opposite way
      const half = (m.shell ? 45 : 30) * Math.PI / 180, dmg = 2 + m.shell, angD = (ex, ey) => Math.abs(Math.atan2(Math.sin(Math.atan2(ey, ex) - a), Math.cos(Math.atan2(ey, ex) - a)));
      const inCone = (ex, ey, r) => { const d = Math.hypot(ex, ey) || 1; return d - r < 45 && angD(ex, ey) < half + Math.atan2(r, d); };
      for (const e of [...g.en]) {
        if (e.hp <= 0 || e.rise > 0 || e.harmless) continue;
        const ex = e.x + e.w / 2 - cx, ey = e.y + e.h / 2 - cy;
        if (inCone(ex, ey, (e.w + e.h) / 4)) { dealDmg(g, e, dmg); if (!e.fixed) { const d = Math.hypot(ex, ey) || 1; e.x += ex / d * 14; e.y += ey / d * 14; } }
      }
      const b = g.boss; if (b && b.mode !== "enter" && inCone(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy, b.w / 2)) dealDmg(g, b, dmg);
      for (let i = 0; i < 16; i++) { const r = 8 + Math.random() * 36, da = (Math.random() - 0.5) * half * 2; g.parts.push({ x: cx + Math.cos(a + da) * r, y: cy + Math.sin(a + da) * r, vx: Math.cos(a + da) * 60, vy: Math.sin(a + da) * 60, l: 0.25, c: i % 2 ? "#ffd166" : "#ff8a2a" }); }
      p.dash = 0.14; p.dashV = [-Math.cos(a), -Math.sin(a)]; p.dashSp = 300; p.inv = Math.max(p.inv, 0.25);                    // launched 42 px backward
      p.reloading = false; p.reload = 0; p.ammo = 6 + m.mag;                                                              // instant reload
      p.aimA = a; p.aimT = 0.4; p.atk = 0.12; p.face = Math.cos(a) >= 0 ? 1 : -1; sfx("recoil");
    },
  },

  assassin: {
    name: "Assassin", role: "Melee burst", abilityName: "Step", color: "#d9433a",
    desc: "Blinks behind a target for a x3 Ambush, then stabs away with twin daggers. His Shade Cat marks targets for extra damage.",
    stats: { HP: 3, DMG: 4, RANGE: 1, SPEED: 4 },
    hp: 3, speed: 74, abilityCd: 3.5, companion: "cat", companionName: "Shade Cat", pus: ["phantom", "bloodrush"],
    attack(g, cx, cy) {
      const p = g.p, m = g.mods, reach = ASN.reach;
      if (p.atk > 0) {
        if (!p.hitDone && p.atk <= p.hitAt) {
          p.hitDone = true; p.swings++;
          const w = p.swing;
          meleeHit(g, w.reach, w.dmg, false, w.ambush ? ASN.ambushArc : ASN.arc, { stun: w.ambush ? ASN.stun : 0, knock: w.ambush ? ASN.knockAmb : ASN.knock });
          if (w.ambush) { p.ambush = 0; burst(g, cx, cy - 2, 14, "#ff4a5a", 120); }
        }
        return;
      }
      if (p.acd > 0) return;
      const amb = p.ambush > 0, t = nearest(g, cx, cy, reach + (amb ? 8 : 3)); if (!t) return;
      const a = Math.atan2(t.y - cy, t.x - cx);
      sfx(amb ? "ambush" : "stab"); p.atk = amb ? 0.24 : 0.16; p.hitAt = amb ? 0.14 : 0.10; p.hitDone = false;
      p.acd = amb ? 0.25 : atkInterval(ASN.interval, rushRate(g), m);
      p.face = Math.sign(t.x - cx) || p.face; p.swingA = a;
      p.swing = { a, ambush: amb, reach: amb ? reach + 4 : reach, dmg: amb ? ASN.stab * (ASN.ambushMul + 0.5 * m.sharp) : ASN.stab, hand: p.swings % 2 };
    },
    // Shadow Step: teleports to stepLanding() (just behind the nearest target) or a blind 40px blink if nothing's
    // in range. Landing near a target arms the Ambush window (p.ambush — the next stab within 2s is x3 dmg, see
    // the p.swing.ambush branch in attack() above). Charges work like a rechargeable magazine, not independent
    // per-charge timers — see tick() below, which only starts counting down once you drop below max charges.
    ability(g) {
      const p = g.p, m = g.mods, [cx, cy] = pc(g), L = stepLanding(g), B = g.bounds, max = m.charges;
      let nx, ny;
      if (L) { nx = L.nx; ny = L.ny; } else { const v = p.dir || [p.face, 0]; nx = cx + v[0] * 40; ny = cy + v[1] * 40; }
      for (let i = 0; i < 10; i++) g.parts.push({ x: cx + (Math.random() - 0.5) * 8, y: cy + (Math.random() - 0.5) * 12, vx: (Math.random() - 0.5) * 50, vy: -Math.random() * 30, l: 0.4, c: i % 2 ? "#3a3f52" : "#d9433a" });
      if (m.decoy) g.decoy = { x: cx, y: cy, t: 2 };
      p.x = clamp(nx - 8, B.x0, B.x1); p.y = clamp(ny - 10, B.y0, B.y1); p.vx = 0; p.vy = 0; p.dash = 0;
      for (let i = 0; i < 10; i++) g.parts.push({ x: p.x + 8 + (Math.random() - 0.5) * 8, y: p.y + 10 + (Math.random() - 0.5) * 12, vx: (Math.random() - 0.5) * 50, vy: -Math.random() * 30, l: 0.4, c: i % 2 ? "#3a3f52" : "#ff4a5a" });
      p.inv = Math.max(p.inv, 0.3); p.atk = 0; p.hitDone = true; p.acd = 0; sfx("step");
      if (L) { p.face = Math.sign(L.t.x - (p.x + 8)) || p.face; p.ambush = 2; }                // ambush window: the next stab is a x3 Ambush
      if (p.charges >= max) p.chT = stepCd(g);
      p.charges--;
      return p.charges > 0 ? 0.35 : Math.max(0.35, p.chT);                                      // cooldown handed back to the engine
    },
    tick(g, dt) {                                                                              // recharge Shadow Step charges
      const p = g.p, max = g.mods.charges;
      if (p.charges < max) { p.chT -= dt; if (p.chT <= 0) { p.charges++; p.chT = p.charges < max ? stepCd(g) : 0; } }
    },
    onKill(g) {
      const p = g.p, m = g.mods;
      if (lv(g, "bloodrush")) { g.rush.n = Math.min(4, g.rush.n + 1); g.rush.t = 2; }          // Bloodrush: stacking speed on kills
      if (m.exec) { p.cd = Math.max(0, p.cd - 1.5); if (p.charges < m.charges) p.chT = Math.max(0.01, p.chT - 1.5); }   // Executioner
    },
  },

  chronomancer: {
    name: "Chronomancer", role: "Time control", abilityName: "Rewind", color: "#4ab3ba",
    desc: "Time bolts pierce, then echo again from where he stood. His Sandling drops stasis bubbles that slow enemies and bullets. Rewind undoes the last 2 seconds.",
    stats: { HP: 3, DMG: 3, RANGE: 4, SPEED: 3 },
    hp: 3, speed: 58, abilityCd: 8, companion: "sandling", companionName: "Sandling", pus: ["slowmo", "overclock"],
    attack(g, cx, cy) {
      const p = g.p, m = g.mods, oc = lv(g, "overclock"); if (p.acd > 0) return;
      const t = nearest(g, cx, cy - 4, CHR.range); if (!t) return;
      const ox = cx, oy = cy - 8, a = Math.atan2(t.y - oy, t.x - ox), bolt = (mult, ang) => fireShot(g, { kind: "chrono", x: ox, y: oy, a: ang, sp: CHR.speed, dmg: CHR.dmg * mult, pierce: CHR.pierce, l: 0.9 });
      bolt(1, a); sfx("cast");
      after(g, CHR.echoDelay * (oc ? 0.5 : 1), () => {                                          // the echo: same shot, same direction, from where he was standing
        if (g.over) return;
        const tc = alive(g, t.ref) ? center(g, t.ref) : null;                                      // the echo re-aims at the same target if it is still alive
        bolt(1 + 0.25 * m.echo, tc ? Math.atan2(tc[1] - oy, tc[0] - ox) : a); sfx("echo"); burst(g, ox, oy, 5, "#9fe8ee", 40); g.rings.push({ x: ox, y: oy, r: 2, max: 8, l: 0.15 });
      });
      p.atk = 0.2; p.acd = atkInterval(CHR.interval, 1 + 0.4 * oc, m); p.face = Math.sign(t.x - cx) || p.face;
    },
    // Rewind: jumps to the position recorded ~2s ago (rewindPoint(), reading g.hist — pushed every frame in
    // engine.js step()). If that historical snapshot shows MORE armour plates than you currently have, the
    // difference is restored too (below) — Rewind can undo a plate break, not just movement. g.hist is reset to
    // a single fresh entry at the end of this function, so you can't chain-rewind through the same window twice.
    ability(g) {
      const p = g.p, m = g.mods, A = g.armor, e = rewindPoint(g) || g.hist[0], B = g.bounds; if (!e) return 1;
      for (let i = 0; i < 10; i++) g.parts.push({ x: p.x + 8 + (Math.random() - 0.5) * 10, y: p.y + 10 + (Math.random() - 0.5) * 12, vx: (Math.random() - 0.5) * 40, vy: -Math.random() * 30, l: 0.45, c: i % 2 ? "#4ab3ba" : "#ffd166" });
      p.x = clamp(e.x, B.x0, B.x1); p.y = clamp(e.y, B.y0, B.y1); p.vx = 0; p.vy = 0; p.dash = 0; p.atk = 0;
      if (e.n > A.n) { A.n = Math.min(A.max, e.n); A.t = A.n >= A.max ? 0 : Math.max(A.t, ARMOR.repair); burst(g, p.x + 8, p.y + 6, 10, "#e4eaf6", 70); }    // plates lost in the window come back
      for (let i = 0; i < 10; i++) g.parts.push({ x: p.x + 8 + (Math.random() - 0.5) * 10, y: p.y + 10 + (Math.random() - 0.5) * 12, vx: (Math.random() - 0.5) * 40, vy: -Math.random() * 30, l: 0.45, c: i % 2 ? "#4ab3ba" : "#e0b93a" });
      p.inv = Math.max(p.inv, m.rewindShield ? 1.5 : 0.3); sfx("rewind");
      g.hist.length = 0; g.hist.push({ t: g.t, x: p.x, y: p.y, n: A.n });
    },
  },
};

// display / unlock order: 3 roles x 2 styles (only implemented classes are listed)
export const CLASS_KEYS = ["warden", "assassin", "ranger", "gunner", "mage", "chronomancer"].filter(k => CLASSES[k]);
// win a run with the key class to unlock the value class
export const UNLOCK = { assassin: "warden", gunner: "ranger", chronomancer: "mage" };

const pierceCount = g => { const pc = lv(g, "pierce"); return pc ? Math.round(2 * pc) : 0; };
const arrow = (g, x, y, a, dmg) => fireShot(g, { kind: "arrow", x, y, a, sp: 200 * g.mods.projSpeed, dmg, pierce: pierceCount(g), bounce: g.mods.bounce, l: 0.8 * g.mods.range });
function volley(g, x, y, a) {
  const ms = lv(g, "multishot"), ex = g.mods.arrows;
  arrow(g, x, y, a, 1);
  if (ms) for (const s of [-0.25, 0.25]) arrow(g, x, y, a + s, Math.min(1, 0.5 * ms));
  for (let i = 0; i < ex; i++) arrow(g, x, y, a + (i % 2 ? -1 : 1) * 0.12 * (1 + (i >> 1)), 0.6);
}
