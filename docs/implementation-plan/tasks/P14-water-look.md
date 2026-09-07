# P14 — Calm water and restrained shoreline

**Status:** Not started. **Dependencies:** P13. **Goal:** water supports the island instead of dominating it.

## Read and edit

Water shader modules/WaterSurface, style defaults/presets/schema, and [VISUAL-TARGET](../VISUAL-TARGET.md). Use P01's fixed camera/seed/time and P12 output handling.

## Steps

1. Apply VISUAL-TARGET's proposed starting water values to a named/default day look, keeping every value represented by validated craft metadata. Export comparable before/after settings once P22 is available; until then record exact values in STATUS.
2. Preserve the union-of-hex signed distance for land discard. For open water, build a single smooth radial deep-to-lagoon base ramp. Apply the beach/shallow colors only through a narrow actual-shore mask, so bays inside the outer island radius no longer receive unconditional bright beach color.
3. Use normalized world-unit shoreline width for a thin foam lip and a separate low-contrast shelf wash. Derivative-based antialiasing (`fwidth`) should soften subpixel thresholds without widening the whole coast.
4. Replace band-index-dependent noise jumps with continuously sampled world-space noise and a continuous time offset. Use noise as an arc visibility mask, not as a high-amplitude brightness texture. Keep ripples near shore and travelling toward land as the current intended direction.
5. Keep reflection contribution subordinate to depth color, with no use of a darkened reflected image as a substitute for proper object contact shadows. Keep caustics shallow-only, bands/drift off by default, and no neon full-island rings.
6. Tune one family per capture: base/shelf → foam → ripples → reflection → caustics. Recheck sunset/night after day. If changing preset values beyond the starting table, record the affected acceptance observation, not just “looks better.”

## Acceptance

At canonical day view the board/tokens have stronger attention contrast than open water; no several closed bright rings; shallow water remains distinguishable from land; horizon dissolves without a disk edge. Ripple motion has no periodic large arc pops. Night preserves island readability. Run capture matrix core/scale/weather and build/typecheck.

## Boundaries

No organic island replacement, shoreline graph changes, volumetric water, reflection-engine rewrite, or post-processing. Preserve land exclusion under all styles.

**Copyable prompt:** Implement only P14 after reading VISUAL-TARGET. Retune and simplify water composition using the specified hierarchy, keeping hex land masking. Supply fixed before/after captures and final numeric values; do not add new effect families. Update STATUS.
