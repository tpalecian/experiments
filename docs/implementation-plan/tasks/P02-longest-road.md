# P02 — Longest Road award and interruption

**Status:** Complete. **Dependencies:** P01. **Goal:** awards and VP reflect the current graph immediately.

## Read and edit

`src/engine/rules.ts:longestRoadLength, updateLongestRoad`, `src/engine/engine.ts:placeSettlement, placeRoad, refreshVp`, and rules fixtures/smoke. Preserve the current edge-simple path search unless a fixture proves it wrong.

## Steps

1. Add failing tests before changing award selection: unique leader ≥5, all below five, two leaders with no incumbent, tied eligible incumbent, and incumbent overtaken by tied successors.
2. Compute each player's length once. Let `max` be the maximum and `leaders` all players at it. Return null below five; keep currentOwner if it belongs to leaders; otherwise return the only leader or null if several tie. Never break a successor tie by player array order.
3. Add real-board integration fixtures in which an opposing settlement legally interrupts the current owner's chain. Use an existing graph vertex and legal connection/distance constraints, rather than testing only an impossible synthetic board.
4. Recompute the award after successful main-phase settlement placement as well as road placement, before VP refresh and victory evaluation. Reuse one scoring helper if it reduces repeated sequencing; do not emit intermediate states.
5. Cover both route endpoints at a blocking settlement: an edge leading to the opponent still counts, but continuation through that vertex does not. Include a cycle with a branch and assert no edge is reused in one route.

## Acceptance

All award cases above pass for player order permutations. An interrupted chain loses/transfers its award in the same emitted snapshot; both old and new owners' VP change correctly. Existing legal-road connectivity and setup tests still pass. Run typecheck and smoke.

## Boundaries and handoff

No new scoring rules, resource-bank behavior, or optimizations of the DFS without a failing correctness/performance case. Victory-message/active-turn corrections belong to P03. Official interpretation links are in AUDIT.

**Copyable prompt:** Implement only P02 after verifying P01. Correct Longest Road ties and settlement interruption using the listed fixtures. Preserve map rules and the existing graph. Do not begin P03; document any remaining victory behavior as pending. Update STATUS with test results.
