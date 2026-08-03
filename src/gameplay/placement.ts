/**
 * Map hex-board graph sites → believable world positions on the organic island.
 * Rules still use hex IDs; this only affects rendering.
 *
 * - Settlements: pull out of water / steep cliffs onto nearby land
 * - Harbors / shipyards: walk to the actual coastline along the SDF gradient
 * - Roads: use snapped endpoint positions
 */

import type { BoardState, Harbor } from '../game/types';
import type { WorldData } from '../world/types';
import { worldSampleBilinear } from '../world/types';

export interface WorldPose {
  x: number;
  y: number;
  z: number;
  /** Yaw around Y (radians) when relevant. */
  yaw: number;
}

const EPS = 1e-4;

function sdfAt(world: WorldData, x: number, z: number): number {
  return world.sdf.sample(x, z);
}

function heightAt(world: WorldData, x: number, z: number): number {
  return worldSampleBilinear(world.heightField, world.grid, x, z);
}

/** Approximate ∇distanceToCoast on XZ. */
function sdfGradient(world: WorldData, x: number, z: number, h = 0.35): { gx: number; gz: number } {
  const gx = (sdfAt(world, x + h, z) - sdfAt(world, x - h, z)) / (2 * h);
  const gz = (sdfAt(world, x, z + h) - sdfAt(world, x, z - h)) / (2 * h);
  return { gx, gz };
}

function normalize2(x: number, z: number): { x: number; z: number } {
  const len = Math.hypot(x, z);
  if (len < EPS) return { x: 0, z: 0 };
  return { x: x / len, z: z / len };
}

/**
 * Walk along ±SDF gradient until distance crosses target.
 * dirSign > 0 → inland (increasing d); dirSign < 0 → toward ocean.
 */
function walkSdf(
  world: WorldData,
  startX: number,
  startZ: number,
  dirSign: 1 | -1,
  targetD: number,
  maxSteps = 48,
  step = 0.22,
): { x: number; z: number; d: number } {
  let x = startX;
  let z = startZ;
  let d = sdfAt(world, x, z);

  for (let i = 0; i < maxSteps; i++) {
    const crossed =
      dirSign > 0 ? d >= targetD : d <= targetD;
    if (crossed) break;

    const g = sdfGradient(world, x, z);
    let nx = g.gx * dirSign;
    let nz = g.gz * dirSign;
    const n = normalize2(nx, nz);
    // Fallback: push from island center if gradient vanishes
    if (Math.hypot(n.x, n.z) < 0.05) {
      const fromCenter = normalize2(x, z);
      nx = fromCenter.x * dirSign;
      nz = fromCenter.z * dirSign;
    } else {
      nx = n.x;
      nz = n.z;
    }
    x += nx * step;
    z += nz * step;
    d = sdfAt(world, x, z);
  }
  return { x, z, d };
}

/**
 * Resolve a board vertex to a buildable land pose.
 * Coastal junctions sit slightly inland; water sites walk onto land.
 */
export function resolveVertexPose(world: WorldData, board: BoardState, vertexId: string): WorldPose {
  const v = board.vertices.get(vertexId);
  if (!v) return { x: 0, y: 0, z: 0, yaw: 0 };

  let x = v.x;
  let z = v.z;
  let d = sdfAt(world, x, z);

  // Prefer a little inland so foundations clear wet sand / foam
  const targetLand = 0.55;
  if (d < targetLand) {
    const hit = walkSdf(world, x, z, 1, targetLand);
    x = hit.x;
    z = hit.z;
    d = hit.d;
  }

  // Soften steep slopes: if slope is harsh, nudge toward flatter neighbor samples
  const g = sdfGradient(world, x, z);
  const slope = Math.hypot(g.gx, g.gz);
  if (slope > 1.8) {
    const n = normalize2(g.gx, g.gz);
    x += n.x * 0.25;
    z += n.z * 0.25;
  }

  const y = Math.max(0.02, heightAt(world, x, z));
  return { x, y, z, yaw: 0 };
}

/**
 * Harbor / shipyard: pier sits on the true coastline, facing the ocean.
 */
