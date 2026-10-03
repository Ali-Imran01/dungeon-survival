// Class configs: stats, auto-attack and ability. Upgrades arrive via g.mods (see upgrades.js computeMods).
import { sfx } from "./audio.js";
import { lv } from "./powerups.js";
import { atkInterval } from "./upgrades.js";
import { nearest, fireShot, meleeHit, burst, clamp, addHz, dealDmg, pc } from "./engine.js";

// Gunner tuning (mutable so the balance sim can sweep it: --gun.reload=2 ...)
// tuned with the sim: total boss time 197 s (Ranger 174, Warden 243, Mage 319)
export const GUN = {
  range: 40, pellets: 4, spread: 0.12, pelletSpeed: 240, dmg: 2, interval: 1.0, reload: 2.6,
  deadInterval: 0.45, deadBoss: 3, bottomless: 0.15, bomb: 3, bombCd: 6,
};

// Assassin tuning (mutable so the balance sim can sweep it: --asn.markMul=1.3 ...)
export const ASN = {
  stab: 1, interval: 0.34, reach: 16, arc: 90, ambushMul: 3, ambushArc: 120, stun: 0.5,
  markMul: 1.5, markT: 4, catCd: 6, stepCd: 3.5, range: 90, knock: 2, knockAmb: 6,
};

// Where Shadow Step would land: just behind the nearest target (null when nothing is in range).
// Also drives the red landing-bracket reticle (drawReticle in engine.js) — the same function computes both the
// preview and the actual teleport target, so the preview can't ever lie about where you'll land.
export function stepLanding(g) {
  const [cx, cy] = pc(g);
  const B = g.bounds;
  const target = nearest(g, cx, cy, ASN.range);
  if (!target) return null;

  const dx = target.x - cx;
  const dy = target.y - cy;
  const dist = Math.hypot(dx, dy) || 1;
  const radius = target.ref === g.boss ? g.boss.w / 2 : (target.ref.w + target.ref.h) / 4;
  return {
    nx: clamp(target.x + dx / dist * (radius + 9), B.x0 + 8, B.x1 + 8),
    ny: clamp(target.y + dy / dist * (radius + 9), B.y0 + 10, B.y1 + 10),
    t: target,
  };
}

const stepCd = g => ASN.stepCd * g.mods.cd / (1 + 2 * lv(g, "phantom"));
const rushRate = g => 1 + 0.25 * (g.rush.t > 0 ? g.rush.n : 0);

// Necromancer tuning (mutable so the balance sim can sweep it: --nec.dmg=2 ...)
// sim-tuned: boss total ~198 s (Ranger 174, Gunner 197, Assassin 198, Warden 243, Mage 319); the soul bolt pierces once
// (needed against magma/cinder swarms), Raise Dead skeletons add the rest
export const NEC = {
  dmg: 2, interval: 1.0, speed: 150, pierce: 1, range: 110,
  skelCount: 2, skelLife: 6, skelDmg: 1, skelHitCd: 0.7, skelSpeed: 70,
  fogCd: 8, fogR: 24, fogT: 3, fogSlow: 0.4, bulletSlow: 0.3,
};

// small puff of particles around (x, y); `colorA` / `colorB` alternate
function smoke(g, x, y, w, h, vxSpread, life, colorA, colorB) {
  for (let i = 0; i < 10; i++) {
    g.parts.push({
      x: x + (Math.random() - 0.5) * w,
      y: y + (Math.random() - 0.5) * h,
      vx: (Math.random() - 0.5) * vxSpread,
      vy: -Math.random() * 30,
      l: life,
      c: i % 2 ? colorA : colorB,
    });
  }
}

