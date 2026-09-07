# P17 — Safe camera framing, pointer lifecycle, and reduced motion

**Status:** Not started. **Dependencies:** P05, P10. **Goal:** all board actions remain reachable across viewports and gestures never leave stale input.

## Read and edit

CameraRig, Viewport, Game pointer handlers, input picker/tap, motion settings, HUD bounds, and UI styles. Add a small motion-preference controller in `src/core/`.

## Steps

1. Extend camera framing with `setSafeInsets({top,right,bottom,left})` in CSS pixels and current viewport size. Measure persistent HUD/control rectangles with ResizeObserver, with sensible zero-inset fallback. Debounce measurements to one frame.
2. Compute fit from actual board+harbor bounds at the desired tabletop orientation. Project candidate bounds and increase camera distance until every bound fits inside the safe rectangle with 16 px margin; cap iterations and compute a conservative initial distance from vertical/horizontal FOV. Offset the projection/target for an asymmetric safe area. Do not change gameplay coordinates.
3. Refit on initial build/reset and when resize would clip the board. Preserve an intentional user orbit/zoom if it still fits; do not reset camera every HUD text change. Keep existing tabletop pitch limits.
4. Use pointer capture for accepted primary canvas gestures, handle pointerup/cancel/lostpointercapture, and clear all state on blur, visibility pause, lobby, and modal blocking. Track multitouch until every pointer ends. Orbit/drag/pinch never invokes a board click.
5. Separate visual marker size from hit-child radius. Preserve generous coarse-pointer hits, raycast only currently legal targets, and guard zero-sized canvas rectangles. Keep existing recursive child picking behavior.
6. Add a motion preference (`system`, `full`, `reduced`, default system) backed by matchMedia. Reduced mode disables camera nudges/harbor bob and shortens placement travel to near-immediate state resolution. Keep brief opacity/color feedback. Add matching CSS reduced-motion handling for HUD animations.
7. Keep hover as glow; retain the legacy hexHoverLift field for compatibility but consistently label/document it as hover glow. Do not move only the tile body while props/pieces remain behind.

## Acceptance

All maps fit at 1280×720 and 390×844 without HUD overlap/clipping. Pointer release outside canvas clears state. Multitouch and cancelled gestures never place. New/reset nudges cancel old ones. Reduced motion settles pieces correctly and responds to system preference changes. Typecheck/smoke/browser tests pass.

## Boundaries

Keyboard action-list UI is P18. No new camera projection type or cinematic orbit system.

**Copyable prompt:** Implement only P17. Solve safe-area framing and input cleanup, preserve touch hit targets, and add reduced-motion behavior. Verify both portrait/landscape and cancelled gestures. Update STATUS with camera and input evidence.
