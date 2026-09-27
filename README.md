# Dungeon Survival

A top-down survival arena game built with React, TypeScript, and Vite. Pick a class, fight off waves of enemies, and take down five bosses to become the Master of Souls.

Play it live at [aliimranrohaizi.xyz](https://aliimranrohaizi.xyz), or run it locally below.

## Gameplay

- **Classes** — pick one of three, each with a unique attack, ability, and companion:
  - **Warden** (melee tank, *Dash*) — swings hit everything in front; his Wisp companion shoots from range.
  - **Ranger** (ranged DPS, *Roll*) — fast arrows; a Hawk companion swoops at enemies that get too close.
  - **Mage** (AoE control, *Blink*) — splashing orbs; a Familiar companion blocks bullets.
- **Bosses** — survive waves of enemies and defeat 4 minibosses plus a final boss, the Hollow Lord.
- **Power-ups** — collect leveled power-ups that scale your build as you survive longer.
- **Trophies** — earn a trophy per class, plus "Master of Souls" for clearing all three. Best runs are saved locally in your browser.

### Controls

- **Keyboard**: WASD / arrow keys to move, Space to use your ability, Esc to pause.
- **Touch**: drag to move, use a second finger to trigger your ability (or tap the on-screen ability button).
- **Mobile gamepad skin**: D-pad to move, A for ability, B to pause.

## Tech stack

React 19, TypeScript, Vite, Tailwind CSS v4, deployed to Cloudflare Pages via Wrangler. Fully client-side — no backend or database.

## Development

```bash
npm install       # install dependencies
npm run dev       # start the dev server
npm run build     # type-check and build for production
npm run lint      # run oxlint
npm run preview   # build, then preview with Wrangler's local Pages runtime
npm run deploy    # build and deploy to Cloudflare Pages
```
