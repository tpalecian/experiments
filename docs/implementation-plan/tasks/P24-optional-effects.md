# P24 — Optional action accents and restrained bloom

**Status:** Deferred. **Dependencies:** P04, P05, P14, P15, P19, P22. **Goal:** add small readable action accents only after the base look/performance gates pass.

This task is not required for the first release. Its inclusion is a future implementation specification, not authorization to start it while fixing earlier tasks.

## Read and edit

PresentationRuntime/Rendering, P04 feedback identity, Pieces, style metadata, QualityCaps, and disposal helpers. Add `src/world/effects/PlacementAccents.ts`; reuse Three addons rather than another post-processing dependency.

## Steps

1. Establish a fresh production performance/capture baseline. Confirm P14/P15 already pass without bloom. If the device/tier misses its budget, leave this task deferred for that tier.
2. Add a fixed pool of 24 small flat accent meshes shared across placement effects. Trigger one short radial ground accent for a newly placed road/building by comparing board occupancy between snapshots; key effects by gameId and object ID/kind to prevent replay on ordinary sync. Reset clears all active accents.
3. Make accents last .25 s with ease-out scale and opacity decay, using P05 scheduling and shared clock. They do not raycast, cast shadows, cover number tokens, or modify gameplay. Use player hue at low opacity; reuse/dispose resources through P08. Reduced motion shows a brief opacity change only.
4. Add optional bloom only on High, off by default: EffectComposer with a half-float scene target, RenderPass → UnrealBloomPass → OutputPass. Starting bloom strength .12, radius .25, threshold 1.0. Expose enable/strength under Fog & Post; quality disables the pass without clearing stored artistic values.
5. Maintain one tone-mapping/display conversion at final OutputPass. Verify P12 swatches again under composer and direct fallback. Ordinary terrain/foam should stay below the bloom threshold; use bounded HDR intensity only for intentional accents. Do not add a scene-wide emissive wash to make bloom visible.
6. Resize/dispose composer targets with runtime, include all passes in metrics, and keep reflection rendering outside bloom. Low/Medium remain direct rendering. No depth of field during play.

## Acceptance

Each placement accent occurs once, pool is bounded, reset/dispose cancels it, and targets remain readable. Bloom-off matches the pre-task baseline; bloom-on is restrained and meets the tested High budget. No duplicate gamma conversion or reflection feedback. Reduced-motion and direct-fallback paths pass.

## Boundaries

No rain/snow particles, audio, physics, screen shake, persistent fog particles, or cinematic blur. Each would need a separate product/performance decision.

**Copyable prompt:** Implement P24 only when explicitly assigned after its dependencies pass. Add bounded placement accents and optional High-only bloom exactly as specified. Preserve direct rendering and readability; provide swatch/capture/performance evidence and update STATUS.
