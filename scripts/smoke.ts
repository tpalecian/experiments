/**
 * Headless smoke test for game engine + island pipeline.
 * Run: npx tsx scripts/smoke.ts
 */
import * as THREE from 'three';
import { environmentFromAtmosphere, createDefaultEnvironmentState } from '../src/atmosphere/environment';
import { hexCountForRings, MAP_SIZES, type MapSizeId } from '../src/game/board';
import { GameEngine } from '../src/game/engine';
import { legalSetupRoads, legalSetupSettlements } from '../src/game/rules';
import { boardToRegionGraph } from '../src/gameplay/regions';
import { findRoadPath } from '../src/gameplay/roads';
import { enumerateSettlementSites, snapSettlementToTerrain } from '../src/gameplay/settlements';
import {
  ATMOSPHERE_PRESETS,
  TimeOfDayController,
  celestialDirection,
  lerpAtmosphere,
  sampleAtmosphereAtPhase,
} from '../src/render/atmosphere';
import { generateIsland } from '../src/terrain/pipeline';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function playSetup(engine: GameEngine, players: number): void {
  const totalPlacements = players * 2;
  for (let i = 0; i < totalPlacements; i++) {
    assert(engine.phase === 'setupSettlement', `placement ${i} settlement phase`);
    const verts = legalSetupSettlements(engine.board);
    assert(verts.length > 0, `legal settlements at ${i}`);
    assert(engine.placeSettlement(verts[0]!), `place settlement ${i}`);
    assert(engine.phase === 'setupRoad', 'road phase');
    const edges = legalSetupRoads(engine.board, engine.currentPlayer, engine.lastSetupSettlement!);
    assert(edges.length > 0, `legal roads at ${i}`);
    assert(engine.placeRoad(edges[0]!), `place road ${i}`);
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

  tod.setMode('cycle');
  tod.setDayLength(60);
  const before = tod.phase;
  tod.update(15);
  assert(Math.abs(tod.phase - ((before + 0.25) % 1)) < 0.001, 'cycle advances 1/4 day');
  assert(tod.getCelestialDirection() instanceof THREE.Vector3, 'celestial vector');

  const env = createDefaultEnvironmentState('day');
  environmentFromAtmosphere(tod.getSnapshot(), tod.getCelestialDirection(), env);
  assert(env.sunDirection.length() > 0.9, 'env sun from atmosphere');

  console.log('ok atmosphere day-cycle');
}

{
  const engine = new GameEngine(7);
  engine.startGame(2, 'standard', 7);
  const graph = boardToRegionGraph(engine.board, 7);
  assert(graph.regions.size === engine.board.hexes.size, 'region count = land hexes');

  const world = generateIsland(
    {
      island: { seed: 7, radius: 8, falloff: 1.12, warp: 0.4 },
      resolution: 64,
      smoothPasses: 2,
    },
    engine.board,
    graph,
  );

  assert(world.sdfField.length === 64 * 64, 'sdf field size');
  assert(world.heightField.length === 64 * 64, 'height field size');
  const center = world.sdf.sample(0, 0);
  assert(center > 0, `island center should be land (d=${center})`);
  const ocean = world.sdf.sample(world.grid.bounds.maxX * 0.95, world.grid.bounds.maxZ * 0.95);
  assert(ocean < 0, `far corner should be ocean (d=${ocean})`);

  // All region centers on land
  for (const site of world.sites) {
    const d = world.sdf.sample(site.x, site.z);
    assert(d > 0, `site ${site.id} should be inland (d=${d})`);
  }

  const ids = [...graph.regions.keys()];
  if (ids.length >= 2) {
    const path = findRoadPath(graph, ids[0]!, ids[1]!);
    assert(path.nodes.length >= 1, 'road path has nodes');
  }

  const sites = enumerateSettlementSites(graph, engine.board);
  assert(sites.length > 0, 'settlement sites from board vertices');
  const snapped = snapSettlementToTerrain(sites[0]!, world);
  assert(Number.isFinite(snapped.y), 'settlement snaps to height');

  console.log(
    `ok island pipeline (regions=${graph.regions.size}, trees=${world.trees.length}, rocks=${world.rocks.length}, coastLoops=${world.coastline.length})`,
  );
}

console.log('smoke ok');
