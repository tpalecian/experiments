# P20 — Reuse one thumbnail renderer and await assets

**Status:** Not started. **Dependencies:** P08, P10. **Goal:** editor thumbnails do not create a WebGL context per item or capture textures before loading.

## Read and edit

`src/ui/propThumbnails.ts`, editor warm-up calls, `src/style/style.ts` texture loader, shared AssetResources, and PresentationRuntime. Preserve static biome icon overrides unless they fail to load.

## Steps

1. Add readiness tracking to AssetResources for asynchronous texture loads. Expose `whenReady(): Promise<void>` plus per-asset failure information. Cache load promises; do not request the same meadow texture repeatedly. A failed texture gets a flat-color fallback and does not reject the entire game startup.
2. Replace per-thumbnail makeRenderer with a route-owned ThumbnailRenderer using one small offscreen canvas, one renderer, one reusable scene/camera, and shared presentation lighting. Do not start a permanent RAF loop for captures.
3. Change thumbnail APIs to promises/queued requests. Show placeholders immediately, process at most one uncached item per animation frame, wait for its assets, render/capture, then release owned preview geometry/materials through P08. Yield during a long list so editor input remains responsive.
4. Use a bounded 128-entry cache keyed by asset ID, variant, dimensions, and presentation/style revision. Cache successful output only; keep a fallback icon for failure. Static biome icon assets remain ordinary image URLs with an error fallback.
5. Cancel queued work on route disposal and ignore late results using a generation token. Final teardown releases the thumbnail renderer once. Do not dispose shared maps after every capture.
6. Reuse an existing renderer where the runtime exposes a safe capture-only instance; otherwise one dedicated thumbnail renderer per active editor is the allowed maximum. Do not borrow/change the live game's active target during a frame.

## Acceptance

Warm the full prop list with at most one thumbnail context; UI remains responsive. Texture-backed thumbnails show loaded art, errors show fallback, and route teardown prevents late DOM changes. Repeated requests hit cache; style revision invalidates it; resource counts plateau. Build/typecheck/editor check pass.

## Boundaries

No thumbnail server, image generation, persistent binary cache, or asset-pack conversion pipeline.

**Copyable prompt:** Implement P20 only. Convert thumbnail warm-up to a cancellable queued service using one renderer and explicit asset readiness. Preserve resource ownership and static icons; test load failures and update STATUS.
