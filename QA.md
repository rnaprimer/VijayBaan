# Verification record — 20 October 2026

## Build and rules

The production build completed successfully with strict TypeScript checking. Vite reports the expected large-chunk advisory for the Phaser engine bundle; this is a warning, not a build failure. Dependency installation reported no known vulnerabilities.

All 22 tests passed. The test suite covers initial configuration, the physical terrain gap, ammunition and concurrent-shot rejection, invalid aiming, bounded launch vectors, prediction versus real Matter integration (under four pixels at one second), duplicate head and destruction scoring, reduced-mass damage, combo scoring, the single power-up slot, consumption on misses, Volley ownership, timer expiry, last-arrow resolution, victory bonuses, restart rule state, best-score persistence, result text, real structural collapses, both winning replays, and a real projectile pickup collision.

The separate physics check confirms no initial body drifts more than 20 world units during four seconds of settling. It also exercises repeated angles to ensure different shots have different physical outcomes. The recorded winning routes are assertions, not visual guesses.

## Reproducible victory routes

Use `npm run physics` or development-only `?debug` replay buttons. Angles are in radians, positive downward; speed uses Matter's 60 Hz base units. The original 10-arrow and 90-second limits are unchanged.

| Route                    | Shot tuples (angle, speed)                                                                  | Headless result                               | Observed browser result                             |
| ------------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------- |
| Low supports             | (0.08,22), (-0.12,27), (-0.19,22), (0.02,27)                                                | 10/10; 4 arrows used; 63.97s remaining; 9,580 | 10/10; 4 arrows used; 68s remaining; 9,630; 3 stars |
| Alternate upper approach | (-0.18,25), (0.12,22), (-0.14,25), (-0.16,27), (0.22,25), (-0.36,22), (0.02,27), (-0.09,22) | 10/10; 8 arrows used; 37.93s remaining; 8,070 | 10/10; 8 arrows used; 43s remaining; 8,130; 3 stars |

The headless harness waits the full 6.5-second bound after every shot. The browser ends a shot once motion settles and declares victory immediately after the tenth defeat; this explains the time and time-bonus differences. Browser replays use accelerated simulation for QA, with the same physics timestep and normal weapon limits. The low route defeats three heads with the first shot, demonstrating a physical chain reaction rather than ten required direct hits.

A robustness probe shifting every angle by ±0.01 radians defeated 6 and 3 targets in the first four shots, respectively. These perturbations did not reproduce the four-shot win; six arrows remain for recovery. Precise replay tuples demonstrate solvability, but do not establish human success rates. Broader playtesting is still useful.

## Browser checks actually performed

- Inspected rendered game layouts at 1280×720, 844×390, 390×844, and 320×844.
- Verified mobile portrait pointer dragging consumes one arrow and affects a physical object.
- Inspected portrait player framing, camera tracking, fixed HUD, and landscape suggestion.
- Fixed narrow welcome-screen overflow. Measured document width and viewport width both equal to 320 pixels after the fix.
- Fixed landscape letterboxing to center the undistorted environment.
- Completed both recorded victory routes in the actual Phaser scene and inspected their result screens.
- Paused the game and verified the timer remained at 1:30 across subsequent tool operations.
- Performed three consecutive pause/restart cycles; each restored 10 arrows and 0/10 defeated heads.
- Returned to the welcome screen and observed the retained personal best.
- Activated Copy Result and observed its success status.
- Activated the score-card button and observed successful Canvas generation/download initiation. The browser automation download event timed out; filesystem completion of the download was not independently verified.
- Inspected browser error logs during replay: no errors or warnings were reported in that check.
- Saved a screenshot of actual browser victory as the sibling deliverable `vijay-baan-victory.jpg`.

## Fixes found through testing

1. Exterior-only chroma removal left enclosed green bow pockets; the extraction now removes those while preserving crown jewels and grass.
2. Removing sleeping supports could suspend stacks; structural destruction now wakes the remaining dynamic bodies.
3. Per-render-frame arrow rotation changed collision geometry with frame rate; it now runs in the fixed physics step.
4. Restart now clears simulation state, effects, collision callbacks, canvas callbacks, and HUD notifications.
5. Narrow mobile welcome art and headings now fit without horizontal scrolling.

## Remaining verification limits

Native phone touch hardware, Android frame-rate/memory profiling, native share-sheet completion, WhatsApp compose behavior, and actual download-file completion have not been verified. The complete camera/physics implementation is exercised through desktop pointer input at mobile dimensions. The shared headless harness reproduces material and collision rules but is not a full browser renderer.

A Site was registered as owner-private, but deployment was not completed. Automatic approval review rejected both the public-audience change and the source/artwork upload to the private Sites repository, pending explicit approval. No hosted-game URL is claimed. The source game has no login and is ready for ordinary public static hosting once upload and publication are authorized.

## Mobile landscape update

Added an in-game portrait rotation recommendation and viewport-filling mobile landscape gameplay. The header, footer, surrounding labels, and bottom aiming hint are hidden in this mode, with safe-area spacing for the HUD. TypeScript/build, formatting, and the 22 existing tests were rerun successfully. Visual verification of this revision remains pending because automatic browser approval review blocked opening the local preview. Earlier browser screenshots document the previous layout.
