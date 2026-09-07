# Validation recipes and completion gates

## Commands

From the repository root:

```sh
npx tsc --noEmit
npm run smoke
npm run build
npm run dev -- --host 127.0.0.1
```

If `tsx` CLI IPC is blocked by the execution sandbox, use `node --import tsx scripts/smoke.ts` and report that substitution. A local server port permission error is infrastructure, not a code failure. Follow the host's approval mechanism when necessary; do not change host/network settings to conceal the failure. The build's large Three.js chunk warning is expected until P23 and may remain for the shared Three chunk afterward.

Pure behavior fixes need targeted assertions plus smoke/typecheck. Renderer, app wiring, and style changes also need build and browser checks. Documentation-only changes need link/path checks, not a new gameplay test suite. Do not regenerate screenshots merely to make an unexplained failure pass.

## Baseline fixture contract (P01)

Add a debug-only query route `?view=review&seed=11&map=standard&look=day`. It uses normal World and presentation code, with canonical camera, two players, deterministic legal initial setup state, and frozen visual time. Supported maps: standard/large/huge. Supported looks: day/sunset/night. Debug controls can unfreeze and trigger ordinary test interactions; they are not a product lobby replacement.

The fixture must not overwrite normal style or biome localStorage. Pass defaults/a supplied preset explicitly. Use seed 11 for all canonical captures. Optional second fixture seed 29 exercises terrain/layout variation. Keep randomness injection local to the engine; do not replace global Math.random in browser code.

## Capture matrix

| Group | Cases |
| --- | --- |
| Core visual | standard × day/sunset/night at 1280×720 |
| Scale | large/huge × day at 1280×720 |
| Mobile | standard/huge × day/night at 390×844 |
| Weather | standard × overcast/rain; transition back to clear |
| Camera | default, top-down reset, nearest allowed zoom, lowest allowed pitch |
| Actions | settlement spawn, road spawn, city upgrade, robber hop/landing, matching production, repeated identical dice |
| Tools | same asset and environment in game, Asset Lab, Biome Editor; non-default style |

Store future evidence in a task-specific ignored/local output directory and summarize reviewed files in STATUS. Do not add large PNGs to source control by default. Freeze at the same time for comparisons; for animations capture multiple timestamps or a short recording. Wait for fonts/textures via explicit readiness rather than arbitrary long sleeps.

## Rules regression fixtures

Use small hand-built graphs for pure longest-road tests and seeded real boards for command integration. Cover branches, cycles, an opposing blocking settlement, ties with/without an incumbent, split-to-below-five, and transfer. Preserve map thresholds of 10/12/15 VP. Setup order for N players is `0..N-1,N-1..0`, with initial resources granted only for the second settlement.

Test every rejected command as a no-op: compare resources, board occupancy, phase, award owner, roll identity, and notification count. Boundary cases include fractional/NaN/infinite values, invalid IDs, missing targets, no-resource theft, and unavailable piece supply. Restore any temporary test mutation in `finally`; prefer injected RNG over monkeypatching Math.random.

## Performance protocol (P19)

Measure a production build in a foreground visible browser on named hardware. Record browser version, viewport, devicePixelRatio, effective pixel ratio, map/seed/look, tier, and whether recording/devtools were active. Let assets compile/load first. Sample 30 seconds idle, 15 seconds continuous orbit, and a short action sequence. Report median and p95 frame interval plus draw calls/triangles and geometry/texture counts. FPS alone is insufficient.

Targets: desktop High aims for 60 FPS (16.7 ms typical frame); mobile Medium/Low aims for at least 30 FPS (33.3 ms typical frame). These are acceptance targets, not universal guarantees. If a target is missed, identify the measured cost and use the tier's defined fallback. Do not claim that browser CPU-throttling emulates a mobile GPU.

For resource ownership, render then rebuild a standard board ten times, upgrade pieces repeatedly, and switch preview assets at least 30 times. Counts should reach a bounded plateau after caches warm. GPU drivers may retain internal allocations; compare renderer-owned counts and dispose events rather than requiring OS GPU memory to return to zero.

## Accessibility and input

Keyboard: Tab/Shift+Tab through visible controls; open/close trade, discard, steal, and Style; verify focus containment/return; select a legal board target using the provided keyboard action list; Escape cancels only cancellable UI. Screen-reader smoke: phase/result announcements occur once; active player and selected targets have text names. Touch: pan/pinch/rotate never places a piece accidentally, outside pointer release clears state, and buttons meet 44 CSS px touch targets.

Reduced motion: no camera nudge, bouncing dice, looping harbor bob, or forced long travel animation; placements and feedback still resolve visibly and promptly. Pause/resume hidden tabs without jumping water time or replaying obsolete feedback.

## Per-task report template

```text
Task ID:
Status: complete / partial / blocked
Source files changed:
Contract/API changes:
Targeted cases passed:
Commands and outcomes:
Browser/device/capture evidence:
Remaining limitations:
Next task (do not start automatically):
```

Full integration (P25) requires P01–P23 acceptance cases, no new browser errors on the matrix, no lost user-saved layouts/styles, and updated current-behavior docs. P24 is optional and has a separate visual/performance gate.
