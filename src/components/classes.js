// Class configs: stats, auto-attack and ability. Add a class by adding one entry.
import { sfx } from "./audio.js";
import { nearest, fireShot, meleeHit, meleeHitAll, burst, dropField, clamp, stat, W, H, WALL } from "./engine.js";

export const CLASS_KEYS = ["warden", "ranger", "mage"];
const SIDE_DMG = 0.6;

export const CLASSES = {
  warden: {
    name: "Warden", role: "Melee tank", abilityName: "Dash", color: "#9b7fd9",
    desc: "Survives by fighting up close. Swings hit everything in front. His wisp shoots from range.",
    stats: { HP: 4, DMG: 3, RANGE: 1, SPEED: 3 },
    hp: 4, speed: 62, abilityCd: 1.2, companion: "wisp", companionName: "Wisp",
    attack(g, cx, cy) {
      const p = g.p, reach = 22 + stat(g, "reach");
      if (p.atk > 0) {
        if (!p.hitDone && p.atk <= 0.16) {
          p.hitDone = true; p.swings = (p.swings || 0) + 1;
          const spin = stat(g, "spinEvery");
          if (spin && p.swings % spin === 0) meleeHitAll(g, reach, 2); else meleeHit(g, reach, 2);
        }
        return;
      }
      if (p.acd > 0) return;
      const t = nearest(g, cx, cy, reach + 2); if (!t) return;
      sfx("swing"); p.atk = 0.24; p.acd = Math.max(0.7 * 0.5, 0.7 / (1 + stat(g, "attackSpeed"))); p.hitDone = false; p.face = Math.sign(t.x - cx) || p.face;
    },
    ability(g, dir) {
      const p = g.p; sfx("dash");
      p.dash = 0.15; p.dashV = dir || [p.face, 0]; p.dashSp = 190; p.inv = Math.max(p.inv, 0.35);
      if (stat(g, "dashDamage") > 0) p.dashHit = new Set();
      const shieldT = stat(g, "dashShield"); if (shieldT > 0) { p.shield = true; p.shieldT = shieldT; }
    },
  },

  ranger: {
    name: "Ranger", role: "Ranged DPS", abilityName: "Roll", color: "#6fcf6a",
    desc: "Survives by staying away. Fast arrows, and a hawk that swoops at enemies who get too close.",
    stats: { HP: 3, DMG: 3, RANGE: 5, SPEED: 5 },
    hp: 3, speed: 78, abilityCd: 1.2, companion: "hawk", companionName: "Hawk",
    attack(g, cx, cy) {
      const p = g.p; if (p.acd > 0) return;
      const range = 120 * (1 + stat(g, "range"));
      const t = nearest(g, cx, cy - 2, range); if (!t) return;
      const a = Math.atan2(t.y - (cy - 2), t.x - cx);
      volley(g, cx, cy - 2, a);
      sfx("arrow"); p.atk = 0.16; p.acd = Math.max(0.28 * 0.5, 0.28 / (1 + stat(g, "attackSpeed"))); p.face = Math.sign(t.x - cx) || p.face;
    },
    ability(g, dir) {
      const p = g.p, v = dir || [-p.face, 0], cx = p.x + 8, cy = p.y + 8;
      sfx("roll"); p.dash = 0.2; p.dashV = v; p.dashSp = 170; p.inv = Math.max(p.inv, 0.3);
      const back = Math.atan2(-v[1], -v[0]);
      const t = nearest(g, cx, cy, 140, a => Math.abs(Math.atan2(Math.sin(a - back), Math.cos(a - back))) < Math.PI / 4);
      fireShot(g, { kind: "arrow", x: cx, y: cy, a: t ? Math.atan2(t.y - cy, t.x - cx) : back, sp: sp(g), dmg: 1, bounce: stat(g, "bounce") ? 1 : 0, l: 0.8 });
      if (stat(g, "rollTrap")) dropField(g, cx, cy, 10, 5, "trap");
    },
  },

  mage: {
    name: "Mage", role: "AoE control", abilityName: "Blink", color: "#5577d9",
    desc: "Survives by controlling the field. Splashing orbs, and a familiar that blocks bullets.",
    stats: { HP: 3, DMG: 3, RANGE: 4, SPEED: 2 },
    hp: 3, speed: 53, abilityCd: 2.0, companion: "familiar", companionName: "Familiar",
    attack(g, cx, cy) {
      const p = g.p; if (p.acd > 0) return;
      const t = nearest(g, cx, cy - 4, 125); if (!t) return;
      const sx = cx + p.face * 5, sy = cy - 10, splash = 16 * (1 + stat(g, "splash"));
      fireShot(g, { kind: "orb", x: sx, y: sy, a: Math.atan2(t.y - sy, t.x - sx), sp: 130, dmg: 2, tgt: t.ref, splash, l: 1.2 });
      sfx("cast"); p.atk = 0.22; p.acd = Math.max(0.7 * 0.5, 0.7 / (1 + stat(g, "attackSpeed"))); p.face = Math.sign(t.x - cx) || p.face;
    },
    ability(g, dir) {
      const p = g.p, cx = p.x + 8, cy = p.y + 10;
      let v = dir;
      if (!v) { const t = nearest(g, cx, cy, 200); if (t) { const d = Math.hypot(cx - t.x, cy - t.y) || 1; v = [(cx - t.x) / d, (cy - t.y) / d]; } else v = [p.face, 0]; }
      burst(g, cx, cy - 4, 12, "#5577d9");
      for (const dist of [36, 28, 20, 12]) {
        const nx = clamp(p.x + v[0] * dist, 0, W - 16), ny = clamp(p.y + v[1] * dist, WALL - 8, H - 17);
        const blocked = g.en.some(e => Math.hypot(e.x + 4 - (nx + 8), e.y + 3 - (ny + 10)) < 9) || (g.boss && Math.hypot(g.boss.x + g.boss.w / 2 - (nx + 8), g.boss.y + g.boss.h / 2 - (ny + 10)) < g.boss.w / 2 + 4);
        if (!blocked) { p.x = nx; p.y = ny; break; }
      }
      burst(g, p.x + 8, p.y + 6, 12, "#b9d0ff"); sfx("blink"); p.inv = Math.max(p.inv, 0.25);
      if (stat(g, "blinkField")) dropField(g, p.x + 8, p.y + 10, 16, 3, "frost");
    },
  },
};

const sp = g => 200 * (1 + stat(g, "projSpeed"));
function volley(g, x, y, a) {
  const extra = stat(g, "arrows"), bounce = stat(g, "bounce") ? 1 : 0;
  fireShot(g, { kind: "arrow", x, y, a, sp: sp(g), dmg: 1, bounce, l: 0.8 });
  for (let i = 0; i < extra; i++) for (const s of [-0.22 * (i + 1), 0.22 * (i + 1)]) fireShot(g, { kind: "arrow", x, y, a: a + s, sp: sp(g), dmg: SIDE_DMG, bounce, l: 0.8 });
}
