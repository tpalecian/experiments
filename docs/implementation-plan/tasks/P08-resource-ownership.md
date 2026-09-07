# P08 — GPU resource ownership and safe disposal

**Status:** Not started. **Dependencies:** P01. **Goal:** rendered rebuilds release owned assets without invalidating shared textures.

## Read and edit

`src/style/style.ts`, Board/Highlights/Props/Pieces clear/reset paths, `src/ui/assetLab.ts:disposeObject`, `src/ui/biomeEditor.ts:disposeObject`, `src/ui/propThumbnails.ts:disposeObject`, and Sky/Water disposal paths. Add `src/world/assets/resources.ts`.

## Steps

1. Inventory cached/shared objects (toon gradient, meadow texture/prototype) versus per-board/per-prop materials, geometries, label textures, render targets. Write the ownership table as comments beside the resource helper.
2. Implement a shared-resource registry and `disposeObjectTree(root, resources)`. Within one disposal operation deduplicate geometry/material/texture identities with Sets. Dispose only owned resources; explicitly skip registered shared maps/gradient maps. Do not traverse arbitrary object properties or renderer internals.
3. Board geometry shared across its hex meshes is disposed once when the whole board is cleared, not when one tile is removed. Per-piece/procedural prop geometry is disposed when that owned group is removed. Renderer/cache-level disposal releases shared textures only after every route consumer is gone.
4. Replace all three ad-hoc preview disposers with the same helper. Ensure cloned meadow materials do not claim ownership of their shared map. Cover Mesh material arrays, Sprite maps, and nested meshes sharing geometry.
5. Wire removal, upgrade completion, reset, and rebuild paths to cancel relevant tweens before disposing. Keep the reusable robber alive on reset and dispose it only on final Pieces disposal. Keep Water render-target disposal at final lifetime end.
6. Add dispose spies for shared/deduplicated assets in headless tests; add browser count checks after real rendering and repeated board rebuilds. This task does not add aggressive instancing or geometry caches.

## Acceptance

Dispose each owned identity once per lifecycle, never dispose shared textures from individual previews, and make final disposal idempotent. Ten board rebuilds and 30 asset switches reach bounded renderer counts after warm-up. City upgrade does not leak the retired settlement. Smoke/typecheck/build and browser checks pass.

## Boundaries

Do not call `forceContextLoss` on the active game renderer as a substitute for disposal. Whole-application teardown is P09.

**Copyable prompt:** Implement only P08. Establish explicit ownership first, then replace removal/preview disposal paths. Verify both no leaks and no premature shared-texture disposal. Report the resource table and memory evidence in STATUS.
