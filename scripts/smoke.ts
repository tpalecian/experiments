/**
 * Headless smoke test for game engine setup + a few turns.
 * Run: npx tsx scripts/smoke.ts
 */
import { GameEngine } from '../src/game/engine';
import { legalSetupRoads, legalSetupSettlements } from '../src/game/rules';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const engine = new GameEngine(42);
engine.startGame(2, 42);

assert(engine.phase === 'setupSettlement', 'should start in setupSettlement');
assert(engine.board.hexes.size === 19, '19 hexes');
assert(engine.board.robberHexId, 'robber on desert');

const totalPlacements = 4;
for (let i = 0; i < totalPlacements; i++) {
  assert(engine.phase === 'setupSettlement', `placement ${i} settlement phase`);
  const verts = legalSetupSettlements(engine.board);
  assert(verts.length > 0, `legal settlements at ${i}`);
  assert(engine.placeSettlement(verts[0]), `place settlement ${i}`);
  assert(engine.phase === 'setupRoad', 'road phase');
  const edges = legalSetupRoads(engine.board, engine.currentPlayer, engine.lastSetupSettlement!);
  assert(edges.length > 0, `legal roads at ${i}`);
  assert(engine.placeRoad(edges[0]), `place road ${i}`);
}

assert(engine.phase === 'roll', 'should enter roll phase');
assert(engine.currentPlayer === 0, 'player 0 starts');

assert(engine.rollDice(), 'roll');
assert(engine.phase === 'main' || engine.phase === 'discard' || engine.phase === 'robber', 'after roll');

if (engine.phase === 'main') {
  assert(engine.endTurn(), 'end turn');
  assert(engine.phase === 'roll', 'next player rolls');
  assert(engine.currentPlayer === 1, 'player 1');
}

console.log('smoke ok');
