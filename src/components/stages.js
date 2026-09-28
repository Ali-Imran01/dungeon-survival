// Stage definitions: biome, rule, spawn table, 2 minibosses + 1 stage boss. Data only.
import { PAL, SLIME_BOSS } from "./sprites.js";
import { buildDungeon, drawDungeonAmbient, DUNGEON } from "./biomes/dungeon.js";
import { buildIce, drawIceAmbient, ICE } from "./biomes/ice.js";
import { buildLava, drawLavaAmbient, LAVA } from "./biomes/lava.js";
import { buildCrypt, drawCryptAmbient } from "./biomes/crypt.js";
import { buildVoid, drawVoidAmbient } from "./biomes/void.js";
import { RAT_KING, JAILER, DUNGEON_EPAL } from "./biomes/dungeon_enemies.js";
import { FROST_GOLEM, ICE_WRAITH, GLACIER_QUEEN, ICE_EPAL } from "./biomes/ice_enemies.js";
import { MOLTEN_SMITH, SALAMANDER, FORGEMASTER, LAVA_EPAL } from "./biomes/lava_enemies.js";
import { GRAVEKEEPER, DROWNED_KNIGHT, CRYPT_LICH, CRYPT_EPAL } from "./biomes/crypt_enemies.js";
import { RIFT_WEAVER, HOLLOW_LORD_TRUE, VOID_EPAL } from "./biomes/void_enemies.js";

export const KILLS_NEED = [15, 18, 22];        // kills to trigger miniboss 1, miniboss 2, stage boss
export const PHASE_FALLBACK = 75;              // seconds: boss comes anyway
export const SPAWN_BASE = [1.15, 1.0, 0.9, 0.85, 0.8];  // seconds between spawns at phase 0, per stage (−12% per phase)

