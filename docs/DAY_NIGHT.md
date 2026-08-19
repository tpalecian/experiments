# Day-Night Cycle on the Hex Board

> **Core Principle**
>
> The day-night cycle should **never regenerate the board**.
>
> Hex tiles, props, pieces, water mesh, and vegetation instances remain static.
>
> Only the **rendering layer** (Environment State) changes.

---

## Architecture

Separate board data from look.

```text
Hex Board (Static)
tiles · props · pieces · water mesh · grass
        │
        ├──────────────────────┐
        ▼                      ▼
Board materials              WaterSurface
        │                      │
        └──────────┬───────────┘
                   ▼
        Lighting & Atmosphere
        (Environment State)
```

This separation makes the day-night cycle cheap: retint and relight, never rebuild.

---

## What changes?

### Board / world — nothing

These stay identical across the whole cycle:

- Hex meshes and terrain colours (base albedos)
- Dirt skirts, rims, harbors
- Trees, wheat, rocks, roads, buildings, robber geometry
- Water **mesh** and land-hex mask
- Grass blade instances

### Rendering — everything that reads Environment State

- Sun / moon direction and colour
- Sky gradient, stars, fog
- Water brightness, tint, Fresnel, specular, caustic intensity
- Wave-band opacity
- Foam brightness / tint
- Shadow direction, softness, opacity
- Exposure and post
- Optional soft tile / prop brightness under night (future)

---

## Sun

The sun is a moving directional light over the hex board. Nothing procedural regenerates.

```ts
// Live code: TimeOfDayController → celestialDirection(altitude, azimuth)
```

At night the same light path can represent the **moon** (cool colour, low intensity).

---

## Water

The water shader does **not** rebuild the sea.

It still uses the hex land mask for depth / bands / foam placement.

It **interpolates palettes and scalars** from Environment State.

### Day

| Band | Hex |
| --- | --- |
| Deep Ocean | `#0E2A5C` |
| Ocean | `#164A8C` |
| Lagoon | `#1FA8C8` |
| Beach / foam shelf | `#A8FFF4` |

Navy open water with a bright cyan shelf — Bruno folio shore read.

### Sunset

| Band | Hex |
| --- | --- |
| Deep Ocean | `#1A3A68` |
| Ocean | `#2A6A9A` |
| Lagoon | `#3A9BB0` |
| Beach | `#FFD8B8` |

Warmer. Longer shadows. Soft reflections.

### Night

| Band | Hex |
| --- | --- |
| Deep Ocean | `#0A1230` |
| Ocean | `#101C42` |
| Lagoon | `#1A2E5A` |
| Beach | `#2EC8E0` |

Indigo open water with a glowing cyan rim.

---

## Water Reflections (Fresnel)

| Time | Strength (guide) |
| --- | --- |
| Morning | ~5% |
| Midday | ~3% |
| Sunset | ~10% |
| Night | ~20% |

Water becomes more reflective at night.

---

## Wave Bands

Band placement from the land mask **stays the same**. Only opacity changes:

| Time | Feel |
| --- | --- |
| Day | Strong, readable |
| Sunset | Medium |
| Night | Soft / faint — still visible |

---

## Foam

Foam **placement** never changes (shore only). Only brightness / tint:

| Time | Look |
| --- | --- |
| Day | Bright white |
| Night | Blue-white |

---

## Hex tiles & props

Tile **geometry** never changes. Optional future albedo / emissive response:

| Time | Feel |
| --- | --- |
| Day | Full terrain colour |
| Sunset | Warm fill, longer shadows |
| Night | Cooler ambient, readable toon sides |

Props (trees, wheat, rocks) do **not** respawn — only lighting / saturation.

---

## Sky

The sky drives most of the atmosphere.

| Time | Sky |
| --- | --- |
| Day | Blue → white horizon |
| Sunset | Orange → pink → purple |
| Night | Dark blue → stars → moon |

---

## Fog

Fog colour follows the sky.

| Time | Fog |
| --- | --- |
| Morning | Soft blue / warm haze |
| Sunset | Warm orange |
| Night | Dark blue |

---

## Ambient Lighting

Avoid physically accurate lighting. Prefer stylized, readable lighting:

```text
Directional Sun
+ Ambient Sky Light
+ Soft Bounce Light
+ Subtle Rim Light
```

---

## Shadows

