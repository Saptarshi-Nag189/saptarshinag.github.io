# THE LONG LIGHT — build notes

> One world. Many lands. One day's light.
> Wash ashore at dawn, travel out through six distinct lands, climb the spire in the last light,
> then glide home over every one of them under stars.

New flagship experience. `/wander/` and `/signal/` stay exactly as they are.

## Vendored engine

| File | Source | Licence |
|---|---|---|
| `lib/babylon.js` | npm `babylonjs@9.26.0` → its `main` (UMD, exposes `window.BABYLON`) | Apache-2.0 (`lib/BABYLON-LICENSE.md`) |

7.94 MB raw, **1.72 MB gzipped** (GitHub Pages serves gzip). No CDN at runtime, no build step —
the UMD file loads with a plain `<script>` tag, which is what preserves this repo's zero-build rule.

## Phase 0 — engine spike (PASSED)

`_spike.html` is a diagnostic page that exercises every at-risk feature at once. Run it with the
headless SwiftShader rig to re-verify the engine after any upgrade.

Result on the software-only test rig (no GPU), 1280×760:

| | |
|---|---|
| boot | **7.4 s** (software rasterizer; far faster on any real GPU) |
| context | **WebGL 2** |
| features | boot · webgl2 · custom GLSL sky · PBR · procedural `DynamicTexture` · blurred exponential shadow maps · 4 000 thin instances · particles (`GPUParticleSystem.IsSupported` = true) · `DefaultRenderingPipeline` · bloom · DOF · grain · ACES tonemapping · vignette · FXAA — **15 / 15 OK** |
| internal errors | none |

**Conclusion:** the full game-engine stack renders under software WebGL, so every step of this build
can be verified headlessly before it ships. Engine risk closed.

## The lesson the spike taught

The spike also demonstrated the failure mode to design against: **untextured PBR reads as grey
plastic.** In the screenshot the atmosphere (sky gradient, sun bloom, aerial fog, grain, vignette)
does all the work while the materials contribute nothing.

So the art direction is explicitly **stylised, not photoreal**:

- **Aerial-perspective fog** tinted from horizon-sun colour to zenith colour by view ray — the single
  highest charm-per-GPU-cycle effect available, and it costs almost nothing.
- **Toon ramp + Fresnel rim light tinted to the sky colour** on hero objects; soft-lit, low-roughness
  stylised materials everywhere else. No photoreal PBR, no IBL, no SSAO.
- **Opaque** grass blades (no alpha `discard`) so early-Z survives on tile-based mobile GPUs.
- Camera craft — critically damped spring on position *and* look-at, look target pushed ahead of
  travel, FOV widening on run, slight roll into turns — is the cheapest large gain in perceived
  production value.
- Text as **canvas-texture billboards** (no web-font dependency fetched at runtime).

## The Ledger — accessibility & escape hatch

`The Ledger` (every résumé fact, each attributed to its source project) is built as **real DOM, not
3D text**. It is simultaneously the SEO surface, the no-WebGL fallback, the screen-reader path, and
the fast exit for a time-pressed recruiter. It must be reachable from the first second.

## Carried over from `/wander/` (engine-independent, unchanged)

`twin-data.js` (content) · `brain/llm-brain.js` + `LocalBrain` (the `window.TwinBrain` contract) ·
`ambience.js` · `demos/_shared/sfx.js` (36 one-shots, 10 loop pairs) · the HUD CSS/DOM overlay.
The six `demo:` mini-game consoles are **dropped**; their prose loses its "play the console"
call-to-action sentences.

---

## Phase 1 — the vertical slice (done)

One seeded island you can walk, lit by a day that is a single number.

| file | what it is |
|---|---|
| `noise.js` | seeded mulberry32 + simplex; `fbm` / `ridged` / `billow` / `warp`. One seed always grows the same island. |
| `shaders.js` | the shared shading language. `skyColor()` feeds **both** the skybox and the aerial fog, so distant land melts exactly into the horizon. `toonLit()` = banded terminator + hemisphere ambient + sky-tinted rim. |
| `sky.js` | the day as data: eight keyframes, smoothstep-blended. `setSkyTime(t)` re-lights the whole world from one number. |
| `terrain.js` | one authoritative `heightAt(x,z)` — mesh, depth bake, prop placement and the character controller all sample it, so nothing can float or sink. Plus stylised water with a baked depth map, shoreline foam, sun road and glitter. |
| `flora.js` | grass, trees, rocks as thin instances. Grass is a dense disc that **follows the viewer**. |
| `traveller.js` | the robed figure, built in code. Vertex-shader gait, verlet cape on a fixed clock. |
| `camera.js` | the third-person spring rig and the character controller. |
| `ledger.js` | every résumé fact as real DOM — the no-WebGL fallback, the SEO surface, the screen-reader path. |
| `verify.mjs` | the headless check suite. Run it against `python3 -m http.server`. |

### Lessons worth keeping

Every one of these was found by rendering the thing headless and **actually
looking at the frames** — none of them showed up as an error:

1. **Triangle winding.** Babylon is left-handed; the reversed index order culled
   every front face, so only the island's *far* slopes were ever drawn. The
   near field simply did not exist and the result read as floating shards.
2. **Zero-centred noise drowns terrain.** Rolling fBm of amplitude ±12 riding on
   a 1.6 m base put 28% of the land under water — the island came up as
   scattered sandbars. Land has to *climb* away from the sea with the bumps
   riding on that climb.
