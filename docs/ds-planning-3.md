# DS planning 3: map expansion with rooms and doors

**Problem:** the whole game is one 240×135 arena. More space would help dodging and variety, but a scrolling camera would make the Game Boy view (160×144) even tighter.

## Idea
Each stage is a short chain of single-screen rooms. The player starts in one room, and finishing a phase (kill gate, miniboss) opens a door to the next room. Crossing the door snaps the screen to the new room, Zelda-style. There is no scrolling, so it works at both resolutions.

## How it maps to what exists
- **Rooms = phases.** A stage already has 3 phases (regular spawns, miniboss 1, miniboss 2, then the stage boss). Suggested layout: regular room, miniboss room(s), boss room. `KILLS_NEED` and `g.phase` (`engine.js`, `stages.js`) decide when a door opens.
- **Per-room layout.** Reuse `g.bounds` / `resetBounds` and `ensureBiome` / `biomeGrow` to build each room's walls and biome. Rooms can differ (pillars, cover, hazards).
- **Spawn rhythm per room.** The telegraphed gates, on-screen cap and rotating sides from `ds-planning-2.md` apply inside each room, so the 360° problem is handled room by room.
- **Biome rules** (ice, lava vents, water, darkness) keep working because they belong to the stage.

## Why it fits
- More map without scrolling.
- Each room gets its own spawn pattern.
- Works on desktop and Game Boy sizes.
- Cheaper than a chunked endless map.

## Open design points
- Door placement and the transition effect (snap, fade, short slide).
- Can the player go back to earlier rooms, or do doors lock behind them?
- What carries over between rooms: enemies cleared, soul shards, power-ups, armour plates.
- Boss-room entry: lock the door, show the boss intro.
- Game Boy layout for door positions.
- Sim bot navigation (it assumes one room today).
- Interaction with endless mode (rooms per loop).

## Risks
- Biome builders take `W`/`H` and build one biome per stage; not yet checked in detail how much needs to change.
- The sim bot has no concept of doors or room changes.

## Suggested first step
Prototype two rooms in stage 1 behind a flag (regular room, then miniboss room), with a door that opens when the kill gate is met. Check balance with `npm run sim` after teaching the bot to walk to the door.

## Status (implemented)
**3 rooms per stage, all 5 stages** (one room per phase). Room = regular spawns until the kill gate, then that phase's boss in the same room. When a **miniboss dies** a door opens on the right wall, then a fade into the next room (new hazard layout, moved lights, stronger tint each room). Room 3 holds phase 2 and the stage boss; stage clear works as before and the Hollow Lord ends the campaign. Doors lock behind you. `g.room` = phase; `--norooms` turns it off in the sim. Verified at 240×135 and 160×144.
