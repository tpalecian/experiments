# Catan — Three.js

Local hotseat Settlers of Catan built with Vite, TypeScript, and Three.js.

## Vision

The long-term look is a **handcrafted island**, not a board of tiles.

- Gameplay runs on a **hidden region graph** (resources + adjacency).
- Players never see hexes; terrain, water, beaches, and props come from **SDF + Voronoi + procedural meshes**.
- Full architecture, pipeline, and milestone order: **[docs/VISION.md](docs/VISION.md)**.

Scaffold modules (stubs, not yet wired into the live view):

```
src/terrain/   island · graph · voronoi · sdf · height · biome · coast · pipeline
src/water/     shader · foam · waves
src/world/     chunks · vegetation
src/gameplay/  regions · roads · settlements
```

The current MVP still renders stylized hex tiles with tropical water; the vision modules are the migration target.

## Run

```bash
npm install
npm run dev
```

## Play

1. Choose a **map size** (Standard 19 / Large 37 / Huge 61 hexes)
2. Choose 2–4 players
3. Place settlements and roads in snake-draft setup
4. Roll, collect resources, bank-trade, build roads/settlements/cities
5. On a 7, discard if needed, move the robber, steal
6. First to the map’s VP goal wins (10 / 12 / 15)

## Notes

- Development cards are not in this MVP
- Longest Road (2 VP at length ≥ 5) is included
- Larger maps scale terrain, numbers, harbors, piece limits, and camera framing
- Tropical low-poly water shader with live **Style** configurator (depth gradient, swells, bands, foam, caustics)
