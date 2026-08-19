# Stylized Hex Catan

## Guiding Principles

1. **Keep the hex board.** Players play on readable Catan hex tiles. Do not replace the board with organic non-hex terrain — that look made the game harder to read.
2. **Motion quality matters.** Placements, robber moves, highlights, and production feedback should feel smooth (eased tweens, no instant pops).
3. **Day-night never regenerates the world.** Meshes and instances stay static; only the **Environment State** (lighting / palettes / atmosphere) changes.
4. **Craft configurator.** Tunable look values stay editable from the Style panel; generation rebuilds (if any) stay gated.

- Day-night / atmosphere: **[docs/DAY_NIGHT.md](DAY_NIGHT.md)**
- Configurator UX & taxonomy: **[docs/CONFIGURATOR.md](CONFIGURATOR.md)**
- Hex board presentation (water, props, pieces): **[docs/TERRAIN.md](TERRAIN.md)**

```
Hex Board (visible tiles)
        ↓
Gameplay Graph (same hexes — resources / adjacency / robber)
        ↓
        BoardView (tiles · props · pieces · water)
        ↓
Renderers  ←  Environment State (time / weather) + TweenPlayer
```
---

## Tech Stack

| Layer | Tools |
| --- | --- |
| Engine | Three.js |
| Materials | Custom GLSL shaders + toon materials |
| Motion | Local `TweenPlayer` (`src/render/tween.ts`) |
| Water | GPU `uTime` shaders |
| Day-night | `TimeOfDayController` + Environment State |

---

## Animation Priorities

| Moment | Feel |
| --- | --- |
| Place road / settlement | Scale + soft drop (easeOutBack) |
| Upgrade to city | Crossfade morph |
| Move robber | Arc hop + land squash |
| Legal highlights | Opacity / emissive fade + gentle pulse |
| Dice production | Number-token pulse on matching hexes |
| Hex hover | Slight tile lift |
| Camera | Soft OrbitControls damping; light nudge on robber move |

---

## Suggested Modules (live)

```
src/
  game/          engine · board · rules · types
  render/
    BoardView.ts   # hex tiles, pieces, highlights, motion
    tween.ts       # shared easing / tween queue
    water.ts · sky.ts · atmosphere.ts
  ui/            hud · configurator · styles
  input/         picker
```

---

## Development Order (current focus)

| # | Milestone | Outcome |
| --- | --- | --- |
| 1 | Piece motion | Diff sync + spawn / upgrade tweens |
| 2 | Robber hop | Arc move + land squash |
| 3 | Highlight polish | Fade + pulse legal sites |
| 4 | Production feedback | Pulse matching number tokens |
| 5 | Hover + camera | Hex lift, soft look-at on robber |
| 6 | HUD dice | Pop-in dice chips on new rolls |
| 7 | Water craft depth | Richer hex-shore palette / bands / foam knobs in Style |
| 8 | Deep configurator | Schema-driven panel: search, categories, presets, Motion section |
| 9 | Day-night Environment State | Scheme palettes, bands, foam, shadows, rim, board tint |
| 10 | Weather (later) | Palette / scalar swaps on Environment State only |

Milestones 1–9 are implemented on the live hex board. Weather remains future work.

Day-night is already live (`TimeOfDayController`). Keep feeding Environment State into water/sky/lights — never rebuild hex geometry when the clock moves.

**Rule:** a visual feature is not done until it is editable in the craft panel under the correct category ([CONFIGURATOR.md](CONFIGURATOR.md)).
