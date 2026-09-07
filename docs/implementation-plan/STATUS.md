# Implementation status

Audit baseline: commit `427b3bd`, 2026-09-05.

## Pre-existing untracked files (preserved)

Not installed, upgraded, or deleted for this baseline:

- `docs/implementation-plan/` (this documentation package)
- `pnpm-lock.yaml`

Tracked tooling remains npm / `package-lock.json`.

## Clean baseline commands (before P01)

Recorded 2026-09-05 against the audited sources, before fixture work:

- `npx tsc --noEmit` — pass
- `node --import tsx scripts/smoke.ts` — pass (`npm run smoke` / tsx CLI not required; Node loader used)
- `npm run build` — pass. JS 730.59 kB (gzip 192.87 kB), CSS 23.97 kB. Expected >500 kB chunk warning.

| Task | Status | Evidence / notes |
| --- | --- | --- |
| P01 | Complete | Fixtures, RNG injection, review route. See report below. |
| P02 | Complete | Longest Road ties and settlement interruption. See report below. |
| P03 | Complete | Rejected commands are no-ops; winning move keeps winner text; only the current player can win. See report below. |
| P04 | Not started | |
| P05 | Not started | |
| P06 | Not started | |
| P07 | Not started | |
| P08 | Not started | |
| P09 | Not started | |
| P10 | Not started | Review scene still has its own RAF loop; migrate to PresentationRuntime here. |
| P11 | Not started | |
| P12 | Not started | |
| P13 | Not started | |
| P14 | Not started | |
| P15 | Not started | |
| P16 | Not started | |
| P17 | Not started | |
| P18 | Not started | |
| P19 | Not started | |
| P20 | Not started | |
| P21 | Not started | |
| P22 | Not started | |
| P23 | Not started | |
| P24 | Deferred | Optional effects, outside first release gate |
| P25 | Not started | |

## Helper APIs introduced in P01 (reuse these)

- `GameEngine(seed?, random?: () => number)` — default `random` is `() => Math.random()`. Dice and theft use `this.random`. One-arg construction unchanged. Board generation still uses `createBoard` / `SeededRandom`.
- `Time.freeze(at?)` / `Time.play()` / `Time.isFrozen` — review freezes elapsed at 0.
- `World({ biomeLibrary })` and `Props.reload(library?)` — omit to keep production localStorage load.
- Review query: `src/ui/reviewRoute.ts` — `isReviewRoute`, `parseReviewQuery`, `reviewHref`, `REVIEW_DEFAULTS`.
- Engine fixtures: `src/engine/fixtures.ts` (re-exported from `scripts/fixtures/engine.ts`) — `startSeededGame`, `completeLegalSetup`, `grantAffordableResources`, `prepareAffordableMain`, `boardLayoutFingerprint`, `fixtureStateFingerprint`, `runDeterministicActionSequence`.
- RNG helpers: `src/engine/rng.ts` (re-exported from `scripts/fixtures/random.ts`) — `sequenceRandom`, `unitForDie`, `diceSequence`.
- Synthetic road graphs (test-only): `scripts/fixtures/roads.ts` — `emptyRoadGraph`, `addRoad`, `addRoadChain`, `addBlockingSettlement`.
- Canonical review URL: `?view=review&seed=11&map=standard&look=day`. Supported maps: standard/large/huge. Looks: day/sunset/night. Invalid values fall back to 11/standard/day. Optional second seed: 29.

## Helper APIs introduced in P02

- `updateLongestRoad` — compute each length once; `max < 5` → `null`; keep `currentOwner` if they are a leader; otherwise the unique leader, or `null` on a successor tie.
- `GameEngine` private `refreshAwardsAndVp()` — updates Longest Road then VP; used after main-phase settlement and road placement, before `checkWin` / emit.
- Test helpers in `scripts/fixtures/longestRoad.ts` (re-exported from `scripts/fixtures/index.ts`): `awardPlayers`, `permute`, `growOpenLongestRoad`, `arrangeLegalRouteInterruption`.