Adjust only direction, softness, and opacity:

| Time | Shadows |
| --- | --- |
| Morning | Long |
| Midday | Short |
| Sunset | Very long |
| Night | Moon shadows (soft, cool) |

---

## Underwater Caustics

Caustics stay active in shallow water near hex shores. Intensity scales with the cycle:

| Time | Intensity |
| --- | --- |
| Day | 100% |
| Sunset | 70% |
| Night | 30% (or lower) |

---

## The Board Never Changes

```text
Hex tiles       ✔ Static
Props           ✔ Static
Pieces          ✔ Static (motion is tween, not rebuild)
Water mesh      ✔ Static
Grass instances ✔ Static
```

Only rendering / Environment State changes. Piece tweens are gameplay feedback, not world regeneration.

---

## Environment State

Do not sprinkle a bare `timeOfDay` into every shader.

Build one **Environment State** every frame (or on scheme hold). Every renderer reads from it.

```ts
type EnvironmentState = {
  sunDirection: Vector3
  sunColor: Color
  moonDirection: Vector3

  ambientColor: Color

  skyTopColor: Color
  skyHorizonColor: Color

  fogColor: Color

  waterDeepColor: Color
  waterShallowColor: Color
  // optional mid / lagoon / beach shelf colours

  waveBandIntensity: number
  fresnelStrength: number
  shadowStrength: number
  causticIntensity: number
  foamBrightness: number
}
```

### Live mapping

Runtime Environment State is `AtmosphereSnapshot` via `TimeOfDayController` in `src/world/Atmosphere.ts`. Palette tables come from `src/atmosphere/environment.ts`. Weather (`applyWeather`) is a second Environment State pass — Clear / Overcast / Rain — and never rebuilds meshes.

| Vision field | Live field(s) |
| --- | --- |
| `sunDirection` | Derived from `sunAltitude` + `sunAzimuth` |
| `sunColor` / intensity | `sunColor`, `sunIntensity` |
| Sky | `skyZenith`, `skyMid`, `skyHorizon` |
| Fog | `fogColor`, `fogNearMul`, `fogFarMul` |
| Ambient / bounce / rim | `hemiSky`, `hemiGround`, `fillColor`, `rimColor`, `rimIntensity` |
| Shadows | `shadowStrength` (softness / opacity feel) |
| Water depth palette | `waterDeep`, `waterOcean`, `waterLagoon`, `waterShallow`, `waterShelf` |
| Water response | `waterBrightness`, `waterTint`, `waterFresnelStrength`, `waterSpecularIntensity`, `waterCausticIntensity`, `waveBandIntensity`, `foamBrightness`, `waterFoamColor`, `waterPaletteMix` |
| Board tint | `beachTint`, `boardTintMix` (hex/prop albedo only — no mesh rebuild) |
| Stars / moon disc | `starsIntensity`, night celestial as cool “sun” |

`WaterSurface.applyAtmosphere` composes **Style craft bases × Environment State**. `World.applyAtmosphere` soft-tints tiles/props. `Game.ts` applies lights, rim, fog, and shadow strength every frame.

---

## Environment Pipeline

```text
Time
        │
        ▼
Environment State
        │
        ├──────────────┬──────────────┬──────────────┐
        ▼              ▼              ▼
Sky          Board materials    Water shader
        │              │              │
        ▼              ▼              ▼
Fog       Grass / props      Post / exposure
```

Keeps every visual system synchronized without touching board data.

---

## Future Expansion

Once Environment State exists, weather is a palette / scalar swap:

- Rain, storms, fog banks
- Wind stronger on grass
- Seasons
- Eclipse / magical events

Each modifies Environment State only. **No hex rebuild.**

Piece / camera motion stays on `TweenPlayer` ([VISION.md](VISION.md)) — orthogonal to day-night.

---

## Key Design Principle

The hex board is built **once** per game (map size / seed) — see [TERRAIN.md](TERRAIN.md).

The day-night cycle does **not** modify the board.

Every renderer interprets the same hex world through a shared Environment State that controls lighting, colours, atmosphere, reflections, shadows, and post-processing.

Atmosphere scalars and palettes should be editable from the craft configurator under **Atmosphere**, **Sky & Clouds**, **Lighting**, **Fog**, and **Water** — see [CONFIGURATOR.md](CONFIGURATOR.md).
