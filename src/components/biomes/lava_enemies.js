// Stage 3 — Lava Forge enemies: sprites + tuning. Behaviour notes are the spec for the engine.
export const LAVA_EPAL = {
  K:"#120e1a", R:"#8c1f2b", r:"#d9433a", o:"#ff8a2a", y:"#ffd166", j:"#4a4450", J:"#7a7486", b:"#5a3a22",
  d:"#2a1c1c", D:"#4a2c2c", g:"#d9433a", G:"#ffb26b", W:"#cfd6e6",
};
const mirror = half => half.map(r => r + [...r].reverse().join(""));

// Regular: Magma Slime — slime recolour (g/G), hp 3; on death splits into 2 Cinders (hp 1, speed 50, 4s lifespan).
export const CINDER = [".KKK.","KoyoK","KoooK",".KKK."];
// Regular: Fire Imp — hp 2, speed 34, keeps ~60px from the player, throws a fireball every 2.5s (speed 55, 0.4s windup: hand glows).
//   First ranged regular enemy: punishes standing still, gives melee a reason to dive.
export const FIRE_IMP = [
  ["K........K","RK......KR",".RKKKKKKR.",".KrrrrrrK.",".KryrrryK.",".KrrKKrrK.","..KrrrrK..","RRKRrrRKRR",".R.KRRK.R.","...KK.KK..","...K...K.."],
  ["..........","K........K","RK......KR",".RKKKKKKR.",".KrrrrrrK.",".KryrrryK.",".KrrKKrrK.","RRKrrrrKRR","..KRrrRK..","...KRRK...","...KK.KK.."],
];
export const FIREBALL = [".o.","oyo",".o."];

// Miniboss 1: Molten Smith — hp 40, speed 14, cycle [slam, ingot, slam, stoke]
//  slam: 0.7s windup (hammer raised, line telegraph) → fire shockwave travelling in a straight line (width 8, speed 110)
//  ingot: throws a molten ingot that bounces off walls twice (speed 70), leaves no fire
//  stoke: hammers the floor → every vent within 60px erupts immediately (bait him next to vents!)
export const MOLTEN_SMITH = [
  "....KKKKKKK.....","...KjjjjjjjK....","...KJJJJJJJK....","...KKyKKKyKK....","...KjjjjjjjK....","..KKKrrrrrKKK...",
  ".KjjKrrrrrKjjK..","KjJjKbbbbbKjJjK.","KjJjKbbobbKjJjK.","KrrKKbbbbbKKrrK.","KrrK.KbbbK.KrrK.",".KK..KbbbK..KK..",
  ".....KjjjK......","....KjjKjjK.....","....KJJKJJK.....","...KKKKKKKKK....",
];
export const HAMMER = ["KKKKK","KJJJK","KjjjK","KKKKK","..b..","..b..","..b.."];
export const INGOT = ["KKKKK","KoyoK","KKKKK"];

// Miniboss 2: Salamander — hp 36, speed 40 (fast), cycle [sprint, spit, sprint, spit]
//  sprint: runs a wide arc around the player for 1.4s leaving a fire trail (patches r 5, last 2s, 1 dmg)
//  spit: 5-fireball fan (±0.5 rad, speed 70)
//  after each sprint it pants for 1s: takes DOUBLE damage (tail flickers) — the reward window
export const SALAMANDER = [
  "..........KKK...",".........KrrrK..","KK......KrrryrK.","orK...KKrrrrrrKK",".oKKKKrrRRrrrrK.",
  "..KrrrrRRRrrrK..","...KrrKKKKrrK...","...KoK....KoK...","...KK......KK...",
];

// Stage boss: Forgemaster — hp 120, speed 10
//  Phase 1 (100–50%): cycle [meteors, breath, summonImps, meteors]
//   meteors: 4 big telegraphed circles (r 9, 1.0s) near the player → impact + fire patch for 2s
//   breath: flame cone (60°) that sweeps 90° over 1.2s; 0.5s windup (mouth glows, cone outline shown)
//   summonImps: 2 Fire Imps from the braziers
//  Phase 2 (<50%): "Eruption" — vents erupt in waves across the arena (left→right, 0.35s apart) with one safe
//   column; cycle [eruption, meteors, breath, eruption]; his chest core glows (visual only)
export const FORGEMASTER = mirror([
  "..K........","..RK.......","...RK..o.o.","....RKoyoyo",".....KKyoyy","....KRRRRRR","...KRrrrrrr","...KRKrrrrr",
  "...KRrKKrrr","...KRryyrrr","....KRrrrrr","....KRKWKWK","..KKKKRRRRR",".KdDDKKRRRR","KdDoDDKRRRR","KdDDDdKRRRy",
  "KrrKDdKRRRR","KrrK.KDDDDD",".Ko..KDdDdD","..o..KDDDDD",".....KdDKdD",".....KKK.KK",
]);

export const LAVA_STAGE = {
  spawnTable: [["magmaSlime", 0.7], ["imp", 0.3]],
  minibosses: [
    { name:"Molten Smith", spr:MOLTEN_SMITH, hp:40, sp:14, cs:0,   atk:["slam","ingot","slam","stoke"], bc:"#ff8a2a" },
    { name:"Salamander",   spr:SALAMANDER,   hp:36, sp:40, cs:160, atk:["sprint","spit","sprint","spit"], bc:"#ffd166" },
  ],
  boss: { name:"Forgemaster", spr:FORGEMASTER, hp:120, sp:10, atk:["meteors","breath","summonImps","meteors"], phase2:["eruption","meteors","breath","eruption"], bc:"#d9433a", final:true },
};
