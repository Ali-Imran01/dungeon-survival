// Shared + class power-ups. Timed power-ups stack up to level 3 with diminishing returns.
export const DUR = 8;
export const LV = [0, 1, 1.5, 1.75];            // bonus multiplier per level: +100%, +50%, +25%
const ROMAN = ["", "", " II", " III"];

export const PU = {
  heart: {
    name: "+1 heart",
    c: "#ff9aa5",
    apply: g => {
      g.p.hp = Math.min(g.maxHp + 1, g.p.hp + 1);
    },
  },
  shield: {
    name: "Soul shield",
    c: "#b9d0ff",
    apply: g => {
      g.p.shield = true;
    },
  },
  boots:      { name: "Swift boots", c: "#c9a27a", timed: true },
  frenzy:     { name: "Frenzy",      c: "#d4a82a", timed: true, cls: "warden" },
  surge:      { name: "Soul surge",  c: "#5ef2ff", timed: true, cls: "warden" },
  multishot:  { name: "Multishot",   c: "#cfd6e6", timed: true, cls: "ranger" },
  pierce:     { name: "Piercing",    c: "#ff9aa5", timed: true, cls: "ranger" },
  overload:   { name: "Overload",    c: "#5ef2ff", timed: true, cls: "mage" },
  nova:       { name: "Frost nova",  c: "#b9d0ff", timed: true, cls: "mage" },
  slowmo:     { name: "Grave Hush",  c: "#b9a0f0", timed: true, cls: "necromancer" },
  overclock:  { name: "Dark Frenzy", c: "#7be07a", timed: true, cls: "necromancer" },
  phantom:    { name: "Phantom",     c: "#eef2fa", timed: true, cls: "assassin" },
  bloodrush:  { name: "Bloodrush",   c: "#d9433a", timed: true, cls: "assassin" },
  bottomless: { name: "Bottomless",  c: "#ffd166", timed: true, cls: "gunner" },
  buckshot:   { name: "Deadshot",    c: "#ff4a6a", timed: true, cls: "gunner" },
};

// 0 when inactive, otherwise 1 / 1.5 / 1.75 by level
export function lv(g, key) {
  const fx = g.fx[key];
  if (fx && fx.t > 0) return LV[fx.lv];
  return 0;
}

export function applyPU(g, key) {
  const def = PU[key];
  if (!def.timed) {
    def.apply(g);
    return def.name;
  }

  const fx = g.fx[key];
  if (fx && fx.t > 0) {
    // already running: bump the level (max 3) and refresh the timer
    fx.lv = Math.min(3, fx.lv + 1);
    fx.t = DUR;
  } else {
    g.fx[key] = { t: DUR, lv: 1 };
  }
  return def.name + ROMAN[g.fx[key].lv];
}

// Weighted pick: hearts ~20% (35% when on 1 heart), shared ~30%, class ~50%
export function pickPU(g) {
  const weights = {
    heart: g.p.hp >= g.maxHp + 1 ? 0 : g.p.hp <= 1 ? 35 : 20,
    shield: g.p.shield ? 0 : 15,
    boots: 15,
  };
  for (const key in PU) {
    if (PU[key].cls === g.cls) weights[key] = 25;
  }

  // already maxed with plenty of time left, so make it less likely
  for (const key in weights) {
    const fx = g.fx[key];
    if (fx && fx.t > 3 && fx.lv >= 3) weights[key] *= 0.3;
  }

  let total = 0;
  for (const key in weights) total += weights[key];

  let roll = Math.random() * total;
  for (const key in weights) {
    roll -= weights[key];
    if (roll < 0) return key;
  }
  return "boots";
}

export function tickFx(g, dt) {
  for (const key in g.fx) g.fx[key].t -= dt;
}

export function fxLabel(g) {
  return Object.entries(g.fx)
    .filter(([, fx]) => fx.t > 0)
    .map(([key, fx]) => `${PU[key].name}${ROMAN[fx.lv]} ${Math.ceil(fx.t)}s`)
    .join("  ");
}