export const STAGES = [
  { n: 1, key: "dungeon", name: "Dungeon", accent: "#9b7fd9", music: 1.0,
    build: (W, H, WALL, doc) => buildDungeon(W, H, WALL, 12, doc), ambient: (ctx, g, W, H, WALL, now) => drawDungeonAmbient(ctx, W, H, WALL, now),
    slimePal: { ...PAL, ...DUNGEON.slime },
    spawn: [["slime", 1]],
    minis: [
      { name: "Slime King", spr: SLIME_BOSS, pal: { ...PAL, g: "#6fcf6a", G: "#c9f59a", E: "#fff27a" }, hp: 24, sp: 18, cs: 140, atk: ["charge"], bc: "#c9f59a" },
      { name: "Rat King", spr: RAT_KING, pal: DUNGEON_EPAL, hp: 30, sp: 20, cs: 120, atk: ["lunge", "squeak", "lunge"], bc: "#b8a69c", scatterAt: [0.66, 0.33] },
    ],
    boss: { name: "The Jailer", spr: JAILER, pal: DUNGEON_EPAL, hp: 60, sp: 12, cs: 0, atk: ["ballSwing", "ballThrow", "releasePrisoners", "ballThrow"],
      phases: [{ at: 0.5, atk: ["chainHook", "ballSwing", "ballThrow", "releasePrisoners"], enter: "riot" }], bc: "#d4a82a" } },

  { n: 2, key: "ice", name: "Ice Cave", accent: "#7fb0dd", music: 0.95, rule: "ice",
    build: (W, H, WALL, doc) => buildIce(W, H, WALL, 12, doc), ambient: (ctx, g, W, H, WALL, now) => drawIceAmbient(ctx, W, H, WALL, now),
    slimePal: { ...PAL, ...ICE.slime },
    spawn: [["slime", 0.6], ["bat", 0.4]],
    minis: [
      { name: "Frost Golem", spr: FROST_GOLEM, pal: ICE_EPAL, hp: 34, sp: 12, cs: 120, atk: ["stomp", "boulder", "stomp", "charge"], bc: "#b8e3ff", trail: "ice" },
      { name: "Ice Wraith", spr: ICE_WRAITH, pal: ICE_EPAL, hp: 38, sp: 30, cs: 140, atk: ["volley", "fade", "volley", "blink"], bc: "#5ef2ff", floats: true },
    ],
    boss: { name: "Glacier Queen", spr: GLACIER_QUEEN, pal: ICE_EPAL, hp: 100, sp: 10, cs: 0, atk: ["icicleRain", "spiral", "summonBats", "icicleRain"],
      phases: [{ at: 0.5, atk: ["frostRing", "icicleRain", "spiral", "summonBats"], enter: "whiteout" }], bc: "#b8e3ff" } },

  { n: 3, key: "lava", name: "Lava Forge", accent: "#ff8a2a", music: 1.05, rule: "lava",
    build: (W, H, WALL, doc) => buildLava(W, H, WALL, 12, doc), ambient: (ctx, g, W, H, WALL, now) => drawLavaAmbient(ctx, W, H, WALL, now, g.biome.vents, g.ventT),
    slimePal: { ...PAL, ...LAVA.slime },
    spawn: [["magma", 0.7], ["imp", 0.3]],
    minis: [
      { name: "Molten Smith", spr: MOLTEN_SMITH, pal: LAVA_EPAL, hp: 40, sp: 14, cs: 0, atk: ["slam", "ingot", "slam", "stoke"], bc: "#ff8a2a" },
      { name: "Salamander", spr: SALAMANDER, pal: LAVA_EPAL, faces: true, hp: 36, sp: 40, cs: 160, atk: ["sprint", "spit", "sprint", "spit"], bc: "#ffd166" },
    ],
    boss: { name: "Forgemaster", spr: FORGEMASTER, pal: LAVA_EPAL, hp: 120, sp: 10, cs: 0, atk: ["meteors", "breath", "summonImps", "meteors"],
      phases: [{ at: 0.5, atk: ["eruption", "meteors", "breath", "eruption"], enter: "eruption" }], bc: "#d9433a" } },

  { n: 4, key: "crypt", name: "Flooded Crypt", accent: "#7dff9a", music: 0.9, rule: "water",
    build: (W, H, WALL, doc, g) => buildCrypt(W, H, WALL, 12, doc, g?.biomeGrow || 1), ambient: (ctx, g, W, H, WALL, now) => drawCryptAmbient(ctx, W, H, WALL, now, g.biome.pools),
    slimePal: { ...PAL, g: "#6f8f7a", G: "#a8c8a0" },
    spawn: [["skeleton", 0.6], ["drowned", 0.4]],
    minis: [
      { name: "Gravekeeper", spr: GRAVEKEEPER, pal: CRYPT_EPAL, hp: 44, sp: 14, cs: 0, atk: ["sweep", "dirt", "raise", "dirt"], bc: "#7dff9a" },
      { name: "Drowned Knight", spr: DROWNED_KNIGHT, pal: CRYPT_EPAL, hp: 48, sp: 22, cs: 130, atk: ["shieldCharge", "trident", "tide", "trident"], bc: "#4f9f96" },
    ],
    boss: { name: "Crypt Lich", spr: CRYPT_LICH, pal: CRYPT_EPAL, hp: 140, sp: 12, cs: 0, atk: ["soulChains", "boneSpears", "raiseDead", "soulChains"],
      phases: [{ at: 0.5, atk: ["pull", "soulChains", "poolBlink", "boneSpears", "raiseDead"], enter: "flood" }], bc: "#7dff9a" } },

  { n: 5, key: "void", name: "The Void", accent: "#b06bff", music: 1.1, rule: "dark",
    build: (W, H, WALL, doc) => buildVoid(W, H, WALL, 12, doc), ambient: (ctx, g, W, H, WALL, now) => drawVoidAmbient(ctx, W, H, WALL, now),
    slimePal: { ...PAL, g: "#5b3f8c", G: "#8a6fd1" },
    spawn: [["shade", 0.65], ["eye", 0.35]],
    minis: [
      { name: "Mirror Self", mirror: true, hp: 55, sp: 30, cs: 150, atk: ["mirrorAttack", "mirrorAbility"], bc: "#ff4fd8" },
      { name: "Rift Weaver", spr: RIFT_WEAVER, pal: VOID_EPAL, hp: 52, sp: 26, cs: 120, atk: ["openRifts", "web", "openRifts", "lunge"], bc: "#8a6fd1", riftShield: true },
    ],
    boss: { name: "Hollow Lord", spr: HOLLOW_LORD_TRUE, pal: VOID_EPAL, hp: 200, sp: 14, cs: 130, ring: 14, atk: ["ring", "charge", "spiral", "blink"], bc: "#ff4a6a", final: true,
      phases: [{ at: 0.66, atk: ["hollowGrasp", "ring", "summonShades", "spiral"], enter: "eclipse" },
               { at: 0.33, atk: ["soulStorm", "charge", "hollowGrasp", "ring"], enter: "collapse" }] } },
];
