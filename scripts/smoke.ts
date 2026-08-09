/**
 * Headless smoke test for game engine setup + a few turns.
 * Run: npx tsx scripts/smoke.ts
 */
import * as THREE from 'three';
import { hexCountForRings, MAP_SIZES, type MapSizeId } from '../src/game/board';
import { GameEngine } from '../src/game/engine';
import { legalSetupRoads, legalSetupSettlements } from '../src/game/rules';
import {
  ATMOSPHERE_PRESETS,
  TimeOfDayController,
  celestialDirection,
  lerpAtmosphere,
  sampleAtmosphereAtPhase,
} from '../src/render/atmosphere';
import {
  ASSET_CATALOG,
  getAssetById,
  makeSettlement,
  makeTree,
} from '../src/render/assets';
import { TweenPlayer, ease } from '../src/render/tween';
import {
  DEFAULT_STYLE_CONFIG,
  STYLE_PRESETS,
  applyStylePreset,
} from '../src/render/styleConfig';

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
  // Skip canvas-backed sprites/tokens in headless Node (no document).
  const headlessSkip = new Set(['number-token', 'harbor-label']);
  for (const def of ASSET_CATALOG) {
    if (headlessSkip.has(def.id)) continue;
    const obj = def.create({ playerIndex: 1, number: 6 });
    assert(obj instanceof THREE.Object3D, `${def.id} creates Object3D`);
  }
  console.log(`ok asset catalog (${ASSET_CATALOG.length} assets)`);
}

console.log('smoke ok');
