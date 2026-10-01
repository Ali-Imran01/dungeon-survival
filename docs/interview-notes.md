# Interview notes

Rehearsal notes for talking through the trickiest mechanics in this codebase out loud — not architecture docs.
For the high-level picture (file roles, game flow, stage/class tables) see [`../CLAUDE.md`](../CLAUDE.md) and
[`characters.md`](./characters.md). This doc doesn't repeat those — it only zooms into the handful of spots that
are genuinely hard to explain from memory, with a short "how I'd say this out loud" script for each.

**How to use this:** read a section, then read its "Say it out loud" block as if you were answering the
interviewer. Do this once per section before an interview. The matching code comment is cited so you can jump
to the source and check the script still agrees with what's actually there.

## TL;DR

| # | Spot | File |
|---|---|---|
| 1 | The per-frame loop | `engine.js` `step()` |
| 2 | Rendering + stage-5 darkness/eyes | `engine.js` `draw()` |
| 3 | Armour plates | `engine.js` `ARMOR`, `breakPlate`, `blast` |
| 4 | Melee hit detection vs. the slash animation | `engine.js` `meleeHit`, `drawSwing`, `drawStab` |
| 5 | Companion state machines | `engine.js` `stepCompanion` |
| 6 | The engine.js ↔ classes/enemies/bosses circular import | `engine.js` header |
| 7 | The boss attack DSL | `bosses.js` `ATK`, combinators |
| 8 | Assassin Ambush / Chronomancer Rewind | `classes.js` |

---

## 1. The per-frame loop (`step()`, engine.js)

Every frame does the same five things, in order: read input and move the player, tick down every timer/cooldown
on the player, check armour regen and stage-progression, then hand off to each subsystem (enemies, the current
class's attack, the boss, the companion, hazards, the biome's special rule, enemy bullets), and finally clean up
(XP magnet, expired particles, queued level-ups).

**Say it out loud:** "`step()` runs once a frame and does five things in sequence: input and movement, timer
countdown, armour/progression checks, then it hands off to each subsystem in turn — enemies, my attack, the
boss, the companion, hazards, the current biome's rule, enemy shots — and finishes with cleanup: XP magnet,
expired particles, any level-up that's ready to show. It's terse, one-letter locals like `m`, `S`, `ar`, because
it's the hot path and I wanted it skimmable once you know the letters. If I were handing this to a team I'd
probably split the tail end into its own `stepWorld()` helper, but solo, one function I can hold in my head beat
a dozen small ones I'd have to jump between."

**Likely follow-up:** "Why not split it into smaller functions?" — Honest answer: a survival-game frame
genuinely touches almost every subsystem every frame, so splitting it mostly moves the coupling into function
call plumbing rather than removing it. Worth doing if a second person ever had to work in this file.

---

## 2. Rendering + the stage-5 darkness/eyes trick (`draw()`, engine.js)

`draw()` is a straight top-to-bottom layer stack — background, hazard telegraphs, pickups, enemies, boss,
player, companion. Stage 5 (the void) adds one twist: everything is drawn normally first, then a darkness mask
goes down over the whole screen (black except small lit circles around the player, companion, and light
sources), then enemies/boss are drawn a *second* time in "eyes only" mode — a palette proxy that makes every
color transparent except the eye pixels — so their eyes glow back through the black mask even outside the
lit radius.

**Say it out loud:** "Draw is one linear stack of layers. Stage 5 adds a twist: I draw everything normally
first, then paint a darkness mask that's black except for small lit circles, then I draw the enemies and boss a
second time in an 'eyes only' mode — a palette proxy where every pixel is transparent except the eye color — so
their eyes glow back through the black mask outside your light radius. It's a cheap way to get 'you can see
something watching you in the dark' without building a real lighting engine."

