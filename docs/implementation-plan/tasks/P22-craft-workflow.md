# P22 — Exportable looks and inspectable craft controls

**Status:** Not started. **Dependencies:** P06, P11. **Goal:** good settings can be reproduced and shared, with visible control effects and bounded structural changes.

## Read and edit

StyleConfig/model metadata, `src/ui/style/configurator.ts`, craft styles, PresentationRuntime style subscription, and reviewScene.

## Steps

1. Add JSON export/import using the validated v23 style envelope. Download only on explicit export click. Limit import to 256 KiB; parse/sanitize entirely before applying; reject unsupported versions or objects with no recognized fields. On failure keep current settings and display a concise error.
2. Include an optional `review` object in exported files with seed/map/look/time/camera pose from reviewScene, separate from StyleConfig. Gameplay import applies style only; review import may restore those explicitly supplied fixture values. Never turn a style import into a game reset.
3. Add reset-per-section based on schema category keys and modified badges comparing normalized values to defaults. Reconcile cross-field bounds through the sanitizer. Keep global reset and deterministic named presets from P06.
4. Add short help text and impact metadata: `live` for colors/speeds/scalars, `rebuildWater` for subdivisions, `rebuildClouds` for cloud structure. Heavy structure sliders preview numeric values while dragging and apply on change/pointer release; uniform edits apply at most once per frame.
5. Show artistic controls only; time/matrices/generated SDF/texture handles are runtime data. Quality remains a separate performance setting. Disabled controls explain why (e.g. planar reflection unavailable on Low) without silently changing their stored artistic values.
6. Keep panel search/category state and focus stable after import/reset. Persist safely through P06 and show saved/unsaved status. Include the same configurator when the shared preview routes opt into look editing, using one style source per route.

## Acceptance

Export→import reproduces normalized settings and fixed review captures. Invalid JSON leaves state untouched. Section reset affects only that category plus necessary bound reconciliation. Structural controls rebuild once on release; color/speed edits rebuild nothing. Storage failure retains exportable edits. Build/typecheck and panel keyboard check pass.

## Boundaries

No preset cloud service, account system, or broad all-uniform settings dump. Update current-behavior docs only for features actually completed here.

**Copyable prompt:** Implement P22 only. Add validated look import/export, section reset, and impact-aware controls using the existing style model. Preserve review metadata separately from gameplay and verify reproducible captures. Update STATUS.
