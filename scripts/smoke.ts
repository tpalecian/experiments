/**
 * Headless smoke test for game engine setup + a few turns.
 * Run: npx tsx scripts/smoke.ts
 */
import * as THREE from 'three';
import { hexCountForRings, MAP_SIZES, axialToWorld, HEX_SIZE, type MapSizeId } from '../src/engine/board';
import { GameEngine } from '../src/engine/engine';
import {
  computeVictoryPoints,
  legalCities,
  legalSetupRoads,
  legalSetupSettlements,
  updateLongestRoad,
} from '../src/engine/rules';
import { RESOURCES, emptyBank } from '../src/engine/types';
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
  sanitizeLibrary,
  stampLayout,
} from '../src/world/biomeLayouts';
import { TweenPlayer, ease } from '../src/core/tween';
import {
  DEFAULT_STYLE_CONFIG,
  STYLE_PRESETS,
  applyStylePreset,
} from '../src/style/styleConfig';
import { IslandField, sdHexagon, warpCoast } from '../src/world/islandField';
import { IslandMesh } from '../src/world/IslandMesh';
import { CameraRig } from '../src/view/CameraRig';

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
  const groveSpan = Math.max(...a.props.map((p) => Math.hypot(p.x, p.z)));
  assert(groveSpan > HEX_SIZE * 0.45, 'grove uses the larger hex floor');

  const migrated = sanitizeLibrary({
    version: 1,
    layouts: [
      {
        id: 'wood-legacy',
        name: 'Legacy grove',
        terrain: 'wood',
        props: [{ id: 't1', kind: 'tree', x: 0.4, z: 0.3, yaw: 0, scale: 1 }],
      },
    ],
  });
  const legacy = migrated.layouts.find((l) => l.id === 'wood-legacy')?.props[0];
  assert(legacy && Math.abs(legacy.x - 0.4 * HEX_SIZE) < 1e-6, 'legacy unit-hex layouts scale up');

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
  const engine = new GameEngine(13);
  engine.startGame(2, 'standard', 13);
  const field = IslandField.fromBoard(engine.board);
  assert(field.sample(0, 0).shoreDist < -0.2, 'center inland');
  assert(field.sample(20, 0).shoreDist > 1, 'open ocean');

  let oreH = 0;
  let wheatH = 0;
  for (const hex of engine.board.hexes.values()) {
    const { x, z } = axialToWorld(hex.q, hex.r);
    const h = field.heightAt(x, z);
    if (hex.terrain === 'ore') oreH = Math.max(oreH, h);
    if (hex.terrain === 'wheat') wheatH = Math.max(wheatH, h);
  }
  assert(oreH > 0 && wheatH > 0, 'ore and wheat tiles exist');

  const mountain = getAssetById('mountain')!.create({ scale: 1 });
  const mbox = new THREE.Box3().setFromObject(mountain);
  assert(mbox.getSize(new THREE.Vector3()).y > 0.35, 'mountain boulders have volume');
  assert(mbox.getSize(new THREE.Vector3()).x > 0.7, 'mountain is a wide pile not a spike');

  const inland = field.shoreDistance(0, 0);
  const warped = warpCoast(0, 0);
  assert(Math.hypot(warped.x, warped.z) < HEX_SIZE, 'warp stays local');
  assert(sdHexagon(0, 0, HEX_SIZE * Math.sqrt(3) * 0.5) < 0, 'hex center inside SDF');
  assert(inland < 0, 'shoreDistance negative inland');

  const mesh = new IslandMesh();
  mesh.build(field);
  const pos = mesh.mesh.geometry.getAttribute('position');
  const col = mesh.mesh.geometry.getAttribute('color');
  assert(pos && pos.count > 200, 'island mesh has vertices');
  assert(col && col.count === pos.count, 'island mesh has vertex colours');
  const vertCount = pos.count;

  let maxShore = -1e9;
  let coastH = 1e9;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const d = field.shoreDistance(x, z);
    if (d > maxShore) maxShore = d;
    if (Math.abs(d) < 0.12 * HEX_SIZE) coastH = Math.min(coastH, y);
  }
  assert(maxShore < 0.08 * HEX_SIZE, 'sand mesh stops at the waterline');
  assert(coastH < 0.06, 'waterline height is a beach slope, not a cliff');
  assert(DEFAULT_STYLE_CONFIG.waterFoamWidth >= 1.4, 'foam band is wide enough to read as surf');

  mesh.clear();
  console.log(`ok island field + mesh (${vertCount} verts)`);
}

{
  const canvas = {
    addEventListener() {},
    removeEventListener() {},
    style: {},
    getRootNode() {
      return { addEventListener() {}, removeEventListener() {} };
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    ownerDocument: { documentElement: {} },
  } as unknown as HTMLCanvasElement;
  const rig = new CameraRig(canvas, new TweenPlayer());
  assert(rig.camera.type === 'OrthographicCamera', 'diorama camera is orthographic');
  const framed = rig.frameBoard(2);
  assert(framed.radius > HEX_SIZE * 3, 'standard island radius grew with hex size');
  assert(rig.camera.top / framed.radius < 1.35, 'ortho frame is tight enough that hexes read large');
  console.log('ok orthographic camera rig');
}

console.log('smoke ok');
