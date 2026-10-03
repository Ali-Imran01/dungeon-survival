# Character Design

## Overview

The game has **six playable classes**, arranged as 3 roles × 2 styles. Every class answers the same question ("how do I survive?") in a different way.

| Role | Style A | Style B |
|---|---|---|
| **Melee** | **Warden** — knight, tank, wide sword sweeps | **Assassin** — skirmisher, burst, blink-strikes |
| **Ranged** | **Ranger** — mobile, sustained arrow fire | **Gunner** — magazine burst, recoil jumps, bomb-bot |
| **Magic** | **Mage** — AoE control, homing orbs, chill | **Necromancer** — summoner: soul bolts, grave fog, raise dead |

```text
Warden   = I survive by fighting up close.
Assassin = I survive by never being where the attack lands.
Ranger   = I survive by staying away.
Gunner   = I survive by killing before it arrives.
Mage     = I survive by controlling the battlefield.
Necromancer = I let the dead do the fighting.
```

Colour identity (so classes read at a glance): Warden **purple + steel**, Ranger **green**, Mage **blue**, Assassin **slate + red**, Gunner **brown + orange**, Necromancer **teal-green + violet**.
Silhouettes: plumed helm + great sword / hood / pointed hat / slim hood + twin daggers / wide-brim hat / hooded caster with a skull staff.

---

## Systems shared by every class

| System | Rule |
|---|---|
| **Hearts** | Warden 4, all others 3 |
| **Armour (passive)** | 3 plates absorb hits before hearts. A broken plate returns after 5s. When the *last* plate breaks: blast (radius 34, pushes mobs 38px, 0.5 dmg, clears bullets, staggers bosses 0.8s, 1.5s protection); the first plate then takes 15s to return, the rest 5s each. Stage clear refills all plates. |
| **Attack** | Automatic. The class decides targeting and rhythm. |
| **Ability** | One button (Space / A). Every ability is also an escape tool. |
| **Companion** | One per class, with a distinct job (see each class). |
| **Class power-ups** | Two timed pickups per class (8s, stack to level III). Shared: heart, shield, swift boots. |
| **Class upgrades** | Four per class (1 Common, 1 Rare, 2 Epic) mixed into the level-up pool. |
| **Unlocks** | Start with Warden, Ranger, Mage. **Win with the Warden → unlock Assassin; Ranger → Gunner; Mage → Necromancer.** Six trophies = "Master of Souls". |

Design rules that apply to all classes:

1. Each class needs a clear weakness; none is best at everything.
2. Theoretical single-target DPS is kept near **3.5** for every class. Differences come from range, burst vs sustained, area, and risk.
3. Power-ups and upgrades must change *how you play*, not only add numbers. Caps: attack interval ≥ 50 % of base, cooldown ≥ 50 %, move speed ≤ ×1.4, damage ≤ ×1.6.
4. Every ability (Dash, Roll, Blink, Shadow Step, Recoil Jump, Smoke Step) must feel different even though all are mobility.

---

## 1. Warden (Knight)

**Role:** Melee tank / bruiser
**Playstyle:** Stands in the middle of the fight and sweeps groups with a wide sword arc.

**Look:** A **knight in shining armour**: polished full plate lit from the upper left (the right half is shaded, and a sparkle glints over the armour every few seconds), great-helm with a nose guard and glowing cyan eyes, purple plume, purple tabard and cape with gold trim and a cyan soul-gem belt. **No shield.** He carries a **great sword** (2 px wide blade, held point-up at rest).

| Attribute | Design |
|---|---|
| Hearts | 4 (+3 armour plates) |
| Speed | 62 (normal, 100 %) |
| Attack | Aimed great-sword sweep |
| Damage / interval | 2 dmg every 0.70 s |
| Arc / reach | 110° sector (+20° per Wide Arc); reach **24 px** measured from his centre to the target's **edge** (was 22; the bigger sword) |
| Ability | Dash (cooldown 1.2 s): 0.15 s, speed 190, 0.35 s invulnerable |
| Companion | Wisp: 1 dmg shot every 1.5 s, range 110 |
| Class power-ups | Frenzy, Soul Surge |
| Class upgrades | Wide Arc (C), Guarded Dash (R), Whirlwind (E), Shock Dash (E) |

