# Deep Style Configurator

> **Core Principle**
>
> If a renderer reads a number, colour, or toggle, the configurator must be able to edit it.
>
> The panel is a **craft tool**, not a settings dump — deeply complete, tightly categorised, and easy to use.
>
> The board is a **seamless island** over a hidden hex graph. Craft look and
> motion feel — generation knobs stay gated to new games.
>
> **Edit live look and motion. Never rebuild the island for day-night.**

---

## What the panel actually does

`StyleConfigurator` (`src/ui/style/configurator.ts`) renders from `CRAFT_CATEGORIES` + `CRAFT_FIELDS` in `src/ui/style/craftSchema.ts`. Values live on `StyleConfig` (`src/style/styleConfig.ts`).

Live behaviour today:

- **Collapsible categories** — all but Atmosphere start collapsed; click a header to expand.
- **Search** — filters fields (and categories) by label, key, and tags.
- **Presets** — named looks from `STYLE_PRESETS` fill many fields at once.
- **Reset all** — restores `DEFAULT_STYLE_CONFIG`. There is no reset-per-section.
- **Live apply** — range/color/select fire on `input` / `change`. Debounce lives in `Game`, not in the panel.
- **Persistence** — autosave to localStorage via `saveStyleConfig`.

The panel does **not** implement reset-per-section, import/export JSON, modified badges, tooltips, an advanced toggle, or a look-vs-motion split. Camera and Debug are not live categories (they have no fields).

Empty categories are filtered out in the configurator as a safety net; the schema itself only lists categories that have knobs.

---

## Goals

1. **Edit everything that is live** — atmosphere, sky/clouds, lighting, fog/post, water, island/prop look, piece motion feel.
2. **Tightly categorised** — seven top-level groups with clear names; no wall of ungrouped sliders.
3. **Easy to use** — searchable, collapsible, presets, live preview, global reset, sensible defaults and ranges.
4. **Never rebuild the island for look tweaks** — day-night / palette / light changes update Environment State only ([DAY_NIGHT.md](DAY_NIGHT.md)). Map rebuilds (new game / map size) stay outside this panel.

---

## Category Taxonomy

Seven live categories. Order matches `CRAFT_CATEGORIES`.

```text
Configurator
 ├── Atmosphere             ← Environment State only
 ├── Sky & Clouds
 ├── Lighting & Shadows
 ├── Fog & Post
 ├── Water
 ├── Island & Props
 └── Motion & Feedback
```

Camera orbit/FOV and debug overlays are not in this panel until they have `CRAFT_FIELDS` entries.

### Atmosphere (`atmosphere`)

Scheme (morning / afternoon / evening / night / cycle), full-day length, scheme blend time, weather (clear / overcast / rain).

See [DAY_NIGHT.md](DAY_NIGHT.md). Editing here must **not** regenerate hex meshes.

### Sky & Clouds (`skyClouds`)

Zenith / horizon colour refs, cloud count / scale / orbit / height / drift / puff shape & colours.

### Lighting & Shadows (`lighting`)

Sun intensity and sky-light (hemi) intensity. Stylized readability over physical accuracy.

### Fog & Post (`fogPost`)

Tone-mapping **exposure** (single field; not duplicated under lighting).

### Water (`water`)

Depth palette (deep → ocean → lagoon → shallow → beach edge), foam colour, shore width, deep fade, horizon dissolve, swell, contour bands, foam, caustics, Fresnel, specular, reflection, shore ripples, drift waves, mesh segments.

Colours here are **craft bases**; atmosphere may multiply / tint them by scheme. Water hugs the **organic island coast** ([TERRAIN.md](TERRAIN.md)).

### Island & Props (`hexBoard`)

Hover glow, production-pulse duration / strength, harbor bob amplitude.

Island generation is not a live craft rebuild — new games stamp a new mesh.

### Motion & Feedback (`motion`)

Piece / road spawn duration, city upgrade duration, robber hop, highlight fade, camera nudge duration / blend.

Backed by `TweenPlayer` (`src/core/tween.ts`). Camera *nudge* timings live here; there is no separate Camera category.

---

## Control Types

Live kinds on `CraftField`:

| Kind | Use for |
| --- | --- |
| `range` | Continuous scalars with min / max / step + live value |
| `color` | Hex colours |
| `select` | Enums (scheme, weather, puff shape) |

Every live field has: **key**, **label**, **category**, **kind**, plus **min/max/step** or **options**, and optional **tags** (search).

---

## Data Flow

```text
StyleConfigurator
      │
      ▼
StyleConfig  (localStorage JSON)
      │
      ├── look fields ──► Environment State / materials (live)
      │
      └── motion fields ──► TweenPlayer timings / World feel
```

Apply debounce is in `Game`, not the panel.

---

## Relationship to Other Docs

| Doc | Configurator owns |
| --- | --- |
| [TERRAIN.md](TERRAIN.md) | Island / water / prop look knobs |
| [DAY_NIGHT.md](DAY_NIGHT.md) | Atmosphere / palette / Fresnel / band opacity |
| [VISION.md](VISION.md) | Module map + motion milestones + deep panel |

---

## Milestone Guidance

1. Keep the Style panel working from `CRAFT_CATEGORIES` + `CRAFT_FIELDS`.
2. Expand fields as island systems need knobs — **every new shader uniform gets a field in the same PR**, under the matching live category.
3. Do not add Camera / Debug categories until they have real fields.

**Rule of thumb:** a feature is not done until it is configurable from the panel, under the right category, with a clear label and safe default.
