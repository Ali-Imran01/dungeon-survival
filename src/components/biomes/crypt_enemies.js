// Stage 4 — Flooded Crypt enemies: sprites + tuning. All are undead: water does NOT slow them.
import { mirror8 as mirror } from "../sprites.js";

export const CRYPT_EPAL = {
  K:"#120e1a", w:"#e8e4d8", W:"#b8b09c", g:"#7dff9a", G:"#3fbf6a", z:"#6f8f7a", Z:"#4a6655", y:"#d8e070", q:"#3f7a4a",
  d:"#3a2e24", D:"#5a4636", J:"#7a7486", j:"#4a4450", u:"#2f6f6a", U:"#4f9f96", c:"#5ef2ff",
  m:"#3f2f5a", M:"#5a4a7a", n:"#342f48", N:"#4a4466", L:"#d4a82a",
};

// Regular: Skeleton — hp 2, speed 36. On death collapses into a bone pile; reassembles after 3s with 1 hp
//   unless the pile is hit again or walked over (shatters for good). Teaches finishing enemies off.
export const SKELETON = [
  "...KKKK...","..KwwwwK..","..KgKKgK..","..KwwwwK..","...KWWK...",".KwKwwKwK.",".KwKWWKwK.",
  ".KwKwwKwK.","..KKWWKK..","..Kw..wK..","..Kw..wK..","..KK..KK..",
];
export const BONE_PILE = ["..w.W...",".wWwKwW.","KWwKwWwK"];

// Regular: Drowned — hp 3, speed 30, lunges (speed 90 for 0.3s) when within 24px. Spawns FROM water pools
//   (≥50px from the player) with a 1s ripple telegraph, rising out of the water (draw only the top rows at first).
export const DROWNED = [
  "...KKKK...","..KzzzzK..","..KyzzyK..","..KzZZzK..","...KzzK...",".KzKZZKzK.","KzZKZZKZzK",
  "Kz.KZZK.zK","...KZZK...","..KqZZqK..","..KZKKZK..","..KZ..ZK..","..KK..KK..",
];

// Miniboss 1: Gravekeeper — hp 44, speed 14, cycle [sweep, dirt, raise, dirt]
//  sweep: shovel arc in front (100°, r 26), 0.5s windup with arc outline
//  dirt: lobs 3 dirt clumps at telegraphed spots (r 6, 0.9s)
//  raise: stands still for 1.2s channelling (lantern flares) → 3 Skeletons rise; takes DOUBLE damage while channelling
export const GRAVEKEEPER = [
  "....KKKKKK....","...KddddddK...",".KKKKKKKKKKKK.","...KWgWWgWK...","...KWWKKWWK...","..KKDDDDDDKK..",
  ".KDDDdDDdDDDK.","KgKDDdDDdDDKDK","KgKDDDDDDDDKdK",".K.KDDDDDDK.dK","...KDdDDdDK.dK","...KDDDDDDK.dK",
  "....KDKKDK..JK","....KdKKdK.JJK","....KKK.KK.KKK",
];

// Miniboss 2: Drowned Knight — hp 48, speed 22, cycle [shieldCharge, trident, tide, trident]
//  shieldCharge: 0.5s windup → charge (speed 130); while charging his shield blocks projectiles from the front — flank him
//  trident: thrown trident flies 90px and RETURNS (hits on both passes)
//  tide: pushes a wave line across the arena (speed 50) with one gap; touching it = 1 dmg + knockback
export const DROWNED_KNIGHT = [
  ".....KKKK.....","....KJJJJK....","...KJjjjjJK...","...KjKccKjK...","...KJjjjjJK...","..KKKjJJjKKK..",
  ".KuuKJjjJKJJK.","KuUuKjJJjKjjK.","KuUuKJjjJKqjK.","KuUuKjjjjKKK..","KuuuKJJJJK....",".KKKKjqjjK....",
  "....KjjKjjK...","....KJJKJJK...","...KJJK.KJJK..","...KKKK.KKKK..",
];
export const TRIDENT = ["K.K.K","JKJKJ","KJJJK","..J..","..J..","..J..","..J.."];

// Stage boss: Crypt Lich — hp 140, speed 12
//  Phase 1 (100–50%): cycle [soulChains, boneSpears, raiseDead, soulChains]
//   soulChains: 3 slow homing green skulls (speed 40, turn 2 rad/s, 4s life) — can be shot down (1 hp each)
//   boneSpears: a line of bone spikes erupts from the floor toward the player (telegraphed cracks, 0.8s)
//   raiseDead: 2 Skeletons + 1 Drowned
//  Phase 2 (<50%): "Flood" — all pools grow ×1.5 (rebuild bg with grow=1.5); he teleports between pools;
//   cycle [pull, soulChains, boneSpears, raiseDead]; pull: drags the player toward him (40 px/s) for 1.5s — move away to resist
export const CRYPT_LICH = mirror([
  ".........K","........Km",".......KmM","......KmMm","......KmLL","......KwWw",".....KwwKK",".....KwKgK",
  ".....KwwwK","......KWKw","......KwKw","...KKKKNKK","..KNnnKNnN",".KNnGnnKnn","KwKNnnnnNn","KgKNnnnnnn",
  ".K.KNnnnGn","...KNnnnnn","...KNNnnnn","..KNnNnnNn","..KKNKKNKn","...K.K..KK",
]);
export const SOUL_SKULL = [".KKK.","KgggK","KKgKK","KgggK",".KgK."];

export const CRYPT_STAGE = {
  spawnTable: [["skeleton", 0.6], ["drowned", 0.4]],
  minibosses: [
    { name:"Gravekeeper",    spr:GRAVEKEEPER,    hp:44, sp:14, cs:0,   atk:["sweep","dirt","raise","dirt"], bc:"#7dff9a" },
    { name:"Drowned Knight", spr:DROWNED_KNIGHT, hp:48, sp:22, cs:130, atk:["shieldCharge","trident","tide","trident"], bc:"#4f9f96" },
  ],
  boss: { name:"Crypt Lich", spr:CRYPT_LICH, hp:140, sp:12, atk:["soulChains","boneSpears","raiseDead","soulChains"], phase2:["pull","soulChains","boneSpears","raiseDead"], bc:"#7dff9a", final:true },
};