**Likely follow-up:** "Why redraw instead of doing it in one pass?" — Because the mask needs every light source
computed first (player, companion, enemy-given lights), so the full sprites have to be drawn *before* the mask
exists, and the eye-glow has to be drawn *after* the mask exists. One pass can't do both.

---

## 3. Armour plates (`ARMOR`, `breakPlate`, `blast`, regen block — engine.js)

Every class has 3 plates that absorb hits before hearts take damage. A broken plate returns after `repair`
(5s) while some armour remains. The *last* plate breaking is special: it triggers `blast()` (knockback +
damage to everything nearby) and switches to the longer `firstRepair` timer (15s) instead of `repair` for that
first plate back; every plate after that uses the normal `repair` timer again.

**Say it out loud:** "Armour is three plates that soak hits before hearts. A broken plate comes back in 5
seconds normally. But if you lose the *last* plate, two things happen: it triggers a blast that pushes enemies
back and staggers the boss, and the regen timer for that first plate coming back jumps to 15 seconds instead of
5 — being at zero armour is meant to feel dangerous, not just 'wait 5 seconds.' Hearts only take damage once
you're at zero plates."

**Likely follow-up:** "How would you make this harder without just adding damage?" — Point to the armour
upgrade ideas already sketched in `CLAUDE.md`.

---

## 4. Melee hit detection vs. the slash animation (`meleeHit`, `drawSwing`, `drawStab` — engine.js)

The hit test is a sector — an angle range around the swing's stored angle (`p.swing.a`), with `reach` measured
from the hero's centre to the *target's edge*. `drawSwing`/`drawStab` read the exact same `reach`/`arc` numbers
off `p.swing` to draw the visible arc — so what you see on screen is, by construction, what can actually hit
you; they can't drift apart because they're not two independent numbers.

**Say it out loud:** "The hit test is a sector — is the enemy within an angle and a distance of my swing
direction — and the drawn slash arc reads the exact same reach and arc values. They can't visually lie about
what's hittable because it's literally the same data used for both. `angDiff` gives a signed angle difference so
I don't get bugs when a swing crosses the ±180° wraparound point. The sector padding by the target's own radius
(`Math.atan2(r, d)`) means a swing 'just' grazes an enemy whose center is technically outside the raw angle but
whose body isn't."

**Likely follow-up:** "Why not use a rectangle hitbox instead of trig?" — The hero can swing in any direction
around a circular collision radius; an angle test reads more naturally for an aimed sweep than rectangle overlap
math would.

---

## 5. Companion state machines (`stepCompanion`, engine.js)

One function, six companion types, branched by `C.companion`. Each branch is its own small inline state
machine rather than a shared FSM. Most follow the same shape: perch near the player → spot a target in range →
travel/act → return to perch. `c.mode` holds the state name, `c.tgt` the current target, `c.extra` is a
leftover-action counter (extra hawk dives, extra cat pounces from bond level) that means something different in
each branch.

**Say it out loud:** "Take the hawk as the example — it perches near me, and every couple seconds checks for a
target within 50px. If it finds one it dives, hits, and — if bond level gives it extra dives (`c.extra`) —
chains to another nearby target before returning to perch. The other five companions (wisp, cat, sandling, bomb
buddy, familiar) follow the same perch/act/return shape with different triggers and effects. It's six small
state machines living in one function rather than a shared FSM."

**Likely follow-up:** "Would you refactor this into a shared FSM?" — Only if a 7th companion made the
duplication actually cost time; six hand-written special cases were cheaper to write and debug independently
than a generalized abstraction I'd have had to design up front.

---

## 6. The circular import between engine.js and classes/enemies/bosses

`engine.js` exports low-level combat/util helpers (`dealDmg`, `meleeHit`, `nearest`, `pc`, `alive`, `center`,
`after`, `clamp`, `ARMOR`) that `classes.js`, `enemies.js`, and `bosses.js` import and call — and `engine.js` in
turn imports those files' top-level `step`/`spawn` functions (`stepEnemies`, `spawnBoss`, etc.) to call every
frame. That's a genuine circular import between modules.

