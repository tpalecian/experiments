/**
 * Roads: A* over the hidden region graph / board edges, then Catmull-Rom spline.
 */

import type { BoardState } from '../game/types';
import type { RegionGraph } from './regions';

export interface PathNode {
  regionId: string;
  x: number;
  z: number;
}

export interface RoadPath {
  nodes: PathNode[];
  /** Sampled points along a smoothed spline for mesh generation. */
  samples: { x: number; z: number }[];
}

function catmullRom(
  p0: { x: number; z: number },
  p1: { x: number; z: number },
  p2: { x: number; z: number },
  p3: { x: number; z: number },
  t: number,
): { x: number; z: number } {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    z:
      0.5 *
      (2 * p1.z +
        (-p0.z + p2.z) * t +
        (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
        (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  };
}

/** Convert graph nodes into evenly spaced Catmull-Rom samples. */
export function pathToSpline(nodes: PathNode[], segments = 8): { x: number; z: number }[] {
  if (nodes.length === 0) return [];
  if (nodes.length === 1) return [{ x: nodes[0]!.x, z: nodes[0]!.z }];
  if (nodes.length === 2) {
    const out: { x: number; z: number }[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      out.push({
        x: nodes[0]!.x + (nodes[1]!.x - nodes[0]!.x) * t,
        z: nodes[0]!.z + (nodes[1]!.z - nodes[0]!.z) * t,
      });
    }
    return out;
  }
  const pts = nodes.map((n) => ({ x: n.x, z: n.z }));
  const out: { x: number; z: number }[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const steps = i === pts.length - 2 ? segments : segments;
    for (let s = 0; s < steps; s++) {
      out.push(catmullRom(p0, p1, p2, p3, s / steps));
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

/**
 * Shortest path over region adjacency (A*).
 */
export function findRoadPath(
  graph: RegionGraph,
  fromId: string,
  toId: string,
): RoadPath {
  if (!graph.regions.has(fromId) || !graph.regions.has(toId)) {
    return { nodes: [], samples: [] };
  }
  if (fromId === toId) {
    const r = graph.regions.get(fromId)!;
    const node = { regionId: fromId, x: r.position.x, z: r.position.z };
    return { nodes: [node], samples: [{ x: node.x, z: node.z }] };
  }

  const open = new Set<string>([fromId]);
  const came = new Map<string, string>();
  const gScore = new Map<string, number>([[fromId, 0]]);
  const fScore = new Map<string, number>();
  const goal = graph.regions.get(toId)!;
  const h = (id: string) => {
    const r = graph.regions.get(id)!;
    return Math.hypot(r.position.x - goal.position.x, r.position.z - goal.position.z);
  };
  fScore.set(fromId, h(fromId));

  while (open.size > 0) {
    let current = '';
    let best = Infinity;
    for (const id of open) {
      const f = fScore.get(id) ?? Infinity;
      if (f < best) {
        best = f;
        current = id;
      }
    }
    if (current === toId) break;
    open.delete(current);
    const cur = graph.regions.get(current)!;
    for (const nb of cur.neighbors) {
      const n = graph.regions.get(nb)!;
      const tentative =
        (gScore.get(current) ?? Infinity) +
        Math.hypot(n.position.x - cur.position.x, n.position.z - cur.position.z);
      if (tentative < (gScore.get(nb) ?? Infinity)) {
        came.set(nb, current);
        gScore.set(nb, tentative);
        fScore.set(nb, tentative + h(nb));
        open.add(nb);
      }
    }
  }

  if (!came.has(toId) && fromId !== toId) {
    return { nodes: [], samples: [] };
  }

  const chain: string[] = [toId];
  let c = toId;
  while (came.has(c)) {
    c = came.get(c)!;
    chain.push(c);
  }
  chain.reverse();
  const nodes: PathNode[] = chain.map((id) => {
    const r = graph.regions.get(id)!;
    return { regionId: id, x: r.position.x, z: r.position.z };
  });
  return { nodes, samples: pathToSpline(nodes, 6) };
}

/** Build a dirt-path sample polyline for a board edge (compat). */
export function edgeRoadSamples(
  board: BoardState,
  edgeId: string,
  segments = 6,
): { x: number; z: number }[] {
  const e = board.edges.get(edgeId);
  if (!e) return [];
  const [a, b] = e.vertexIds;
  const va = board.vertices.get(a)!;
  const vb = board.vertices.get(b)!;
  const nodes: PathNode[] = [
    { regionId: a, x: va.x, z: va.z },
    { regionId: b, x: vb.x, z: vb.z },
  ];
  return pathToSpline(nodes, segments);
}
