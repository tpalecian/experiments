# P04 — Reliable dice and production feedback

**Status:** Not started. **Dependencies:** P03. **Goal:** animate accepted actions once, including identical consecutive dice, and pulse only hexes that produced.

## Read and edit

`src/engine/engine.ts:EngineSnapshot, rollDice, startGame`, `src/engine/rules.ts:distributeProduction`, `src/Game.ts:pulseIfProduced`, `src/world/World.ts:pulseProduction`, `src/world/Board.ts:pulseProduction`, `src/ui/hud.ts:lastDiceKey`.

## Steps

1. Add snapshot fields `gameId: number`, `rollId: number`, `productionHexIds: string[]`. Increment gameId on accepted start, reset rollId to zero, increment it once per accepted roll, and clear production IDs on start/endTurn/seven.
2. Factor a pure production-details calculation that returns per-player gains and the unique hex IDs contributing a nonzero gain. Keep `distributeProduction`'s existing return type through a wrapper if existing callers need it. Apply resources once only; calculating visual metadata must not distribute a second time.
3. Include unblocked matching productive tiles only when a building actually receives resources. Cities contribute two but the hex appears once. A robber-blocked tile, desert, or empty matching tile is excluded.
4. Change World/Board pulse input to explicit hex IDs and duration. Remove dice-total scanning from the visual layer. Ignore IDs not present in the visual board.
5. Have Game and HUD remember `gameId:rollId`, treating rollId zero as no event. Keep productionLog as human-readable text, not an event identifier. UI rerenders from trade/selection must not replay dice or production.
6. Reset remembered IDs when returning to lobby. Keep separate state for each Game/Hud instance so the review route does not leak freshness into normal play.

## Acceptance

Force the same [3,3] pair on two successive turns: each roll animates exactly once; intervening UI rerenders do not. A matching blocked hex does not pulse. No-production and seven rolls animate dice but no production. Restart/reset does not replay the previous roll. Smoke/typecheck and browser action check pass.

## Boundaries

Do not infer gameplay from messages or add a general event-sourcing system. This minimal snapshot identity is sufficient for first-phase feedback.

**Copyable prompt:** Implement only P04 and its snapshot fields. Update all pulse consumers and repeated-roll tests. Preserve gameplay resource totals and the existing human-readable logs. Validate in the review scene and update STATUS.
