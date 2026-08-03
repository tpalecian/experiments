# Deep Style Configurator

> **Core Principle**
>
> If a renderer reads a number, colour, or toggle, the configurator must be able to edit it.
>
> The panel is a **craft tool**, not a settings dump — deeply complete, tightly categorised, and easy to use.

---

## Goals

1. **Edit everything** — island generation, SDF bands, water, atmosphere, sky, fog, lighting, vegetation, rocks, roads, buildings, camera, post.
2. **Really well categorised** — hierarchical groups with clear names; no flat wall of sliders.
3. **Really easy to use** — searchable, collapsible, presets, live preview, reset-per-section, sensible defaults and ranges.
4. **Never rebuild the world for look tweaks** — day-night / palette / light changes update Environment State only ([DAY_NIGHT.md](DAY_NIGHT.md)). Generation knobs that *do* rebuild (seed, mask, mesh res) are clearly labelled and gated.

---

## UX Principles

| Principle | Practice |
| --- | --- |
| Progressive disclosure | Top-level categories → subsections → fields. Collapse what you are not editing. |
| Findability | Fuzzy search / filter across labels and keys. Jump-to-category. |
| Live craft | Most fields apply on `input` with light debounce. Heavy rebuilds (mesh) confirm or use Apply. |
| Readable controls | Human labels, units in the value readout, tooltips for “why this exists”. |
| Safe defaults | Global Reset + **Reset section** + optional preset packs (Day / Sunset / Night / Cinematic). |
| Persistence | Autosave to localStorage; Import / Export JSON for sharing looks. |
| Separation | **Look** (Environment / materials) vs **Generate** (seed, SDF, mesh) — visually distinct. |
| No clutter | Prefer one purpose per subsection. Hide advanced fields behind “Advanced”. |

---

## Category Taxonomy

Mirror the rendering architecture so authors always know where a knob lives.

```text
Configurator
 ├── World / Generation     ← rebuilds world data (gated)
 ├── Atmosphere             ← Environment State only
 ├── Sky & Clouds
 ├── Lighting & Shadows
 ├── Fog & Post
 ├── Water
 ├── Coast & Beaches
 ├── Terrain & Biomes
 ├── Vegetation
 ├── Rocks & Cliffs
 ├── Roads & Settlements
 ├── Camera
 └── Debug
```

### 1. World / Generation

| Subsection | Examples |
| --- | --- |
| Seed | Island seed, RNG lock |
| Mask | Radius, falloff, warp, simplex amplitude |
| Smooth | Blur passes, distance-transform soften |
| SDF / mesh | Grid resolution, bounds, height curve scales |
| Chunks | Chunk size, load radius |

**Label clearly:** “Regenerates terrain”. Prefer an **Apply** button for this category.

### 2. Atmosphere (Environment State)

| Subsection | Examples |
| --- | --- |
| Clock | Scheme (morning / afternoon / evening / night / cycle), day length, blend time |
| Sun / moon | Altitude, azimuth, colours, intensities |
| Ambient | Hemi sky/ground, fill / bounce, rim |
| Water response | Tint, brightness, Fresnel, specular, caustic multipliers |
| Bands / foam response | Wave-band opacity, foam brightness |

See [DAY_NIGHT.md](DAY_NIGHT.md). Editing here must **not** regenerate SDF or meshes.

### 3. Sky & Clouds

Zenith / mid / horizon colours, haze, stars, sun disc, cloud count / scale / orbit / height / drift / puff shape & colours.

### 4. Lighting & Shadows

Exposure, sun intensity, shadow softness / opacity / bias, fill strength. Stylized readability over physical accuracy.

### 5. Fog & Post

Fog colour / near / far, tone mapping exposure, optional vignette / colour grade later.

### 6. Water

Depth palette (deep → ocean → lagoon → shallow → shelf), shore width, deep fade, horizon dissolve, swell, contour bands, foam, caustics, Fresnel, specular, mesh segments.

Colours here are **craft bases**; atmosphere may multiply / tint them by scheme.

### 7. Coast & Beaches

Wet / dry sand ranges on `distanceToCoast`, sand colours (day ivory / sunset gold / night grey as scheme overrides), beach blend softness.

### 8. Terrain & Biomes

Height curve anchors, vertical scale, large/small noise, biome blur, resource colours (forest / wheat / ore / brick / pasture / desert).

### 9. Vegetation

Density, max slope, min height, scale range, biome weight gates, tint / saturation under atmosphere.

### 10. Rocks & Cliffs

Min height, min slope, density, scale, material colours.

### 11. Roads & Settlements

Path width, spline samples, dirt colour; building scale / offset; visibility toggles.

### 12. Camera

FOV, clip, orbit limits, framing multipliers for map size.

### 13. Debug

Show SDF overlay, coastline, chunk bounds, region graph (dev only), wireframe, normals.

---

## Control Types

| Kind | Use for |
| --- | --- |
| `range` | Continuous scalars with min / max / step + live value |
| `color` | Hex colours |
| `select` | Enums (scheme, puff shape, tone map) |
| `toggle` | Booleans (show foam, lock seed) |
| `vector` | Compact XYZ where needed (sun direction override) |
| `button` | Apply regenerate, reset section, export |
| `preset` | Named looks that fill many fields at once |

Every field needs: **key**, **label**, **category**, **subsection**, **kind**, **default**, **range or options**, optional **tooltip**, optional **`rebuildsWorld: true`**.

---

## Ease-of-Use Checklist

- [ ] Categories collapsed by default except the last-edited one  
- [ ] Search filters fields and highlights matching categories  
- [ ] Sticky category nav or sidebar on wide layouts  
- [ ] Mobile: full-height drawer, large hit targets, no hover-only UI  
- [ ] Debounce heavy listeners (~40ms) — already used for style apply  
- [ ] Keyboard: Esc closes panel; `/` focuses search  
- [ ] Copyable field keys in Advanced for shader authors  
- [ ] “Modified” badge on sections that differ from defaults  

---

## Data Flow

```text
Configurator UI
      │
      ▼
CraftConfig  (persisted JSON)
      │
      ├── look fields ──► Environment State / materials (live)
      │
      └── generate fields ──► Island pipeline (explicit Apply)
```

Live MVP today: `StyleConfig` + `StyleConfigurator` (`src/render/styleConfig.ts`, `src/ui/configurator.ts`) cover time-of-day, clouds, sky refs, water, and lighting craft.

Target: grow that into **`CraftConfig`** driven by the category schema in `src/ui/craftSchema.ts`, so every system in [VISION.md](VISION.md) / [TERRAIN.md](TERRAIN.md) / [DAY_NIGHT.md](DAY_NIGHT.md) has a home — and **every new uniform ships with a configurator field in the same PR**.

---

## Relationship to Other Docs

| Doc | Configurator owns |
| --- | --- |
| [TERRAIN.md](TERRAIN.md) | Generation + beach/height/biome ranges |
| [DAY_NIGHT.md](DAY_NIGHT.md) | Atmosphere / palette / Fresnel / band opacity |
| [VISION.md](VISION.md) | Module map + milestone that ships the deep panel |

---

## Milestone Guidance

1. Keep the current Style panel working.  
2. Introduce schema-driven sections (this doc’s taxonomy).  
3. Add search, collapse, reset-section, export/import.  
4. Expand fields as island systems land — **every new shader uniform gets a field in the same PR**.  
5. Split Generate vs Look visually when SDF mesh regeneration exists.

**Rule of thumb:** a feature is not done until it is configurable from the panel, under the right category, with a clear label and safe default.
