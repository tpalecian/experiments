# P06 — Validated style data, safe storage, deterministic presets

**Status:** Not started. **Dependencies:** P01. **Goal:** malformed/old data cannot crash rendering, failed persistence does not stop editing, and named looks are reproducible.

## Read and edit

`src/style/styleConfig.ts`, `src/ui/style/craftSchema.ts`, `src/ui/style/configurator.ts`. Add pure `src/style/styleSchema.ts` metadata and storage helpers close to the model. UI schema can re-export/use it without a circular dependency.

## Steps

1. Add `sanitizeStyleConfig(raw: unknown): StyleConfig`. Only copy known keys. For numeric values require finite numbers, clamp to existing field min/max, and round counts/segments; keep continuous fields continuous. Validate enum membership and six-digit hex colors. Missing/invalid values use defaults. Reconcile orbit/height min≤max after field validation.
2. Move shared field validation metadata out of the UI dependency direction. The sanitizer and craft UI use the same bounds/options. Internal computed uniforms are not configuration fields.
3. Adopt the versioned envelope/key in ARCHITECTURE. Load valid v23 first; if absent, validate the legacy v22 object and attempt migration. Do not remove/overwrite legacy data on a failed save. Unsupported versions return defaults in memory plus a diagnostic.
4. Catch storage get/set/remove failures. Writes/removals return a result object. The configurator retains edited in-memory values and shows `Changes are not saved` on failure. Expose status access without using alerts for every slider event.
5. Apply presets as `{...DEFAULT_STYLE_CONFIG,...preset.patch}` followed by sanitization. This intentionally replaces overlay-on-current semantics. Preserve applyStylePreset's call signature for callers and document the new result semantics.
6. Coalesce live updates at most once per animation frame and persist after 150 ms idle; flush on explicit save/export or pagehide where possible. Dispose pending timers through P09. Applying a preset/reset sends one coherent normalized configuration.

## Acceptance

Test arrays/null/unknown keys, invalid colors/enums, NaN/infinity via programmatic input, out-of-range numbers, and contradictory min/max. Night→Day equals defaults→Day. Blocked/quota storage leaves sliders functional and reports unsaved state. Legacy data migrates without loss of valid values. Smoke/typecheck pass.

## Boundaries

No new rendering behavior. Import/export buttons and per-section reset are P22. Keep the existing panel's seven categories until a task adds real fields.

**Copyable prompt:** Implement only P06. Centralize validation metadata, retain legacy data safely, and make presets independent of previous settings. Add pure sanitizer/storage tests with a fake storage provider; update STATUS.
