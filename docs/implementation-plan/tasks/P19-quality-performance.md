# P19 — Measured quality tiers and reflection budgets

**Status:** Not started. **Dependencies:** P10, P13. **Goal:** quality tiers remove real work and measurements cover the entire rendered frame.

## Read and edit

`src/core/Quality.ts`, `src/core/Monitoring.ts`, Rendering/PresentationRuntime, WaterSurface, Props tint registration, and [VALIDATION](../VALIDATION.md).

## Target caps

| Tier | DPR cap | Shadow map | Water subdivisions | Reflection |
| --- | --- | --- | --- | --- |
| Low | 1 | 512 | 24 | Disabled; sky-color fallback |
| Medium | 1.5 | 1024 | 48 | 512 target; every second frame while settled |
| High | 2 | 2048 | 96 | 768 target; each frame |

Keep `?quality=low|medium|high` authoritative. Default to Medium for coarse pointers or the existing constrained-device heuristic, High otherwise. Do not claim CPU-core count identifies GPU capability. This phase uses stable tiers, not an oscillating auto-quality controller.

## Steps

1. Extend QualityCaps with reflectionEnabled/update cadence. Keep capWaterSegments bounded. Low quality uses zero vertex displacement with per-fragment normals and no reflection-target allocation; a shader uniform selects the environment fallback without sampling an uninitialized texture.
2. On Medium, invalidate reflection on build, resize, style/quality change, visible scene mutation, camera motion, and active piece motion; refresh on the next renderable frame, respecting P13's initial shadow-readiness fallback. When settled, update every other rendered frame. Shader time can animate continuously between updates. High remains every frame after readiness. Changing to Low releases its target safely.
3. Update effective DPR on resize/display-DPR changes. Tier transitions rebuild only affected targets/geometry and preserve rules/camera/piece state. Provide a simple quality select in settings/Style with actual effective caps shown in debug; record manual preference separately from artistic presets.
4. Set renderer.info.autoReset=false for frame accounting; reset once before all frame passes, then sample after main render. Display draw calls, triangles, geometries/textures, reflection-enabled/update status, median/p95 frame interval, and selected/effective tier. Update DOM at most twice per second.
5. Replace per-frame Props traversal with registered unique material/base-color pairs rebuilt only when content changes. Reuse resolver output objects and avoid fixed-frame changes when its revision is unchanged. Stop water SDF loops after uHexCount; keep all live hexes so interior land stays excluded.
6. Measure the production capture matrix using VALIDATION. If targets are missed, report the measured tier/hardware and use the next lower tier for that device; do not add unplanned effects or promise universal 60 FPS. Leave larger instancing/SDF-texture work as a measured follow-up rather than guessing a bottleneck.

## Acceptance

Low performs no reflected-scene render/allocation; fallback remains colored correctly. Medium saves settled pass work but updates during interaction. Counters include reflection and main passes. Tier changes do not leak resources. Record foreground hardware-based performance results and compare equivalent baselines.

**Copyable prompt:** Implement only P19 with the exact tier behavior above. Measure whole-frame counters and remove redundant tint work. Prove Low skips reflections and Medium refreshes correctly; report measured limitations in STATUS rather than adding speculative optimizations.
