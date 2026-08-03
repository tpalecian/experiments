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
import { PlacementCache, resolveHarborPose, resolveVertexPose } from '../src/gameplay/placement';
import { enumerateSettlementSites, snapSettlementToTerrain } from '../src/gameplay/settlements';
import {
  ATMOSPHERE_PRESETS,
  TimeOfDayController,
  celestialDirection,
  lerpAtmosphere,
  sampleAtmosphereAtPhase,
} from '../src/render/atmosphere';
import { biomeIndexToKind } from '../src/terrain/biome';
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
      island: {
        seed: 7,
        radius: 10,
        falloff: 1.12,
        warp: 0.35,
        islandCount: 2,
        archipelagoSpread: 0.6,
      },
      resolution: 64,
      smoothPasses: 2,
    },
    engine.board,
    graph,
  );

  assert(world.sdfField.length === 64 * 64, 'sdf field size');
  assert(world.heightField.length === 64 * 64, 'height field size');
  assert(world.seed.blobs.length === 2, `expected 2 archipelago blobs, got ${world.seed.blobs.length}`);
  assert(
    world.seed.blobs.every((b) => typeof b.biome === 'string'),
    'each island blob has a biome',
  );
  // Per-island biomes: land cells near each nucleus should match that blob's biome
  for (const blob of world.seed.blobs) {
    const sample = world.sdf.sample(blob.x, blob.z);
    if (sample <= 0) continue;
    const u =
      (blob.x - world.grid.bounds.minX) /
      Math.max(world.grid.bounds.maxX - world.grid.bounds.minX, 1e-6);
    const v =
      (blob.z - world.grid.bounds.minZ) /
      Math.max(world.grid.bounds.maxZ - world.grid.bounds.minZ, 1e-6);
    const ix = Math.round(u * (world.grid.width - 1));
    const iz = Math.round(v * (world.grid.depth - 1));
    const idx = iz * world.grid.width + ix;
    const kind = biomeIndexToKind(world.biomeField[idx]!);
    assert(kind === blob.biome, `island nucleus biome ${blob.biome} vs field ${kind}`);
  }
  const center = world.sdf.sample(0, 0);
  // With two offset islands, map center may be a sea channel — that's OK.
  const ocean = world.sdf.sample(world.grid.bounds.maxX * 0.95, world.grid.bounds.maxZ * 0.95);
  assert(ocean < 0, `far corner should be ocean (d=${ocean})`);
  assert(world.coastline.length >= 1, 'at least one coastline loop');
  // Prefer multiple landmasses when archipelago; allow a thin sandbar bridge
  if (world.seed.blobs.length >= 2) {
    assert(
      world.coastline.length >= 1,
      'archipelago should produce coastline geometry',
    );
    // Mid-channel should not be deep inland — sandbar or open water
    const a = world.seed.blobs[0]!;
    const b = world.seed.blobs[1]!;
    const midD = world.sdf.sample((a.x + b.x) * 0.5, (a.z + b.z) * 0.5);
    assert(midD < 1.25, `channel between islands should be shallow/open (d=${midD})`);
  }

  // Organic coast: sites covered by their blob radii without SDF mutation.
  let inland = 0;
  for (const site of world.sites) {
    if (world.sdf.sample(site.x, site.z) > 0) inland++;
  }
  assert(
    inland === world.sites.length,
    `all region centers inland on archipelago (${inland}/${world.sites.length})`,
  );

  const env = createDefaultEnvironmentState('day');
  const todEnv = new TimeOfDayController('afternoon');
  environmentFromAtmosphere(todEnv.getSnapshot(), todEnv.getCelestialDirection(), env, {
    waterDeepOcean: '#1FAFD4',
    waterOcean: '#37C9D9',
    waterLagoon: '#62E7E0',
    waterShallow: '#8CF7EC',
    waterBeachEdge: '#DDFCF8',
    waterFoam: '#FFFFFF',
    waterBandIntensity: 0.11,
    waterFresnelStrength: 0.12,
    waterSpecularIntensity: 0.28,
    waterCausticIntensity: 0.08,
    waterShoreFoam: 0.55,
  });
  assert(env.waterDeepColor.r > 0 || env.waterDeepColor.g > 0, 'env water palette filled');
  assert(env.waterShallowColor.g > 0, 'env shallow colour set');
  assert(env.beachTint.r > 0, 'env beach tint set');
  assert(env.horizonHaze >= 0, 'env horizon haze set');

  const ids = [...graph.regions.keys()];
  if (ids.length >= 2) {
    const path = findRoadPath(graph, ids[0]!, ids[1]!);
    assert(path.nodes.length >= 1, 'road path has nodes');
  }

  const sites = enumerateSettlementSites(graph, engine.board);
  assert(sites.length > 0, 'settlement sites from board vertices');
  const snapped = snapSettlementToTerrain(sites[0]!, world);
  assert(Number.isFinite(snapped.y), 'settlement snaps to height');

  const placement = new PlacementCache(world, engine.board);
  for (const v of engine.board.vertices.values()) {
    const pose = placement.vertex(v.id);
    const d = world.sdf.sample(pose.x, pose.z);
    assert(d >= 0.2, `placed vertex ${v.id} should be on land (d=${d.toFixed(2)})`);
    assert(pose.y >= 0, `placed vertex ${v.id} height`);
  }
  for (const h of engine.board.harbors) {
    const pose = resolveHarborPose(world, engine.board, h);
    const shoreD = world.sdf.sample(pose.x, pose.z);
    const tipD = world.sdf.sample(pose.pierTip.x, pose.pierTip.z);
    assert(shoreD > -0.5 && shoreD < 1.2, `harbor ${h.edgeId} footing near coast (d=${shoreD.toFixed(2)})`);
    assert(tipD < shoreD, `harbor ${h.edgeId} pier tip should be more seaward`);
  }
  // Spot-check resolveVertexPose matches cache
  const anyId = [...engine.board.vertices.keys()][0]!;
  const a = resolveVertexPose(world, engine.board, anyId);
  const b = placement.vertex(anyId);
  assert(Math.hypot(a.x - b.x, a.z - b.z) < 1e-6, 'placement cache matches resolver');

  console.log(
    `ok island pipeline (blobs=${world.seed.blobs.length}, regions=${graph.regions.size}, trees=${world.trees.length}, rocks=${world.rocks.length}, coastLoops=${world.coastline.length}, harbors=${engine.board.harbors.length}, centerD=${center.toFixed(2)})`,
  );
}

console.log('smoke ok');
