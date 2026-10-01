# DS planning 2: surviving 360° spawns in one room

**Problem:** mobs spawn from every direction with no warning, so the player has no safe side to retreat to and dodging becomes luck.

## Ideas
1. **Telegraphed spawn gates.** Enemies appear after a marker (portal, crack, ripple) shows for ~0.6s. No spawns within ~30px of the player. Edit `spawnMob` / `spawnEnemy` in `enemies.js`.
2. **Rotating spawn sides.** Each wave uses 1-2 edges, with an on-screen arrow or colour showing which, so the player can read the pattern and kite away. Currently spawns are random.
3. **Spawn lanes.** Fixed gates (e.g. 4 doors) open and close in a visible sequence. Fits the parked room-based dungeon idea.
4. **Breathing waves.** Short bursts followed by calm gaps instead of a constant stream. The kill-gated phases already work this way, so this is a small change (`SPAWN_BASE` / spawn timer in `stages.js` / `engine.js`).
5. **Pressure-relief tools.** Make existing tools matter more: the armour blast could scale with nearby enemies, and Dash / Blink / Roll could clear a ring.
6. **Capped simultaneous enemies.** Hard cap of ~12-15 on screen with a queue that spawns more as enemies die. Difficulty then comes from enemy type and HP, not crowding.
7. **Enemy role mixing.** Fast chasers from one side, slow tanky ones from another, ranged enemies hold the edges, so the player can tell whom to dodge first.
8. **Ground hazard windows.** A shrinking safe zone, or pillars as cover that break enemy lines and give a place to funnel crowds.

## Recommendation
Do **1 (telegraphs), 6 (cap) and 2 (rotating sides)** first. They keep endless mode fair without new content. Check balance with `npm run sim`.

## Open question
Telegraphs + cap + rotating sides, or go straight to the room-based layout (pillars and gates)?

## Status (implemented: ideas 1, 2, 6)
- **Telegraphed gates:** a red cross marks the screen edge where an enemy will walk in; it flashes white in the last 0.25s, then the enemy spawns (`GATE.delay` 0.6s, `stepSpawns` / `drawGates` in `enemies.js`).
- **On-screen cap:** max 14 live regular enemies on desktop, 9 on Game Boy, gates included (`GATE.cap` / `GATE.capGB` in `stages.js`). Summons don't count. Skipped spawns are not queued.
- **Rotating sides:** one side at a time in phase 0, two from phase 1, rotating every 7s (`GATE.sideTime`). The active sides glow red along the wall.
- Not covered: Drowned still rise from water without a gate; boss summons still use all sides.
