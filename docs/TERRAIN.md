# Island Diorama — Terrain, Water, Props & Coast

> **Core Principle**
>
> The **hex graph stays for rules only**. Presentation is one continuous
> stylized island: organic coastline, silhouette-first biomes, painterly
> materials. Do not draw extruded hexagonal tiles.

The live board is built in `World` (`src/world/World.ts`): an island height
mesh, terrain props, number tokens, harbors, and tropical water hugging the
organic shore.

---

## Architecture

```text
Hex graph (game rules, hidden)
        │
        ▼
IslandField (warped rounded-hex SDF + biome sample)
        │
        ├──────────────┐
        ▼              ▼
IslandMesh        WaterSurface
(vertex colors)   (same coast SDF)
        │
        ▼
Props / pieces / tokens sit on sampled height
        │
        ▼
Environment State + TweenPlayer
```

Gameplay adjacency and production stay on the hex graph. Presentation never
draws that graph as tiles.

---

## Island field

Live path: `src/world/islandField.ts`.

Coastline is a **union of rounded hex SDFs** with a shared domain warp so
neighbouring tiles melt into one blob. Biome colour and height still follow
soft hex influence, blended at the borders so the grid does not read.

`distanceToCoast` (positive = ocean, negative = inland) drives:

| System | Reads |
| --- | --- |
| Beach / shelf | sand band and underwater sand |
| Terrain height | biome curve faded by coast |
| Water colour / foam | same SDF on the GPU |
| Prop / piece Y | `heightAt(x, z)` |

---

## Biome language (silhouette first)

| Terrain | Terrain language |
| --- | --- |
| Wood | Darker green floor, dense oversized trees, logs, rocks |
| Wheat | Golden rolling fields, crop rows, tiny barn or windmill |
| Sheep | Bright hills, sheep, fences, flowers |
| Brick | Warm red/orange rock, terraces, clay pits, sparse plants |
| Ore | Dark grey floor, stacked chunky boulders (not cones) |
| Desert | Cream dunes, cactus, oasis or ruins |

Mountains are **boulder piles**: overlapping faceted grey rocks with light tops
and dark sides. The island mesh stays a low rocky floor; silhouette comes from
the props. Trees stay oversized enough to read from the diorama camera.

The beach is a **wide warm-sand band** with darker orange blotches. Surf is
**layered white-to-mint paint-stroke foam** warped off the coast SDF — not a
thin glow ring and not a hex contour. Shallows are pale mint with mossy
depth patches.

Each land hex uses circumradius `HEX_SIZE` (1.75, about 3× the old floor
area) so groves, fields, and flocks can be composed instead of stacked on a
tiny disc. Coast SDF, biome height, roads, and the biome editor tile all
scale with that size. The ortho camera frames the island a little tighter
so the bigger hexes also read larger on screen.

---

## Water around the island

Water is a flat sea plane whose land mask is the **same warped coast SDF**
as the mesh (not a raw hex outline). The island mesh stops at the waterline
so surf is painted on the water, not under a sand skirt.

Live path: `src/world/WaterSurface.ts` — mint shallows, layered paint-stroke
foam, frosted mirror, depth colour. Ripples stay quiet so they do not fight
the foam.

Craft bases live in `StyleConfig`; day-night multiplies them via Environment
State ([DAY_NIGHT.md](DAY_NIGHT.md)).

| Effect | Intent |
| --- | --- |
| Depth colour | Pale mint shallows → lagoon → deeper green out to sea |
| Opaque shallows | Flat paint fill at the beach; no dark see-through gap |
| Shore foam | Thick broken white lip + mint-white paint-stroke blobs |
| Shore ripples | Sparse thin arcs, kept off the foam lip |
| Frosted mirror | Soft scene contact shadows on the plane |
| Swells | Near-flat (folio amplitude is tiny) |
| Caustics | Quiet, shallow only |

---

## Board stack

Each hidden hex (conceptually):

```text
Island mesh (shared)
  └─ Invisible pick disc
       └─ Glow disc (hover / legal / production)
            └─ Props (trees / wheat / rocks / peaks / …)
                 └─ Number token (if any)
```

Pieces (roads, settlements, cities, robber) sample island height at their
world xz. Highlight markers sit on the same sampler.

---

## Pieces & motion

Roads, settlements, cities, and the robber are board pieces on the hex graph.

Motion system: `src/core/tween.ts` + `World` piece sync.

| Moment | Feel |
| --- | --- |
| Place road / settlement | Scale + soft drop |
| Upgrade city | Morph / crossfade |
| Robber | Arc hop + land squash |
| Highlights | Opacity / emissive fade + pulse |
| Hover | Soft glow disc (no tile lift) |
| Select tile | Camera eases down and toward the hex |

See [VISION.md](VISION.md) for the full animation priority table.

---

## What we are not doing

- Drawing extruded hex tiles, dirt skirts, or hex rims as the board
- Treating “low-poly” as primitive unshaded chunks
- Regenerating terrain when day-night changes

---

## Module map (live)

| Concern | Module |
| --- | --- |
| Coast SDF + biome height | `src/world/islandField.ts` |
| Terrain mesh | `src/world/IslandMesh.ts` |
| Tokens, harbors, pick discs | `src/world/Board.ts` |
| Tweens / easing | `src/core/tween.ts` |
| Water shader | `src/world/WaterSurface.ts` |
| Biome props | `src/world/biomeLayouts.ts` + `src/world/assets/props.ts` |
| Sky / clouds | `src/world/Sky.ts` |
| Day-night / atmosphere | `src/world/Atmosphere.ts` |
| Style craft | `src/style/styleConfig.ts`, `src/ui/style/configurator.ts` |
| Rules / board graph | `src/engine/*` |

Day-night and weather must **not** rebuild the island mesh — only Environment
State changes. See **[DAY_NIGHT.md](DAY_NIGHT.md)**.
