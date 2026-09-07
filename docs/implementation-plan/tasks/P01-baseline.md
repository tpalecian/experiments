# P01 — Deterministic fixtures and visual baseline

**Status:** Complete. **Dependencies:** none. **Goal:** make every later result reproducible without changing production gameplay.

## Read and edit

Read `src/boot.ts`, `src/Game.ts`, `src/engine/engine.ts`, `src/engine/board.ts:createBoard`, and `scripts/smoke.ts`. Add `src/ui/reviewScene.ts` and small fixture helpers under `scripts/fixtures/`. Follow [validation](../VALIDATION.md).

## Steps

1. Record the clean baseline commands and existing untracked files in STATUS; preserve them. Do not install or upgrade dependencies merely to establish a baseline.
2. Add an optional second constructor argument to `GameEngine`: `random: () => number = Math.random`. Store it and use it for dice/theft draws. Existing one-argument construction remains compatible; board generation continues to use its existing seeded generator.
3. Add test helpers for seeded setup, affordable action states, and small synthetic road graphs. Keep synthetic graphs in test code. Do not replace global Math.random in new tests.
4. Add the opt-in `view=review` route from VALIDATION. Parse supported map/look/seed values, falling back to standard/day/11 for invalid query values. Construct real game/world objects with explicit defaults rather than reading or overwriting user style/layout storage. Add constructor injection for those data sources only where the fixture needs it.
5. Freeze scene time at zero, set the canonical camera, and expose review-only controls for play/pause and one deterministic setup/action sequence. Keep the existing lobby route behavior unchanged. Use an engine instance with injected dice draws, not direct DOM calls to private game methods.
6. Capture the core standard/day baseline and record the review route configuration. Later tasks use this route and migrate it to PresentationRuntime in P10. Do not commit generated screenshot binaries by default.

## Acceptance

- The same seed produces identical hex resources, numbers, layout selection, and fixture state across reloads.
- Review startup does not change existing localStorage payloads; the ordinary game retains fresh/random play.
- Typecheck, smoke, build pass. Review scene renders with no console error.
- Different injected random sequences change dice/theft outcomes without changing the board seed.

## Boundaries and handoff

No visual tuning, rule corrections, test-framework migration, or production debug controls. Report fixture URLs and helper APIs so subsequent models reuse them.

**Copyable prompt:** Implement only P01 in `docs/implementation-plan/tasks/P01-baseline.md`. Read ARCHITECTURE and VALIDATION first. Preserve user data and existing untracked files. Create deterministic review/test fixtures and RNG injection; do not fix unrelated behavior. Run the listed acceptance cases and update STATUS with evidence.
