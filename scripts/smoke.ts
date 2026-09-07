/**
 * Headless smoke test for game engine setup + a few turns.
 * Run: npx tsx scripts/smoke.ts
 */
import * as THREE from 'three';
import { hexCountForRings, MAP_SIZES, type MapSizeId } from '../src/engine/board';
import { GameEngine } from '../src/engine/engine';
import {
  canAfford,
  computeVictoryPoints,
  legalCities,
  legalSettlements,
  legalSetupRoads,
  legalSetupSettlements,
  longestRoadLength,
  updateLongestRoad,
} from '../src/engine/rules';
import { BUILD_COSTS, RESOURCES, emptyBank } from '../src/engine/types';
import type { PlayerId } from '../src/engine/types';
import { parseReviewQuery, REVIEW_DEFAULTS } from '../src/ui/reviewRoute';
import {
  addBlockingSettlement,
  addRoad,
  addRoadChain,
  arrangeLegalRouteInterruption,
  awardPlayers,
  boardLayoutFingerprint,
  diceSequence,
  emptyRoadGraph,
  fixtureStateFingerprint,
  growOpenLongestRoad,
  permute,
  prepareAffordableMain,
  sequenceRandom,
  startSeededGame,
} from './fixtures';
import { CRAFT_CATEGORIES, CRAFT_FIELDS } from '../src/ui/style/craftSchema';
import { applyWeather } from '../src/world/Weather';
import { Highlights } from '../src/world/Highlights';
import { isTap, TAP_SLOP_PX } from '../src/input/tap';
import { Pieces } from '../src/world/Pieces';
import { Props } from '../src/world/Props';
import { motionFromStyle } from '../src/world/motion';
import { getQualityCaps, getQualityLevel } from '../src/core/Quality';
import {
  ATMOSPHERE_PRESETS,
  TimeOfDayController,
  celestialDirection,
  lerpAtmosphere,
  sampleAtmosphereAtPhase,
} from '../src/world/Atmosphere';
import {
  ASSET_CATALOG,
  getAssetById,
  makeSettlement,
  makeTree,
} from '../src/world/assets';
import {
  BIOME_PROP_KINDS,
  TERRAIN_ORDER,
  createPropObject,
  defaultBiomeLibrary,
  exportBiomeLayoutsJson,
  importBiomeLayoutsJson,
  layoutsForTerrain,
  pickLayout,
  stampLayout,
} from '../src/world/biomeLayouts';
import { TweenPlayer, ease } from '../src/core/tween';
import {
  DEFAULT_STYLE_CONFIG,
  STYLE_PRESETS,
  applyStylePreset,
} from '../src/style/styleConfig';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function playSetup(engine: GameEngine, players: number): void {
  const totalPlacements = players * 2;
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
}

for (const size of Object.keys(MAP_SIZES) as MapSizeId[]) {
  const expected = hexCountForRings(MAP_SIZES[size].rings);
  const engine = new GameEngine(42);
  engine.startGame(2, size, 42);
  assert(engine.board.hexes.size === expected, `${size} should have ${expected} hexes`);
  assert(engine.board.harbors.length >= 5, `${size} should have harbors`);
  assert(engine.board.robberHexId, `${size} robber placed`);
  playSetup(engine, 2);
  assert(engine.phase === 'roll', `${size} should enter roll`);
  assert(engine.rollDice(), `${size} roll`);
  assert(
    engine.phase === 'main' || engine.phase === 'discard' || engine.phase === 'robber',
    `${size} after roll`,
  );
  console.log(`ok ${size} (${expected} hexes, ${engine.board.harbors.length} harbors)`);
}

