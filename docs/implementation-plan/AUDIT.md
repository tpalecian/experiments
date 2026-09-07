# Audit findings and evidence

## Method and baseline

Source inspection covered composition, engine/rules, board generation, rendering, atmosphere, water/sky shaders, pieces/tweens, input, quality, HUD, style configuration, asset factories, biome storage/editor, thumbnails, build configuration, and smoke coverage. A live 19-hex/two-player board was inspected in the browser at 1280×720. Browser console inspection returned no warnings/errors in that session. This is not an exhaustive browser, accessibility, or device certification.

Validation run against the original implementation:

- TypeScript check passed.
- Smoke suite passed via `node --import tsx scripts/smoke.ts`. The npm/tsx CLI encountered a sandbox IPC permission error; invoking the same script through Node's tsx loader succeeded.
- `npm run build` passed: JS entry 730.59 kB, gzip 192.87 kB; CSS 23.97 kB. The expected >500 kB chunk warning remains. This is a measured build result, not a runtime-memory figure.
- The browser FPS overlay showed roughly 39 FPS in one capture. Do not use that single observation as a benchmark or infer a specific GPU bottleneck from it.
- Additional in-memory Node probes reproduced fractional discard acceptance, tie misassignment, overwritten victory text, nested-tween time consumption, and history-dependent Day presets. No gameplay source was changed.

## Confirmed behavior defects

| Finding | Evidence in audited source | Planned fix |
| --- | --- | --- |
| Longest Road ties can award the card arbitrarily | `src/engine/rules.ts:updateLongestRoad` picks the first maximum when no eligible incumbent exists. Two disjoint five-edge chains with no incumbent returned player 0. | P02 |
| Settlement interruption leaves Longest Road stale | `GameEngine.placeSettlement` refreshes VP but does not recompute Longest Road after a settlement splits another player's route. | P02 |
| Winning action overwrites winner text | Settlement, road, and city commands call `checkWin()` then assign their ordinary build message. A probe ended in `gameOver` with `Red upgraded to a city.` | P03 |
| Victory check considers inactive players | `checkWin()` loops every player. Once interruption is fixed, transferred Longest Road points could incorrectly end another player's turn. | P03 |
| Fractional resource discard accepted | `discard()` checks sign/total but not integers. `{wood:0.5,sheep:0.5}` satisfied a one-card discard in a probe. | P03 |
| Direct robber-phase theft lacks adjacency validation | Public `stealFrom()` accepts any victim during `robber`; normal UI generally avoids this path, but the engine contract is weaker than its intended rule. | P03 |
| Advertised build sites can be unaffordable | Snapshot helpers call raw legal graph functions although `rules.ts:legalBuildTargets` already checks costs and piece limits. | P03, P18 |
| Repeated identical dice do not animate | `Hud.lastDiceKey` compares face values instead of roll identity. The same pair on a later turn is not fresh. | P04 |
| Production highlight can include the blocked hex | `Board.pulseProduction` pulses every matching number and has no robber/productive-result information. Text equality also controls event freshness in `Game`. | P04 |
| Child tween consumes the parent's update delta | `TweenPlayer.update` iterates the mutable array to which `play()` appends. A .14 s tween started by a .5 s completion finished during that same .5 s update. The robber landing squash uses this pattern. | P05 |
| Craft colors are overwritten | `SkyDome.applyConfig` sets sky/cloud colors; `applyAtmosphere` replaces them each frame. | P11 |
| Presets depend on prior choices | `applyStylePreset` overlays current values. Night → Day retains different shore glow, Fresnel, and reflection strength than defaults → Day. This overlay is currently documented; replacing it is an explicit workflow change. | P06 |
| Water subdivision does not subdivide its interior | `WaterSurface` uses a radius-180+ `CircleGeometry`. Segments control its perimeter and central fan, not a 2D wave grid. | P13 |
| Shadow softness knob has no intended directional-light effect | `Rendering` uses PCFSoftShadowMap while `Lighting` varies `shadow.radius`. The installed r172 PCF-soft directional shadow branch does not use that radius. `shadowStrength` also only toggles casting and changes radius, rather than directly setting opacity. | P15 |
| Claimed hover lift is actually glow | `Board.updateHoverAndPulse` resets tile Y to restingY and applies emissive color/intensity. The schema calls it glow while parts of README/VISION/TERRAIN call it lift. Keep glow and reconcile docs. | P17, P25 |

## Confirmed implementation gaps with impact requiring measurement

