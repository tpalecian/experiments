# Hex Board Presentation — Water, Props & Coast Feel

> **Core Principle**
>
> Keep the **readable hex tiles**. Water, skirts, props, and lighting dress the board —
> they do not replace it with organic non-hex terrain.

The live board is built in `BoardView` (`src/render/BoardView.ts`): extruded hex meshes,
terrain props, number tokens, harbors, tropical water hugging the land hexes.

---

## Architecture

```text
Hex graph (game rules)
        │
        ▼
BoardView tiles + markers + pieces
        │
        ├──────────────┐
        ▼              ▼
WaterSurface      Grass / props
(hex land SDF)    (per-tile scatter)
        │
        ▼
Environment State + TweenPlayer
```

Gameplay adjacency and production stay on the hex graph. Presentation never invents a second board.

---

## Water around hexes

Water is a flat sea plane with a **land mask from hex centers** (not an organic island silhouette).

Live path: `src/render/water.ts` — Bruno folio shore (cyan rim + sparse arcs), frosted mirror, depth colour, atmosphere tint.

Craft bases live in `StyleConfig`; day-night multiplies them via Environment State ([DAY_NIGHT.md](DAY_NIGHT.md)).

| Effect | Intent |
| --- | --- |
| Depth colour | Navy open water → cyan shelf at hex coast |
| Shore foam | Thin glowing lip (Bruno `shoreNode`) |
| Shore ripples | Sparse thin arcs marching on SDF (Bruno `ripplesNode`) |
| Frosted mirror | Soft scene contact shadows on the plane |
| Swells | Near-flat (folio amplitude is tiny) |
| Caustics | Quiet, shallow only |

Polish work improves these shaders and Style knobs — **without** removing hex tiles.

---

## Hex tile stack

Each land hex (conceptually):

```text
Dirt skirt (tabletop edge)
  └─ Extruded hex body (terrain colour)
       └─ Top rim
            └─ Props (trees / wheat / rocks / mesa / cactus)
                 └─ Number token (if any)
                      └─ Pasture grass blades (sheep only)
```

| Layer | Notes |
| --- | --- |
| Body | Toon material per terrain type |
| Skirt | Slightly wider bottom for a coast edge |
| Props | Seeded scatter; static meshes (motion comes from grass wind + pieces) |
| Tokens | Pulse on matching dice production |
| Markers | Vertex / edge legal highlights (fade + pulse) |

---

## Pieces & motion

Roads, settlements, cities, and the robber are board pieces on the hex graph.

Motion system: `src/render/tween.ts` + `BoardView` sync.

| Moment | Feel |
| --- | --- |
| Place road / settlement | Scale + soft drop |
| Upgrade city | Morph / crossfade |
| Robber | Arc hop + land squash |
| Highlights | Opacity / emissive fade + pulse |
| Hover | Slight hex lift |

See [VISION.md](VISION.md) for the full animation priority table.

---

## What we are not doing

- Replacing hexes with a coastline-first organic heightmesh
- Hidden region graphs that players never see as tiles
- Regenerating terrain when day-night changes

---

## Module map (live)

| Concern | Module |
| --- | --- |
| Hex tiles, pieces, highlights | `src/render/BoardView.ts` |
| Tweens / easing | `src/render/tween.ts` |
| Water shader | `src/render/water.ts` |
| Pasture grass | Meadow floor in `src/render/style.ts` + biome props |
| Sky / clouds | `src/render/sky.ts` |
| Day-night / atmosphere | `src/render/atmosphere.ts` |
| Style craft | `src/render/styleConfig.ts`, `src/ui/configurator.ts` |
| Rules / board graph | `src/game/*` |

Day-night and weather must **not** rebuild hex meshes — only Environment State changes. See **[DAY_NIGHT.md](DAY_NIGHT.md)**.
