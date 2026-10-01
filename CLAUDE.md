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
Sim flags: `--classes=warden,ranger,mage,gunner --god --gun.reload=2.2 --gun.dmg=2 --asn.markMul=1.5 --chr.dmg=2 --chr.pierce=1 --armor=on|off|on-1 --plates=N --repair=S --first=S --reset --pressure=X --bosshp=X --mortal`.
Testing: `?stage=N` in the URL starts runs at stage N. `npm run sim [runs]` plays full runs with a bot (no extra deps).

## Game flow
Stage → phase 0: regular spawns until 15 kills (or 75s) → miniboss 1 → phase 1: 18 kills → miniboss 2 → phase 2: 22 kills → stage boss
→ stage clear: Rare+ upgrade pick → next stage. Stage 5 boss (Hollow Lord) = win + class trophy.
Regular spawns stop during bosses; summoned adds (`summon: true`) never count toward progress.
Difficulty steps by stage/phase (spawn interval `SPAWN_BASE[stage] × (1 − 0.12·phase)`, enemy HP +20%/phase, speed +5%/phase), not by time.
XP: kills drop soul shards (magnet 24px) → `XP.need(lv) = 25 + 6(lv−1)` → level-up pick 1 of 3 (1 reroll per stage).
Boss contact only hurts during moving attacks (charge/lunge/sprint); walking bosses just shove.

## Endless mode
After the Hollow Lord win (trophy awarded first) the win screen offers **Continue into Endless**: `continueEndless(g)` keeps the run/build, opens the Rare+ pick, then `nextStage` wraps stage 5 → 1 with `g.loop++`. Per loop (`LOOP` in stages.js): enemy+boss HP ×(1+0.25·loop), enemy speed +5%/loop (cap ×1.5), spawn interval ×0.92^loop. In endless the Hollow Lord is a normal stage boss (no win). Best depth (loop·5+stage) per class in localStorage `wisp-endless`. If every upgrade is maxed the pick is skipped (`offer` / `g.autoNext`). Sim: `npm run sim 2 -- --endless --mortal` reports `endlessDepth`; first run (warden/ranger) hit the 4000s cap at depth 42-51, so scaling is probably too gentle.

## Rooms (all stages) + spawn rules
Each stage is 3 rooms, one per phase (`g.room` = phase; default on, `opts.rooms`, sim `--norooms`): regulars → that phase's boss in the same room → boss dies → door on the right wall (`g.door`, `openDoor`) → fade (`g.trans`, `stepTrans`) → next room (new layout via the `room` arg of each biome builder, per-room `LIGHTS`, `roomTint` in stages.js, stronger each room). Regular spawns use telegraph gates (`g.gates`, `GATE` in stages.js: 0.6s delay, cap 14 desktop / 9 Game Boy), and spawn sides rotate every 7s (`g.sides`, 1 side in phase 0, 2 after). Plans: docs/ds-planning-2.md, ds-planning-3.md.

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
| Attack | great sword 2 dmg / 0.70s, aimed 110° sweep, reach 24 (centre → target edge) | arrow 1 dmg / 0.28s, range 120 | homing orb 2 dmg / 0.70s, splash 16 + chill |
| Ability | Dash (1.2s) | Roll + back-arrow (1.2s) | Blink (2.0s) |
| Companion | Wisp (shots) | Hawk (swoops, knockback) | Familiar (blocks bullets) |
Warden swing: aims at the nearest target (any direction), alternates slash direction, 0.26s (windup 0.10 → hit at 0.11 left → follow-through). Hit = sector of 110° (+20° per Wide Arc), reach measured to the target's EDGE, so the drawn slash arc (engine `drawSwing`) equals the hit area. Whirlwind = full circle. Sprite: knight in shining armour — right half of the body is auto-shaded darker (`shadeRight`), great-helm with nose guard + purple plume, purple tabard/cape, NO shield, sparkle glint every 2.6s (`HERO.warden.glint`), own `legs`; rest pose = great sword held upright; the sprite\'s static sword is only used in previews/Mirror Self, in-game the blade is drawn by the engine (`noWeapon`).
Caps: attack interval ≥50% of base, cooldown ≥50%, move ≤×1.4, damage ≤×1.6.

