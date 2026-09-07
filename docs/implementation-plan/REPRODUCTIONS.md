# Copyable baseline defect probes

These are **documentation examples**, not newly installed tests or implementation files. They were run in memory against the audited source. Run from the repository root. They construct disposable engine objects and do not save game data, modify source, or access the user's browser storage.

Use the outputs as starting points for targeted regression tests. After the corresponding fix, update the expected result in the actual test; preserve this file as historical audit evidence. Do not rely on a failing probe remaining reproducible after its task is complete.

## P02 — Tied successors without an incumbent

```sh
node --import tsx --input-type=module <<'JS'
import { updateLongestRoad } from './src/engine/rules.ts';
const board = { roads: new Map(), edges: new Map(), buildings: new Map() };
for (let player = 0; player < 2; player++) {
  for (let edge = 0; edge < 5; edge++) {
    const id = `${player}e${edge}`;
    board.edges.set(id, {
      vertexIds: [`${player}v${edge}`, `${player}v${edge + 1}`],
    });
    board.roads.set(id, { edgeId: id, owner: player });
  }
}
console.log(updateLongestRoad(board, [{ id: 0 }, { id: 1 }], null));
JS
```

Audited result: `0`. Required result: `null`. This deliberately minimal graph exercises the pure award function; do not pass it to unrelated board rendering or trade functions requiring a complete BoardState.

## P03 — Fractional discard

```sh
node --import tsx --input-type=module <<'JS'
import { GameEngine } from './src/engine/engine.ts';
const engine = new GameEngine(1);
engine.startGame(2);
engine.phase = 'discard';
engine.players[0].resources.wood = 1;
engine.players[0].resources.sheep = 1;
engine.discardRemaining.set(0, 1);
console.log(engine.discard(0, { wood: 0.5, sheep: 0.5 }));
console.log(engine.players[0].resources);
JS
```

Audited acceptance result: `true`, leaving fractional holdings. Required: `false`, preserving all holdings and the pending discard. The manually supplied discard phase isolates integer validation; the full regression should also reach discard through a real seven roll.

## P03 — Victory text overwritten by build text

```sh
node --import tsx --input-type=module <<'JS'
import { GameEngine } from './src/engine/engine.ts';
const engine = new GameEngine(1);
engine.startGame(2);
engine.phase = 'main';
engine.buildMode = 'city';
const vertices = [...engine.board.vertices.keys()].slice(0, 9);
for (const id of vertices) {
  engine.board.buildings.set(id, { vertexId: id, owner: 0, kind: 'settlement' });
}
engine.players[0].settlements = 9;
engine.players[0].resources.ore = 3;
engine.players[0].resources.wheat = 2;
engine.placeCity(vertices[0]);
console.log(engine.phase, engine.message);
JS
```

Audited result: `gameOver Red upgraded to a city.` Required behavior: gameOver with winner text. **This is a scoring-isolation fixture with deliberately impossible standard-board settlement supply/spacing**, not proof that the setup is legal gameplay. Replace it in integration tests with a legal mix of cities, settlements, and/or Longest Road reaching the same threshold. The source ordering independently confirms the message overwrite.

## P05 — Nested tween consumes the parent frame

```sh
node --import tsx --input-type=module <<'JS'
import { TweenPlayer } from './src/core/tween.ts';
const tweens = new TweenPlayer();
let childDone = false;
tweens.play(0.5, () => {}, {
  onComplete: () => tweens.play(0.14, () => {}, {
    onComplete: () => { childDone = true; },
  }),
});
tweens.update(0.5);
console.log({ childDone, active: tweens.active });
JS
```

Audited result: `{ childDone: true, active: false }`. Required: childDone false and active true until subsequent time advances the child. Also add a realistic .016 s frame test: the child must not advance .016 s on its creation frame.

## P06 — Day depends on prior Night selection

```sh
node --import tsx --input-type=module <<'JS'
import { DEFAULT_STYLE_CONFIG, applyStylePreset } from './src/style/styleConfig.ts';
const night = applyStylePreset(DEFAULT_STYLE_CONFIG, 'night');
const dayAfterNight = applyStylePreset(night, 'day');
const dayFromDefaults = applyStylePreset(DEFAULT_STYLE_CONFIG, 'day');
console.log(Object.keys(dayAfterNight).filter(
  key => dayAfterNight[key] !== dayFromDefaults[key],
));
JS
```

Audited differing fields: `waterShoreGlow`, `waterFresnelStrength`, `waterReflectStrength`. Under the new deterministic-preset contract the array must be empty. The old behavior was intentional overlay semantics; the task changes that workflow explicitly.

## Browser-only issues

Color conversion, shadow softness, coastline artifacts, stale reflections, text readability, touch cancellation, focus restoration, and GPU disposal require the browser cases in [VALIDATION.md](VALIDATION.md). Headless object assertions cannot validate them. The audit's live scene had no console error, so “no errors” alone is not a sufficient acceptance criterion.
