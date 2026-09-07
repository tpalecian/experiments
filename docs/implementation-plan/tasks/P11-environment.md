# P11 — Resolve atmosphere and craft in one place

**Status:** Not started. **Dependencies:** P06, P10. **Goal:** controls have persistent effects, renderers agree on final values, and changing time does not rebuild objects.

## Read and edit

`src/world/Atmosphere.ts`, `src/world/Weather.ts`, WaterSurface.applyAtmosphere, SkyDome.applyConfig/applyAtmosphere, Lighting.applyAtmosphere, and the runtime's frame environment path. Add `src/atmosphere/resolveEnvironment.ts`.

## Steps

1. Define ResolvedEnvironment and the pure output-writing resolver from ARCHITECTURE. Keep strongly typed fields; do not replace colors with loose dictionaries. Reuse output Color/Vector objects.
2. Move weather copying into an optional-out helper, hoist weather tint constants, and preserve the public nonmutating two-argument applyWeather API through a wrapper. Never mutate presets even in the clear-weather fast path.
3. Move current water palette/scalar composition and lighting/exposure reference multipliers into the resolver without changing the formulas initially. Renderers copy resolved uniforms; they no longer blend craft independently.
4. Implement bounded linear RGB craft/default tint multipliers for sky/cloud colors. Test default identity and edited colors under every fixed scheme. Align water horizon with the same resolved sky horizon.
5. Split Sky config updates by impact. Speed/color edits update state/uniforms only; cloud count/shape/layout edits rebuild only clouds. Remove cloudDriftSpeed from the respawn condition. Track material/environment revisions so a fixed unchanged scene does not retint every prop each frame.
6. Preserve smooth transitions when selecting schemes repeatedly or entering cycle mid-blend: keep the current snapshot as the transition source and blend toward the advancing cycle sample over dayTransitionSec. Do not snap to the last requested fixed scheme. Explicit zero-duration fixture selection still snaps by design.
7. Add counters/test hooks for board geometry and cloud spawn counts; these are debug/test instrumentation, not craft controls.

## Acceptance

Sky/cloud controls survive many frames; changing speed does not respawn clouds; fixed→cycle during a blend has no one-frame color jump. Output objects are reused, presets remain unchanged, water and fog agree, and day/weather changes keep board mesh identities. Smoke/typecheck/build plus day-cycle captures pass.

## Boundaries

Do not add rain particles, seasonal geometry, or new shader effects. P12 addresses output conversion separately.

**Copyable prompt:** Implement only P11. Centralize environment resolution while preserving existing water formulas, then fix sky/cloud craft influence and transition continuity. Prove no preset mutation or board regeneration; update STATUS.
