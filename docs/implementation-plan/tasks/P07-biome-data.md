# P07 — Biome validation and stable asset identity

**Status:** Not started. **Dependencies:** P01. **Goal:** an import either installs a valid usable model or leaves the current work untouched.

## Read and edit

`src/world/biomeLayouts.ts`, `src/world/assets/props.ts`, `src/world/assets/types.ts`, and the Biome Editor import/save handlers. Preserve the scale compensation in `createPropObject` unless replacing it with an equivalent tested contract.

## Steps

1. Separate forgiving persisted-data load from strict explicit import. Add `parseBiomeLibrary(raw: unknown): {ok:true;library:BiomeLayoutLibrary}|{ok:false;errors:string[]}` for explicit import. Reject unsupported version, invalid IDs/kinds/transforms, duplicate layout IDs, and duplicate prop IDs within a layout. Keep version 1 and existing export shape.
2. For explicit imports require nonempty unique string IDs, names ≤120 characters, at most 120 layouts and 100 props per layout, file size ≤2 MiB, finite transforms, scale 0.15–3, and nonnegative integer variants. Restrict prop centers to the existing radius-0.82 editing region; normalize finite yaw to [-π,π). Do not silently replace an empty/invalid imported library with defaults.
3. Require at least one layout per terrain for strict import. Persisted old data may keep valid entries and fill missing terrain from defaults, but return warnings and do not overwrite the original until the user saves. Invalid imports return useful path-specific errors.
4. Parse and validate completely before modifying library/history/selection. On success, push exactly one undo entry, swap the model, rebuild, and attempt persistence. On failure, retain all previous state and show the first actionable error with a count of others.
5. Catch persistence failures and retain in-memory edits with an unsaved indicator/export path. Replace timestamp-only IDs for newly created/duplicated layouts and props with `crypto.randomUUID()`-based IDs. Do not regenerate valid imported IDs.
6. Normalize palette indices with positive modulo in `makePastureRock`; test all variants. Validate factory scale once, and add dimension/finite-color tests covering the existing `SCALE_VIA_OPTS` split so no asset receives scale twice.

## Acceptance

Existing v1 exports within the supported authoring bounds round-trip. Older out-of-bounds persisted work is preserved with warnings rather than overwritten; explicit imports explain the offending values. Duplicate IDs, future versions, oversized counts/files, invalid numbers, empty data, and extreme scale reject atomically. A failed import adds no history entry. Selection/removal targets one unique prop. Asset colors/scales remain finite and predictable. Run smoke/typecheck and editor import/undo check.

## Boundaries

Do not automatically relocate authored props to token-safe areas in this task; P16 handles default art and P21 adds authoring warnings. No database or schema library dependency is needed.

**Copyable prompt:** Implement P07 only. Make explicit import atomic and strict while preserving legacy saved work, then fix stable IDs and the negative palette index. Follow the scale contract and acceptance fixtures; update STATUS.