// shortest angle between two directions, 0..PI
function angleDiff(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

export const CLASSES = {
  warden: {
    name: "Warden", role: "Melee tank", abilityName: "Dash", color: "#9b7fd9",
    desc: "A knight in shining armour who fights up close. His great sword sweeps a wide arc toward the nearest enemy, and his wisp shoots from range.",
    stats: { HP: 4, DMG: 3, RANGE: 1, SPEED: 3 },
    hp: 4, speed: 62, abilityCd: 1.2, companion: "wisp", companionName: "Wisp", pus: ["frenzy", "surge"],

    attack(g, cx, cy) {
      const p = g.p;
      const m = g.mods;
      const frenzy = lv(g, "frenzy");
      const reach = 24 + 6 * frenzy + m.reach;      // reach: hero centre → target edge

      // mid-swing: the hit lands once, near the end of the windup
      if (p.atk > 0) {
        if (!p.hitDone && p.atk <= 0.11) {
          p.hitDone = true;
          p.swings++;
          meleeHit(g, p.swing.reach, 2, p.swing.spin);
        }
        return;
      }
      if (p.acd > 0) return;

      const target = nearest(g, cx, cy, reach + 4);  // start early: windup lets enemies step in
      if (!target) return;

      const a = Math.atan2(target.y - cy, target.x - cx);
      const spin = !!m.spinEvery && (p.swings + 1) % m.spinEvery === 0;
      sfx("swing");
      p.atk = 0.26;
      p.acd = atkInterval(0.7, 1 + 0.4 * frenzy, m);
      p.hitDone = false;
      p.face = Math.sign(target.x - cx) || p.face;
      p.swingA = a;
      p.swing = {
        a,
        dir: p.swings % 2 ? 1 : -1,                  // alternating slash direction
        arc: (110 + m.arc) * Math.PI / 180,
        reach: spin ? reach + 4 : reach,
        spin,
        fr: frenzy > 0,
      };
    },

    ability(g, dir) {
      const p = g.p;
      sfx("dash");
      p.dash = 0.15;
      p.dashV = dir || [p.face, 0];
      p.dashSp = 190;
      p.inv = Math.max(p.inv, 0.35);
    },
  },

  ranger: {
    name: "Ranger", role: "Ranged DPS", abilityName: "Roll", color: "#6fcf6a",
    desc: "Survives by staying away. Fast arrows, and a hawk that swoops at enemies who get too close.",
    stats: { HP: 3, DMG: 3, RANGE: 5, SPEED: 5 },
    hp: 3, speed: 78, abilityCd: 1.2, companion: "hawk", companionName: "Hawk", pus: ["multishot", "pierce"],

    attack(g, cx, cy) {
      const p = g.p;
      const m = g.mods;
      if (p.acd > 0) return;

      const target = nearest(g, cx, cy - 2, 120 * m.range);
      if (!target) return;

      volley(g, cx, cy - 2, Math.atan2(target.y - (cy - 2), target.x - cx));
      sfx("arrow");
      p.atk = 0.16;
      p.acd = atkInterval(0.28, 1, m);
      p.face = Math.sign(target.x - cx) || p.face;
    },

    ability(g, dir) {
      const p = g.p;
      const v = dir || [-p.face, 0];
      const cx = p.x + 8;
      const cy = p.y + 8;
      sfx("roll");
      p.dash = 0.2;
      p.dashV = v;
      p.dashSp = 170;
      p.inv = Math.max(p.inv, 0.3);
      if (g.mods.rollTrap) {
        addHz(g, { k: "trap", owner: "player", x: cx, y: cy + 4, r: 8, dur: 5, dmg: g.mods.rollTrap, hit: new Set() });
      }

      // shoot back over the shoulder at whatever is behind the roll
      const back = Math.atan2(-v[1], -v[0]);
      const target = nearest(g, cx, cy, 140, a => angleDiff(a, back) < Math.PI / 4);
      arrow(g, cx, cy, target ? Math.atan2(target.y - cy, target.x - cx) : back, 1);
    },
  },

  mage: {
    name: "Mage", role: "AoE control", abilityName: "Blink", color: "#5577d9",
    desc: "Survives by controlling the field. Splashing orbs, and a familiar that blocks bullets.",
    stats: { HP: 3, DMG: 3, RANGE: 4, SPEED: 2 },
    hp: 3, speed: 53, abilityCd: 2.0, companion: "familiar", companionName: "Familiar", pus: ["overload", "nova"],

    attack(g, cx, cy) {
      const p = g.p;
      const m = g.mods;
      if (p.acd > 0) return;

      const target = nearest(g, cx, cy - 4, 125);
      if (!target) return;

      const overload = lv(g, "overload");
      const sx = cx + p.face * 5;
      const sy = cy - 10;
      fireShot(g, {
        kind: "orb", x: sx, y: sy, a: Math.atan2(target.y - sy, target.x - sx), sp: 130, dmg: 2,
        tgt: target.ref, splash: 16 * (1 + 0.5 * overload) * m.splash, split: m.split, l: 1.2,
      });
      sfx("cast");
      p.atk = 0.22;
      p.acd = atkInterval(0.7, 1 + 0.33 * overload, m);
      p.face = Math.sign(target.x - cx) || p.face;
    },

    ability(g, dir) {
      const p = g.p;
      const B = g.bounds;
      const cx = p.x + 8;
      const cy = p.y + 10;

      // no direction held: blink away from the nearest enemy, or forward if there's none
      let v = dir;
      if (!v) {
        const target = nearest(g, cx, cy, 200);
        if (target) {
          const dist = Math.hypot(cx - target.x, cy - target.y) || 1;
          v = [(cx - target.x) / dist, (cy - target.y) / dist];
        } else {
          v = [p.face, 0];
        }
      }

      burst(g, cx, cy - 4, 12, "#5577d9");
      if (g.mods.blinkField) addHz(g, { k: "frost", owner: "player", x: cx, y: cy + 3, r: 20, dur: g.mods.blinkField });

      // try the full blink first, then shorter ones until we find a spot that isn't inside an enemy
      for (const dist of [36, 28, 20, 12]) {
        const nx = clamp(p.x + v[0] * dist, B.x0, B.x1);
        const ny = clamp(p.y + v[1] * dist, B.y0, B.y1);
        const hitsEnemy = g.en.some(e =>
          !e.harmless && Math.hypot(e.x + e.w / 2 - (nx + 8), e.y + e.h / 2 - (ny + 10)) < 9);
        const hitsBoss = g.boss &&
          Math.hypot(g.boss.x + g.boss.w / 2 - (nx + 8), g.boss.y + g.boss.h / 2 - (ny + 10)) < g.boss.w / 2 + 4;
        if (!hitsEnemy && !hitsBoss) {
          p.x = nx;
          p.y = ny;
          break;
        }
      }
      burst(g, p.x + 8, p.y + 6, 12, "#b9d0ff");
      sfx("blink");
      p.inv = Math.max(p.inv, 0.25);
    },
  },

  gunner: {
    name: "Gunner", role: "Ranged burst", abilityName: "Recoil", color: "#e0913a",
    desc: "Blasts a 4-pellet shotgun spread at anything within 40px, then reloads. Recoil Jump blasts enemies, launches him away and reloads. His Bomb Buddy blows up crowds.",
    stats: { HP: 3, DMG: 4, RANGE: 1, SPEED: 2 },
    hp: 3, speed: 60, abilityCd: 3.5, mag: 6, companion: "bomb", companionName: "Bomb Buddy", pus: ["bottomless", "buckshot"],

    attack(g, cx, cy) {
      // Shotgun: 4 pellets that only reach GUN.range (40px).
      // Deadshot power-up (key "buckshot"): one-hit-kill bullet, whole-screen range, no ammo use.
      const p = g.p;
      const m = g.mods;
      const bottomless = lv(g, "bottomless");
      const deadshot = lv(g, "buckshot") > 0;
      const magSize = 6 + m.mag;

      if (p.reloading && !deadshot) {
        if (p.reload > 0) return;
        p.reloading = false;
        p.ammo = magSize;
        sfx("reload");
      }
      if (p.ammo <= 0 && !bottomless && !deadshot) {
        p.reload = GUN.reload;
        p.reloading = true;
        sfx("reload");
        return;
      }
      if (p.acd > 0) return;

      const target = nearest(g, cx, cy - 2, deadshot ? 999 : GUN.range);
      if (!target) return;

      const a = Math.atan2(target.y - (cy - 2), target.x - cx);
      const sx = cx + Math.cos(a) * 11;
      const sy = cy - 2 + Math.sin(a) * 11;
      const lastRound = p.ammo === 1 && m.deadEye && !bottomless;

      if (deadshot) {
        fireShot(g, { kind: "dead", x: sx, y: sy, a, sp: 320, dmg: 1, kill: true, pierce: 0, l: 1 });
      } else if (lastRound) {
        fireShot(g, { kind: "heavy", x: sx, y: sy, a, sp: 270, dmg: GUN.dmg * GUN.pellets, pierce: 99, l: 0.2 });
      } else {
        for (let i = 0; i < GUN.pellets; i++) {
          const fan = (i - (GUN.pellets - 1) / 2) * GUN.spread;
          fireShot(g, {
            kind: "pellet", x: sx, y: sy,
            a: a + fan + (Math.random() - 0.5) * 0.04,
            sp: GUN.pelletSpeed, dmg: GUN.dmg, pierce: 0, l: GUN.range / GUN.pelletSpeed + 0.02,
          });
        }
      }

      if (!bottomless && !deadshot) p.ammo--;
      sfx("gun");
      p.atk = 0.12;
      p.aimA = a;
      p.aimT = 0.6;
      p.face = Math.sign(target.x - cx) || p.face;
      p.acd = atkInterval(deadshot ? GUN.deadInterval : GUN.interval, 1 + GUN.bottomless * bottomless, m);
    },

    // Recoil Jump: blast a cone at the nearest enemy, get launched the opposite way, reload instantly
    ability(g, dir) {
      const p = g.p;
      const m = g.mods;
      const [cx, cy] = pc(g);
      const target = nearest(g, cx, cy, 90);

      // shell direction; the jump goes the opposite way
      const a = target
        ? Math.atan2(target.y - cy, target.x - cx)
        : dir ? Math.atan2(-dir[1], -dir[0]) : (p.face > 0 ? Math.PI : 0);
      const half = (m.shell ? 45 : 30) * Math.PI / 180;
      const dmg = 2 + m.shell;

      // (ex, ey) is the offset from the player; r is the thing's radius
      const inCone = (ex, ey, r) => {
        const dist = Math.hypot(ex, ey) || 1;
        return dist - r < 45 && angleDiff(Math.atan2(ey, ex), a) < half + Math.atan2(r, dist);
      };

      for (const e of [...g.en]) {
        if (e.hp <= 0 || e.rise > 0 || e.harmless) continue;
        const ex = e.x + e.w / 2 - cx;
        const ey = e.y + e.h / 2 - cy;
        if (!inCone(ex, ey, (e.w + e.h) / 4)) continue;
        dealDmg(g, e, dmg);
        if (!e.fixed) {
          const dist = Math.hypot(ex, ey) || 1;
          e.x += ex / dist * 14;
          e.y += ey / dist * 14;
        }
      }
      const boss = g.boss;
      if (boss && boss.mode !== "enter" && inCone(boss.x + boss.w / 2 - cx, boss.y + boss.h / 2 - cy, boss.w / 2)) {
        dealDmg(g, boss, dmg);
      }

      // muzzle sparks
      for (let i = 0; i < 16; i++) {
        const r = 8 + Math.random() * 36;
        const da = (Math.random() - 0.5) * half * 2;
        g.parts.push({
          x: cx + Math.cos(a + da) * r,
          y: cy + Math.sin(a + da) * r,
          vx: Math.cos(a + da) * 60,
          vy: Math.sin(a + da) * 60,
          l: 0.25,
          c: i % 2 ? "#ffd166" : "#ff8a2a",
        });
      }

      // launched 42 px backward
      p.dash = 0.14;
      p.dashV = [-Math.cos(a), -Math.sin(a)];
      p.dashSp = 300;
      p.inv = Math.max(p.inv, 0.25);

      // instant reload
      p.reloading = false;
      p.reload = 0;
      p.ammo = 6 + m.mag;

      p.aimA = a;
      p.aimT = 0.4;
      p.atk = 0.12;
      p.face = Math.cos(a) >= 0 ? 1 : -1;
      sfx("recoil");
    },
  },

  assassin: {
    name: "Assassin", role: "Melee burst", abilityName: "Step", color: "#d9433a",
    desc: "Blinks behind a target for a x3 Ambush, then stabs away with twin daggers. His Shade Cat marks targets for extra damage.",
    stats: { HP: 3, DMG: 4, RANGE: 1, SPEED: 4 },
    hp: 3, speed: 74, abilityCd: 3.5, companion: "cat", companionName: "Shade Cat", pus: ["phantom", "bloodrush"],

    attack(g, cx, cy) {
      const p = g.p;
      const m = g.mods;
      const reach = ASN.reach;

      // mid-stab: the hit lands once, partway through
      if (p.atk > 0) {
        if (!p.hitDone && p.atk <= p.hitAt) {
          p.hitDone = true;
          p.swings++;
          const stab = p.swing;
          meleeHit(g, stab.reach, stab.dmg, false, stab.ambush ? ASN.ambushArc : ASN.arc, {
            stun: stab.ambush ? ASN.stun : 0,
            knock: stab.ambush ? ASN.knockAmb : ASN.knock,
          });
          if (stab.ambush) {
            p.ambush = 0;
            burst(g, cx, cy - 2, 14, "#ff4a5a", 120);
          }
        }
        return;
      }
      if (p.acd > 0) return;

      const ambushing = p.ambush > 0;
      const target = nearest(g, cx, cy, reach + (ambushing ? 8 : 3));
      if (!target) return;

      const a = Math.atan2(target.y - cy, target.x - cx);
      sfx(ambushing ? "ambush" : "stab");
      p.atk = ambushing ? 0.24 : 0.16;
      p.hitAt = ambushing ? 0.14 : 0.10;
      p.hitDone = false;
      p.acd = ambushing ? 0.25 : atkInterval(ASN.interval, rushRate(g), m);
      p.face = Math.sign(target.x - cx) || p.face;
      p.swingA = a;
      p.swing = {
        a,
        ambush: ambushing,
        reach: ambushing ? reach + 4 : reach,
        dmg: ambushing ? ASN.stab * (ASN.ambushMul + 0.5 * m.sharp) : ASN.stab,
        hand: p.swings % 2,
      };
    },

    // Shadow Step: teleports to stepLanding() (just behind the nearest target) or a blind 40px blink if nothing's
    // in range. Landing near a target arms the Ambush window (p.ambush — the next stab within 2s is x3 dmg, see
    // the p.swing.ambush branch in attack() above). Charges work like a rechargeable magazine, not independent
    // per-charge timers — see tick() below, which only starts counting down once you drop below max charges.
    ability(g) {
      const p = g.p;
      const m = g.mods;
      const [cx, cy] = pc(g);
      const landing = stepLanding(g);
      const B = g.bounds;
      const maxCharges = m.charges;

      let nx, ny;
      if (landing) {
        nx = landing.nx;
        ny = landing.ny;
      } else {
        const v = p.dir || [p.face, 0];
        nx = cx + v[0] * 40;
        ny = cy + v[1] * 40;
      }

      smoke(g, cx, cy, 8, 12, 50, 0.4, "#3a3f52", "#d9433a");     // where he left
      if (m.decoy) g.decoy = { x: cx, y: cy, t: 2 };
      p.x = clamp(nx - 8, B.x0, B.x1);
      p.y = clamp(ny - 10, B.y0, B.y1);
      p.vx = 0;
      p.vy = 0;
      p.dash = 0;
      smoke(g, p.x + 8, p.y + 10, 8, 12, 50, 0.4, "#3a3f52", "#ff4a5a");   // where he lands

      p.inv = Math.max(p.inv, 0.3);
      p.atk = 0;
      p.hitDone = true;
      p.acd = 0;
      sfx("step");
      if (landing) {
        p.face = Math.sign(landing.t.x - (p.x + 8)) || p.face;
        p.ambush = 2;                                   // ambush window: the next stab is a x3 Ambush
      }

      if (p.charges >= maxCharges) p.chT = stepCd(g);
      p.charges--;
      return p.charges > 0 ? 0.35 : Math.max(0.35, p.chT);   // cooldown handed back to the engine
    },

    // recharge Shadow Step charges
    tick(g, dt) {
      const p = g.p;
      const maxCharges = g.mods.charges;
      if (p.charges < maxCharges) {
        p.chT -= dt;
        if (p.chT <= 0) {
          p.charges++;
          p.chT = p.charges < maxCharges ? stepCd(g) : 0;
        }
      }
    },

    onKill(g) {
      const p = g.p;
      const m = g.mods;
      // Bloodrush: stacking speed on kills
      if (lv(g, "bloodrush")) {
        g.rush.n = Math.min(4, g.rush.n + 1);
        g.rush.t = 2;
      }
      // Executioner: kills refund Shadow Step cooldown
      if (m.exec) {
        p.cd = Math.max(0, p.cd - 1.5);
        if (p.charges < m.charges) p.chT = Math.max(0.01, p.chT - 1.5);
      }
    },
  },

  necromancer: {
    name: "Necromancer", role: "Summoner", abilityName: "Raise Dead", color: "#3fb59a",
    desc: "Soul bolts pierce. His Bone Imp drops grave fog that slows enemies and bullets. Raise Dead calls skeletons that chase down enemies for 6 seconds.",
    stats: { HP: 3, DMG: 3, RANGE: 4, SPEED: 3 },
    hp: 3, speed: 58, abilityCd: 8, companion: "boneimp", companionName: "Bone Imp", pus: ["slowmo", "overclock"],

    attack(g, cx, cy) {
      const p = g.p;
      const m = g.mods;
      const overclock = lv(g, "overclock");
      if (p.acd > 0) return;

      const target = nearest(g, cx, cy - 4, NEC.range);
      if (!target) return;

      const ox = cx;
      const oy = cy - 8;
      const a = Math.atan2(target.y - oy, target.x - ox);
      fireShot(g, { kind: "soul", x: ox, y: oy, a, sp: NEC.speed, dmg: NEC.dmg, pierce: NEC.pierce, l: 0.9 });
      sfx("cast");

      p.atk = 0.2;
      p.acd = atkInterval(NEC.interval, 1 + 0.4 * overclock, m);
      p.face = Math.sign(target.x - cx) || p.face;
    },

    // Raise Dead: skeletons spawn around the player (stepMinions in engine.js moves them and deals their damage)
    ability(g) {
      const p = g.p;
      const m = g.mods;
      const [cx, cy] = pc(g);
      const n = NEC.skelCount + m.legion;
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        g.minions.push({ x: cx + side * (8 + 6 * Math.floor(i / 2)), y: cy + 4, t: NEC.skelLife, face: side, hit: new Map() });
      }
      smoke(g, cx, cy + 6, 14, 10, 40, 0.45, "#8f6bd1", "#7be07a");
      p.inv = Math.max(p.inv, m.soulWard ? 1.5 : 0.3);
      sfx("cast");
    },
  },
};

