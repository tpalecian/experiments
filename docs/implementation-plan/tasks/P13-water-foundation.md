# P13 — Water mesh, normals, and safe reflection pass

**Status:** Not started. **Dependencies:** P12. **Goal:** real interior wave subdivision and stable reflections before changing the visual design.

## Read and edit

`src/world/WaterSurface.ts`, `src/world/World.ts:renderWaterReflection`, runtime pre-render ordering, and `src/core/Quality.ts`. Separate water GLSL into `src/world/water/shaders.ts` if that makes review narrower; do not create a plugin framework.

## Steps

1. Replace CircleGeometry with an XZ-oriented PlaneGeometry covering the same diameter. Use the existing capped waterSegments for both width and height subdivisions. Preserve the circular radial fade in the fragment shader; square corners must disappear. Keep world coordinates and the hex land mask unchanged.
2. Share the swell function and its analytic sine derivatives between vertex/fragment shader strings. Compute the fragment normal from those derivatives at the fragment's world XZ, scaling the slopes by the same attenuation derived from the already-computed shore distance. Deliberately omit the attenuation field's derivative as a near-flat shore approximation and document it. Do not evaluate the full hex-distance loop several additional times per pixel for finite-difference normals. Low quality may use flat geometry with fragment normals later in P19.
3. Generate normals from the actual displacement coordinate convention; do not apply model transforms twice. Explicitly document that the water mesh has translation only at present. If transforms are later supported, test them before using them in reflection projection.
4. Before deriving reflected camera/texture matrices, update camera, scene, and water world matrices. Use one coordinate convention: texture matrix projects world position and therefore does not multiply modelMatrix again when the varying already contains world position.
5. Put hidden-water/harbor visibility and renderer target/XR/shadow-auto-update restoration inside nested try/finally blocks. Set the reflecting guard only for the active pass and restore on early exit/error. Keep scissor/viewport unchanged or restore them if the pass changes them.
6. Keep reflected shadow data from the main light rather than recomputing it from the mirror camera. On the first frame after board build, use the sky fallback and skip reflection until one main render initializes shadow maps; schedule reflection on the next frame. Reset this readiness flag on renderer recreation. The pass must not accidentally freeze main shadows.
7. Rebuild/dispose water geometry only when its structural setting/map bounds change, never on time or palette changes.

## Acceptance

Mesh has interior XZ vertices; subdivision changes interior density. Wave displacement is visible locally at a temporary diagnostic amplitude and returns to default afterward. No coastline cracks/square rim, stale orbit reflection, clipping inversion, or blank first-frame reflection. A test-induced render exception restores state. All map sizes and quality caps build.

## Boundaries

Keep old visual parameter values for this task. Shoreline tuning is P14; reflection scheduling is P19. Do not add multiple reflection passes.

**Copyable prompt:** Implement P13 only in two checkpoints: mesh/normals, then reflection state/matrices. Use fixed captures before/after each. Preserve color pipeline and disposal, run acceptance checks, and update STATUS.