### Attack — Great-sword sweep
- Turns toward the **nearest target in any direction** (not only left/right).
- 0.26 s swing: windup 0.10 s → **hit lands mid-slash** → follow-through. Slash direction alternates each swing.
- The drawn slash arc has the same radius and angle as the hit area, so range can be judged by eye.
- Whirlwind makes every 4th swing a full-circle spin; Frenzy turns the trail gold, adds reach and speeds swings.
- Knocks enemies back 10 px on hit.

### Ability — Dash
Short straight dash with invulnerability: an escape from a crowd, or a way to cross an enemy line. Guarded Dash and Shock Dash upgrade it.

### Companion — Wisp
Orbits him and fires support shots. It stays secondary; his sword is the main weapon.

### Strengths / weaknesses
**Strengths:** most hearts, area damage in front of him, reliable knockback, safe engage with Dash.
**Weaknesses:** must be close; the sweep only covers 110°, so being surrounded is dangerous; slowest boss kills of the melee/ranged classes.

### Balance status (simulation)
- Boss fights (god mode): about **1.2–1.5×** the Ranger's time; Hollow Lord about 2×.
- Bot that keeps ~15–21 px from targets (just inside reach) survives ≈180 s; a bot that hugs enemies ≈35 s. Spacing is the skill, and the visible arc now teaches it.
- If he still feels weak after human playtests, options in order of preference: Dash invulnerability 0.35 → 0.5 s; Wisp damage/rate; a 5th heart. (The reach 22 → 24 change with the bigger sword was already a small buff.) (Class passives are parked.)

---

## 2. Ranger

**Role:** Ranged sustained DPS / mobility
**Playstyle:** Keeps distance and never stops moving.

| Attribute | Design |
|---|---|
| Hearts | 3 (+3 plates) |
| Speed | 78 (fast, ~125 %) |
| Attack | Auto-fire arrows at the nearest enemy |
| Damage / interval | 1 dmg every 0.28 s (≈3.6 dps), range 120 |
| Ability | Roll (cooldown 1.2 s): 0.2 s, speed 170, 0.3 s invulnerable, **fires an arrow backward** |
| Companion | Hawk: swoops at enemies within 50 px, 1 dmg, knockback 22, slows 0.6 s; cooldown 2.5 s |
| Class power-ups | Multishot, Piercing |
| Class upgrades | Longbow (C), Extra Arrow (R), Ricochet (E), Trap Roll (E) |

**Strengths:** fastest, safest, best sustained single-target.
**Weaknesses:** fragile if caught; weak against big groups; needs line of fire.

---

## 3. Mage

**Role:** Ranged AoE / crowd control
**Playstyle:** Controls groups from a distance.

| Attribute | Design |
|---|---|
| Hearts | 3 (+3 plates) |
| Speed | 53 (slow, ~85 %) |
| Attack | Homing soul orbs (turn rate 4 rad/s, life 1.2 s) |
| Damage / interval | 2 dmg every 0.70 s; splash radius 16 px (1 dmg) that also **chills** for 1 s; range 125 |
| Ability | Blink (cooldown 2.0 s): 36 px teleport in the move direction (away from the nearest enemy if standing still); never lands inside an enemy; 0.25 s invulnerable |
| Companion | Familiar: orbits and blocks enemy bullets (2 charges, 1.5 s recharge), bumps and slows enemies it touches |
| Class power-ups | Overload, Frost Nova |
| Class upgrades | Big Splash (C), Deep Freeze (R), Split Orb (E), Frost Blink (E) |

**Strengths:** homing, splash, chill, bullet-blocking companion.
**Weaknesses:** slow; low burst on one target; late bosses (Lich, Hollow Lord) take her 1.3–2× longer than the others — flagged for a buff.

---

## 4. Assassin *(new — playable, locked until you win with the Warden)*

**Role:** Melee burst / skirmisher
**Playstyle:** Blink behind a target, land a devastating opener, slip away before the hit comes back.

**Look:** Slim slate-grey hood, white eyes over a red mask-scarf with a trailing tail, twin reverse-grip daggers. Fastest melee silhouette.