// display / unlock order: 3 roles x 2 styles (only implemented classes are listed)
export const CLASS_KEYS = ["warden", "assassin", "ranger", "gunner", "mage", "necromancer"].filter(k => CLASSES[k]);
// win a run with the key class to unlock the value class
export const UNLOCK = { assassin: "warden", gunner: "ranger", necromancer: "mage" };

function pierceCount(g) {
  const level = lv(g, "pierce");
  return level ? Math.round(2 * level) : 0;
}

function arrow(g, x, y, a, dmg) {
  fireShot(g, {
    kind: "arrow", x, y, a, sp: 200 * g.mods.projSpeed, dmg,
    pierce: pierceCount(g), bounce: g.mods.bounce, l: 0.8 * g.mods.range,
  });
}

// main arrow, two side arrows from Multishot, plus the Extra Arrow upgrade's arrows fanned out alternately
function volley(g, x, y, a) {
  const multishot = lv(g, "multishot");
  const extra = g.mods.arrows;
  arrow(g, x, y, a, 1);
  if (multishot) {
    for (const side of [-0.25, 0.25]) arrow(g, x, y, a + side, Math.min(1, 0.5 * multishot));
  }
  for (let i = 0; i < extra; i++) {
    arrow(g, x, y, a + (i % 2 ? -1 : 1) * 0.12 * (1 + (i >> 1)), 0.6);
  }
}
