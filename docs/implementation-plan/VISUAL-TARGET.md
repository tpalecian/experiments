# Visual target: warm miniature island, calm surrounding sea

## Composition and priorities

At the reset camera, players should see in order: legal action/selected site, numbered resource tiles and player pieces, terrain silhouettes, coastline, distant sea/sky. Keep readable hex boundaries and the existing compact toy proportions. Do not turn the board into continuous terrain.

The playable island and harbor labels should occupy approximately 65–80% of the available safe viewport width on landscape screens. On portrait, fit all harbors inside the safe region with at least 16 CSS px clearance; accept a smaller board rather than cropping legal sites. HUD and Style controls must not overlap each other. Keep the current Fraunces/DM Sans typography; no typography redesign is needed.

## First-pass art decisions

- Terrain: all six resource types use the same soft-toon surface treatment. Pasture's current image texture is optional in Asset Lab, disabled in the default game look. Preserve existing terrain hue identity. Apply the already-defined darker side palettes consistently, including non-pasture tiles.
- Detail: forest uses small grouped trees; ore uses a compact rock cluster; brick uses a smaller off-center mesa; wheat reads as a few grouped stalks; pasture uses a flock with restrained walls/flowers; desert stays sparse. Prefer medium silhouettes over tiny noise.
- Tokens: protect a center disk of radius 0.38 world units. Decoration footprints must fit outside it. Reserve 0.12 world units inward from tile edges for visual separation from roads. In layouts where a prop cannot fit, reduce its scale rather than covering a token.
- Player identity: retain existing red/blue/white/orange hues. Keep roof/trim colors subordinate. Night colors must preserve the distinction between terrain and pieces.
- Light: warm key, cool fill, subtle rim, clear contact shadows. Starting reference intensities: sun 1.45, hemisphere 0.65, fill 0.22, rim 0.10, exposure 1.05. Update normalization reference values alongside these defaults so the environment resolver does not unintentionally multiply them twice.
- No global bloom, vignette, film grain, or depth of field in the first visual slice. Solve base materials and exposure first.

## Water starting preset

These are proposed tuning starting values after P12 color correction; they are not claims about final perceptual equivalence. Commit the selected final values only after the fixed-scene capture checklist passes.

| Field | Starting value |
| --- | --- |
| Deep/ocean/lagoon/shallow/beach | Keep current default hex colors initially |
| waterShoreWidth | 1.4 |
| waterDeepFade | 12 |
| waterShoreGlow | 0.06 |
| waterShoreFoam | 0.30 |
| waterFoamWidth | 0.10 |
| waterRippleIntensity | 0.22 |
| waterReflectStrength | 0.22 |
| waterReflectDistort | 0.008 |
| waterReflectBlur | 0.008 |
| waterWaveHeight | 0.025 |
| waterColorWave | 0.01 |
| waterCausticIntensity | 0.02 |
| waterBandIntensity / waterDriftIntensity | 0 / 0 |

Use the hex shoreline only for land exclusion, narrow shelf/foam, and limited near-shore ripples. Open-water depth remains a continuous radial ramp, avoiding stacked hex-shaped color rings. Make the radial ramp's start explicit: the current envelope assigns the brightest shelf color throughout all water inside the outermost tile radius. P14 changes that behavior so broad bays are not uniformly beach-colored.

The foam should be mostly thin and discontinuous, with no default view dominated by several closed bright rings. Break ripples with slowly moving world-space noise; changing integer band IDs must not cause whole arcs to pop between frames. Keep waves small enough that tiles and piers do not appear to float above large swells.

## Readability checks

1. Capture the same seed/camera after fonts and textures are ready, with clock frozen.
2. At 1280×720, every visible number token is legible and none is physically hidden at the default and top-down reset poses.
3. At 390×844, every legal setup site can be reached by touch, and harbor labels do not disappear behind persistent HUD panels.
4. At night, identify each terrain and each player's pieces without relying only on selection glow.
5. Temporarily view a grayscale capture during review: token/marker contrast should exceed surrounding sea variation. Do not introduce a permanent grayscale tool into the game.
6. Orbit within allowed camera limits and inspect coastline seams, intersecting skirts, reflection clipping, and labels. Extreme permitted angles may overlap distant props in projection; the two canonical gameplay poses must remain clear.

## Art iteration protocol

Change one family at a time: color pipeline → exposure/shadows → terrain consistency → camera/labels → sea palette → foam/ripples → reflection. Export the resulting preset through P22. Include before/after evidence and record why a deviation from these initial numbers improved the acceptance checks. Do not compensate for a color-space bug by continually changing palettes.

No new raster generation, external models, or Blender pipeline is required for this phase. Later authored GLB assets should use the same runtime/material contract, but are not included as hidden work in P16.
