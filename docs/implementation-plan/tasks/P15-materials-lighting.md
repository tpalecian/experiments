# P15 — Consistent terrain materials and controllable shadows

**Status:** Not started. **Dependencies:** P11, P12. **Goal:** unified miniature surfaces, legible contact, and functional shadow controls.

## Read and edit

`src/style/style.ts`, `src/world/Board.ts:build`, `src/world/assets/props.ts:makeHexTile`, `src/world/geom.ts`, Rendering, Lighting, style/resolver metadata.

## Steps

1. Extract shared hex body/rim construction so live Board and Asset Lab call the same factory/geometry utility. Keep Board ownership of IDs/tokens/harbors/pickables. Reuse geometry per board with P08 disposal rules.
2. Use top/side material groups for all terrain types, applying STYLIZED_TERRAIN_SIDE consistently. Make the default pasture use the common terrain material; retain its existing texture as an optional lab/style option with a safe fallback. Do not delete the asset file.
3. Keep MeshToonMaterial with the existing ramp as the baseline. Add a modest bevel to visual tile edges only (start 0.025 world units, one segment), ensuring bevel expansion stays within the original HEX_SIZE footprint. Preserve TILE_HEIGHT top level, graph vertex positions, token height, and legal hit meshes. Test water alignment before increasing it.
4. Switch directional shadows to PCFShadowMap so radius control has the intended r172 effect. Drive `sun.shadow.intensity` from resolved shadow strength. Expose authored intensity/softness multipliers (defaults 1; ranges 0–1 and 0.5–4) and a small normal-bias control under Lighting. Keep map size quality-owned, not an arbitrary slider.
5. Tune shadow camera bounds to actual board/prop extents with a small margin; keep the light target in the scene and consistent across sun movement. Start with existing bias, then use normalBias only as needed to remove acne without detached contact shadows.
6. Apply VISUAL-TARGET's lighting defaults and normalization references together. Expose fill/rim strength multipliers if tuning them; resolve them in P11, not directly in the light class. Preserve terrain/player palette contrast at night.

## Acceptance

All terrain sides use their intended shade, pasture no longer clashes by default, and preview/live hexes match. Shadow intensity zero removes shadows while keeping lighting; softness visibly changes edges. No acne, peter-panning, coastline seam, or token-height change. Core/day-night/map captures and build/typecheck/smoke pass.

## Boundaries

No global custom material shader rewrite, SSAO, baked lightmaps, or terrain-bounce shader in this phase. Those require a separate measured proposal, not an ad-hoc onBeforeCompile patch.

**Copyable prompt:** Implement only P15 in material-factory and lighting checkpoints. Keep graph geometry and resource ownership intact, use supported r172 shadow controls, and show rendered acceptance evidence. Update STATUS.