{
  const mid = sampleAtmosphereAtPhase(0.125);
  assert(mid.sunIntensity > ATMOSPHERE_PRESETS.morning.sunIntensity, 'morning→afternoon brightens');
  assert(mid.sunIntensity < ATMOSPHERE_PRESETS.afternoon.sunIntensity, 'not fully afternoon yet');

  const out = sampleAtmosphereAtPhase(0);
  lerpAtmosphere(ATMOSPHERE_PRESETS.evening, ATMOSPHERE_PRESETS.night, 0.5, out);
  assert(out.starsIntensity > 0.4, 'evening→night raises stars');

  const dir = celestialDirection(0.82, 0.55);
  assert(dir.length() > 0.99 && dir.length() < 1.01, 'celestial dir normalized');
  assert(dir.y > 0.7, 'afternoon sun high');

  const tod = new TimeOfDayController('afternoon');
  tod.setMode('night', 4);
  tod.update(2);
  const half = tod.getSnapshot();
  assert(half.starsIntensity > 0.3 && half.starsIntensity < 0.9, 'night transition mid-blend');
  tod.update(3);
  assert(tod.getSnapshot().starsIntensity > 0.95, 'night transition completes');
  assert(tod.getSnapshot().waterDeep !== undefined, 'scheme water palette on snapshot');
  assert(tod.getSnapshot().waveBandIntensity < 0.5, 'night softens wave bands');
  assert(tod.getSnapshot().shadowStrength < 0.55, 'night softens shadows');
  assert(tod.getSnapshot().foamBrightness < 0.95, 'night foam slightly softer than day');

  tod.setMode('cycle');
  tod.setDayLength(60);
  const before = tod.phase;
  tod.update(15);
  assert(Math.abs(tod.phase - ((before + 0.25) % 1)) < 0.001, 'cycle advances 1/4 day');
  assert(tod.getCelestialDirection() instanceof THREE.Vector3, 'celestial vector');

  const aft = ATMOSPHERE_PRESETS.afternoon;
  const nite = ATMOSPHERE_PRESETS.night;
  assert(aft.waterDeep.getHexString() !== nite.waterDeep.getHexString(), 'day/night water palettes differ');
  assert(aft.waveBandIntensity > nite.waveBandIntensity, 'bands stronger by day');
  assert(aft.rimIntensity >= 0 && nite.rimIntensity > 0, 'rim light present');

  console.log('ok atmosphere day-cycle');
}

{
  const player = new TweenPlayer();
  let value = 0;
  let done = false;
  player.to(0, 10, 0.5, (v) => {
    value = v;
  }, {
    ease: ease.linear,
    onComplete: () => {
      done = true;
    },
  });
  player.update(0.25);
  assert(Math.abs(value - 5) < 0.001, 'tween mid value');
  player.update(0.3);
  assert(done && Math.abs(value - 10) < 0.001, 'tween completes');
  assert(ease.easeOutBack(1) === 1, 'easeOutBack ends at 1');
  assert(ease.smoothstep(0.5) === 0.5, 'smoothstep mid');
  console.log('ok tween player');
}

{
  assert(STYLE_PRESETS.length >= 4, 'style presets present');
  const night = applyStylePreset(DEFAULT_STYLE_CONFIG, 'night');
  assert(night.timeOfDay === 'night', 'night preset sets scheme');
  assert(night.waterDeepOcean !== DEFAULT_STYLE_CONFIG.waterDeepOcean, 'night palette changes');
  assert(typeof DEFAULT_STYLE_CONFIG.waterShoreGlow === 'number', 'shore glow craft knob');
  assert(typeof DEFAULT_STYLE_CONFIG.waterReflectStrength === 'number', 'bruno reflection knob');
  assert(typeof DEFAULT_STYLE_CONFIG.waterRippleIntensity === 'number', 'bruno ripple knob');
  assert(typeof DEFAULT_STYLE_CONFIG.motionRobberHopSec === 'number', 'motion craft knob');
  assert(typeof DEFAULT_STYLE_CONFIG.hexHoverLift === 'number', 'hex board craft knob');
  const cine = applyStylePreset(DEFAULT_STYLE_CONFIG, 'cinematic');
  assert(cine.timeOfDay === 'cycle', 'cinematic uses cycle');
  console.log('ok style craft presets');
}

