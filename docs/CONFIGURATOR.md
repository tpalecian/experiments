# Deep Style Configurator

> **Core Principle**
>
> If a renderer reads a number, colour, or toggle, the configurator must be able to edit it.
>
> The panel is a **craft tool**, not a settings dump — deeply complete, tightly categorised, and easy to use.
>
> The board stays **hex tiles**. Craft look and motion feel — do not expose organic-island generation as the product path.

---

## Goals

1. **Edit everything that is live** — water, atmosphere, sky, fog, lighting, hex/prop look, piece motion feel, camera, post.
2. **Really well categorised** — hierarchical groups with clear names; no flat wall of sliders.
3. **Really easy to use** — searchable, collapsible, presets, live preview, reset-per-section, sensible defaults and ranges.
4. **Never rebuild the board for look tweaks** — day-night / palette / light changes update Environment State only ([DAY_NIGHT.md](DAY_NIGHT.md)). Map rebuilds (new game / map size) stay outside this panel.

---

## UX Principles

| Principle | Practice |
| --- | --- |
| Progressive disclosure | Top-level categories → subsections → fields. Collapse what you are not editing. |
| Findability | Fuzzy search / filter across labels and keys. Jump-to-category. |
| Live craft | Most fields apply on `input` with light debounce. Heavy changes confirm or use Apply. |
| Readable controls | Human labels, units in the value readout, tooltips for “why this exists”. |
| Safe defaults | Global Reset + **Reset section** + optional preset packs (Day / Sunset / Night / Cinematic). |
| Persistence | Autosave to localStorage; Import / Export JSON for sharing looks. |
| Separation | **Look** (Environment / materials) vs **Motion** (tween timings) — visually distinct from game setup. |
| No clutter | Prefer one purpose per subsection. Hide advanced fields behind “Advanced”. |

---

## Category Taxonomy

Mirror the **live hex rendering** architecture so authors always know where a knob lives.

```text
Configurator
 ├── Atmosphere             ← Environment State only
 ├── Sky & Clouds
 ├── Lighting & Shadows
 ├── Fog & Post
 ├── Water
 ├── Hex Board & Props
 ├── Motion & Feedback
 ├── Camera
 └── Debug
```

### 1. Atmosphere (Environment State)

| Subsection | Examples |
| --- | --- |
| Clock | Scheme (morning / afternoon / evening / night / cycle), day length, blend time |
| Sun / moon | Altitude, azimuth, colours, intensities |
| Ambient | Hemi sky/ground, fill / bounce, rim |
| Water response | Tint, brightness, Fresnel, specular, caustic multipliers |
| Bands / foam response | Wave-band opacity, foam brightness |

See [DAY_NIGHT.md](DAY_NIGHT.md). Editing here must **not** regenerate hex meshes.

### 2. Sky & Clouds

Zenith / mid / horizon colours, haze, stars, sun disc, cloud count / scale / orbit / height / drift / puff shape & colours.

### 3. Lighting & Shadows

Exposure, sun intensity, shadow softness / opacity / bias, fill strength. Stylized readability over physical accuracy.

### 4. Fog & Post

Fog colour / near / far, tone mapping exposure, optional vignette / colour grade later.

### 5. Water

Depth palette (deep → ocean → lagoon → shallow → shelf), shore width, deep fade, horizon dissolve, swell, contour bands, foam, caustics, Fresnel, specular, mesh segments.

Colours here are **craft bases**; atmosphere may multiply / tint them by scheme. Water hugs **hex land masks** ([TERRAIN.md](TERRAIN.md)).

### 6. Hex Board & Props

| Subsection | Examples |
| --- | --- |
| Tiles | Terrain colours, rim / skirt tint, hover lift amount |
| Tokens | Number-token scale, production-pulse strength / duration |
| Props | Tree / wheat / rock density scales, tint under atmosphere |
| Harbors | Label bob amplitude, pier colour |

No organic mask / SDF island generators here.

### 7. Motion & Feedback

| Subsection | Examples |
| --- | --- |
| Pieces | Spawn duration, ease, drop height |
| Robber | Hop duration, arc height, land squash |
| Highlights | Fade speed, pulse amount |
| Camera | Robber nudge blend, damping |

Backed by `TweenPlayer` (`src/render/tween.ts`).

### 8. Camera

FOV, clip, orbit limits, framing multipliers for map size.

### 9. Debug

Show pickables, legal markers always-on, wireframe, normals, frame timing (dev only).

---

## Control Types

| Kind | Use for |
| --- | --- |
| `range` | Continuous scalars with min / max / step + live value |
| `color` | Hex colours |
| `select` | Enums (scheme, puff shape, tone map) |
| `toggle` | Booleans (show foam, lock seed) |
| `vector` | Compact XYZ where needed (sun direction override) |
| `button` | Reset section, export |
| `preset` | Named looks that fill many fields at once |

Every field needs: **key**, **label**, **category**, **subsection**, **kind**, **default**, **range or options**, optional **tooltip**, optional **`rebuildsWorld: true`** (rare on the hex path).

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
      └── motion fields ──► TweenPlayer timings / BoardView feel
```

Live MVP today: `StyleConfig` + `StyleConfigurator` (`src/render/styleConfig.ts`, `src/ui/configurator.ts`) cover time-of-day, clouds, sky refs, water, and lighting craft.

Target: grow that into **`CraftConfig`** driven by the category schema in `src/ui/craftSchema.ts`, so every system in [VISION.md](VISION.md) / [TERRAIN.md](TERRAIN.md) / [DAY_NIGHT.md](DAY_NIGHT.md) has a home — and **every new uniform ships with a configurator field in the same PR**.

---

## Relationship to Other Docs

| Doc | Configurator owns |
| --- | --- |
| [TERRAIN.md](TERRAIN.md) | Hex board / water / prop look knobs |
| [DAY_NIGHT.md](DAY_NIGHT.md) | Atmosphere / palette / Fresnel / band opacity |
| [VISION.md](VISION.md) | Module map + motion milestones + deep panel |

---

## Milestone Guidance

1. Keep the current Style panel working.  
2. Retarget schema categories to the hex taxonomy above (`craftSchema.ts`).  
3. Add search, collapse, reset-section, export/import.  
4. Expand fields as hex systems need knobs — **every new shader uniform gets a field in the same PR**.  
5. Add **Motion & Feedback** section for tween timings once the baseline animations ship.

**Rule of thumb:** a feature is not done until it is configurable from the panel, under the right category, with a clear label and safe default.
