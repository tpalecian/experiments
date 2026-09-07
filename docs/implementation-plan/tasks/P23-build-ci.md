# P23 — Route loading, script checking, and continuous validation

**Status:** Not started. **Dependencies:** P01, P09. **Goal:** ship only needed route code initially and make current validation repeatable.

## Read and edit

`src/boot.ts`, route predicate helpers, `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, and future `.github/workflows/ci.yml`.

## Steps

1. Move route detection into a tiny pure helper that reads the current query/hash once. Dynamically import Game, Asset Lab, Biome Editor, or reviewScene after choosing the route. Do not statically import a lab just to call its route predicate.
2. Preserve route compatibility (`?view=assets`, biome-editor query/hash, ordinary game, P01 review). Add a small loading/error region if importing or renderer startup fails; offer reload and keep the message understandable. AppHandle disposal remains owned by boot.
3. Keep npm/package-lock authoritative for CI and documented commands. Pin the tested Node 22 major via an engines/.nvmrc choice consistent with the current environment; add npm scripts `typecheck` and `check` (typecheck, smoke, build). Preserve the pre-existing untracked pnpm-lock.yaml; do not delete it or regenerate both lockfiles.
4. Add `tsconfig.scripts.json` for smoke/fixture scripts with noEmit, matching strictness and explicit Node types. Add direct `@types/node` dev dependency only if needed, updating package-lock with npm. Fix real script errors; do not exclude failing fixtures to make checks pass.
5. Add GitHub Actions for pull requests/pushes: checkout → setup Node 22/npm cache → npm ci → npm run check. Use supported official action releases, pinned consistently with repository practice; verify their official documentation at implementation time. Do not add deployment or secrets.
6. Compare built route chunks and gzip totals with AUDIT. Separate authoring code through dynamic imports; allow a large shared Three chunk if unavoidable. Do not raise warning thresholds or add manualChunks solely to hide a warning. Record actual loaded entry/route chunks, not just filenames.
7. Document failure/loading behavior and current startup flow: selecting a player-count button starts the game after map selection; there is no separate Start Game button in the audited UI.

## Acceptance

All routes load directly and have usable failure fallback; normal game does not eagerly load editor code. npm ci/check succeeds on a clean environment, scripts are typechecked, workflow contains no deployment, and known user files remain untouched. Record before/after bundle sizes.

## Boundaries

No major dependency upgrades, bundler migration, package-manager switch, or publishing. Do not commit generated dist output.

**Copyable prompt:** Implement P23 only. Lazy-load routes, typecheck scripts, and add npm-based CI without upgrading the rendering stack or deleting the user's pnpm lockfile. Verify all routes and bundle changes; update STATUS.