export function resolveHarborPose(
  world: WorldData,
  board: BoardState,
  harbor: Harbor,
): WorldPose & { pierTip: { x: number; y: number; z: number } } {
  const edge = board.edges.get(harbor.edgeId);
  if (!edge) {
    return { x: 0, y: 0.05, z: 0, yaw: 0, pierTip: { x: 0, y: 0.05, z: 0 } };
  }

  // Start from snapped coastal vertices of this edge (more stable than raw mid)
  const [va, vb] = edge.vertexIds;
  const a = resolveVertexPose(world, board, va);
  const b = resolveVertexPose(world, board, vb);
  let x = (a.x + b.x) * 0.5;
  let z = (a.z + b.z) * 0.5;

  // Walk to the shore (d ≈ 0.08 on the land side)
  const shore = walkSdf(world, x, z, -1, 0.08);
  x = shore.x;
  z = shore.z;

  // If somehow still deep inland, walk farther toward ocean
  if (sdfAt(world, x, z) > 0.4) {
    const again = walkSdf(world, x, z, -1, 0.05, 64, 0.28);
    x = again.x;
    z = again.z;
  }

  const g = sdfGradient(world, x, z);
  // Ocean direction = decreasing SDF
  let out = normalize2(-g.gx, -g.gz);
  if (Math.hypot(out.x, out.z) < 0.05) {
    out = normalize2(x, z); // radial fallback
  }

  const yaw = Math.atan2(out.x, out.z);
  const y = Math.max(0.04, heightAt(world, x, z) * 0.35 + 0.04);

  // Pier tip a short way into the water
  const tipX = x + out.x * 0.85;
  const tipZ = z + out.z * 0.85;
  const tipY = 0.05;

  return {
    x,
    y,
    z,
    yaw,
    pierTip: { x: tipX, y: tipY, z: tipZ },
  };
}

/** Road ribbon samples between two snapped vertices. */
export function resolveRoadSamples(
  world: WorldData,
  board: BoardState,
  edgeId: string,
  segments = 6,
): { x: number; y: number; z: number }[] {
  const e = board.edges.get(edgeId);
  if (!e) return [];
  const [va, vb] = e.vertexIds;
  const a = resolveVertexPose(world, board, va);
  const b = resolveVertexPose(world, board, vb);
  const out: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    // Slight lift so tubes clear terrain
    const y = Math.max(0.05, heightAt(world, x, z) + 0.05);
    out.push({ x, y, z });
  }
  return out;
}

/** Hex-center pose for number tokens / robber (pull inland if needed). */
export function resolveHexCenterPose(
  world: WorldData,
  x: number,
  z: number,
): WorldPose {
  let px = x;
  let pz = z;
  const d = sdfAt(world, px, pz);
  if (d < 0.35) {
    const hit = walkSdf(world, px, pz, 1, 0.6);
    px = hit.x;
    pz = hit.z;
  }
  return {
    x: px,
    y: Math.max(0.04, heightAt(world, px, pz)),
    z: pz,
    yaw: 0,
  };
}

/** Cache of resolved poses for one board + world pair. */
export class PlacementCache {
  private vertices = new Map<string, WorldPose>();
  private harbors = new Map<string, ReturnType<typeof resolveHarborPose>>();

  constructor(
    private world: WorldData,
    private board: BoardState,
  ) {}

  vertex(id: string): WorldPose {
    let p = this.vertices.get(id);
    if (!p) {
      p = resolveVertexPose(this.world, this.board, id);
      this.vertices.set(id, p);
    }
    return p;
  }

  harbor(h: Harbor): ReturnType<typeof resolveHarborPose> {
    let p = this.harbors.get(h.edgeId);
    if (!p) {
      p = resolveHarborPose(this.world, this.board, h);
      this.harbors.set(h.edgeId, p);
    }
    return p;
  }

  road(edgeId: string): { x: number; y: number; z: number }[] {
    return resolveRoadSamples(this.world, this.board, edgeId);
  }

  hex(x: number, z: number): WorldPose {
    return resolveHexCenterPose(this.world, x, z);
  }
}
