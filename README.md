# Catan — Three.js

Local hotseat Settlers of Catan built with Vite, TypeScript, and Three.js.

## Vision

The long-term look is a **handcrafted island**, not a board of tiles.

- Gameplay runs on a **hidden region graph** (resources + adjacency).
- **Coastline first:** one field `distanceToCoast` drives height, water colour, beaches, wave bands, foam, vegetation, and rocks.
- **Day-night is render-only:** world data stays static; an Environment State retints lighting, water, sky, and fog.
- **Deep configurator:** edit everything via a well-categorised, easy-to-use craft panel (search, presets, Generate vs Look).
- Architecture & milestones: **[docs/VISION.md](docs/VISION.md)**  
- Terrain algorithm (12 steps): **[docs/TERRAIN.md](docs/TERRAIN.md)**  
- Day-night cycle: **[docs/DAY_NIGHT.md](docs/DAY_NIGHT.md)**  
- Configurator: **[docs/CONFIGURATOR.md](docs/CONFIGURATOR.md)**

Scaffold modules (stubs / target APIs; live day cycle still uses `src/render/atmosphere.ts`):

```
src/terrain/     island · mask · graph · voronoi · sdf · height · beach · biome · coast · pipeline
src/water/       shader · foam · waves
src/atmosphere/  environment (EnvironmentState + palettes)
src/world/       chunks · vegetation · rocks
src/gameplay/    regions · roads · settlements
src/ui/          craftSchema (deep configurator taxonomy) · configurator (live Style panel)
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
- Long-term: expand that panel into a **deep craft configurator** that can edit every system — see [docs/CONFIGURATOR.md](docs/CONFIGURATOR.md)