| Finding | Evidence and practical risk | Planned fix |
| --- | --- | --- |
| Color-pipeline mismatch | Water and sky end at `gl_FragColor` without built-in tone-mapping/output conversion chunks; mesh materials use those chunks. Clouds explicitly opt out of tone mapping. Exposure/palette changes cannot be compared consistently across these paths. | P12 |
| Reflection state/matrix lifecycle is fragile | Reflection reads matrixWorld before explicitly updating it, runs before main rendering, and hides water/harbors without exception-safe restoration. Exact visible lag must be tested during orbit and first render. | P13 |
| Rendering costs do not scale down enough | Every quality tier still has reflected-scene rendering; shoreline shaders evaluate all 64 slots and reflection blur uses seven samples. Quality lowers resolution but does not remove the pass. | P19 |
| Per-frame material traversal/allocation | `Props.applyTint` traverses every prop mesh; `applyWeather` clones many colors even for clear/fixed time; board material arrays are repeatedly gathered. | P11, P19 |
| Removed meshes are not disposed | Board, Highlights, Props, and Pieces remove/clear groups without systematic geometry/material disposal. Rebuilds and city upgrades can accumulate GPU resources after rendering. | P08 |
| Shared textures are disposed by individual previews | Asset Lab, Biome Editor, and thumbnail helpers dispose material maps, including the cached meadow texture shared by cloned materials. Avoid premature disposal and repeated uploads. | P08 |
| No complete app teardown | Game loses the Viewport reference, does not retain subscriptions for disposal, and has an uncancelled RAF loop. Labs have independent permanent loops/listeners. | P09 |
| Simulation clocks disagree after stalls | `Time.delta` is clamped but `elapsed` follows the unclamped Three clock; shader animation can jump while tweens advance only .05 s. | P09 |
| Duplicate visual setup | Game, labs, and thumbnails instantiate their own renderers/lights and different exposure/background values. Hex mesh construction also exists in both Board and the asset factory. | P10, P15, P20 |
| Style storage accepts invalid fields | Parsed JSON is spread into defaults without runtime type/range/enum validation; saves and reset can throw on unavailable storage. | P06 |
| Biome import can corrupt authoring identity | Duplicate layout/prop IDs are not rejected; model maps/find operations depend on uniqueness. Unsupported versions and empty imports silently fall back to defaults. Extents/scales/counts are insufficiently bounded. | P07 |
| Editor import changes history before validation | `pushHistory()` precedes parsing, so failed imports affect history; save failures can leave in-memory state and success messages inconsistent. | P07, P21 |
| Thumbnail creation churns contexts | `warmPropThumbnails` synchronously creates and disposes one renderer per uncached prop; texture-backed capture has no readiness barrier. | P20 |
| Camera fit ignores aspect and HUD | `frameBoard` depends on radius only; resize changes projection without accounting for portrait width or overlay safe area. | P17 |
| Pointer cleanup is incomplete | Game tracks active pointers only on canvas events, with no explicit capture/lost-capture policy; outside release and modal transitions need coverage. | P17 |
| UI accessibility and feedback gaps | Canvas has no keyboard action alternative. Custom modals lack dialog semantics/focus containment. HUD uses innerHTML replacement; invalid trade/discard failures do not explain recovery. No reduced-motion support was found. | P17, P18 |
| Initial bundle includes authoring routes | `boot.ts` statically imports both labs. TypeScript config excludes scripts, and there is no repository CI workflow in the inspected tree. | P23 |

## Visual observations, not bug diagnoses

The current scene reads as bright contour water surrounding a relatively small board. Broad cyan and repeated near-continuous white rings compete with gameplay. Pasture has dense painted texture and microprops while adjacent tiles are plain; the mesa/trees overlap some token views. Tiny harbor abbreviations are hard to read at the default framing. The Style button overlaps part of the player-panel area in the inspected desktop layout. These are composition and readability decisions addressed in P14–P18, not evidence that adding bloom will fix the scene.

## Additional source-inspection candidates

- `makePastureRock` selects a tone with JavaScript remainder on an expression that can be negative; normalize indices before lookup and add asset-factory coverage (P07). This is an invalid palette lookup, not a verified crash.
- Several asset factories honor scale through different mechanisms; `createPropObject` currently compensates with `SCALE_VIA_OPTS`. Preserve this behavior during refactors and test dimensions; do not multiply scales twice (P07/P16).
- Switching from an unfinished fixed-scheme blend to `cycle` immediately resamples `phase`; this can jump in appearance. Include it in P11 transition tests.
- Full HUD/editor DOM replacement may disrupt focus; reproduce and preserve stable field identity rather than assuming every replacement currently loses focus in every browser (P18/P21).

## Reference conclusions and sources

Bruno's [shared material](https://github.com/brunosimon/folio-2025/blob/main/sources/Game/Materials/MeshDefaultMaterial.js) explicitly combines stylized lighting, shadow color, terrain bounce, fog, and water response. His [rendering system](https://github.com/brunosimon/folio-2025/blob/main/sources/Game/Rendering.js) uses a WebGPU/TSL pipeline and quality-dependent effects. His [water surface](https://github.com/brunosimon/folio-2025/blob/main/sources/Game/World/WaterSurface.js) includes terrain-data-driven detail and a blurred viewport sample; it is not a drop-in planar-reflection implementation for this game. Adopt coordinated ownership and art controls, not an assumed one-to-one shader port.

For the narrow rules corrections, use the official [base-game FAQ](https://www.catan.com/faq/basegame) and [rules/almanac](https://www.catan.com/sites/default/files/2021-07/catan-25th-rules_eng-200313.pdf): opponents' settlements interrupt routes, an eligible incumbent keeps a tied Longest Road, otherwise tied successors do not receive it, and victory occurs on the winning player's turn. Preserve this project's configured map-specific thresholds and MVP omissions.

## Not established by this audit

No claim is made that mobile performance meets a budget, every legal game state is covered, all GPU memory growth was measured, all accessibility criteria pass, or shader correctness was proven by screenshots. The validation tasks close those gaps. Do not describe intended weather particles, physical hover lift, city crossfade/morph, or a post-processing stack as existing features; current weather is palette/scalar changes and current upgrades use transforms.
