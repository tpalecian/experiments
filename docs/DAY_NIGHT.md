# Adding a Day-Night Cycle to a Stylized Procedural Island

> **Core Principle**
>
> The day-night cycle should **never regenerate the world**.
>
> The terrain, coastlines, beaches, and vegetation remain static.
>
> Only the **rendering layer** changes.

---

## Architecture

Separate world generation from rendering.

```text
Terrain Generation (Static)
        │
        ▼
World Data
(Height, SDF, Biomes)
        │
        ├──────────────────────┐
        ▼                      ▼
Terrain Renderer         Water Renderer
        │                      │
        └──────────┬───────────┘
                   ▼
        Lighting & Atmosphere
```

This separation makes the day-night cycle cheap.

The terrain never changes. The renderer interprets the same world differently through a shared **Environment State**.

---

## What Changes?

### Terrain / world — nothing

These stay identical across the whole cycle:

- Heightmap
- Coastline / SDF
- Beaches (geometry)
- Trees, rocks, roads, buildings
- Water **mesh**

Everything generated from `distanceToCoast` stays exactly the same.

### Rendering — everything that reads Environment State

- Sun / moon direction and colour
- Sky gradient, stars, fog
- Water depth palette, Fresnel, specular, caustic intensity
- Wave-band opacity
- Foam brightness / tint
- Beach albedo tint
- Vegetation brightness / saturation
- Shadow direction, softness, opacity
- Exposure and post

---

## Sun

The sun is a moving directional light. It rotates around the island. Nothing procedural regenerates.

```ts
// Conceptual orbit — live code derives direction from altitude + azimuth.
sun.position.set(Math.cos(time), Math.sin(time), 0)
```

At night the same light path can represent the **moon** (cool colour, low intensity).

---

## Water

The water shader does **not** recalculate the ocean from scratch.

It still samples `distanceToCoast` for depth / bands / foam placement.

It **interpolates colour palettes** (and related scalars) from Environment State.

### Day

| Band | Hex |
| --- | --- |
| Deep Ocean | `#1FAFD4` |
| Ocean | `#37C9D9` |
| Lagoon | `#62E7E0` |
| Beach / foam shelf | `#DDFCF8` |

Bright. Clear. Highly saturated.

### Sunset

| Band | Hex |
| --- | --- |
| Deep Ocean | `#205A8C` |
| Ocean | `#3A91B8` |
| Lagoon | `#4FB8C4` |
| Beach | `#FFD8B8` |

Warmer. Longer shadows. Soft reflections.

### Night

| Band | Hex |
| --- | --- |
| Deep Ocean | `#0C2340` |
| Ocean | `#10304F` |
| Lagoon | `#153B5F` |
| Beach | `#294A67` |

Cool. Higher contrast. More reflections.

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

Geometry / SDF contours **stay the same**. Only opacity changes:

| Time | Feel |
| --- | --- |
| Day | Strong, readable |
| Sunset | Medium |
| Night | Soft / faint — still visible |

---

## Foam

Foam **placement** never changes (`d ∈ [-2, 2]`). Only brightness / tint:

| Time | Look |
| --- | --- |
| Day | Bright white |
| Night | Blue-white |

---

## Beaches

Sand **geometry** never changes. Albedo shifts with sunlight:

| Time | Sand |
| --- | --- |
| Day | Warm ivory |
| Sunset | Golden orange |
| Night | Cool grey |

---

## Vegetation & Rocks

Do **not** swap textures or respawn instances.

- Trees: adjust brightness, saturation, ambient — they become silhouettes at night.
- Rocks: longer / softer shadows only.

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

Caustics stay active (still gated by shallow `distanceToCoast`). Intensity scales with the cycle:

| Time | Intensity |
| --- | --- |
| Day | 100% |
| Sunset | 70% |
| Night | 30% (or lower) |

---

## The World Never Changes

```text
Island Shape   ✔ Static
Coastline      ✔ Static
Terrain        ✔ Static
Trees          ✔ Static
Rocks          ✔ Static
Roads          ✔ Static
Buildings      ✔ Static
Water Mesh     ✔ Static
```

Only rendering changes.

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
  beachTint: Color
}
```

### Live MVP mapping

Today’s runtime already follows this pattern via `AtmosphereSnapshot` + `TimeOfDayController` in `src/render/atmosphere.ts`:

| Vision field | Live field(s) |
| --- | --- |
| `sunDirection` | Derived from `sunAltitude` + `sunAzimuth` |
| `sunColor` / intensity | `sunColor`, `sunIntensity` |
| Sky | `skyZenith`, `skyMid`, `skyHorizon` |
| Fog | `fogColor` |
| Ambient / bounce | `hemiSky`, `hemiGround`, `fillColor` |
| Water response | `waterBrightness`, `waterTint`, `waterFresnelStrength`, `waterCausticIntensity`, … |
| Stars / moon disc | `starsIntensity`, night celestial as cool “sun” |

Island-generation water will add explicit **depth palette** colours (`waterDeepColor` …) on top of the existing tint/fresnel knobs. See `src/atmosphere/environment.ts` for palette constants and the target `EnvironmentState` shape.

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
Sky          Terrain Shader    Water Shader
        │              │              │
        ▼              ▼              ▼
Fog       Vegetation        Post Processing
```

Keeps every visual system synchronized without touching world data.

---

## Future Expansion

Once Environment State exists, weather is a palette / scalar swap:

- Rain, storms, fog banks
- Snow, wind
- Seasons
- Eclipse / magical events

Each modifies Environment State only. **No terrain regeneration.**

---

## Key Design Principle

The procedural world is generated **once** (coastline-first SDF — see [TERRAIN.md](TERRAIN.md)).

The day-night cycle does **not** modify the terrain.

Every renderer interprets the same world through a shared Environment State that controls lighting, colours, atmosphere, reflections, shadows, and post-processing.

That keeps rendering efficient, consistent, and cohesive while preserving the handcrafted tropical aesthetic.