3. **A world must end inside its own mesh.** Without a bounding coast the terrain
   ran off the edge of the grid and the border became visible against the sky.
4. **Fog: exponential in distance, not distance squared.** The squared form is
   invisible up close and then swallows everything past a few hundred metres. A
   height falloff on top means haze pools in the valleys and peaks rise clear.
5. **Rim light is not free.** It is added flat, independent of albedo; on a
   ground plane at a grazing angle the Fresnel term is ~1 everywhere, so at full
   strength it washes the entire landscape to the rim colour. Small objects want
   1.0, the ground wants a fraction.
6. **Headroom matters.** A fully lit surface should land near 1.2× albedo, not
   1.9×. Above that the tonemapper has nothing left to do and every sunlit slope
   desaturates toward white.
7. **Verlet needs a fixed timestep.** Integrated with the frame's `dt` the cape
   stretched into a 3 m streamer at 1 fps and would behave differently again at
   120. It runs on its own 1/60 clock with capped sub-stepping.
8. **Grass is proportion, not polygons.** The first pass had chest-high blades
   (2.7 m at the extreme) on a 1.75 m eye. Blades also *must* darken toward the
   root, or the field reads as green carpet rather than separate blades.

### Known, and deliberate

- Performance is **unmeasured**. Everything here is tested on SwiftShader
  software WebGL, which runs at 1–4 fps regardless of how cheap the scene is.
  Real frame rates need a real GPU to judge. Flora counts are tunable from the
  query string (`?grass=30000&trees=1500&rocks=500`) so tiers can scale them.
- The grass disc refills on a hop rather than amortising across frames. With a
  player moving at 7 m/s that is a refill every ~38 m; if it hitches on a real
  GPU, spread the refill over several frames or split it into tiles.

---

## Phase 2 — diversity, on a streaming world

Seven biomes placed by a climate, things somebody built, things that move, a
rideable boat — and underneath it all, a world that only generates what is
close enough to see.

| file | what it is |
|---|---|
| `chunks.js` | **the streaming world.** 64 m tiles, three residency rings, a per-frame build budget, a buffer pool, and an explicit disposal contract. |
| `biome.js` | climate as two fields (temperature, moisture) in a Whittaker layout. Seven biomes as blended **weights**, never hard ids. |
| `landmarks.js` | `findSite()` scans for ground that would suit a building. Temple, standing stones, torii, boat, lanterns, driftwood, ice shards. |
| `fauna.js` | deer that graze, wander and bolt; three flocks of birds. Legs and wings animate in the vertex shader. |
| `boat.js` | the verb that only works on water. |
| `weather.js` | fireflies, petals, blowing sand, falling snow — each tied to a biome and an hour. |
| `quality.js` | guess a tier from static hints, then measure and ratchet **down** only — plus a four-state control (auto / low / med / high) in the HUD, on **Q**, remembered across visits. |
| `verify-stream.mjs` | the determinism and memory proofs. |

### How streaming works, in one paragraph

`heightAt(x,z)` and `climateAt(x,z)` are pure functions of position, so a tile
can be generated, destroyed and regenerated byte-identical later. Every tile
seeds its RNG from `(seed, tileX, tileZ)` — without that the world reshuffles
as you walk. Tiles build as a state machine on a queue with a ~4 ms per-frame
budget, nearest first. Heights are computed **once** per tile and reused by the
mesh, the flora and the props. Thin instances belong to a mesh, so rather than
duplicating tree geometry per tile there is one mesh per species and each tile
owns a slice of matrices, repacked when the resident set changes. Typed arrays
are pooled, because tiles churn constantly and fresh allocations would cause
exactly the GC stutter streaming exists to prevent.

### Measured

Walking two full laps of the island: resident tiles stay **77–121**, meshes
**101–145**, **1387 tiles disposed**, the pool caps at **3.5 MB** with a **92%
recycle rate**, and the heap does not climb lap over lap. A tile generates, is
evicted, and regenerates with byte-identical instance buffers.

### Lessons, again all found by rendering and looking

1. **A coarse mesh under a fine one does not stay under it.** The far field was
   sunk 0.35 m and expected to behave. At 7.8 m per quad against the tiles' 1 m
   it cuts the corner across every ridge and punches through as hard-edged
   black wedges. It now has its own material with a distance discard and simply
   does not draw where tiles are.
2. **A third-person camera walks into trees the character never touches.**
   Inside a canopy the screen fills with flat facets and the character is gone.
   Tall foliage now collapses toward its base as the camera closes — collapsing
   rather than alpha-fading keeps it opaque, so no blending and no sorting.
3. **Lifting a camera over an obstacle is the wrong instinct.** Raising it to
   clear rising ground behind the traveller makes it climb the slope and stare
   down at his hood. Shortening the boom is what an operator would do.
4. **A local noise term can silently veto a biome.** The desert first came out
   at 2% in scattered patches because the damp-noise had too big a say in the
   moisture field and floored it everywhere.
5. **Not everything that looks wrong is wrong.** Props appeared to float over
   the dunes. Ray-casting onto the rendered ground says every one sits at
   exactly the −0.25 m it was placed at, and the tile surface matches
   `heightAt` to 3 mm. Billow dunes simply occlude what stands behind them.
   Measure before fixing.
