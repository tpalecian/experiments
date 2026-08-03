# Recreating the Stylized Tropical Island Algorithm

> **Core Principle**
>
> Don't generate terrain first and then add water.
>
> Generate a **coastline** first, then let **everything else** derive from it.

Everything is driven by a single value:

```ts
distanceToCoast // signed: ocean < 0, coast = 0, land > 0
```

---

## The Rendering Pipeline

```text
Island Shape
      │
      ▼
Signed Distance Field (SDF)
      │
      ├──────────────┐
      ▼              ▼
Terrain Height    Water Depth
      │              │
      ▼              ▼
Beach           Water Colour
      │              │
      ▼              ▼
Grass         Wave Bands
      │              │
      ▼              ▼
Trees          Foam
      │
      ▼
Rocks
```

Every rendering system reads the same field:

```ts
terrainHeight(d)
waterColour(d)
beachColour(d)
waveBands(d)
foam(d)
caustics(d)
vegetation(d)
rocks(d)
```

Nothing works independently. Everything is synchronized.

---

## Step 1 — Generate the Island Mask

Forget heightmaps first.

Start with only the island silhouette. For every sample:

```ts
island = radialFalloff + simplexNoise + domainWarp
```

At this stage the map only knows **land** vs **water**. Nothing else.

**Never use high-frequency noise.** Large sweeping forms only.

---

## Step 2 — Smooth the Coastline

Raw procedural noise looks artificial. Soften the mask:

- Gaussian blur
- Distance transform
- Marching Squares smoothing

Goal: **large sweeping beaches**, not noisy coastlines.

---

## Step 3 — Generate the Signed Distance Field (SDF)

Compute distance from every point to the coastline.

| Sign | Meaning |
| --- | --- |
| `< 0` | Ocean |
| `0` | Coastline |
| `> 0` | Land |

This field is the heart of the renderer. Store it as a texture / sampler every system can query.

---

## Step 4 — Generate Terrain Height

Never generate mountains directly from Perlin noise.

```ts
height = terrainCurve(distanceToCoast)
       + largeScaleNoise
       + smallVariation
```

Example curve (distance → layer):

| Distance | Layer |
| --- | --- |
| −100 | Deep Ocean |
| −20 | Lagoon |
| 0 | Beach |
| 15 | Grass |
| 40 | Hills |
| 70 | Mountains |

Subtle noise only — the result should feel sculpted, not random.

---

## Step 5 — Water Colour

Don't colour water from normals. Use the SDF:

```text
Deep Ocean → Blue → Turquoise → Lagoon → Mint → Almost White
```

That gradient is the tropical look.

---

## Step 6 — Beaches

The beach is another SDF range. No decals. No textures. Smooth interpolation:

| Distance | Surface |
| --- | --- |
| `< 0` | Water |
| `0 … 8` | Wet sand |
| `8 … 18` | Dry sand |
| `18+` | Grass |

---

## Step 7 — Wave Bands

These are **not** water normals. They are **contour lines** (like a topo map):

```ts
band = fract(distance * frequency)
// then blur, fade, animate
```

Contours naturally follow every bay and peninsula.

---

## Step 8 — Animate the Water

Contour lines barely move — **breathing**, not waves:

```ts
distance += sin(time * 0.2) * 0.5
```

Almost imperceptible.

---

## Step 9 — Foam

Foam only near shore:

```text
distance ∈ [-2, 2]
```

Fade quickly. Never in deep water.

---

## Step 10 — Underwater Caustics

Subtle animated caustics, shallow water only:

```text
distance ∈ [-25, 0]
```

Slow movement. Low contrast.

---

## Step 11 — Vegetation

Not random. Gate on slope, height, biome:

```ts
if (slope < threshold && height > grassLevel) spawnTree()
```

Flat grasslands become forests. Steep cliffs stay empty.

---

## Step 12 — Rocks

Slope detection:

```ts
if (height > rockHeight && slope > cliffThreshold) spawnRock()
```

Cliffs emerge from the height field automatically.

---

## Terrain Generation Order

```text
Generate Island Mask
        │
        ▼
Smooth Coastline
        │
        ▼
Compute Signed Distance Field
        │
        ▼
Generate Terrain Height
        │
        ▼
Generate Terrain Mesh
        │
        ▼
Generate Water Mesh
        │
        ▼
Generate Water Depth Colours
        │
        ▼
Generate Beaches
        │
        ▼
Generate Wave Contours
        │
        ▼
Generate Foam
        │
        ▼
Generate Underwater Caustics
        │
        ▼
Generate Vegetation
        │
        ▼
Generate Rocks
        │
        ▼
Lighting & Post Processing
```

---

## Why This Works

Traditional procedural worlds treat terrain, water, beaches, and vegetation as separate systems.

This style treats them as **different visual interpretations of the same signed distance field**.

The coastline defines:

- Terrain height
- Water depth
- Beach width
- Water colour
- Foam placement
- Wave contour lines
- Vegetation limits
- Rock placement

Because every effect shares the same data, the island feels cohesive and handcrafted — connected to the water instead of stitched together from independent systems.

---

## Module Map

| Concern | Module |
| --- | --- |
| Mask + silhouette | `src/terrain/island.ts` |
| Coast smoothing | `src/terrain/mask.ts` |
| SDF / `distanceToCoast` | `src/terrain/sdf.ts` |
| Height from curve(d) | `src/terrain/height.ts` |
| Beach bands | `src/terrain/beach.ts` |
| Coast polylines | `src/terrain/coast.ts` |
| Water colour / material | `src/water/shader.ts` |
| Wave contours | `src/water/waves.ts` |
| Foam | `src/water/foam.ts` |
| Trees | `src/world/vegetation.ts` |
| Rocks | `src/world/rocks.ts` |
| Pipeline entry | `src/terrain/pipeline.ts` |

Gameplay regions / Voronoi biomes still modulate *which* land looks like forest vs ore; they do not invent a second coastline. Biome masks are applied **on top of** the shared SDF.
