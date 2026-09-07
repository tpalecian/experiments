# P09 — Application lifecycle, visibility, and consistent time

**Status:** Not started. **Dependencies:** P08. **Goal:** one active loop per app, complete teardown, and no animation-time jump after backgrounding.

## Read and edit

`src/Game.ts`, `src/boot.ts`, `src/core/Time.ts`, `src/core/Viewport.ts`, Rendering, Hud, StyleConfigurator, and both lab entry functions.

## Steps

1. Introduce `AppHandle { dispose(): void }`. Game implements it; lab/editor/review starters return it. Retain RAF IDs, Viewport instances, unsubscribe functions, timeout IDs, controls, and event-listener cleanup functions on the owner instead of discarding references.
2. Add idempotent dispose: stop scheduling → cancel timers/tweens → remove listeners/subscriptions → dispose controls/content through P08 → dispose renderer targets/renderer → remove route-specific DOM/body classes. Add cleanup methods to Hud/Configurator where needed.
3. Have boot retain the handle and dispose it through `import.meta.hot?.dispose`. Navigation remains document/query-route based; do not add a router framework.
4. Make Time's simulation elapsed accumulate its clamped delta, using a monotonic timestamp. Add reset/resume so the first frame after start/resume has zero delta. The day cycle, shader time, and tween updates receive the same simulation clock.
5. Pause RAF while document.hidden. Resume once, resetting the clock's previous timestamp. Optional diagnostic wall time must be named separately and must not drive effects. Ensure backgrounding does not cancel a legitimate game action or advance rules.
6. Treat lobby as having no active board presentation: hide/clear board content and skip its reflection/update work after resetToLobby. Explicitly choose the existing sky/background as lobby decoration. Restore the board on the next start.

## Acceptance

Mount/dispose twice without duplicate listeners or loops. Dispatch resize after dispose with no effect. Hide for several seconds and resume without water jump, large camera movement, or stale input. Reset/start repeatedly without a visible stale island or increased resource counts. Run smoke/typecheck/build.

## Boundaries

Do not combine this with PresentationRuntime extraction; P10 reuses the proven lifecycle. Keep document navigation behavior intact.

**Copyable prompt:** Implement only P09 using P08 ownership. Add complete idempotent lifecycle and a shared clamped simulation clock; verify visibility/HMR/reset behavior. Do not begin the runtime refactor. Update STATUS with lifecycle evidence.