```text
Task ID: P01
Status: complete
Source files changed:
  src/engine/engine.ts
  src/engine/rng.ts
  src/engine/fixtures.ts
  src/core/Time.ts
  src/world/Props.ts
  src/world/World.ts
  src/ui/reviewRoute.ts
  src/ui/reviewScene.ts
  src/ui/styles/labs.css
  src/boot.ts
  index.html
  scripts/smoke.ts
  scripts/fixtures/index.ts
  scripts/fixtures/engine.ts
  scripts/fixtures/random.ts
  scripts/fixtures/roads.ts
  .gitignore
  docs/implementation-plan/STATUS.md
  docs/implementation-plan/tasks/P01-baseline.md
Contract/API changes:
  GameEngine second constructor argument `random`.
  World/Props optional biome library injection.
  Time freeze/play.
  Opt-in `view=review` route; lobby unchanged.
Targeted cases passed:
  Same seed 11 → identical hex/number/harbor fingerprint with different injected dice.
  Injected 1+1 vs 6+6 changes lastRoll without changing the board.
  Injected theft 0 vs 0.99 steals wood vs ore.
  parseReviewQuery falls back to standard/day/11; seed=29&map=huge&look=night parsed.
  prepareAffordableMain enters main with city/road costs.
  Synthetic 5-edge chain readable by longestRoadLength.
  Review route: frozen setup-complete roll, 2 players, 2 VP each, no style/biome writes.
  Run sequence: 4+4=8 then city upgrade via public engine methods.
  Play/pause toggles frozen/playing.
  Ordinary `/` lobby and 2-player start still work.
Commands and outcomes:
  npx tsc --noEmit — pass
  node --import tsx scripts/smoke.ts — pass (includes `ok P01 fixtures and rng injection`)
  npm run build — pass. JS 740.08 kB (gzip 194.39 kB), CSS 24.81 kB. Expected chunk warning.
Browser/device/capture evidence:
  http://127.0.0.1:5173/?view=review&seed=11&map=standard&look=day
  Review startup left localStorage empty; reload preserved planted `catan-style-config-v22` and `catan-biome-layouts-v1` marker payloads.
  Invalid query `seed=bad&map=nope&look=whatever` rendered seed 11 · standard · day.
  WebGL getError() === 0; document.fonts.status === 'loaded'; no window error events after listeners attached.
  Local capture (not committed): docs/implementation-plan/captures/p01-standard-day.png
Remaining limitations:
  ReviewScene duplicates Game's RAF/presentation wiring until P10.
  Hud.render() still does not hide #lobby; review adds `.hidden` and `body.review-mode` CSS.
  Existing smoke blocks still monkeypatch Math.random; new tests use injection. Default RNG is a live Math.random wrapper so those old patches keep working.
  Screenshot binary is gitignored; do not add it to source control by default.
Next task (do not start automatically): P02 — Longest Road correctness
```

```text
Task ID: P02
Status: complete
Source files changed:
  src/engine/rules.ts
  src/engine/engine.ts
  scripts/smoke.ts
  scripts/fixtures/roads.ts
  scripts/fixtures/longestRoad.ts
  scripts/fixtures/index.ts
  docs/implementation-plan/STATUS.md
  docs/implementation-plan/tasks/P02-longest-road.md
Contract/API changes:
  updateLongestRoad no longer breaks successor ties by player-array order.
  Main-phase placeSettlement recomputes Longest Road before VP and checkWin.
  Shared private refreshAwardsAndVp sequences award then VP without an extra emit.
  Test helpers: addRoad, awardPlayers, permute, growOpenLongestRoad, arrangeLegalRouteInterruption.
Targeted cases passed:
  Unique leader ≥5, all below five, two leaders with no incumbent, tied eligible incumbent, incumbent overtaken by tied successors — all player-order permutations.
  Historical two disjoint 5-edge chains with no incumbent → null (was 0).
  Split-to-below-five synthetic block drops the award.
  Blocking settlement at both chain endpoints still counts the edge that meets the opponent; continuation through that vertex does not.
  Cycle with a branch has length 6 of 6 unique edges (no reuse).
  Seed-11 legal main-phase settlement on an existing graph vertex interrupts the incumbent; one snapshot updates award and both players' VP.
  Map win thresholds remain 10/12/15. Occupied/missing road placements remain no-ops.
Commands and outcomes:
  npx tsc --noEmit — pass
  node --import tsx scripts/smoke.ts — pass (includes `ok P02 longest road award and interruption`)
Browser/device/capture evidence:
  Not required for this rules-only task.
Remaining limitations:
  Victory-message overwrite remains: checkWin sets winner text, then placeSettlement/placeRoad/placeCity replace it with the build sentence (P03).
  checkWin still inspects every player, so a transferred Longest Road could end the game on a non-active turn (P03).
  Fractional discard, robber steal adjacency, and unaffordable advertised build sites are also P03, not victory-specific.
Next task (do not start automatically): P03 — Command validation and victory
```