| Attribute | Design |
|---|---|
| Hearts | 3 (+3 plates) |
| Speed | 74 (fast, ~120 %) |
| Attack | **Twin Fangs**: rapid alternating stabs at the nearest enemy |
| Damage / interval | 1 dmg every 0.34 s (≈2.9 dps), 90° arc, reach **16 px** (edge) |
| Ability | **Shadow Step** (cooldown 3.5 s): teleports up to 90 px to just behind the nearest enemy/boss (no target: 40 px blink forward), 0.3 s invulnerable |
| Ambush | After a Shadow Step, the next attack within 2 s is an **Ambush**: ×3 damage (3 dmg), 120° arc, stuns 0.5 s (≈ +0.9 dps averaged) |
| Companion | **Shade Cat**: every 6 s pounces on the nearest unmarked enemy within 100 px, pins it 0.8 s and **marks** it (+50 % damage taken for 4 s) |
| Class power-ups | **Phantom** (Shadow Step cooldown ÷3 for 8 s), **Bloodrush** (each kill: +25 % attack and move speed for 2 s, stacks ×4) |
| Class upgrades | **Sharp Edge** (C: Ambush +0.5× per stack), **Afterimage** (R: Step leaves a decoy that enemies chase for 2 s), **Executioner** (E: each kill refunds 1.5 s of Shadow Step cooldown), **Twin Step** (E: Shadow Step holds 2 charges) |

**Strengths:** highest burst, best mobility, marks make every fight faster.
**Weaknesses:** shortest reach in the game (16 px), no ranged fallback, every stab puts him inside contact range; Step can land him in a boss's charge lane.
**Implementation notes:** stabs are aimed like the Warden's sweep but with a 90° arc and 16 px reach; every hit pushes enemies back only 2 px so they stay in reach. Shadow Step lands just behind the target and shows **red landing brackets** while it is ready; a red **AMBUSH bar** shows the 2 s window (plus one pip per charge with Twin Step). Marked enemies get a red diamond. Afterimage draws a ghost of him where he left. Bloodrush caps his speed at ×1.8.
**Design change:** the spec's Executioner ("enemies below 25 % HP die instantly") was dropped because regular enemies only have 2–4 HP and die in a few stabs anyway, so it would never matter; the cooldown refund gives kills real value and chains with Bloodrush.
**Tuning (simulation):** with the numbers above his total boss time is ≈198 s (Ranger 174, Gunner 197, Warden 243, Mage 319), so nothing was changed. Weakening the mark to ×1.3 pushed him to 231 s. Values live in `ASN` in `classes.js`. Note: a bot that hugs enemies dies within seconds, one that stays ~14 px away (just inside reach 16) survives the whole run; spacing is the skill.
**Why he is not "Warden with a dash":** short reach + teleport + burst, versus the Warden's wide reach + tanking. The Warden stands still and sweeps; the Assassin never stops moving.

---

## 5. Gunner *(new — playable, locked until you win with the Ranger)*

**Role:** Ranged burst / heavy hitter
**Playstyle:** Empty a cylinder into the closest threat, jump away while reloading, let the bomb-bot handle the crowd.

**Look:** Wide-brim tan hat, brass goggles with orange lenses, brown trench coat, chunky hand cannon. Slower, heavier silhouette than the Ranger.

| Attribute | Design |
|---|---|
| Hearts | 3 (+3 plates) |
| Speed | 60 (slightly slow, ~97 %) |
| Attack | **Shotgun**: 6-shell cylinder, auto-fires a **4-pellet spread** at the nearest enemy, but **only within 40 px** (pellets die at 40 px, so nothing at range) |
| Damage / interval | 2 dmg per pellet (up to 8 per blast at point blank, 3-4 pellets land on small enemies), one blast every 1.0 s; **reloads 2.6 s** when empty |
| Ability | **Recoil Jump** (cooldown 3.5 s): fires a shell at the nearest enemy (2 dmg, 60° cone, 45 px, knockback 14) and is thrown 42 px backward (0.14 s, 0.25 s invulnerable); **instantly reloads** |
| Companion | **Bomb Buddy**: waddles to the densest cluster within 90 px, arms for 0.6 s, explodes (3 dmg, radius 22, knockback 12); rebuilds in 6 s |
| Class power-ups | **Bottomless** (no reload and −15 % interval for 8 s), **Deadshot** (8 s: a one-hit-kill bullet with no range limit, no ammo use; kills any regular enemy, bosses take a flat 3 dmg per bullet; replaces Buckshot, internal key still `buckshot`) |
| Class upgrades | **Big Mag** (C: +2 rounds per stack), **Blast Shell** (R: Recoil Jump +1 dmg and wider cone), **Dead Eye** (E: the last round of every magazine is a heavy round: ×4 dmg, pierces everything), **Twin Bots** (E: a second Bomb Buddy) |

