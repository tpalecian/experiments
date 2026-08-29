# Stylized Island Diorama Catan

## Guiding Principles

1. **The hex graph is hidden.** Players never see hexagonal tiles. Rules still run on the Catan hex graph (resources, adjacency, robber); rendering never draws that graph as a board.
2. **One continuous island.** The world is a handcrafted miniature archipelago — premium stylized low-poly with soft shading — not a tabletop of extruded chunks and not a primitive “low-poly Catan.”
3. **Day-night never regenerates the world.** The island mesh, props, and water stay static; only the **Environment State** (lighting / palettes / atmosphere) changes.
4. **Craft configurator.** Tunable look values stay editable from the Style panel; generation rebuilds stay gated to new games.

- Island presentation: **[docs/TERRAIN.md](TERRAIN.md)**
- Day-night / atmosphere: **[docs/DAY_NIGHT.md](DAY_NIGHT.md)**
- Configurator UX & taxonomy: **[docs/CONFIGURATOR.md](CONFIGURATOR.md)**

```
Gameplay Graph (hidden hexes — resources / adjacency / robber)
        ↓
Island Field (organic coast SDF + biome heights)
        ↓
World (terrain mesh · props · pieces · water)
        ↓
Renderers  ←  Environment State (time / weather) + TweenPlayer
```

---

## Tech Stack

| Layer | Tools |
| --- | --- |
| Engine | Three.js |
| Terrain | CPU island field + vertex-colored Lambert mesh |
| Materials | Painterly Lambert / toon pieces + custom GLSL water |
| Motion | Local `TweenPlayer` (`src/core/tween.ts`) |
| Water | GPU `uTime` shaders with the same coast SDF as the mesh |
| Day-night | `TimeOfDayController` + Environment State |
| Camera | Orthographic (miniature diorama) |

---

## Animation Priorities

| Moment | Feel |
| --- | --- |
| Place road / settlement | Scale + soft drop (easeOutBack) |
| Upgrade to city | Crossfade morph |
| Move robber | Arc hop + land squash |
| Legal highlights | Opacity / emissive fade + gentle pulse |
| Dice production | Number-token pulse on matching hexes |
| Hex hover | Soft glow disc on the hidden hex (no tile lift) |
| Camera | Orthographic orbit; lower + rotate toward a selected tile |

---

## Suggested Modules (live)

```
src/
  engine/        GameEngine · board · rules · types
  Game.ts        composition root (folio-style wiring)
  core/          Time · Viewport · Rendering · tween · Quality
  view/          CameraRig · Lighting · Fog
  world/         IslandField · IslandMesh · Board · Pieces · Highlights · Props · WaterSurface · Sky · Atmosphere
  ui/            hud · style/configurator · styles
  input/         picker
```

---

## Development Order (current focus)

Milestones 1–10 (motion, water craft, day-night, weather) are implemented. The live presentation is the **island diorama** over the hidden hex graph.

Day-night is already live (`TimeOfDayController`). Keep feeding Environment State into water/sky/lights — never rebuild island geometry when the clock moves.

**Rule:** a visual feature is not done until it is editable in the craft panel under the correct category ([CONFIGURATOR.md](CONFIGURATOR.md)).
