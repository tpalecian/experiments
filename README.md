# Catan — Three.js

Local hotseat Settlers of Catan built with Vite, TypeScript, and Three.js.

## Vision

A **stylized hex-board island** — classic Catan tiles, polished motion, tropical water, and day-night craft.

- **Hex tiles stay.** The board is a readable hex map; organic non-hex terrain is not the direction.
- Gameplay runs on the hex graph (resources + adjacency).
- **Smooth motion:** piece spawn / upgrade, robber hop, highlight fades, production pulses, hover lift.
- **Day-night is render-only:** world data stays static; an Environment State retints lighting, water, sky, and fog.
- **Style configurator:** craft water, atmosphere, and lighting (searchable panel over time).
- Architecture & notes: **[docs/VISION.md](docs/VISION.md)**  
- Hex board presentation: **[docs/TERRAIN.md](docs/TERRAIN.md)**  
- Day-night cycle: **[docs/DAY_NIGHT.md](docs/DAY_NIGHT.md)**  
- Configurator: **[docs/CONFIGURATOR.md](docs/CONFIGURATOR.md)**

Live modules:

```
src/game/        rules engine · board graph
src/render/      BoardView · water · grass · sky · atmosphere · tweens
src/input/       picker
src/ui/          HUD · Style configurator
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

## Notes

- Development cards are not in this MVP
- Longest Road (2 VP at length ≥ 5) is included
- Larger maps scale terrain, numbers, harbors, piece limits, and camera framing
- Tropical low-poly water shader with live **Style** configurator (depth gradient, swells, bands, foam, caustics)
- Piece placement, robber moves, legal highlights, and dice feedback are animated