**Say it out loud:** "It looks tangled on paper, but ES modules handle circular imports fine as long as nothing
runs at the top level of the file — only inside functions. Every one of engine.js's exports is a function
declaration, so by the time anything actually *calls* `dealDmg`, every module involved has already finished
loading. I chose this over pulling the helpers into a third `engine-core.js` file because they're inherently
'engine' concepts — damage, targeting, hazards — and a third file just to break the cycle on paper felt like
indirection for its own sake."

**Likely follow-up:** "What would actually break this?" — Putting side-effecting code at module top level (e.g.
calling a function immediately instead of just defining it). That's the real hazard with circular ESM imports,
not the cycle itself.

---

## 7. The boss attack DSL (`ATK` table + combinators, bosses.js)

`wind`, `rest`, `once`, `charge`, `fan`, `ringShot` are small builders that return "acts" — the smallest unit
`stepBoss`'s interpreter consumes. An attack (any entry in the `ATK` table, ~45 of them) is nothing but an array
of acts assembled from those combinators, plus a few bespoke inline acts for one-off behavior. `stepBoss` pulls
the next act off a queue, ticks it every frame, and advances once its timer runs out — it has no idea which
attack it's running.

**Say it out loud:** "Every boss attack is built from the same six combinators — `wind` is a windup beat with a
white flash, `charge` is windup plus a dash with an optional damage multiplier and shield flag, `rest` is a
pause after. An attack is just an array of these. `stepBoss` is a generic interpreter: it pulls the next act off
a queue, runs its `tick` every frame, and calls `end`/advances once the act's timer hits zero. Adding attack #46
means composing a new array from existing pieces, not touching the interpreter."

**Likely follow-up:** "Why not a proper behavior tree or state machine library?" — 45 attacks fit comfortably in
this shape; a library would add indirection without a real payoff at this scale.

---

## 8. Assassin Ambush and Chronomancer Rewind (classes.js)

**Assassin — Shadow Step / Ambush:** teleports to `stepLanding()` (just behind the nearest target) or a blind
40px blink if nothing's in range. Landing near a target arms a 2-second Ambush window — the next stab is ×3
damage. Charges work like a rechargeable magazine, not independent per-charge timers: the recharge timer
(`p.chT`, ticked in `tick()`) only starts once you drop *below* max charges, so charges refill one at a time.

**Chronomancer — Rewind:** jumps to the position recorded ~2 seconds ago, read from a position-history ring
buffer (`g.hist`, pushed every frame in `step()`). If that historical snapshot shows *more* armour plates than
you currently have, the difference is restored too — Rewind can undo a lost plate, not just movement. `g.hist`
is reset to a single fresh entry right after rewinding, so you can't chain-rewind through the same window twice.

**Say it out loud (Assassin):** "Shadow Step blinks me behind the nearest enemy and arms a 2-second Ambush
window where my next stab does triple damage. Charges recharge like a magazine — one at a time — the timer only
starts once I've used a charge and I'm below max, not per-charge independently."

**Say it out loud (Chronomancer):** "Rewind replays my position from about two seconds ago using a small ring
buffer I push to every frame. The neat part: if I lost an armour plate in that window, Rewind restores it too,
not just my position — so it can undo a plate break, which reads as a genuine 'time' mechanic rather than just a
blink with a longer cooldown."

**Likely follow-up (both):** "What's the trickiest bug you hit building this?" — *Fill this in with a real
anecdote before the interview — a genuine debugging story lands better than anything written here.*

---

## General questions this prepares you for

- "Walk me through what happens in one frame" → §1
- "Why is engine.js 700+ lines?" → §1, §6
- "What would you refactor first if a team picked this up?" → §1, §5, §6
- "Show me something you're proud of, technically" → §2, §7, or §8
- "What's a bug you shipped and how did you find it?" → §8 (fill in your own story)