**Strengths:** heavy bursts, good crowd-clear from the bomb-bot, Recoil Jump is offence + escape + reload in one.
**Weaknesses:** the reload window (2.6 s of no damage), slow walking, must let enemies get within 40 px to shoot at all (nothing at range, so swarms get at him); Recoil Jump moves him *away* from the target he is shooting.
**Implementation notes:** the gun is drawn along the aim direction while shooting; ammo pips (or a RELOAD bar) sit above the ability icon; Recoil Jump fires opposite the direction of travel when no enemy is near; the Bomb Buddy only hunts clusters of 2+ (or a threat within 45 px, or a boss).
**Tuning (simulation):** first numbers (reload 1.5 s, stronger pellets) made his boss fights ~1.5× faster than the Ranger. Reload 2.2 s, pellets 0.6 dmg and Bottomless −15 % bring his total boss time to ≈197 s vs Ranger 174 s, Warden 243 s, Mage 319 s (all tunable in `GUN` in `classes.js`).
**Rework (shotgun):** the long-range hand cannon was too strong, so the weapon is now a 4-pellet close-range shotgun (`GUN` in `classes.js`: range 40, pellets 4, dmg 2, interval 1.0, reload 2.6). Sim (6 runs): he is now the weakest class in survival (4/6 wins, 3 heart hits per run) but still kills bosses much faster than the others (Jailer 8 s vs Ranger 15 s) because all 4 pellets land on a large boss at point blank. Lever if bosses are too easy: pellet damage 2 → 1.5.
**Why he is not "Ranger with a gun":** magazine rhythm (burst then vulnerable) instead of constant fire; pierce and heavy rounds instead of speed and kiting.

---

## 6. Necromancer *(new — playable, locked until you win with the Mage)*

**Role:** Magic summoner / utility
**Playstyle:** Fire piercing soul bolts, raise skeletons to hunt for you, and let the Bone Imp drop grave fog on crowds and bullet patterns.

**Look:** Hooded caster in a violet robe with bone-green trim and glowing green eyes, carrying a skull-topped staff. Skeletons are pale bone with green eyes.

| Attribute | Design |
|---|---|
| Hearts | 3 (+3 plates) |
| Speed | 58 (slow, ~93 %) |
| Attack | **Soul Bolt**: a bolt at the nearest enemy (range 110), **pierces 1 enemy** |
| Damage / interval | 2 dmg per bolt, one bolt every 1.0 s |
| Ability | **Raise Dead** (cooldown 8 s): calls 2 skeletons that chase the nearest enemy or boss for 6 s (1 dmg per touch, 0.7 s per target); 0.3 s invulnerable |
| Companion | **Bone Imp**: every 8 s flies to the most crowded spot (2+ enemies, or a boss) and drops **Grave Fog** (radius 24, 3 s): enemies inside move at 40 %, bosses at 70 %, enemy bullets at 30 % |
| Class power-ups | **Grave Hush** (all enemies and bullets 30 % slower for 8 s), **Dark Frenzy** (+40 % attack speed for 8 s) |
| Class upgrades | **Bone Legion** (C: Raise Dead calls +1 skeleton, max 2), **Soul Ward** (R: Raise Dead also gives 1.5 s invulnerability), **Soul Rot** (E: enemies you hit take 30 % of that damage again 2 s later), **Twin Imps** (E: the Bone Imp drops two fog zones) |
| Companion Bond | Grave fog lasts 1.5 s longer |

**Strengths:** the best defence against bullet patterns and boss attacks, damage that keeps working while he kites, mechanics no other class has.
**Weaknesses:** low burst; Raise Dead has a long cooldown and the skeletons are slow; fast enemies (bats, cinders) run through the fog; single-target bolts need the pierce to keep up with swarms.
**Implementation notes:** skeletons live in `g.minions` (`stepMinions` in `engine.js`); fog slows enemies through a separate `stasis` timer, so it stacks with chill. Soul Rot is skipped for its own hits (no chains).
**Tuning (simulation):** bolts are 2 dmg so they hit the 2-HP breakpoint (slimes, imps); the pierce handles the magma/cinder swarm; skeleton dmg 1 every 0.7 s per target. First pass (bolt 3 dmg, skeletons 2 dmg every 0.5 s) gave a boss total of only ~104 s, far too strong. Final: boss total ≈198 s (Ranger 174, Gunner 197, Assassin 198, Warden 243, Mage 319). Values live in `NEC` in `classes.js`.
**Why he is not "Mage with slows":** the Mage kills groups with splash and chill; the Necromancer's damage comes from minions he sends after targets while his own bolts stay single-target, and his control comes from the fog.