## Roster: 6 classes (design in `docs/characters.md`)
Live in code: Warden (knight in shining armour), Ranger, Mage, **Gunner** (4-pellet shotgun: 2 dmg/pellet, only fires within 40px, 6-shell cylinder + 2.6s reload, Deadshot power-up = one-hit-kill bullet, no range limit, Recoil Jump, Bomb Buddy; tuned via `GUN`), **Assassin** (Twin Fangs stabs, Shadow Step → x3 Ambush, Shade Cat marks, Twin Step charges; tuned via `ASN`; Executioner = kills refund 1.5s of Step cooldown), **Chronomancer** (Echo Bolt: 2 dmg, pierce 1, echo 0.7s later from the old spot; Rewind = jump back 2s + recover plates; Sandling drops stasis bubbles; tuned via `CHR`). All six classes are playable. Unlocks (`UNLOCK` in classes.js, trophies in localStorage `wisp-trophies`): win with Warden → Assassin, Ranger → Gunner, Mage → Chronomancer; locked classes show a silhouette + hint in class select; `?unlock=1` unlocks all for testing. Left to do: 6-card select layout / Mirror Self variants / sounds.

## Armour (passive, every class) — `ARMOR` in engine.js
3 plates absorb hits before hearts (order: Soul Shield power-up → plates → hearts). One timer: a broken plate returns after 5s (timer keeps running when
more plates break; `ARMOR.resetOnHit` makes it restart on every hit). When the LAST plate breaks → blast (r 34: push 38, 0.5 dmg ×damage mods, bullets
cleared, bosses stagger 0.8s + tiny push, 1.5s invulnerability) and the first plate needs 15s, the rest 5s each (25s full recovery). Stage clear refills all plates.
HUD: plate row under the hearts (recharge fills from the bottom; red blinking outline at 0 plates). Sim tracks `platesBroken / blasts / heartHits / noArmour_%`.
**Balance impact (sim, 8 runs/class, bot wins with old rules: W 2/8, R 5/8, M 1/8):** with 3 plates 5s/15s every class wins 8/8 and loses ~1 heart per whole run.
**Owner is happy with armour as designed: NO difficulty compensation is planned** (sim: every class wins almost every run; accepted). Tested and rejected: slower repair, 2 plates, -1 heart, more enemy pressure / boss HP.
Ideas: Soul Shield / Guardian Spark / Vitality overlap with plates → turn into armour upgrades (+plate, faster repair, blast power); heart pickups at full hearts could restore a plate.

## Balance status (sim, 4 runs/class)
Boss fights (god mode): Warden ≈ 1.2–1.5× the Ranger's time (Hollow Lord ≈ 2×); Mage 1.3–2× slower on Lich / Hollow Lord → needs a buff or boss-specific tuning.
Sim bot for the Warden keeps ~15–21px from targets (just inside sword reach); with that spacing it survives ≈180s vs ≈35s when it hugs enemies. Always re-run `npm run sim` after tuning.

## Ideas (parked)
- Class passives: Warden "Bulwark" (hit → knockback 40px), Ranger "Momentum" (+15% atk speed while moving), Mage "Arcane Echo" (every 4th orb 1.5× splash, 2s chill)
- Endless mode after stage 5 (return of Ember/Frost/Void Slime), global leaderboard (Cloudflare Worker + D1/KV), meta unlocks, v2 open room-based dungeon

## Notes for Claude
- Owner prefers concise answers and code-first output; show only changed code unless asked.
- Verify with `npm run build`, `npx oxlint`, `npm run sim`, and a browser check (`?stage=N`) when visuals change.
