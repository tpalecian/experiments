# P10 — One presentation runtime for game and tools

**Status:** Not started. **Dependencies:** P09. **Goal:** preview and gameplay use the same renderer/environment setup without changing their behavior during extraction.

## Read and edit

`src/Game.ts`, core Rendering/Time/Viewport, view Lighting/Fog, both lab starters, and reviewScene. Add `src/core/PresentationRuntime.ts`. Use the target interface in [ARCHITECTURE](../ARCHITECTURE.md).

## Steps

1. Extract renderer construction, scene, viewport sizing, shared clock, lighting/fog setup, and the single frame loop into PresentationRuntime. Accept canvas/container/camera/config; do not query game DOM IDs inside the runtime.
2. Give route callbacks a frame context containing elapsed, delta, renderer, and scene. Preserve explicit pre-main-render reflection ordering. Keep rules, HUD, pointer commands, Board creation, and TransformControls outside this class.
3. Move Game onto the runtime first. Compare P01 captures before converting tools; do not retune materials or defaults to hide extraction differences.
4. Move Asset Lab, Biome Editor, and reviewScene onto the same runtime. Their stage geometry/background/camera may differ intentionally, but tone mapping, exposure, light definitions, and environment preset handling must share implementations.
5. Expose a scene-content preview mode that uses the runtime without Sky/Water where inappropriate. An asset viewer does not need a full island. The runtime itself must not automatically create World.
6. Preserve P09 disposal order and app handles. Remove replaced loops/listeners so no route renders twice. Keep small existing Rendering/Lighting/Fog classes; this is composition, not a replacement framework.

## Acceptance

Game capture stays equivalent after extraction. The same test asset under a named day/night environment receives matching light/exposure in each route. One RAF per route, clean teardown, correct resize, and no extra board generation. Smoke/typecheck/build pass; visit all query routes.

## Boundaries

P11 resolves duplicate style math; P15 unifies material/tile factories; P20 handles thumbnail capture. Do not bundle them into this task.

**Copyable prompt:** Implement P10 only. Extract the shared presentation owner incrementally, converting Game before labs. Preserve captured appearance and all lifecycle guarantees; report removed duplicate loops/setup and update STATUS.
