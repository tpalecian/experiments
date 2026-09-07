# P25 — Integration, regression matrix, and truthful project docs

**Status:** Not started. **Dependencies:** P01–P23. **Goal:** deliver a cohesive project with verified behavior and documentation matching what exists.

## Read and edit

All prior task reports, [VALIDATION](../VALIDATION.md), README, AGENTS.md, and `docs/{VISION,TERRAIN,DAY_NIGHT,CONFIGURATOR}.md`. Application changes here are limited to reproduced integration regressions; reopen the owning task for substantial rework.

## Steps

1. Check dependency completion and contract drift: ensure there is one environment resolver, one application loop per route, one style sanitizer, one asset ownership policy, and one copy of the tile material factory. Update moved symbol/path references in the handoff.
2. Run a clean npm check/build and visit normal game, Asset Lab, Biome Editor, and review routes. Run the full deterministic visual/input matrix. Include actual device tests where available; explicitly mark untested hardware instead of claiming coverage.
3. Play a complete setup/main sequence for 2/3/4 players and each map size, including trade, seven/discard/robber, road interruption, and a winning action. Confirm no regressions in piece limits/VP thresholds or local hotseat flow.
4. Recheck stored legacy/current styles and custom biome libraries. Corrupt import and failed-storage tests must retain the user's prior work. New data should export/reimport successfully.
5. Perform the resource-count and production performance protocol. Verify quality changes, hidden-tab resume, app disposal, and route reload. Capture any target misses with hardware/tier details.
6. Reconcile existing docs: hover is glow; city upgrades are transforms; weather is palette/scalar unless additional tasks actually ship particles; day/night never rebuilds board geometry; current presets and craft features reflect actual implementation. Correct the obsolete Start Game instruction in AGENTS only after verifying the current lobby flow.
7. Add a concise top-level README link to this handoff and a current architecture/run/authoring summary. Do not rewrite the historical audit to imply it describes fixed code; append completion notes linking reports.
8. Mark tasks complete only with evidence; keep optional P24 deferred unless separately done. Record remaining issues, exact saved visual preset, measured bundle/performance results, and the recommended next narrowly scoped task. Do not deploy or publish as part of this task.

## Acceptance

Core checks pass; no new browser errors in the tested matrix; tokens/sites remain readable across required poses; invalid actions/imports are safe; no persistent resource-count growth after warm-up; baseline performance targets are met on the named tested devices or remaining limits are explicitly reported. Documentation accurately separates implemented/deferred work.

**Copyable prompt:** Perform P25 integration only after P01–P23 are complete. Execute VALIDATION, fix only reproduced integration regressions, reconcile current project docs, and produce evidence-backed completion reports. Do not implement optional effects or deploy the project.
