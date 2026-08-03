# Stylized Catan-Inspired Island Generation

## Guiding Principle

**The gameplay graph is invisible.**

Players never see tiles. Everything they see is generated from smooth distance fields and procedural terrain, creating one handcrafted-looking island. Gameplay rules still run on a hidden region graph; rendering never draws that graph as hexes or polygons.

```
Gameplay Graph (hidden)
        ↓
Region Graph
        ↓
Terrain Generation
        ↓
Water & Beaches
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

## Pipeline

1. **Generate island seed**
2. **Generate hidden gameplay graph**
3. **Assign resource regions**
4. **Relax regions (Lloyd)**
5. **Build SDF from regions**
6. **Generate heightmap**
7. **Extract coastline**
8. **Generate terrain mesh**
9. **Render water**
10. **Scatter assets**

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
- Dice / production / robber logic stay on this graph (today’s hex board maps here during migration).

---

## Island Shape

Combine:

- large radial falloff
- low-frequency simplex
- domain warp

**Never use high-frequency noise.** Soft, continental forms only.

---

## Regions → Organic Terrain

1. Place region centers from the gameplay graph.
2. Build Voronoi cells from those centers.
3. Blur / soften borders so biome masks look organic.
4. Leave gameplay adjacency unchanged — visuals may blur; rules do not.

---

## Height Layers

From water to peak:

| Layer | Role |
| --- | --- |
| Deep Ocean | Far water, dark depth |
| Lagoon | Shallow turquoise shelf |
| Sand Shelf | Underwater sand approach |
| Beach | Shore sand |
| Grass | Lowland biomes |
| Hills | Mid elevation |
| Cliffs | Steep SDF ridges |
| Mountains | Ore / highland peaks |

---

## Coastline & Shared SDF

Build the coastline from the island SDF. The **same SDF** drives:

- water colour / depth
- foam
- beaches
- wave bands
- cliff placement

One field, many consumers — keeps shore, water, and land locked together.

---

## Water Shader

Layered GLSL (calm, aerial-friendly, stylized):

1. Depth gradient  
2. Shoreline fade  
3. Slow sine waves  
4. Contour wave bands  
5. Caustics  
6. Foam  
7. Subtle Fresnel  

### Wave bands

```glsl
distance = sdf(worldPos);
band = smoothstep(...);
// Animate by offsetting distance with time
```

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

Scatter vegetation and rocks with `InstancedMesh`, masked by biome fields.

---

## Suggested Modules

```
src/
  terrain/
    island.ts      # seed + island outline
    graph.ts       # bridge from gameplay regions → spatial graph
    voronoi.ts     # Delaunay / Voronoi + Lloyd relaxation
    sdf.ts         # region / island SDF
    height.ts      # heightmap from SDF + layers
    biome.ts       # soft biome masks
    coast.ts       # coastline extraction
  water/
    shader.ts      # water material
    foam.ts        # foam masks
    waves.ts       # band / swell helpers
  world/
    chunks.ts      # chunk ownership
    vegetation.ts  # InstancedMesh scatter
  gameplay/
    regions.ts     # Region type + graph ops
    roads.ts       # A* → spline paths
    settlements.ts # junction placement + offsets
```

Existing `src/game/` (rules, engine, hex board) remains the rules authority until the hidden graph fully replaces hex-facing APIs. Existing `src/render/` continues to drive the current MVP; new modules above are the target architecture.

---

## Development Order

| # | Milestone | Outcome |
| --- | --- | --- |
| 1 | Flat water | Clear sea plane + camera framing |
| 2 | Island SDF | Soft land mask from seed |
| 3 | Terrain mesh | Height-displaced island mesh |
| 4 | Biomes | Soft Voronoi resource colours |
| 5 | Water shader | Depth, swells, Fresnel |
| 6 | Beaches | Sand shelf from SDF |
| 7 | Wave bands | Animated contour bands |
| 8 | Trees | Biome-instanced forest |
| 9 | Rocks | Ore / cliff scatter |
| 10 | Roads | Graph A\* → dirt splines |
| 11 | Buildings | Offset settlements / cities |
| 12 | Polish | Atmosphere, LODs, craft |

---

## Migration Stance (current MVP)

Today the project still draws **visible hex tiles** with tropical water hugging hex SDFs. That is the playable baseline.

The island-generation vision **keeps Catan rules**, but replaces tile rendering with:

- a hidden region graph (compat layer over today’s hexes at first),
- organic terrain / water / props derived from SDF + Voronoi,
- roads and buildings as world geometry, not board tokens on flat hexes.

No gameplay change is required for a visual milestone: same graph, different presentation.
