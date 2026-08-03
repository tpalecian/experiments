# Stylized Catan-Inspired Island Generation

## Guiding Principles

1. **The gameplay graph is invisible.** Players never see tiles. Rules run on a hidden region graph; rendering never draws that graph as hexes.
2. **Coastline first.** Do not generate terrain and then add water. Generate a coastline, then let **everything else** derive from one value: `distanceToCoast`.

Full terrain algorithm (12 steps, why it works): **[docs/TERRAIN.md](TERRAIN.md)**.

```
Gameplay Graph (hidden)
        ↓
Region Graph  (biomes / resources — does not invent a second coast)
        ↓
Island Mask → Smooth → SDF (distanceToCoast)
        ↓
Terrain Height · Water Depth · Beaches · Bands · Foam · Props
        ↓
Rendering
```

---

## Tech Stack

| Layer | Tools |
| --- | --- |
| Engine | Three.js |
| Materials | Custom GLSL shaders |
| Scattering | `InstancedMesh` |
| Noise | Simplex / FBM (low frequency only) |
| Regions | Delaunay + Voronoi |
| Coast / depth | Signed Distance Field (SDF) |
| Mesh extraction | Marching Squares / Dual Contouring |
| Queries (optional) | BVH |

---

## The One Field

```ts
// ocean < 0, coastline = 0, land > 0
distanceToCoast
```

Every system samples it:

| System | Reads |
| --- | --- |
| Terrain height | `terrainCurve(d) + subtle noise` |
| Water colour | deep → turquoise → mint |
| Beach | wet / dry sand bands |
| Wave bands | `fract(d * freq)` contours |
| Foam | `d ∈ [-2, 2]` |
| Caustics | `d ∈ [-25, 0]` |
| Trees | slope + height + biome |
| Rocks | slope + height |

---

## Pipelines

### Gameplay (hidden)

1. Generate island seed  
2. Generate hidden gameplay graph  
3. Assign resource regions  
4. Relax region sites (Lloyd) — visual spacing only  

### Terrain / render (coastline-first)

1. Generate island mask (radial + low-freq simplex + domain warp)  
2. Smooth coastline  
3. Compute SDF (`distanceToCoast`)  
4. Height from `terrainCurve(d)`  
5. Terrain mesh + water mesh  
6. Water colour, beaches, wave contours, foam, caustics  
7. Vegetation + rocks  
8. Lighting & polish  

---

## Hidden Gameplay Graph

Gameplay only. Never rendered as tiles.

```ts
type Region = {
  id: string;
  resource: 'forest' | 'wheat' | 'ore' | 'brick' | 'pasture' | 'desert';
  neighbors: string[];
  position: Vector2;
};
```

- Nodes own resource type and adjacency.
- Roads run A\* over the graph, then become splines for dirt paths.
- Settlements spawn at graph junctions, then offset to believable world positions.
- Biome masks blur Voronoi borders for look; **adjacency rules stay crisp**.
- Dice / production / robber stay on this graph (today’s hex board maps here during migration).

---

## Island Shape

```ts
island = radialFalloff + simplexNoise + domainWarp
```

**Never use high-frequency noise.** Soften the mask (Gaussian / distance transform / Marching Squares) so beaches sweep — they must not look noisy.

---

## World Chunking

```
World
 └── Chunks
      ├── Terrain
      ├── Water
      ├── Trees
      ├── Rocks
      └── Props
```

---

## Suggested Modules

```
src/
  terrain/
    island.ts      # silhouette mask
    mask.ts        # coastline smoothing
    graph.ts       # gameplay sites → points
    voronoi.ts     # Delaunay / Voronoi + Lloyd
    sdf.ts         # distanceToCoast
    height.ts      # terrainCurve(d)
    beach.ts       # wet / dry sand bands
    biome.ts       # soft resource masks
    coast.ts       # polyline extract (tools)
    pipeline.ts    # coastline-first entry
  water/
    shader.ts      # colour from d + material
    foam.ts        # shore foam
    waves.ts       # contour bands + caustics mask
  world/
    chunks.ts
    vegetation.ts
    rocks.ts
  gameplay/
    regions.ts
    roads.ts
    settlements.ts
```

Existing `src/game/` remains rules authority until the hidden graph replaces hex-facing APIs. Existing `src/render/` drives the current MVP; modules above are the migration target.

---

## Development Order

| # | Milestone | Outcome |
| --- | --- | --- |
| 1 | Flat water | Clear sea plane + camera framing |
| 2 | Island mask + SDF | Soft land/water + `distanceToCoast` |
| 3 | Terrain mesh | Height from `terrainCurve(d)` |
| 4 | Water colour | Tropical depth gradient from `d` |
| 5 | Beaches | Wet/dry sand bands |
| 6 | Wave bands | Breathing contour lines |
| 7 | Foam + caustics | Shore + shallow only |
| 8 | Biomes | Soft Voronoi on land |
| 9 | Trees | Slope/height/biome gated |
| 10 | Rocks | Cliff scatter from slope |
| 11 | Roads / buildings | Graph → splines / junctions |
| 12 | Polish | Atmosphere, LODs, craft |

---

## Migration Stance (current MVP)

Today the project still draws **visible hex tiles** with tropical water hugging hex SDFs. That is the playable baseline.

The island-generation vision **keeps Catan rules**, but replaces tile rendering with:

- a hidden region graph (compat layer over today’s hexes at first),
- organic terrain / water / props derived from one coastline SDF,
- roads and buildings as world geometry, not board tokens on flat hexes.

No gameplay change is required for a visual milestone: same graph, different presentation.
