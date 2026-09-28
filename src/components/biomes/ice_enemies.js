// Stage 2 — Ice Cave enemies: sprites + tuning. Behaviour notes are the spec for the engine.
export const ICE_EPAL = {
  K:"#120e1a", i:"#b8e3ff", I:"#7fb0dd", j:"#3d5d86", J:"#2a3f63", w:"#ffffff", s:"#b9cfe6",
  E:"#5ef2ff", e:"#ff4a6a", g:"#7fc8e8", G:"#d8f3ff", L:"#d4a82a", q:"#8a6fd1",
};

// Regular: Frost Bat — hp 1, speed 48, flies in a sine wave (amp 10px, 0.9s), ignores ice, spawns in pairs.
export const FROST_BAT = [
  ["K.......K","iK.....Ki","IiKKKKKiI",".IKEKEKI.","..KjjjK..","...K.K..."],
  [".........","...KKK...","KKKEjEKKK","IiKjjjKiI","Ii.KjK.iI","I...K...I"],
];
// Regular: Frost Slime — normal slime recolour (g/G above); slides on slick patches (accel 3 vs 30).

// Miniboss 1: Frost Golem — hp 34, speed 12, cycle [stomp, boulder, stomp, charge]
//  stomp: 0.6s windup (flash) → 10-shard ring (speed 55) + temporary slick patch r=18 for 6s at its feet
//  boulder: lobs a 5x5 ice boulder at the player (speed 45), shatters after 1.2s or on impact into 5 shards
//  charge: like Slime King, leaves slick trail
export const FROST_GOLEM = [
  "....KKKKKK....","...KiiiiIIK...","..KiIIIIIIjK..","..KIKEIIEKjK..","..KIIIIIIIjK..",".KKjKKKKKKjKK.",
  "KiiKIIIIIIKiiK","KiIKIiiiIIKIiK","KIjKIIIIIjKIjK","KjjKjIIIjjKjjK",".KK.KjjjjK.KK.","....KjKKjK....",
  "...KIjKKjIK...","...KKKK.KKKK..",
];
export const BOULDER = [".KKK.","KiIIK","KIIjK","KIjjK",".KKK."];

// Miniboss 2: Ice Wraith — hp 38, speed 30, floats (ignores ice), cycle [volley, fade, volley, blink]
//  volley: 3 aimed icicles (speed 90, ±0.2 rad); a hit also CHILLS the player (−40% move speed, 1.5s)
//  fade: 1.2s at 35% opacity, moves fast (70), takes 50% damage — stays targetable so auto-aim still works
//  blink: same as Void Slime blink → windup → short charge
export const ICE_WRAITH = [
  "....KKKK....","...KiiiiK...","..KiIIIIiK..","..KIKKKKIK..","..KKEKKEKK..","..KIKKKKIK..",
  ".KiIIKKIIiK.","KiIIIIIIIIiK","KIiIIIIIIiIK",".KIIjIIjIIK.",".KIjIIIIjIK.","..KjIjjIjK..",
  "..KK.jj.KK..","....K..K....",
];
export const ICICLE = ["w","i","I"];          // vertical 1x3, rotate by drawing along velocity

// Stage boss: Glacier Queen — hp 100, speed 10
//  Phase 1 (100–50%): cycle [icicleRain, spiral, summonBats, icicleRain]
//   icicleRain: 5 shadow circles (r 6) around the player, 0.9s telegraph, then icicles drop (1 dmg in r 6)
//   spiral: 3-arm shard spiral 1.4s (like Frost Slime) ; summonBats: 3 Frost Bats from the wall
//  Phase 2 (<50%): "Whiteout" — all slick patches grow ×1.4 and 2 new ones appear; attacks 25% faster;
//   adds frostRing: an expanding ring of shards with one 50° gap — dash/roll/blink through or find the gap
export const GLACIER_QUEEN = [
  "....i....i....i.....","....iI..iIi..Ii.....",".....IiIiwiIiI......",".....KKKKKKKKKK.....","....KssssssssssK....",
  "....KsKKssssKKsK....","....KsKEssssEKsK....","....KssssssssssK....",".....KsssKKsssK.....","...KKiKKKKKKKKiKK...",
  "..KiIiIjjjjjjIiIiK..",".KiIKIIjjjjjjIIKIiK.","KiIK.KIIjjjjIIK.KIiK","KwK..KIIjjjjIIK..KwK",".K...KIjjjjjjIK...K.",
  "....KIIjjjjjjIIK....","...KIIjjjjjjjjIIK...","..KIIjjjjjjjjjjIIK..",".KiIIjjjjjjjjjjIIiK.",".KKKKKKKKKKKKKKKKKK.",
];

export const ICE_STAGE = {
  spawnTable: [["slime", 0.6], ["bat", 0.4]],            // bats spawn in pairs
  minibosses: [
    { name:"Frost Golem", spr:FROST_GOLEM, hp:34, sp:12, cs:120, atk:["stomp","boulder","stomp","charge"], bc:"#b8e3ff" },
    { name:"Ice Wraith",  spr:ICE_WRAITH,  hp:38, sp:30, cs:140, atk:["volley","fade","volley","blink"], bc:"#5ef2ff", floats:true },
  ],
  boss: { name:"Glacier Queen", spr:GLACIER_QUEEN, hp:100, sp:10, cs:0, atk:["icicleRain","spiral","summonBats","icicleRain"], phase2:["frostRing","icicleRain","spiral","summonBats"], bc:"#b8e3ff", final:true },
};
