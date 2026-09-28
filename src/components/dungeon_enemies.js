// Stage 1 — Dungeon (tutorial stage). Slime King stays as miniboss 1; Ember/Frost/Void Slime retire (their
// elements now have their own stages). Everything here is slow and heavily telegraphed: it teaches the patterns.
export const DUNGEON_EPAL = {
  K:"#120e1a", r:"#7a6a62", R:"#5a4c46", e:"#ff4a6a", p:"#ff9aa5", L:"#d4a82a",
  j:"#4a4450", J:"#7a7486", b:"#5a3a22", S:"#c99a7a", y:"#ffd166",
};
const mirror = half => half.map(r => r + [...r].reverse().join(""));

// Add: Rat — hp 1, speed 50 (fast, fragile). Only spawned by the Rat King / Jailer.
export const RAT = ["......KK.","..KKKKrrK","pKrrrrreK",".KRrrrrrK","..KK.KK.."];

// Miniboss 2: Rat King — hp 30, speed 20, cycle [lunge, squeak, lunge]
//  lunge: 0.5s windup (crown shakes) → short charge (speed 120)
//  squeak: 3 Rats run in from the arena edge
//  scatter: at 66% and 33% hp, 4 Rats burst off him and flee; any Rat alive after 5s runs back and HEALS him +2
//  → teaches: kill the adds
export const RAT_KING = [
  "......L.L.L.....","......LLLLL.....",".....KKKKKKK....","....KrrrrrrrK...","...KrRrerrerRK..","..KrrrrrKKrrrrK.",
  ".KrRrrrrppRrrrrK","KrrKrrRrrrrKrrRK","KrRrrKrrrRrrKrrK",".KKrrrKKrrrKKrK.","p.pKK.p.KK.p.KKp",".p..p...p..p..p.",
];

// STAGE BOSS: The Jailer — hp 60, speed 12
//  Phase 1: cycle [ballSwing, ballThrow, releasePrisoners, ballThrow]
//   ballSwing: spins his ball-and-chain around himself (r 26) for 2.5s; the circle is outlined 0.6s before
//   ballThrow: line telegraph → ball flies 90px and is dragged back (hits both ways, like the trident)
//   releasePrisoners: 2 Slimes crawl out of the wall
//  Phase 2 (<50%) "Riot": swing r 32 and faster; adds chainHook: chain line telegraph (0.6s) → pulls the player
//   30px toward him, then a slow slam (dash/roll/blink out)
export const JAILER = mirror([
  "....KKKKK","...KjjjjJ","..KjjJJJJ","..KjKKKKK","..KjKyKKK","..KjjjjjJ","...KKKKKK",".KKbbbKKK","KjjKbbbbb",
  "KjjKbbbbb","KjjKbLbbb","KSSKbbbbb","KSSKKKKKK",".KK.KjjjK","....KjjjK","....KjjjK","...KJJJJK","...KKKKKK",
]);
export const BALL = ["...K...",".KjjjK.","KjJjjjK","KJJjjjK","KjjjjjK",".KjjjK.","...K..."];

export const DUNGEON_STAGE = {
  spawnTable: [["slime", 1]],
  minibosses: [
    { name:"Slime King", keep:true },                                              // existing, unchanged
    { name:"Rat King", spr:RAT_KING, hp:30, sp:20, cs:120, atk:["lunge","squeak","lunge"], bc:"#b8a69c", scatterAt:[0.66, 0.33] },
  ],
  boss: { name:"The Jailer", spr:JAILER, hp:60, sp:12, atk:["ballSwing","ballThrow","releasePrisoners","ballThrow"], phase2:["chainHook","ballSwing","ballThrow","releasePrisoners"], bc:"#d4a82a", final:true },
};
