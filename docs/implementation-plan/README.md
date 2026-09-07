# Project improvement implementation handoff

Prepared 2026-09-05 against commit `427b3bd`. **Planning only: none of the tasks below is implemented by this documentation change.**

## Start here

The objective is a readable, cohesive miniature hex island with dependable gameplay, scalable effects, and authoring tools that preview the real game look. Keep Vite, TypeScript, Three.js/WebGL, local hotseat play, and the existing hex rules graph. Use Bruno Simon's folio as a reference for coordinated materials, systems, and iteration; do not copy its entire application or migrate to WebGPU in this work.

Read these files in order:

1. [Audit](AUDIT.md): evidence, confirmed defects, visual observations, and limitations.
2. [Architecture contracts](ARCHITECTURE.md): shared decisions that individual tasks must preserve.
3. [Visual target](VISUAL-TARGET.md): concrete art direction and initial tuning values.
4. The single assigned task under `tasks/`.
5. [Validation](VALIDATION.md): reusable tests and capture procedures.

[Copyable defect probes](REPRODUCTIONS.md) provide exact in-memory reproductions and original outputs for the small confirmed behavior bugs.

## Task queue

Each task file includes dependencies, exact entry points, implementation steps, acceptance cases, boundaries, and a copyable prompt. Execute one task at a time by default. The numbers are a valid sequential order; a dependency does not grant permission to implement that dependency in the same task. All tasks start **Not started**.

| ID | Task | Depends on | Review risk |
| --- | --- | --- | --- |
| P01 | [Deterministic fixtures and baseline](tasks/P01-baseline.md) | — | Low |
| P02 | [Longest Road correctness](tasks/P02-longest-road.md) | P01 | Medium |
| P03 | [Command validation and victory](tasks/P03-command-validation.md) | P02 | Medium |
| P04 | [Reliable gameplay feedback identity](tasks/P04-feedback-identity.md) | P03 | Low |
| P05 | [Tween scheduling and cancellation](tasks/P05-tweens.md) | P01 | Medium |
| P06 | [Style validation and persistence](tasks/P06-style-storage.md) | P01 | Low |
| P07 | [Biome import and model validation](tasks/P07-biome-data.md) | P01 | Medium |
| P08 | [GPU resource ownership](tasks/P08-resource-ownership.md) | P01 | Medium |
| P09 | [Application lifecycle and clock](tasks/P09-lifecycle.md) | P08 | Medium |
| P10 | [Shared presentation runtime](tasks/P10-presentation-runtime.md) | P09 | Medium |
| P11 | [Resolve atmosphere and craft once](tasks/P11-environment.md) | P06, P10 | Medium |
| P12 | [Consistent color pipeline](tasks/P12-color-pipeline.md) | P10, P11 | High: rendered review |
| P13 | [Water geometry and reflection correctness](tasks/P13-water-foundation.md) | P12 | High: rendered review |
| P14 | [Water composition and shoreline](tasks/P14-water-look.md) | P13 | High: rendered review |
| P15 | [Materials and shadows](tasks/P15-materials-lighting.md) | P11, P12 | High: rendered review |
| P16 | [Biome and token readability](tasks/P16-biome-art.md) | P07, P08, P15 | Medium: rendered review |
| P17 | [Camera, picking, and motion preference](tasks/P17-camera-input.md) | P05, P10 | Medium |
| P18 | [HUD usability and accessibility](tasks/P18-hud.md) | P03, P04, P17 | Medium |
| P19 | [Quality tiers and measurement](tasks/P19-quality-performance.md) | P10, P13 | Medium |
| P20 | [Thumbnail renderer and asset readiness](tasks/P20-thumbnails.md) | P08, P10 | Low |
| P21 | [Editor transactions and decomposition](tasks/P21-editor.md) | P07, P09, P16, P20 | Medium |
| P22 | [Reproducible craft workflow](tasks/P22-craft-workflow.md) | P06, P11 | Low |
| P23 | [Build, loading, and CI](tasks/P23-build-ci.md) | P01, P09 | Low |
| P24 | [Optional restrained effects](tasks/P24-optional-effects.md) | P04, P05, P14, P15, P19, P22 | High; deferred |
| P25 | [Integration and documentation reconciliation](tasks/P25-integration.md) | P01–P23 | Medium |

P24 is a fully specified later enhancement, not part of the first release gate. A visually coherent standard board is the first art milestone; 37- and 61-hex boards remain compatibility requirements throughout. Do not turn the first milestone into a terrain, networking, physics, or asset-pipeline rewrite.

## How to use lower-effort models

- Give a model the task's copyable prompt, not the whole queue as an implementation request.
- Require it to read the stated functions before editing. Paths and symbols reflect the audit snapshot; preceding tasks may move them.
- Split a task at its numbered checkpoint if the model is losing context. Keep the contracts and acceptance cases in the continuation.
- Require an exact changed-file list, relevant test output, and unresolved issues. A build passing is not proof of visual improvement.
- For P12–P15 and P24, require the same seeded before/after captures and a human or more capable model's visual review. The plan reduces decisions; it cannot replace looking at rendered shaders.
- If actual source contradicts the task, record the discrepancy and make the smallest adjustment preserving the contract. Do not invent new architecture to resolve a narrow mismatch.
- Record progress in [STATUS.md](STATUS.md). Mark complete only after acceptance cases pass. Do not implement future tasks opportunistically.

## Existing work and boundaries

At audit start `pnpm-lock.yaml` was untracked. Preserve it and any other pre-existing user changes. The tracked project uses npm commands and `package-lock.json`; P23 specifies npm as the default without deleting the user's pnpm file.

Existing docs mix intentions with claims of completed behavior. This handoff describes the audited state and planned changes explicitly. P25 reconciles those documents after implementation, rather than prematurely claiming new functionality exists.

Development cards, player-to-player trading, finite resource-bank simulation, multiplayer, a free-roaming vehicle, new map topology, audio, game save/resume, and paid/imported asset packs are outside this plan. Their absence is an MVP boundary, not a discovered defect.
