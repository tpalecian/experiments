# P12 — Correct custom-shader output and scene color handling

**Status:** Not started. **Dependencies:** P10, P11. **Goal:** exposure and colors behave consistently across built-in/custom materials and reflected passes.

## Read and edit

`src/core/Rendering.ts`, `src/world/WaterSurface.ts` shader output/reflection target, `src/world/Sky.ts` shader/cloud materials, `src/style/style.ts` texture declarations. Inspect the installed Three r172 shader chunks and WebGLProgram behavior rather than copying latest-version code blindly.

## Steps

1. Add a review-only neutral test scene: built-in material swatches and custom unlit shader swatches receiving identical linear Color values. Compare direct rendering at exposures 0.8/1.05/1.4. Keep swatches outside gameplay.
2. Add `#include <tonemapping_fragment>` followed by `#include <colorspace_fragment>` after each custom fragment shader's final linear gl_FragColor. Keep all color math before these chunks. Do not hardcode pow(color,1/2.2).
3. Set scene sky/cloud/world materials to participate in the same scene tone mapping, removing intentional toneMapped:false exceptions for clouds. Preserve genuinely display/UI-only elements as explicit exceptions if any; do not casually exempt water or terrain to match old screenshots.
4. Audit color textures (meadow, label/number canvas textures) for SRGBColorSpace and data textures for NoColorSpace. Keep the toon ramp as data. Do not mark a linear reflection render target as an sRGB image texture.
5. Verify reflection target output stays linear and avoids tone mapping/display encoding before sampling. Let Three's render-target program variants handle output; do not globally switch renderer toneMapping mid-pass without restoration.
6. Capture the canonical board. Expect a changed appearance; record it, then leave palette retuning to P14/P15. Verify transparency edge colors and sky/water horizon match before claiming completion.

## Acceptance

Custom/built-in neutral swatches agree within a documented small pixel tolerance under the same conditions, exposure affects all intended scene elements, and reflection toggling does not cause a gamma jump. Browser console has no shader compilation errors. Run build/typecheck/smoke and capture day/night plus exposure extremes.

## Boundaries

No EffectComposer, bloom, library upgrade, or palette compensation in this task. A rendered review is required; textual shader inspection alone is insufficient.

**Copyable prompt:** Implement P12 only using installed Three.js r172 behavior. Fix linear/display conversion and tone-mapping consistency, verify direct and reflection paths with swatches, and provide captures. Do not tune water/lighting yet. Update STATUS.
