# Shared implementation contracts

These are target contracts, not descriptions of already-created files. Task files identify when each contract is introduced. Keep the engine independent of Three.js and DOM. Do not add a singleton, ECS, generic service locator, or framework migration.

## Ownership boundaries

| Owner | Owns | Must not own |
| --- | --- | --- |
| `GameEngine` | Rules, board graph, resources, phase, action/roll identity | Camera, materials, DOM, clocks for shaders |
| `Game` | Wiring engine, HUD, presentation, input; explicit update order | Duplicated shader/color math |
| `PresentationRuntime` (P10) | Rendering, scene, Time, Viewport, Lighting, Fog, environment output | Lobby/rules state and board generation |
| `World` | Board, props, pieces, water, highlights; visual sync | Mutating rule state |
| `AssetResources` (P08) | Shared texture/cache ownership and disposal policy | Application routing or board rules |
| Lab/editor routes | Scene content, route UI, orbit/transform controls, editor model | Alternative tone mapping/environment logic |

Retain recognizable folders. Add focused modules near their concern rather than relocating all existing files. Move code only when a task makes one owner explicit. The `src/engine` directory remains a headless dependency boundary.

## Presentation lifecycle

P10 introduces `PresentationRuntime` with `scene`, `rendering`, `start(frame)`, `stop()`, `resize()`, and idempotent `dispose()`. Constructor options include `canvas`, `container`, `camera`, and normalized style config. `start` accepts a callback that updates route content and optionally performs a pre-main-render pass. The runtime owns exactly one RAF loop. Routes own their controls and content; each route returns/disposes one application handle.

Per frame: advance clamped simulation time → update controls/camera tweens → resolve environment → apply environment → update pieces/water/sky → update camera/world matrices → reflection if scheduled → main render → record metrics. Sample renderer counters across the whole frame, not just the last render. A fixed scene may skip unchanged material updates, but controls and active tweens still run.

On teardown: cancel RAF and timers → unsubscribe events/listeners → detach controls/transform helpers → dispose route-owned meshes → release route references to shared assets → dispose runtime render targets/renderer → remove route DOM/body classes. Shared cached textures live until the owning resource service is disposed; mesh disposal must not blindly dispose them. HMR must use the same path.

## Environment resolution

P11 introduces `resolveEnvironment(base, style, out)` in `src/atmosphere/resolveEnvironment.ts`. `base` is the day-cycle snapshot. Resolve weather first, then craft controls, into reusable output objects. Do not mutate atmosphere presets, style defaults, or `base`. The output is `ResolvedEnvironment`: a snapshot plus a resolved sun direction, final exposure, and water uniforms whose colors/scalars no longer need per-renderer recomposition.

Keep current water composition formulas initially, moving them without visual change. For sky/cloud colors, compute linear RGB multipliers `craft / max(defaultCraft, 0.0001)`, bound each multiplier to 0–4, and multiply the scheme/weather color. Defaults therefore preserve the scheme, while edits survive a frame. Scalars use the existing reference ratios. P15 subsequently tunes reference/default lighting values together. Do not apply these ratios twice.

Craft changes affect uniform/material state. Geometry rebuilds are limited to explicit structure edits: map size/seed, water subdivisions, cloud geometry/count/layout, or authored props. Speed, color, time, exposure, and weather edits do not respawn objects. Expose authored aesthetic controls, not uniforms such as matrices, texture handles, time, or computed masks.

## Color and render passes

Three.js r172 and `WebGLRenderer` remain the baseline. Input hex/CSS colors become linear via Three.Color. Color textures are tagged sRGB; masks/noise/data textures are not. Intermediate render targets hold linear values. World materials, sky, water, and clouds participate in the same scene tone mapping. HTML UI remains ordinary CSS.

With direct rendering, custom shader output includes `tonemapping_fragment` then `colorspace_fragment`. With optional P24 post-processing, render the scene linearly and let one final OutputPass apply tone mapping/display conversion. Do not manually gamma-encode uniforms, and do not tone-map a reflection texture before blending it into water. Any shader patch must have a stable customProgramCacheKey and an explicit supported Three version.

## Feedback and commands

P04 adds `gameId`, `rollId`, and `productionHexIds` to `EngineSnapshot`. Increment `gameId` at each start; reset rollId to zero for that game; increment rollId only for an accepted roll. Consumers compare the pair. `productionHexIds` identifies unblocked matching hexes that actually grant at least one resource. Board animation consumes those IDs, not prose or just a dice total. Ordinary state sync must not replay feedback.

Keep boolean command results for compatibility. Invalid commands are no-ops. P03 makes scoring order explicit: apply legal mutation → recompute affected awards → recalculate VP → determine active-player victory → set exactly one message → emit one state notification. P18 derives reasons for disabled UI actions without making the UI an authority for legality.

## Persistence

P06/P07 introduce validation at JSON boundaries. UI ranges, defaults, and runtime validation share metadata; avoid importing DOM UI classes into the model. Existing style data is migrated from `catan-style-config-v22` into a versioned envelope without deleting the original key until a valid replacement is written. New style key: `catan-style-config-v23`, envelope `{ version: 23, config: StyleConfig }`. Keep biome schema version 1 for compatible fields; reject unsupported future versions during explicit import.

Storage helpers return `{ ok: true } | { ok: false; message: string }` for writes/removals. Editing remains usable in memory on storage failure; UI says it is unsaved and offers JSON export. An explicit failed import never replaces the current library/config or history. Loading corrupt persisted data may fall back in memory, but must not silently overwrite the original payload.

## Scope and review rules

Small fixes must not introduce new dependencies. Use built-in Three addons for optional rendering passes. Use npm/package-lock for CI; retain the user's untracked pnpm lockfile. New rendering settings must be represented in style defaults, schema, sanitizer, and presets in the same task. Never change game topology to solve a visual overlap.

Public engine snapshot references are currently live/mutable; this plan does not promise deep immutability or add deep clones to every pointer event. Production consumers treat them as read-only. Fixtures may deliberately construct state in test code. Additional boundaries should be introduced only when a task needs them.
