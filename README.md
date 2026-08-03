# Catan — Three.js

Local hotseat Settlers of Catan built with Vite, TypeScript, and Three.js.

## Vision

The look is a **handcrafted organic island**, not a board of tiles.

- Gameplay runs on a **hidden region graph** (resources + adjacency; hex board is the rules compat layer).
- **Coastline first:** one field `distanceToCoast` drives height, water colour, beaches, wave bands, foam, vegetation, and rocks.
- **Day-night is render-only:** world data stays static; an Environment State retints lighting, water, sky, and fog.
- **Deep configurator:** edit everything via a categorised craft panel (search, Generate vs Look, Apply regenerate).
- Architecture & milestones: **[docs/VISION.md](docs/VISION.md)**  
- Terrain algorithm (12 steps): **[docs/TERRAIN.md](docs/TERRAIN.md)**  
- Day-night cycle: **[docs/DAY_NIGHT.md](docs/DAY_NIGHT.md)**  
- Configurator: **[docs/CONFIGURATOR.md](docs/CONFIGURATOR.md)**

```
src/terrain/     island · mask · graph · voronoi · sdf · height · beach · biome · coast · pipeline · noise
src/water/       shader · foam · waves
src/atmosphere/  environment (EnvironmentState + palettes)
src/world/       types · chunks · vegetation · rocks
src/gameplay/    regions · roads · settlements
src/render/      BoardView · IslandTerrainView · water · atmosphere · sky
src/ui/          craftSchema · configurator
```

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

## Craft panel

Open **Craft** (top-right). Look categories update live; **World / Generation** knobs rebuild the island when you press **Apply regenerate**. Debug toggles: hex overlay, SDF overlay.

## Notes

- Development cards are not in this MVP
- Longest Road (2 VP at length ≥ 5) is included
- Larger maps scale terrain, numbers, harbors, piece limits, and camera framing
- Hex tiles are hidden by default (toggle in Debug); number tokens and picking stay on the graph