```text
Task ID: P03
Status: complete
Source files changed:
  src/engine/engine.ts
  scripts/smoke.ts
  docs/implementation-plan/STATUS.md
  docs/implementation-plan/tasks/P03-command-validation.md
Contract/API changes:
  Public command signatures unchanged (boolean results; startGame/setBuildMode remain void no-ops when invalid).
  startGame validates integer player count 2–4, a known map ID, and a finite integer seed before any mutation.
  bankTrade validates resource enum names at runtime.
  placeSettlement/placeRoad/placeCity/moveRobber/discard/stealFrom validate IDs and player existence before dereference.
  discard accepts only finite nonnegative integers, exact pending total, known resource keys, an existing player with a pending discard.
  stealFrom is valid only during steal, and only for an existing listed opponent who has cards. Direct theft during robber is rejected.
  moveRobber computes eligible victims from the destination once, then auto-transfers via private transferStolenCard or enters selection.
  Main-phase snapshot legalVertices/legalEdges use rules.legalTargets (audit name legalBuildTargets; the existing export was kept).
  setBuildMode derives the prompt from the resulting mode, including toggle-off to none.
  Successful main-phase builds share completeBuild: graph mutation → refreshAwardsAndVp → checkWin → exactly one message → emit.
  checkWin returns boolean and inspects only the current player. endTurn (and setup-complete turn entry) check that player before requesting a roll.
  Discrepancy: the task named legalBuildTargets; source already exports legalTargets. Contract kept; no rename/new architecture.
Targeted cases passed:
  Fractional/NaN/infinite/negative/unknown-key/oversize/short/missing-player discards are no-ops; a real 1+6 seven then exact integer discard works.
  Direct robber-phase theft, missing/same hex, unlisted/empty/self/missing steal targets leave state unchanged; auto single-victim theft and listed steal work.
  Invalid startGame args, unknown build mode, unknown trade resources, missing vertex/edge IDs are no-ops.
  Toggle-off build mode message is "Select an action." from resulting none.
  Affordable city/road/settlement highlights disappear when cost or piece supply is not met.
  City, settlement, and Longest Road (including transfer) wins keep winner text and do not write the build sentence.
  Inactive player at ≥10 VP does not win during the opponent's turn; they win on turn entry before a dice request.
  gameOver commands leave winner/phase/last action/roll identity/notification count unchanged.
  Map thresholds remain 10/12/15; 10 VP does not end a large-map game.
Commands and outcomes:
  npx tsc --noEmit — pass
  node --import tsx scripts/smoke.ts — pass (includes `ok P03 command validation and victory`)
  npm run build — pass. JS 740.99 kB (gzip 194.70 kB), CSS 24.81 kB. Expected chunk warning.
Browser/device/capture evidence:
  Not required for this rules-only task.
Remaining limitations:
  HUD still does not explain why a command was rejected (P18).
  EngineSnapshot still has no gameId/rollId/productionHexIds (P04).
  Public snapshots remain live/mutable; this task did not add deep clones.
Next task (do not start automatically): P04 — Reliable gameplay feedback identity
```