{
  assert(ASSET_CATALOG.length >= 10, 'asset catalog populated');
  assert(getAssetById('settlement'), 'settlement asset registered');
  assert(getAssetById('hex-wood'), 'hex tile asset registered');
  const house = makeSettlement({ playerIndex: 0 });
  assert(house.children.length >= 2, 'settlement has meshes');
  const tree = makeTree({ scale: 0.8 });
  assert(Math.abs(tree.scale.x - 0.8) < 0.001, 'tree scale applied');
  // Skip canvas-backed sprites/tokens/meadow maps in headless Node (no document).
  const headlessSkip = new Set(['number-token', 'harbor-label', 'hex-sheep']);
  for (const def of ASSET_CATALOG) {
    if (headlessSkip.has(def.id)) continue;
    const obj = def.create({ playerIndex: 1, number: 6, variant: 1 });
    assert(obj instanceof THREE.Object3D, `${def.id} creates Object3D`);
  }
  assert(getAssetById('stone-wall'), 'stone wall asset registered');
  assert(getAssetById('pine'), 'pine asset registered');
  assert(getAssetById('bush'), 'bush asset registered');
  assert(getAssetById('pasture-rock'), 'pasture rock asset registered');
  console.log(`ok asset catalog (${ASSET_CATALOG.length} assets)`);
}

{
  const lib = defaultBiomeLibrary();
  assert(lib.version === 1, 'biome library version');
  assert(lib.layouts.length >= 6, 'default layouts present');
  for (const t of TERRAIN_ORDER) {
    const list = layoutsForTerrain(lib, t);
    assert(list.length >= 1, `layout for ${t}`);
  }
  const a = pickLayout(lib, 'wood', 'hex-0-0');
  const b = pickLayout(lib, 'wood', 'hex-0-0');
  const c = pickLayout(lib, 'wood', 'hex-1-0');
  assert(a.id === b.id, 'pickLayout deterministic');
  assert(a.terrain === 'wood', 'picked wood layout');
  // Different hex ids may still collide on small pools — just ensure pick returns a layout.
  assert(c.terrain === 'wood', 'other seed still wood');

  const group = new THREE.Group();
  stampLayout(a, group, 1, 0.28, 2);
  assert(group.children.length === a.props.length, 'stamp creates prop meshes');

  for (const kind of BIOME_PROP_KINDS) {
    if (kind === 'flower-tuft') {
      // flower-tuft is fine without canvas
    }
    const obj = createPropObject({
      id: `t-${kind}`,
      kind,
      x: 0,
      z: 0,
      yaw: 0,
      scale: 1,
      variant: 1,
    });
    assert(obj instanceof THREE.Object3D, `biome prop ${kind} instantiates`);
  }

  const json = exportBiomeLayoutsJson(lib);
  const roundTrip = importBiomeLayoutsJson(json);
  assert(roundTrip.layouts.length === lib.layouts.length, 'import/export round-trip');
  console.log(`ok biome layouts (${lib.layouts.length} defaults)`);
}

{
  const engine = new GameEngine(7);
  engine.startGame(2, 'standard', 7);
  assert(!engine.placeSettlement('nope'), 'illegal settlement rejected');
  assert(!engine.rollDice(), 'roll rejected in lobby/setup');
  playSetup(engine, 2);
  assert(engine.phase === 'roll', 'enter roll');

  const origRandom = Math.random;
  Math.random = () => 0.5; // 1+floor(3)=4 per die → 8
  assert(engine.rollDice(), 'roll 8');
  Math.random = origRandom;
  assert(engine.phase === 'main', 'non-7 enters main');
  assert(!engine.placeCity('x'), 'city rejected without build mode');

  const p0 = engine.players[0];
  for (const r of RESOURCES) p0.resources[r] = 20;

  const ownSettlement = [...engine.board.buildings.values()].find((b) => b.owner === 0 && b.kind === 'settlement');
  assert(ownSettlement, 'player 0 has a settlement');
  engine.setBuildMode('city');
  const cities = legalCities(engine.board, 0);
  assert(cities.includes(ownSettlement.vertexId), 'owned settlement is a legal city site');
  assert(engine.placeCity(ownSettlement.vertexId), 'city upgrade');
  assert(p0.cities === 1 && p0.settlements === 1, 'city counts');

  const woodBefore = p0.resources.wood;
  const wheatBefore = p0.resources.wheat;
  assert(engine.bankTrade('wood', 'wheat'), 'bank trade');
  assert(p0.resources.wood < woodBefore && p0.resources.wheat === wheatBefore + 1, 'trade swapped');
  assert(!engine.bankTrade('wood', 'wood'), 'same-resource trade rejected');

  engine.longestRoadOwner = updateLongestRoad(engine.board, engine.players, engine.longestRoadOwner);
  const vp = computeVictoryPoints(engine.board, p0, engine.longestRoadOwner);
  assert(vp >= 3, 'city + settlement is at least 3 VP');
  console.log('ok rules city/trade/illegal');
}

