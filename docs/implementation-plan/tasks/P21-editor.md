# P21 — Editor transactions, clear warnings, and smaller modules

**Status:** Not started. **Dependencies:** P07, P09, P16, P20. **Goal:** edits are atomic/undoable and the editor becomes understandable without changing its tool set.

## Read and edit

`src/ui/biomeEditor.ts`, biome data/footprint helpers, existing TransformControls events and UI bindings. Split into `src/ui/biomeEditor/{state,scene,view}.ts`; keep route helpers/exported startup in the original entry module.

## Steps

1. First add behavior coverage for create/duplicate/delete/rename layout, add/delete/transform prop, undo/redo, failed import, and save failure. Use P07 IDs/model validation; do not create a competing sanitizer.
2. Extract state/history to a DOM/Three-independent controller owning library, selection, dirty/persist status, and undo/redo stacks. Introduce `commitEdit(label, edit)` with a cloned candidate: validate → compare for change → push one history entry → replace model → notify. Failed/no-op edits do not clear redo or add history.
3. Treat transform drag as one transaction: snapshot at drag start; preview mesh/model during drag; commit once at end. Cancel restores the pre-drag state. Keep the 40-entry history cap. Undo/redo clears invalid selection safely.
4. Apply snapping before final boundary clamp, using the same model bounds for typed inspector edits, gizmo transforms, and drop placement. Normalize rotation/scale consistently; do not let snapping move a center outside the permitted region.
5. Extract scene/picking/TransformControls to scene.ts with explicit callbacks and disposal. Extract DOM rendering/binding to view.ts; preserve focused field and cursor where content updates. Keyboard shortcuts ignore editable/contenteditable targets, not only INPUT/TEXTAREA/SELECT.
6. Use the transaction path for imports, resets, duplicates, and deletes. Display accurate unsaved/save-error status, preserving in-memory work and export. Keep export/import shapes from P07.
7. Use P16's footprint helper to show token/edge overlap warnings with selected prop IDs and affected rule. Warnings do not silently move existing custom props. Authoring camera/day-night uses the shared P10/P11 setup; do not introduce another local lighting implementation.

## Acceptance

One drag produces one undo step; no-op and failed import produce none; cancel restores state; duplicate IDs cannot occur; undo/redo selection is valid. Snap/typed/drop paths agree. Keyboard shortcuts do not delete props while typing. Teardown stops listeners/late thumbnails. Existing editor features remain reachable.

## Boundaries

No editor framework, asset hierarchy redesign, multiplayer authoring, or new scene format. Limit extraction to the three responsibilities above.

**Copyable prompt:** Implement only P21. Add transaction semantics first, then extract state/scene/view while preserving the existing editor behavior. Reuse validation and lifetime services, test undo/import failures, and update STATUS.
