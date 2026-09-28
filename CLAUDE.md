# Dungeon Survival

Pixel-art arena roguelike (inspired by Soul Knight), 5 stages. Standalone site on Cloudflare Pages.
Stack: React + TypeScript app shell; game = plain JavaScript on Canvas 2D + Web Audio API. No engine, no asset files.
Design (maps/characters) is done in claude.ai chat; implementation and balancing happen here.

## Architecture (`src/components/`)
| File | Role |
|---|---|
| `DungeonSurvival.jsx` | React UI: title, class select, level-up / stage-clear cards, pause (Resume/Build/Settings), results, Game Boy shell |
| `engine.js` | State (`newGame`), `step`, `draw`, player, companions, projectiles, hazards, progression, XP, stage rules, `hudState` |
| `stages.js` | `STAGES[5]`: biome build/ambient, rule, spawn table, 2 minibosses + stage boss (data), `KILLS_NEED`, `SPAWN_BASE` |
| `enemies.js` | `ENEMIES` table + regular AI (chase, slide, wave, ranged, blink, lunge, piles, turrets, healer rats) |
| `bosses.js` | Boss framework + `ATK` attack library (all 15 bosses) + phase transitions |
| `classes.js` | Warden / Ranger / Mage: stats, `attack`, `ability`; reads `g.mods` |
| `upgrades.js` | XP curve, 22 upgrades, rarity, `rollChoices`, `computeMods`, `atkInterval`, icons |
| `powerups.js` | Temporary power-ups (8s, levels I–III) |
| `hud.js` | Canvas HUD + 3×5 pixel font (`drawHUD`) |
| `sprites.js` | Hero sprites, icons, palettes, `drawHero(ctx, key, h, now, palOverride?)` |
| `audio.js` | Procedural SFX + music (tracks: normal, boss, final) |
| `biomes/*.js` | Per-stage background builders, ambient animation, enemy/boss sprites |

Conventions: sprites are string arrays keyed to palette letters (`.` = transparent). Entities have `x, y, w, h`; centre = `x + w/2, y + h/2`.
Logical resolution 240×135 (desktop) or 160×144 (Game Boy mode; auto on touch devices or `gameboy` prop).
localStorage keys use the `wisp-*` prefix — keep them so saves carry over.
Testing: `?stage=N` in the URL starts runs at stage N. `npm run sim [runs]` plays full runs with a bot (no extra deps).

## Game flow
Stage → phase 0: regular spawns until 15 kills (or 75s) → miniboss 1 → phase 1: 18 kills → miniboss 2 → phase 2: 22 kills → stage boss
→ stage clear: Rare+ upgrade pick → next stage. Stage 5 boss (Hollow Lord) = win + class trophy.
Regular spawns stop during bosses; summoned adds (`summon: true`) never count toward progress.
Difficulty steps by stage/phase (spawn interval `SPAWN_BASE[stage] × (1 − 0.12·phase)`, enemy HP +20%/phase, speed +5%/phase), not by time.
XP: kills drop soul shards (magnet 24px) → `XP.need(lv) = 25 + 6(lv−1)` → level-up pick 1 of 3 (1 reroll per stage).
Boss contact only hurts during moving attacks (charge/lunge/sprint); walking bosses just shove.

## Stages
| # | Biome | Rule | Regulars | Minibosses | Stage boss |
|---|---|---|---|---|---|
| 1 | Dungeon | — | Slime | Slime King, Rat King (rats heal him) | The Jailer (ball & chain, hook) |
| 2 | Ice Cave | slick patches (slide) | Frost Slime, Frost Bat | Frost Golem, Ice Wraith (chill, fade) | Glacier Queen (icicle rain, whiteout, frost ring) |
| 3 | Lava Forge | vents erupt (hurt all) | Magma Slime (splits), Fire Imp (ranged) | Molten Smith (stoke vents), Salamander (fire trail, pant) | Forgemaster (meteors, breath, eruption waves) |
| 4 | Flooded Crypt | water slows player | Skeleton (reassembles), Drowned (from water) | Gravekeeper (raise = 2× dmg), Drowned Knight (front shield, trident) | Crypt Lich (skulls, spears, flood, pull) |
| 5 | The Void | darkness (vision 52/44px) | Shade, Void Eye (gives light) | Mirror Self (copies your class), Rift Weaver (rifts halve dmg) | Hollow Lord True Form (3 phases: eclipse, collapse) |

## Classes (current)
| | Warden | Ranger | Mage |
|---|---|---|---|
| HP / speed | 4 / 62 | 3 / 78 | 3 / 53 |
| Attack | dagger 2 dmg / 0.70s, reach 22 | arrow 1 dmg / 0.28s, range 120 | homing orb 2 dmg / 0.70s, splash 16 + chill |
| Ability | Dash (1.2s) | Roll + back-arrow (1.2s) | Blink (2.0s) |
| Companion | Wisp (shots) | Hawk (swoops, knockback) | Familiar (blocks bullets) |
Caps: attack interval ≥50% of base, cooldown ≥50%, move ≤×1.4, damage ≤×1.6.

## Balance status (sim, 4 runs/class)
Boss fights: Warden ≈ Ranger; Mage ~1.5–2.5× slower on late stage bosses (Lich, Hollow Lord) → needs a buff or boss-specific tuning.
Bot survival is not representative for Warden (bot walks into enemies). Always re-run `npm run sim` after tuning.

## Ideas (parked)
- Class passives: Warden "Bulwark" (hit → knockback 40px), Ranger "Momentum" (+15% atk speed while moving), Mage "Arcane Echo" (every 4th orb 1.5× splash, 2s chill)
- Endless mode after stage 5 (return of Ember/Frost/Void Slime), global leaderboard (Cloudflare Worker + D1/KV), meta unlocks, v2 open room-based dungeon

## Notes for Claude
- Owner prefers concise answers and code-first output; show only changed code unless asked.
- Verify with `npm run build`, `npx oxlint`, `npm run sim`, and a browser check (`?stage=N`) when visuals change.
