// Stage 5 — The Void enemies: sprites + tuning. Eyes (e/E/w) are redrawn above the darkness.
import { mirror8 as mirror } from "../sprites.js";

export const VOID_EPAL = {
  K:"#120e1a", v:"#1a1030", V:"#2e1d52", p:"#5b3f8c", P:"#8a6fd1", e:"#ff4fd8", E:"#ffffff", w:"#e8e4f5",
  h:"#2b2140", H:"#4a3570", L:"#d4a82a", r:"#ff4a6a", X:"#5ef2ff",
};
export const EYE_KEYS = ["e", "E", "r", "X"];    // pixels with these keys are drawn again above the darkness

// Regular: Void Shade — hp 2, speed 38; every 2.5s blinks 20px toward the player (0.3s shimmer first). Only its eyes show in the dark.
export const VOID_SHADE = [
  "...KKKK...","..KVVVVK..",".KVvvvvVK.",".KveVVevK.",".KvvvvvvK.","..KvVVvK..",".KvvvvvvK.",
  "KvVvvvvVvK","KvvvvvvvvK",".KvKvvKvK.","..K.KK.K..",".K......K.",
];
// Regular: Void Eye — hp 2, floats ~70px away, fires a slow dark bolt every 3s (speed 45).
//   It GLOWS (light r 30): killing it removes light from that part of the arena — kill it or use its light?
export const VOID_EYE = ["..KKKKK..",".KwwwwwK.","KwweeewwK","KweeKeewK","KwweeewwK",".KwwwwwK.","..KKKKK..",".p..p..p.","p...p...p"];
export const DARK_BOLT = [".K.","KeK",".K."];

// Miniboss 1: Mirror Self — hp 55. A shadow copy of YOUR class (drawHero with SHADOW palette) using your attack + ability:
//  Warden copy: dash-slash; Ranger copy: arrow volleys + roll; Mage copy: slow homing orbs + blink.
//  After each ability it recovers for 1s and takes DOUBLE damage. Fight yourself.
// palette for the Mirror Self: a dark purple silhouette copy of the player's class, with glowing pink eyes/gems
const SHADOW_DARK = ["h", "C", "B", "d", "H", "b"];
const SHADOW_GLOW = ["E", "y", "X"];
export const SHADOW = new Proxy({}, {
  get: (_, k) => {
    if (k === "K") return "#120e1a";
    if (SHADOW_GLOW.includes(k)) return "#ff4fd8";
    if (SHADOW_DARK.includes(k)) return "#2e1d52";
    return "#5b3f8c";
  },
});

// Miniboss 2: Rift Weaver — hp 52, speed 26, cycle [openRifts, web, openRifts, lunge]
//  openRifts: opens up to 3 Rifts (hp 4 each, fire a bolt at the player every 2s, light r 18)
//  While ANY rift is open the Weaver takes 50% damage → close the rifts first.
//  web: 3 web patches (r 10) that slow the player to 60% for 5s ; lunge: short charge
export const RIFT_WEAVER = [
  ".......KKKK.......","......KPPPPK......","..K..KPeppePK..K..",".K.KKPPPPPPPPKK.K.","K.K.KVVVVVVVVK.K.K","K.KKVvvvvvvvvVKK.K",
  ".KK.KvVvEEvVvK.KK.","K..KKvvvvvvvvKK..K","K.K..KvvvvvvK..K.K",".K..K.KVVVVK.K..K.",".K.K...KKKK...K.K.","K..K..........K..K",
];
export const RIFT = [".KKKKK.","KpPPPpK","KPVvVPK","KPvEvPK","KPVvVPK","KPvvvPK","KPVvVPK","KpPPPpK",".KKKKK."];

// FINAL BOSS: Hollow Lord, True Form — hp 200, speed 14 (moves here from stage 1)
//  Phase 1 (100–66%): original kit — ring, charge, spiral, blink (callback to stage 1)
//  Phase 2 (66–33%) "Eclipse": player vision shrinks 52 → 36; summons 3 Shades; adds hollowGrasp:
//    shadow hands burst from the floor at 4 telegraphed spots that follow your path (0.8s delay each)
//  Phase 3 (<33%) "Collapse": the platform's outer ring crumbles (playable area shrinks ~15% over 10s);
//    all patterns 20% faster; soulStorm: rotating bullet rings with 2 gaps for 4s
//  Death: light floods the arena (white fade 1s) → trophy screen
export const HOLLOW_LORD_TRUE = mirror([
  "....L.......L","....LL.....LL",".....LLLLLLLL",".....KKKKKKKK","....KhhhhhhhH","...KhhHHHHHHH","...KhHKKKKKKK","...KhKKrrKKKK",
  "...KhKKKKKKKK",".K.KhhKKKKKKK","KpK.KhhHHHHHH","KpPKKhhhhhhhh","KpPPKKhhhhhhh",".KpPPKhhHhhhh","..KpPKhhhHhhh","..KXKKhhhhhhh",
  "...K.KhhHhhhh",".....KhhhhHhh",".....KhhhhhHh","....KhhhHhhhh","....KhhhhhHhh","...KhhKhhhKhh","...KK.KKhKK.K","......K..K...",
]);

export const VOID_STAGE = {
  spawnTable: [["shade", 0.65], ["eye", 0.35]],
  minibosses: [
    { name:"Mirror Self", spr:"mirror", hp:55, sp:"player", atk:["classAttack","classAbility"], bc:"#ff4fd8" },
    { name:"Rift Weaver", spr:RIFT_WEAVER, hp:52, sp:26, cs:120, atk:["openRifts","web","openRifts","lunge"], bc:"#8a6fd1" },
  ],
  boss: { name:"Hollow Lord", spr:HOLLOW_LORD_TRUE, hp:200, sp:14, cs:130, ring:14, phases:[
    { until:0.66, atk:["ring","charge","spiral","blink"] },
    { until:0.33, atk:["hollowGrasp","ring","summonShades","spiral"], vision:36 },
    { until:0,    atk:["soulStorm","charge","hollowGrasp","ring"], collapse:true, speedMul:1.2 },
  ], bc:"#ff4a6a", final:true },
};