{
  const engine = new GameEngine(3);
  engine.startGame(2, 'standard', 3);
  playSetup(engine, 2);
  const victim = engine.players[1];
  for (const r of RESOURCES) victim.resources[r] = 4; // 20 cards
  engine.players[0].resources = emptyBank();
  engine.currentPlayer = 0;
  engine.phase = 'roll';

  const origRandom = Math.random;
  Math.random = () => 0; // die = 1+0 → 1+1 = 2, not 7. Need 7: one 0 and one ~0.99
  let calls = 0;
  Math.random = () => {
    calls += 1;
    return calls === 1 ? 0 : 0.99; // 1 + 6 = 7
  };
  assert(engine.rollDice(), 'roll 7');
  Math.random = origRandom;
  assert(engine.phase === 'discard', '7 with >7 cards enters discard');
  assert(engine.discard(1, { wood: 2, brick: 2, sheep: 2, wheat: 2, ore: 2 }), 'discard 10 of 20');
  assert(engine.phase === 'robber', 'discard done → robber');

  const otherHex = [...engine.board.hexes.keys()].find((id) => id !== engine.board.robberHexId)!;
  engine.moveRobber(otherHex);
  assert(engine.phase === 'main' || engine.phase === 'steal', 'robber resolved');
  if (engine.phase === 'steal') {
    const target = engine.stealTargets[0];
    assert(engine.stealFrom(target), 'steal');
    assert(engine.phase === 'main', 'steal returns to main');
  }
  console.log('ok rules discard/robber');
}

{
  const engine = new GameEngine(9);
  engine.startGame(2, 'standard', 9);
  playSetup(engine, 2);
  for (const b of engine.board.buildings.values()) {
    if (b.owner === 0) b.kind = 'city';
  }
  const vp = computeVictoryPoints(engine.board, engine.players[0], null);
  assert(vp === 4, 'two cities = 4 VP');
  console.log('ok rules victory points');
}

{
  const aft = ATMOSPHERE_PRESETS.afternoon;
  const overcast = applyWeather(aft, 'overcast');
  const rain = applyWeather(aft, 'rain');
  assert(overcast.sunIntensity < aft.sunIntensity, 'overcast dims sun');
  assert(rain.fogFarMul < aft.fogFarMul, 'rain pulls fog in');
  assert(aft.sunIntensity === ATMOSPHERE_PRESETS.afternoon.sunIntensity, 'weather does not mutate preset');
  assert(CRAFT_FIELDS.some((f) => f.key === 'weather'), 'craft schema includes weather');
  const craftKeys = CRAFT_FIELDS.map((f) => f.key);
  assert(new Set(craftKeys).size === craftKeys.length, 'CRAFT_FIELDS keys are unique (no duplicate exposure)');
  const categoryIds = new Set<string>(CRAFT_CATEGORIES.map((c) => c.id));
  assert(
    CRAFT_FIELDS.every((f) => categoryIds.has(f.category)),
    'every CRAFT_FIELDS.category is in CRAFT_CATEGORIES',
  );
  assert(!categoryIds.has('camera') && !categoryIds.has('debug'), 'CRAFT_CATEGORIES has no camera/debug');
  assert(getQualityLevel() === 'high', 'node quality defaults high');
  assert(getQualityCaps().shadowMap >= 1024, 'quality caps present');
  console.log('ok weather + craft schema + quality');
}

