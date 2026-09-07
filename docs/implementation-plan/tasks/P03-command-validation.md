# P03 — Command boundaries, legal targets, and victory

**Status:** Complete. **Dependencies:** P02. **Goal:** rejected actions are no-ops, legal affordances agree with engine rules, and a winning move emits the final message.

## Read and edit

`src/engine/engine.ts` public commands/snapshot helpers; `src/engine/rules.ts:legalBuildTargets`; `src/engine/types.ts` resource/phase unions; targeted smoke fixtures.

## Steps

1. Add tests reproducing fractional discard and overwritten victory text. For every invalid case record resource totals, board occupancy, phase, winner, and listener count before/after.
2. Validate startGame arguments before mutation: integer player count 2–4, known map ID, finite integer seed. Validate resource enum names at runtime for bank trades and player/hex/vertex/edge IDs before dereferencing them. Keep public boolean return contracts; invalid `startGame`/`setBuildMode` remain no-op void commands.
3. Accept discard values only when finite nonnegative integers, no larger than holdings, with exactly the requested total. Reject unknown resource keys instead of counting or silently retaining them. Validate the player exists and has a pending discard.
4. Route automatic single-victim theft through a private transfer helper. Public `stealFrom` is valid only during `steal` and only for an existing listed opponent with cards. `moveRobber` computes eligible victims from the destination once, then either transfers automatically or enters selection. Reject direct theft during `robber`.
5. Use `legalBuildTargets` for main-phase snapshot highlight sets so costs and piece supply match the command. Keep setup helpers separate. For toggled build mode, derive message from the resulting mode, not the requested mode.
6. Refactor successful build completion to one sequence: graph mutation → award refresh → VP refresh → check active player's threshold → exactly one message → emit. Make the winner check return a boolean. Do not write ordinary action text after victory.
7. Only the current player can win. Check their score on entry to their turn before requesting a dice roll, covering award points obtained during another player's turn. Preserve thresholds 10/12/15. Ensure winner/phase/last action remain stable after gameOver commands.

## Acceptance

Test settlement/road/city wins, including Longest Road transfer; inactive player at threshold waits until their own turn; invalid inputs leave state unchanged; valid integer discard and legal theft work. Affordable legal targets disappear when cost/piece limit is not met. Run smoke/typecheck/build.

## Boundaries

Do not introduce a remote API, deep-clone snapshots, or rewrite all commands into a new command bus. Error explanations in the HUD are P18.

**Copyable prompt:** Implement P03 only. Follow its validation and scoring order exactly, retaining existing public signatures unless this task explicitly changes behavior. Add rejection/no-mutation tests and winning-message tests. Report APIs affected and update STATUS.
