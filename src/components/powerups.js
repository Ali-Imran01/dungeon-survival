// Shared + class power-ups. Timed power-ups stack up to level 3 with diminishing returns.
export const DUR = 8;
export const LV = [0, 1, 1.5, 1.75];            // bonus multiplier per level: +100%, +50%, +25%
const ROMAN = ["", "", " II", " III"];

export const PU = {
  heart:     { name: "+1 heart",    c: "#ff9aa5", apply: g => { g.p.hp = Math.min(g.maxHp + 1, g.p.hp + 1); } },
  shield:    { name: "Soul shield", c: "#b9d0ff", apply: g => { g.p.shield = true; } },
  boots:     { name: "Swift boots", c: "#c9a27a", timed: true },
  frenzy:    { name: "Frenzy",      c: "#d4a82a", timed: true, cls: "warden" },
  surge:     { name: "Soul surge",  c: "#5ef2ff", timed: true, cls: "warden" },
  multishot: { name: "Multishot",   c: "#cfd6e6", timed: true, cls: "ranger" },
  pierce:    { name: "Piercing",    c: "#ff9aa5", timed: true, cls: "ranger" },
  overload:  { name: "Overload",    c: "#5ef2ff", timed: true, cls: "mage" },
  nova:      { name: "Frost nova",  c: "#b9d0ff", timed: true, cls: "mage" },
  slowmo:    { name: "Slow Motion", c: "#b9d0ff", timed: true, cls: "chronomancer" },
  overclock: { name: "Overclock",   c: "#f5c542", timed: true, cls: "chronomancer" },
  phantom:   { name: "Phantom",     c: "#eef2fa", timed: true, cls: "assassin" },
  bloodrush: { name: "Bloodrush",   c: "#d9433a", timed: true, cls: "assassin" },
  bottomless:{ name: "Bottomless",  c: "#ffd166", timed: true, cls: "gunner" },
  buckshot:  { name: "Deadshot",    c: "#ff4a6a", timed: true, cls: "gunner" },
};

// 0 when inactive, otherwise 1 / 1.5 / 1.75 by level
export const lv = (g, k) => { const f = g.fx[k]; return f && f.t > 0 ? LV[f.lv] : 0; };

export function applyPU(g, k) {
  const d = PU[k];
  if (!d.timed) { d.apply(g); return d.name; }
  const f = g.fx[k];
  if (f && f.t > 0) { f.lv = Math.min(3, f.lv + 1); f.t = DUR; } else g.fx[k] = { t: DUR, lv: 1 };
  return d.name + ROMAN[g.fx[k].lv];
}

// Weighted pick: hearts ~20% (35% when on 1 heart), shared ~30%, class ~50%
export function pickPU(g) {
  const w = {
    heart: g.p.hp >= g.maxHp + 1 ? 0 : g.p.hp <= 1 ? 35 : 20,
    shield: g.p.shield ? 0 : 15,
    boots: 15,
  };
  for (const k in PU) if (PU[k].cls === g.cls) w[k] = 25;
  for (const k in w) { const f = g.fx[k]; if (f && f.t > 3 && f.lv >= 3) w[k] *= 0.3; }
  let sum = 0; for (const k in w) sum += w[k];
  let r = Math.random() * sum;
  for (const k in w) if ((r -= w[k]) < 0) return k;
  return "boots";
}

export function tickFx(g, dt) { for (const k in g.fx) g.fx[k].t -= dt; }
export const fxLabel = g => Object.entries(g.fx).filter(([, f]) => f.t > 0).map(([k, f]) => `${PU[k].name}${ROMAN[f.lv]} ${Math.ceil(f.t)}s`).join("  ");
