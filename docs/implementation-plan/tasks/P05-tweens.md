# P05 — Tween scheduling, cancellation, and landing motion

**Status:** Not started. **Dependencies:** P01. **Goal:** chained effects get their own frame time and cancelled animations cannot fight replacements.

## Read and edit

`src/core/tween.ts`, `src/world/Pieces.ts`, `src/view/CameraRig.ts`, `scripts/smoke.ts`.

## Steps

1. Add a failing chain test: complete a .5 s tween whose callback starts a .14 s tween; after the .5 s update the child must be at its initial value and still active. Its first elapsed time arrives in the next update.
2. Define update semantics: only tweens active at update start advance; new tweens initialize through onUpdate(0) immediately but queue for the next update. Implement a pending list or detached work list with an update guard.
3. `cancel` prevents future updates/completion. Recheck cancellation after onUpdate. `clear` cancels active and pending work, including clear invoked from a callback; use a generation/epoch guard so the old work list cannot resurrect items. Completion is invoked once.
4. Treat nonfinite/nonpositive dt as no advancement. Zero-duration tweens keep the current minimal-duration behavior unless all callers explicitly agree to immediate completion; do not silently change it.
5. Store a current camera-nudge handle; cancel it when a new nudge/reset/user orbit begins. Capture from/target vectors inside each tween rather than sharing mutable endpoints across concurrent callbacks.
6. Store/cancel relevant piece handles before removal, upgrade, or reset. Keep initial procedural asset scale; do not introduce double scaling. Preserve robber identity across resets and ensure landing squash restores identity scale.

## Acceptance

Test nested play, nested clear, cancellation in onUpdate, cancellation before update, concurrent independent tweens, and completion once. At 30/60/120 Hz the robber hop plus landing lasts the intended combined duration within one frame. Repeated camera reset/nudge does not drift. Run smoke/typecheck plus animation captures.

## Boundaries

No GSAP/dependency migration. The existing transform-based city upgrade remains; do not describe it as a morph/crossfade.

**Copyable prompt:** Implement P05 only. First reproduce nested-tween timing, then make update/cancel/clear semantics safe and wire cancellation into camera/pieces. Preserve existing easing feel and report frame-rate tests in STATUS.