{
  const engine = new GameEngine(11);
  engine.startGame(2, 'standard', 11);

  const highlights = new Highlights();
  highlights.build(engine.board);
  assert(highlights.group.children.length > 0, 'highlights populated');
  assert(highlights.getPickables().length === 0, 'illegal sites are not pickable');
  const verts = legalSetupSettlements(engine.board);
  assert(verts.length > 0, 'setup has legal vertices');
  highlights.sync(verts, []);
  assert(highlights.getPickables().length === verts.length, 'only legal vertices are pickable');
  const legalId = verts[0];
  assert(
    highlights.getPickables().every((m) => m.userData.kind === 'vertex' && verts.includes(m.userData.id)),
    'pickables are the synced legal vertices',
  );
  assert(
    highlights.getPickables().some((m) => m.userData.id === legalId && m.children.length === 1),
    'legal vertex has a fat-finger hit child',
  );
  highlights.sync([], []);
  assert(highlights.getPickables().length === 0, 'clearing legal set empties pickables');
  highlights.clear();
  assert(highlights.group.children.length === 0, 'highlights.clear removes meshes');

  const props = new Props();
  const propsGroup = props.group;
  props.reset();
  assert(props.group === propsGroup, 'props.reset keeps the same group');

  const pieces = new Pieces();
  const robber = pieces.robber;
  pieces.sync(engine.board, motionFromStyle(), false);
  assert(pieces.group.children.includes(robber), 'robber stays in group after sync');
  const rest = pieces.getRobberPosition();
  assert(Number.isFinite(rest.x) && Number.isFinite(rest.z), 'robber rest position is finite');
  pieces.reset();
  assert(pieces.robber === robber && pieces.group.children.includes(robber), 'reset keeps robber');
  console.log('ok world scene-graph ownership');
}

{
  assert(isTap(0, 0), 'zero movement is a tap');
  assert(isTap(TAP_SLOP_PX, 0), 'movement on slop boundary is a tap');
  assert(!isTap(TAP_SLOP_PX + 1, 0), 'movement past slop is a drag');
  assert(!isTap(8, 8), 'diagonal past slop is a drag');
  assert(isTap(6, 6), 'short diagonal is a tap');
  console.log('ok tap vs drag');
}

{
  const fallback = parseReviewQuery('?view=review&seed=nope&map=planet&look=noon');
  assert(fallback.seed === REVIEW_DEFAULTS.seed, 'invalid seed falls back to 11');
  assert(fallback.map === 'standard', 'invalid map falls back to standard');
  assert(fallback.look === 'day', 'invalid look falls back to day');
  const explicit = parseReviewQuery('view=review&seed=29&map=huge&look=night');
  assert(explicit.seed === 29 && explicit.map === 'huge' && explicit.look === 'night', 'valid review query parsed');

  const layoutA = startSeededGame(11, { mapSize: 'standard' });
  const layoutB = startSeededGame(11, { mapSize: 'standard', random: sequenceRandom([0.99, 0.99]) });
  assert(
    boardLayoutFingerprint(layoutA.board) === boardLayoutFingerprint(layoutB.board),
    'same seed keeps hex resources, numbers, and harbors',
  );

  const low = startSeededGame(11, { random: diceSequence([1, 1]), completeSetup: true });
  const high = startSeededGame(11, { random: diceSequence([6, 6]), completeSetup: true });
  assert(boardLayoutFingerprint(low.board) === boardLayoutFingerprint(high.board), 'injected dice do not change the board');
  assert(low.rollDice() && high.rollDice(), 'injected rolls accepted');
  assert(low.lastRoll?.[0] === 1 && low.lastRoll[1] === 1, 'sequence 1+1');
  assert(high.lastRoll?.[0] === 6 && high.lastRoll[1] === 6, 'sequence 6+6');
  assert(
    fixtureStateFingerprint(low) !== fixtureStateFingerprint(high),
    'different injected sequences change fixture dice state',
  );

  const stealLow = startSeededGame(11, { random: sequenceRandom([0]), completeSetup: true });
  const stealHigh = startSeededGame(11, { random: sequenceRandom([0.99]), completeSetup: true });
  stealLow.phase = 'steal';
  stealHigh.phase = 'steal';
  stealLow.stealTargets = [1];
  stealHigh.stealTargets = [1];
  stealLow.players[0].resources = emptyBank();
  stealHigh.players[0].resources = emptyBank();
  stealLow.players[1].resources = { ...emptyBank(), wood: 1, ore: 1 };
  stealHigh.players[1].resources = { ...emptyBank(), wood: 1, ore: 1 };
  assert(stealLow.stealFrom(1) && stealHigh.stealFrom(1), 'injected theft');
  assert(stealLow.players[0].resources.wood === 1, 'random 0 steals first pooled resource');
  assert(stealHigh.players[0].resources.ore === 1, 'random 0.99 steals later pooled resource');

  const playable = startSeededGame(11);
  prepareAffordableMain(playable, ['road', 'settlement', 'city']);
  assert(playable.phase === 'main', 'affordable helper enters main');
  assert(canAfford(playable.player(), BUILD_COSTS.city), 'city is affordable');
  assert(canAfford(playable.player(), BUILD_COSTS.road), 'road is affordable');

  const graph = emptyRoadGraph();
  addRoadChain(graph, 0, 5, 'p0');
  addRoadChain(graph, 1, 5, 'p1');
  addBlockingSettlement(graph, 'p0v2', 1);
  assert(graph.roads.size === 10, 'synthetic chains added');
  assert(graph.buildings.get('p0v2')?.owner === 1, 'blocking settlement recorded');
  assert(longestRoadLength(graph, 1) === 5, 'unblocked synthetic chain is length 5');
  console.log('ok P01 fixtures and rng injection');
}

