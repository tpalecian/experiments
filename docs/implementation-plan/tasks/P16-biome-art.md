# P16 — Consistent biome silhouettes and token clearance

**Status:** Not started. **Dependencies:** P07, P08, P15. **Goal:** each terrain is recognizable without hiding numbers or build locations.

## Read and edit

`src/world/biomeLayouts.ts:createDefaultLayouts`, `src/world/assets/props.ts`, `src/world/Props.ts`, token/harbor factories, and VISUAL-TARGET.

## Steps

1. Add reusable footprint measurement for a created prop using Box3 projected onto XZ, accounting for yaw and final scale. Keep this authoring/build-time work off the frame loop. Use the same footprint calculation in P21 warnings.
2. Reauthor the existing twelve default layouts with center-disk/edge clearance from VISUAL-TARGET. Keep two variants per terrain and deterministic pickLayout behavior. For the mesa, shrink its footprint and offset it sufficiently instead of placing it over the token. Reduce pasture microclutter until its density matches the other biomes.
3. Use the established scale-compensation contract; verify final dimensions rather than passing scale through both factory and wrapper. Keep texture-free terrain defaults from P15 and reusable material colors.
4. Add a default-layout test asserting footprints do not enter the token disk or edge reserve. Desert without a token still reserves the center for consistent robber placement/readability. Allow a documented bounded exception only for deliberately flat floor decoration, never solid tall props.
5. Improve number-token and harbor-label text texture resolution at fixed world size. Prefer full resource names or clear resource icons in harbors over single-letter abbreviations; keep 2:1/3:1 prominent. Use distance-aware readable label scale with a bounded range, avoiding huge billboards when zoomed out.
6. Preserve imported custom layouts exactly. Surface clearance warnings in authoring rather than silently repositioning the user's work. Refresh stamped props only on board build or explicit authoring reload.

## Acceptance

All default terrain tokens are readable at default/top-down poses on both fixture seeds, roads/settlements remain exposed, and biome density feels consistent. Existing saved layouts still load. Harbor labels fit camera-safe bounds on all map sizes. Test footprints, finite transforms, disposal, and capture core/mobile views.

## Boundaries

No asset-pack downloads, generated bitmap art, new terrain types, procedural regeneration during the day cycle, or decorative physics. Do not add detail merely to fill empty space.

**Copyable prompt:** Implement P16 only using existing procedural assets. Protect token/edge clearance, normalize visual density, and improve label readability while preserving custom saved layouts. Include default-layout validation and captures; update STATUS.
