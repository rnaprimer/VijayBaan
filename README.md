# VIJAY BAAN — Rama vs Ravana

A single-level browser physics puzzle, using the supplied landscape and sprite artwork. No account, server, or paid service is required by the game.

## Run

Requires Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite. Drag backward near Ram's bow and release. The dotted line predicts unobstructed flight. Aim for the wooden columns to trigger collapses, or arc over the fortress for exposed targets. A valid shot consumes one arrow; wait for the shot to resolve before firing again.

```sh
npm test
npm run physics
npm run build
```

`npm run build` performs strict TypeScript checking and creates `dist/`. Serve that directory using any static HTTPS hosting provider. The included `.openai/hosting.json` identifies the Sites deployment. The game uses no authentication SDK or backend.

On phones, portrait gameplay displays an on-screen recommendation to rotate to landscape. Mobile landscape fills the available viewport with the battlefield and HUD; the page header, footer, and surrounding instruction text are hidden. The artwork keeps its proportions, and HUD controls respect device safe areas.

## Rules

90 seconds, 10 arrows, 10 independently simulated target heads, one continuous level. The timer and physics both pause from the pause menu and when the browser tab becomes hidden. Resume explicitly. The last shot and a timed-out shot receive a bounded resolution window.

Directly strike the flame vessel, crystal, or golden Astra object to store Agni, Vajra, or Volley. Only one ability is stored; the next shot consumes it, even on a miss. Volley launches three physical arrows for one ammunition cost. Agni affects a 125-unit radius, and Vajra has at most three penetrations. Stone is denser and substantially harder to break than wood.

## Source map

- `src/config.ts`: authoritative rules, materials, weapons, camera settings, scoring, and asset manifest.
- `src/layout.ts`: deterministic fortress and independent terrain colliders; the river gap has no floor.
- `src/physics.ts`: Matter bodies, materials, world construction, and projectiles.
- `src/rules.ts`: shot state machine, scoring, ammunition, timer, local best, and pure trajectory/impact calculations.
- `src/scene.ts`: Phaser rendering, fixed-step physics orchestration, aiming, collision damage, pickups, camera, effects, and lifecycle.
- `src/main.ts` / `src/style.css`: HTML menus, accessible controls, HUD, responsive presentation, and pause/restart bindings.
- `src/audio.ts`: interaction-unlocked procedural Web Audio effects.
- `src/sharing.ts`: Web Share, WhatsApp fallback, clipboard, and downloadable Canvas score card.
- `src/replays.ts`: development replay shot data.
- `tests/rules.test.ts`: core rule and trajectory verification.
- `scripts/physics-test.ts`: headless Matter simulation for initial stability and repeated-shot checks.
- `scripts/solve.ts`: development-only shot search using the actual layout and collision formulas.
- `scripts/check-replays.ts`: repeatable sequence verification.

The Phaser Matter world uses an explicitly controlled Matter 0.20 engine. Physics runs at 120 Hz independently of render rate. Arrow rotation is also updated inside that fixed step, avoiding frame-rate-dependent collision shapes. A swept ray supplements contact detection for thin projectiles. Sleeping bodies are woken when a structural object disappears, so removed supports cannot leave suspended stacks.

### Damage formula

Impact intensity is `(relative normal speed − minimum impact speed) × sqrt(reduced mass) × projectile factor × weapon modifier`, clamped to zero below the minimum speed. Reduced mass is `m1 × m2 / (m1 + m2)`; static targets use the other body's mass. Arrow contacts also consider 65% of relative speed to handle glancing arrowhead hits. Health thresholds and modifiers live in `config.ts`. Initial settling runs without damage, then damage applies to collisions and falls. Every destroyed object and defeated head is deduplicated by stable ID.

### Artwork

`public/assets/game/originals/sprite-sheet.png` preserves the supplied sheet unchanged. `environment/background.png` preserves the supplied 1672 × 941 landscape. The extraction script creates 28 tightly cropped transparent sprites and `asset-preview.png`, which displays them against alternating light/dark squares. It removes exterior chroma by flood fill, removes large enclosed chroma pockets in bow/magic art, preserves green crown jewels and platform grass, cleans edge contamination, and drops small disconnected crop crumbs.

The original Rama pose contains the bow and arrow. It is retained as one illustration, with a subtle tension-string effect, small pose rotation, recoil, and a projectile that begins at the illustrated arrow tip. A second bow is not drawn.

Re-running `python3 scripts/extract-assets.py` requires Pillow and the two original files at the paths recorded in that script. The prepared sprites are committed; Python is not required to run or deploy the game.

### Debug and replay

In the development server only, append `?debug` to show colliders and replay controls. The replay buttons reset the actual scene and execute predetermined shots with accelerated simulation. Debug tools and hooks are removed from production builds. Shot tuples contain launch angle in radians (positive downward) and Matter velocity units per 60 Hz base step. Normal player input remains bounded by the same weapon speed range.

### Sharing and persistence

Scores and numbers come from actual rule events. The best score, target count, and star count are stored separately and tolerate unavailable localStorage. Native sharing is attempted when supported; otherwise the result opens a WhatsApp compose URL. Cancellation is reported as cancellation. Copy and score-card download work independently. Sharing never sends a message automatically.

## Verification and limitations

See `QA.md` for measured replay outcomes and browser checks. Native touch hardware, broad Android performance profiling, and native share-sheet completion require device testing. Desktop pointer dragging has been exercised at mobile viewport sizes. No skeletal character animation is available in the supplied art; the game uses lightweight pose feedback instead. The client bundle includes Phaser and both Matter API surfaces; Vite reports its bundle-size advisory. Assets and gameplay remain local after loading, except the optional font request and user-initiated sharing destination.