{
  function graphWithLengths(entries: Array<{ player: PlayerId; edges: number }>) {
    const graph = emptyRoadGraph();
    for (const entry of entries) {
      addRoadChain(graph, entry.player, entry.edges, `p${entry.player}`);
    }
    return graph;
  }

  function assertAward(
    entries: Array<{ player: PlayerId; edges: number }>,
    order: PlayerId[],
    current: PlayerId | null,
    expected: PlayerId | null,
    msg: string,
  ): void {
    const graph = graphWithLengths(entries);
    const got = updateLongestRoad(graph, awardPlayers(order), current);
    assert(got === expected, `${msg} (order ${order.join(',')}: got ${got}, expected ${expected})`);
  }

  const two = permute<PlayerId>([0, 1]);
  for (const order of two) {
    assertAward([{ player: 0, edges: 6 }, { player: 1, edges: 4 }], order, null, 0, 'unique leader ≥5');
    assertAward([{ player: 0, edges: 4 }, { player: 1, edges: 6 }], order, null, 1, 'unique leader is player 1');
    assertAward([{ player: 0, edges: 4 }, { player: 1, edges: 3 }], order, null, null, 'all below five');
    assertAward([{ player: 0, edges: 5 }, { player: 1, edges: 5 }], order, null, null, 'two leaders with no incumbent');
    assertAward([{ player: 0, edges: 5 }, { player: 1, edges: 5 }], order, 0, 0, 'tied eligible incumbent 0');
    assertAward([{ player: 0, edges: 5 }, { player: 1, edges: 5 }], order, 1, 1, 'tied eligible incumbent 1');
  }

  const three = permute<PlayerId>([0, 1, 2]);
  for (const order of three) {
    assertAward(
      [{ player: 0, edges: 5 }, { player: 1, edges: 6 }, { player: 2, edges: 6 }],
      order,
      0,
      null,
      'incumbent overtaken by tied successors',
    );
    assertAward(
      [{ player: 0, edges: 6 }, { player: 1, edges: 6 }, { player: 2, edges: 4 }],
      order,
      1,
      1,
      'tied eligible incumbent among three',
    );
    assertAward(
      [{ player: 0, edges: 5 }, { player: 1, edges: 6 }, { player: 2, edges: 4 }],
      order,
      0,
      1,
      'unique successor overtakes incumbent',
    );
  }

  const split = emptyRoadGraph();
  addRoadChain(split, 0, 5, 'p0');
  addRoadChain(split, 1, 3, 'p1');
  addBlockingSettlement(split, 'p0v2', 1);
  assert(longestRoadLength(split, 0) === 3, 'split-to-below-five leaves a 3-edge fragment');
  assert(updateLongestRoad(split, awardPlayers([0, 1]), 0) === null, 'split-to-below-five drops the award');

  const ends = emptyRoadGraph();
  addRoadChain(ends, 0, 5, 'p');
  addBlockingSettlement(ends, 'pv0', 1);
  assert(longestRoadLength(ends, 0) === 5, 'edge leading to opponent at start still counts');
  addBlockingSettlement(ends, 'pv5', 1);
  assert(longestRoadLength(ends, 0) === 5, 'edge leading to opponent at both endpoints still counts');

  const mid = emptyRoadGraph();
  addRoadChain(mid, 0, 5, 'p');
  addBlockingSettlement(mid, 'pv2', 1);
  assert(longestRoadLength(mid, 0) === 3, 'continuation through a blocking vertex does not count');
  assert(longestRoadLength(mid, 0) !== 5, 'blocked chain is not the unsplit length');

  const loop = emptyRoadGraph();
  addRoad(loop, 0, 'ab', 'a', 'b');
  addRoad(loop, 0, 'bc', 'b', 'c');
  addRoad(loop, 0, 'cd', 'c', 'd');
  addRoad(loop, 0, 'da', 'd', 'a');
  addRoad(loop, 0, 'ae', 'a', 'e');
  addRoad(loop, 0, 'ef', 'e', 'f');
  const loopLen = longestRoadLength(loop, 0);
  assert(loopLen === 6, `cycle with branch counts every edge once, got ${loopLen}`);
  assert(loopLen <= loop.roads.size, 'route length never reuses an edge');

  const playable = startSeededGame(11, { completeSetup: true });
  playable.phase = 'main';
  assert(growOpenLongestRoad(playable, 0, 5), 'player 0 can legally grow a five-edge route');
  assert(playable.longestRoadOwner === 0, 'fifth legal road awards Longest Road');
  assert(playable.players[0].victoryPoints === 4, 'award is worth 2 VP on top of two settlements');
  assert(playable.snapshot().winVp === 10, 'standard map still wins at 10 VP');
  assert(startSeededGame(11, { mapSize: 'large' }).snapshot().winVp === 12, 'large map still wins at 12 VP');
  assert(startSeededGame(11, { mapSize: 'huge' }).snapshot().winVp === 15, 'huge map still wins at 15 VP');

  const arranged = arrangeLegalRouteInterruption(11);
  assert(arranged, 'legal interruption fixture exists on the real seed-11 board');
  const { engine, blockVertex } = arranged;
  assert(engine.longestRoadOwner === 0, 'incumbent holds Longest Road before the interrupt');
  assert(arranged.p0LengthBefore >= 5, 'current owner route is eligible');
  assert(legalSettlements(engine.board, 1).includes(blockVertex), 'block vertex is a legal connected settlement site');
  const beforeOwner = engine.longestRoadOwner;
  const beforeP0 = engine.players[0].victoryPoints;
  const beforeP1 = engine.players[1].victoryPoints;
  const notifies: Array<{ owner: PlayerId | null; p0: number; p1: number }> = [];
  const stop = engine.subscribe(() => {
    notifies.push({
      owner: engine.longestRoadOwner,
      p0: engine.players[0].victoryPoints,
      p1: engine.players[1].victoryPoints,
    });
  });
  assert(engine.placeSettlement(blockVertex), 'opposing settlement is a legal main-phase placement');
  stop();
  assert(notifies.length === 1, 'award and VP update in the same emitted snapshot');
  const afterLen = longestRoadLength(engine.board, 0);
  assert(afterLen < 5, `interrupted owner length drops below five, got ${afterLen}`);
  assert(engine.longestRoadOwner !== beforeOwner || engine.longestRoadOwner === null, 'interrupted chain loses or transfers the award');
  assert(engine.players[0].victoryPoints === notifies[0].p0, 'snapshot VP matches owner 0 after emit');
  assert(engine.players[1].victoryPoints === notifies[0].p1, 'snapshot VP matches owner 1 after emit');
  assert(engine.players[0].victoryPoints === beforeP0 - 2, 'old owner loses the 2 VP award');
  if (engine.longestRoadOwner === 1) {
    assert(engine.players[1].victoryPoints === beforeP1 + 1 + 2, 'new owner gains settlement VP plus the award');
  } else {
    assert(engine.longestRoadOwner === null, 'award is vacant when no unique successor remains');
    assert(engine.players[1].victoryPoints === beforeP1 + 1, 'interrupter gains only the settlement');
  }

  const reject = startSeededGame(11, { completeSetup: true });
  prepareAffordableMain(reject, ['road']);
  reject.setBuildMode('road');
  const occupied = [...reject.board.roads.keys()][0];
  const roadsBefore = reject.players[0].roads;
  assert(!reject.placeRoad(occupied), 'occupied edge is still an illegal road');
  assert(reject.players[0].roads === roadsBefore, 'rejected road is a no-op');
  assert(!reject.placeRoad('nope'), 'missing edge id is still rejected');

  console.log('ok P02 longest road award and interruption');
}

console.log('smoke ok');