---

## Class comparison

| Attribute | Warden | Assassin | Ranger | Gunner | Mage | Necromancer |
|---|---:|---:|---:|---:|---:|---:|
| Hearts | **4** | 3 | 3 | 3 | 3 | 3 |
| Speed | 62 | 74 | **78** | 60 | 53 | 58 |
| Reach | Short (24) | **Shortest (16)** | Long (120) | Medium (110) | Long (125) | Medium (110) |
| Single target | Medium | High (burst) | High | **High (burst)** | Medium | Medium |
| AoE | Medium | Low | Low | Medium (bomb-bot) | **High** | Low (pierce, fog) |
| Burst | Medium | **High** | Low | **High** | Medium | Low |
| Sustained | Medium | Medium | **High** | Medium | Medium | **High** |
| Mobility | Medium | **High** | High | Medium | Low (+Blink) | Low (+Raise Dead) |
| Survivability | **High** | Low | Low | Low | Low | Low |
| Crowd control | Low | Low (stun on Ambush) | Low | Low | **High** | **High** (grave fog) |
| Companion job | Extra shots | Marks targets | Knockback swoops | Bomb strikes | Blocks bullets | Grave fog |

---

## UI needs for the new classes

| Class | Needs |
|---|---|
| Assassin | Small **red diamond** above marked enemies; a "Step ready / Ambush window" pip beside the ability icon; a short reticle showing where Shadow Step lands |
| Gunner | **Ammo pips (6)** beside the ability icon, reload progress bar, muzzle flash + shell casings |
| Necromancer | Skeleton fade-out before they expire; green **fog rings**; Bone Imp flight path |
| All | Class select card: hue chip, one-line playstyle, stat bars (HP, DMG, RANGE, SPEED) as now |

## Stage 5 "Mirror Self" per class

| Class | Shadow copy does |
|---|---|
| Warden | Charges with a sword sweep; dash-slash |
| Assassin | Blinks behind you, three quick stabs, then blinks away |
| Ranger | Three-arrow volleys and a back-roll |
| Gunner | Three-round bursts, then a recoil hop |
| Mage | Slow homing orbs and blink |
| Necromancer | Fires a single violet bolt, then pauses |

---

## Early balance targets (starting points, to be measured)

```text
                Hearts  Speed  Dmg × interval            Ability (cooldown)          Single-target dps
Warden            4      62    2 × 0.70 s (110° sweep)   Dash            (1.2 s)     2.9 + wisp 0.7
Assassin          3      74    1 × 0.34 s (90°, 16 px)   Shadow Step     (3.5 s)     2.9 + ambush 0.9 (+ marks)
Ranger            3      78    1 × 0.28 s                Roll            (1.2 s)     3.6
Gunner            3      60    2 × 0.32 s, 6 rounds      Recoil Jump     (3.5 s)     3.1 avg (6.3 burst) + bomb 0.4
Mage              3      53    2 × 0.70 s (+splash)      Blink           (2.0 s)     2.9 + splash
Necromancer      3      58    2 × 1.0 s (pierce 1)       Raise Dead      (8.0 s)     2.0 + skeletons, fog for control
```

All values are playtesting baselines. After implementation, run `npm run sim` (with a bot per new class) and tune until boss-fight times are within ~20 % across classes.
Also planned for the simulation: each class's expected heart losses per run, and how often the armour blast fires.

## Build order

1. ✅ Art for the three new classes (this document + `sprites.js`).
2. ✅ Gunner: playable, sim-tuned, locked until a Ranger win (`?unlock=1` in the URL unlocks everything for testing).
3. ✅ Assassin: playable, sim-tuned, locked until a Warden win.
4. ✅ Necromancer: playable, sim-tuned, locked until a Mage win (replaced the Warlock idea).
5. Unlock flow, class select with 6 cards (scroll on the Game Boy screen), Mirror Self variants, sounds.

## Open questions

- Should each class get its own armour-blast flavour later (bigger knockback for Warden, a freeze for Mage, a smoke teleport for Assassin)?
- Armour stays as designed: the owner is happy with it, so no difficulty compensation is planned.
