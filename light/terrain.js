/* ==========================================================================
   terrain.js — the island, grown from seeded noise.

   ONE authoritative height function, `heightAt(x, z)`, is shared by:
     · the terrain mesh
     · the character controller
     · every prop, tree and blade of grass that gets placed
   so nothing in the world can ever float or sink. Everything else here is
   colour: altitude x slope x moisture decide the ground's albedo, which the
   shared toon shader then lights.
   ========================================================================== */
import { makeNoise2D, fbm, ridged, clamp, lerp, smoothstep } from './noise.js';
import { createClimate, groundFromWeights, BIOME_ORDER } from './biome.js';

export const SEA_LEVEL = 0;

/* The slice built for Phase 1. The traveller starts on the beach and walks
   inland (+z) into the grove; the spire sits far off as a silhouette so the
   promise of the journey is visible from the first frame. */
export const WORLD = {
  seed: 20260914,
  halfExtent: 500,      // world spans -500..500 on x and z
  shoreZ: -300,         // mean shoreline; noise-warped into bays and headlands
  groveZ: 40,           // heart of the forest
  spireZ: 620,          // far beyond the slice — silhouette only
  startX: 20,           // where the traveller first stands
  startZ: -262,
  /* The inland water. Its level is derived from the untouched terrain at its
     centre (see createHeightField), so the basin is always carved to fit the
     land rather than the land being bent to fit a number. */
  lake: { x: 232, z: 54, r: 104 },
};

/**
 * Build the height field. Pure maths, no BABYLON — so it can be unit-tested
 * and reused by the placement code without touching the scene.
 */
export function createHeightField(seed) {
  seed = seed == null ? WORLD.seed : seed;
  const nBase = makeNoise2D(seed);
  const nWarp = makeNoise2D(seed + 7717);
  const nRock = makeNoise2D(seed + 3313);
  const nMoist = makeNoise2D(seed + 9091);
  const climate = createClimate(seed, WORLD);

  /** how far inland a point is, with a bay-and-headland coastline */
  function inlandOf(x, z) {
    const wobble =
      fbm(nWarp, x * 0.0026, z * 0.0026, 3) * 58 +   // broad bays
      fbm(nWarp, x * 0.011, z * 0.011, 2) * 13;      // smaller inlets
    // The south coast is the one the traveller lands on. The bounding coast
    // exists so the island ENDS inside its own mesh — without it the terrain
    // runs off the edge of the grid and the world's border becomes visible as
    // floating shards against the sky.
    const south = z - (WORLD.shoreZ + wobble);
    const bound = 465 - Math.max(Math.abs(x), Math.abs(z)) + wobble * 0.6;
    return Math.min(south, bound);
  }

  /** the land before the lake is cut into it */
  function baseHeight(x, z) {
    const inland = inlandOf(x, z);

    /* --- sea floor: shelves away from the beach ---------------------- */
    if (inland < 0) {
      const d = -inland;
      const shelf = -2.2 * smoothstep(0, 10, d)
                  - 7.0 * smoothstep(8, 70, d)
                  - 14.0 * smoothstep(60, 260, d);
      // gentle ripples in the sea bed keep the shallows from looking like glass
      return shelf + fbm(nBase, x * 0.02, z * 0.02, 2) * 0.35 * smoothstep(0, 40, d);
    }

    /* --- the land's spine -------------------------------------------
       The island has to CLIMB away from the sea, or the rolling noise —
       which is zero-centred — simply floods it. `base` is that climb; every
       bump below rides on top of it and is scaled so it can never sink the
       coast. Two stages: a quick rise off the beach, then a slower highland. */
    const beach    = smoothstep(0, 26, inland);       // 0 at waterline, 1 inland
    const rise     = smoothstep(6, 150, inland);      // dunes → grassland
    const highland = smoothstep(120, 340, inland);    // grassland → uplands

    const base = 1.5 * beach + 16 * rise + 26 * highland;

    /* --- rolling grassland -------------------------------------------
       Amplitude grows with the climb, so the shore stays a gentle apron
       while the interior gets real relief. */
    const rollAmp = 1.6 + 7.0 * rise;
    let rolling =
      fbm(nBase, x * 0.0055, z * 0.0055, 5) * rollAmp +
      fbm(nBase, x * 0.019, z * 0.019, 3) * 1.9 * beach;

    /* --- and where the land is sand, it is dunes instead --------------
       Billow noise gives rounded crests and sharp troughs, which is what a
       dune sea looks like; fBm gives the opposite and reads as hills. */
    const dune = climate.duneAt(x, z);
    if (dune > 0.002) rolling = lerp(rolling, climate.duneHeight(x, z) * rise, dune);

    /* --- rocky outcrops, sharpened by a ridged fractal ---------------- */
    const rockMask = smoothstep(0.50, 0.88, fbm(nRock, x * 0.004, z * 0.004, 3) * 0.5 + 0.5);
    const rock = ridged(nRock, x * 0.009, z * 0.009, 4) * 26 * rockMask * rise * (1 - dune);

    /* --- the far massif that becomes the spire ------------------------
       Mostly beyond the Phase-1 slice: what matters here is that its
       silhouette is visible from the shore, so the journey has a promise. */
    const toSpire = clamp((inland - 250) / 130, 0, 1);
    const massif = smoothstep(0, 1, toSpire) * (40 + ridged(nRock, x * 0.0032, z * 0.0032, 4) * 72);

    let h = base + rolling + rock + massif;

    /* a shallow tidal flat right at the waterline reads as wet sand */
    h = lerp(-0.25, h, smoothstep(0, 10, inland));

    return h;
  }

  /* The lake's level is read from the untouched land at its centre, once, so
     the basin always fits the terrain it sits in. */
  const LK = WORLD.lake;
  const lakeLevel = LK ? baseHeight(LK.x, LK.z) - 1.5 : 0;

  /** distance from the lake centre, in lake radii (Infinity if there is none) */
  function lakeT(x, z) {
    if (!LK) return Infinity;
    return Math.hypot(x - LK.x, z - LK.z) / LK.r;
  }

  function heightAt(x, z) {
    const h = baseHeight(x, z);
    if (!LK) return h;

    const t = lakeT(x, z);
    if (t > 1.45) return h;

    // a bowl that is deepest at the centre and meets the land at the rim
    const w = 1 - smoothstep(0.90, 1.45, t);
    const floor = lakeLevel - 13 * Math.max(0, 1 - t * t) - 0.8;
    return lerp(h, floor, w);
  }

  /** surface normal by central difference — used for slope-aware colouring */
  function normalAt(x, z, eps) {
    eps = eps || 1.2;
    const hL = heightAt(x - eps, z), hR = heightAt(x + eps, z);
    const hD = heightAt(x, z - eps), hU = heightAt(x, z + eps);
    let nx = hL - hR, ny = 2 * eps, nz = hD - hU;
    const len = Math.hypot(nx, ny, nz) || 1;
    return [nx / len, ny / len, nz / len];
  }

  /** 0..1 dampness — drives grass lushness and colour */
  function moistureAt(x, z) {
    const m = fbm(nMoist, x * 0.0045, z * 0.0045, 4) * 0.5 + 0.5;
    const h = heightAt(x, z);
    // low ground holds water; high ground dries out
    return clamp(m * 1.15 - smoothstep(14, 90, h) * 0.55, 0, 1);
  }

  /** everything a placement rule needs to know about a point, in one call */
  function at(x, z) {
    const h = heightAt(x, z);
    const inland = inlandOf(x, z);
    const n = normalAt(x, z, 1.6);
    const w = climate.climateAt(x, z, h, inland, moistureAt(x, z));
    return { h, inland, slope: 1 - clamp(n[1], 0, 1), n, w, biome: climate.dominant(w) };
  }

  return {
    heightAt, baseHeight, normalAt, moistureAt, inlandOf, at,
    climate, lakeLevel, lakeT, lake: LK, seed,
  };
}

/* ==========================================================================
   Ground colour — the art direction lives here.
   Sand, wet sand, grass (lush → dry), rock and a little lichen, chosen by
   altitude x slope x moisture. Flat, slightly desaturated colours that the
   toon shader can light; no textures, no PBR.
   ========================================================================== */
const PAL = {
  wetSand:  [0.60, 0.52, 0.42],
  drySand:  [0.80, 0.72, 0.56],
  grassLush:[0.23, 0.41, 0.19],
  grassDry: [0.45, 0.48, 0.26],
  rock:     [0.42, 0.40, 0.42],
  rockLit:  [0.56, 0.54, 0.53],
  lichen:   [0.38, 0.47, 0.35],
};
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export function groundColor(w, h, slope, moist, jitter, drift) {
  // the biome blend does most of the work
  let col = groundFromWeights(w, drift);

  // wet sand at the waterline, whatever biome runs down to it
  const wet = 1 - smoothstep(-0.4, 1.3, h);
  if (wet > 0.001) col = mix3(col, PAL.wetSand, wet * 0.85);

  // steep ground is bare rock in every climate — soil does not cling to a cliff
  const rocky = smoothstep(0.44, 0.74, slope);
  if (rocky > 0.001) {
    const rockCol = mix3(PAL.rock, PAL.rockLit, clamp(h / 90, 0, 1));
    col = mix3(col, rockCol, rocky * (1 - w.snow * 0.55));
    // a little lichen softens the rock line where it is damp
    col = mix3(col, PAL.lichen, rocky * (1 - rocky) * 1.6 * moist * (1 - w.desert - w.snow));
  }

  // per-vertex jitter stops large areas reading as flat paint
  const j = 1 + (jitter - 0.5) * 0.085;
  return [clamp(col[0] * j, 0, 1), clamp(col[1] * j, 0, 1), clamp(col[2] * j, 0, 1)];
}

/* ==========================================================================
   The mesh
   ========================================================================== */
/* One ground material, shared by every terrain tile and by the far field.
   Cached because each ShaderMaterial is a separate compile, and a streaming
   world creates and destroys terrain meshes constantly — they must not each
   drag a shader behind them. */
let groundMat = null;
let farMat = null;

/**
 * The far field gets its own material rather than sharing the tiles'.
 *
 * It has to, because it needs a discard the tiles must not have. At 7.8 m per
 * quad against the tiles' 1 m, a coarse mesh cuts the corner across every
 * ridge and pokes through the fine surface — sinking it a little was never
 * going to be enough. Instead it simply does not draw inside the radius where
 * tiles exist, so the two can never fight over a pixel.
 */
export function makeFarMaterial(BABYLON, scene, shaders) {
  if (farMat) return farMat;
  makeGroundMaterial(BABYLON, scene, shaders);      // registers the shared source

  BABYLON.Effect.ShadersStore['farVertexShader'] = BABYLON.Effect.ShadersStore['groundVertexShader'];
  BABYLON.Effect.ShadersStore['farFragmentShader'] = /* glsl */`
    precision highp float;
    varying vec3 vWorld; varying vec3 vNormal; varying vec3 vColor;
    uniform float uNearCut;        // tiles own everything inside this radius
    ${shaders.FRAG_PRELUDE}
    void main(){
      vec2 d = vWorld.xz - uCamPos.xz;
      if (dot(d, d) < uNearCut * uNearCut) discard;

      if (uDebug > 0.5) { gl_FragColor = vec4(vColor, 1.0); return; }
      vec3 N = normalize(vNormal);
      vec3 V = normalize(uCamPos - vWorld);
      vec3 col = toonLit(vColor, N, V, 0.30, 0.10, 0.14);
      col = applyAerial(col, vWorld);
      gl_FragColor = vec4(col, 1.0);
    }`;

  farMat = new BABYLON.ShaderMaterial('farMat', scene,
    { vertex: 'far', fragment: 'far' },
    shaders.shaderOptions(['color'], ['uNearCut']));
  farMat.backFaceCulling = true;
  farMat.setFloat('uNearCut', 200);
  return farMat;
}

export function makeGroundMaterial(BABYLON, scene, shaders) {
  if (groundMat) return groundMat;

  BABYLON.Effect.ShadersStore['groundVertexShader'] = /* glsl */`
    precision highp float;
    attribute vec3 position; attribute vec3 normal; attribute vec4 color;
    uniform mat4 world; uniform mat4 worldViewProjection;
    varying vec3 vWorld; varying vec3 vNormal; varying vec3 vColor;
    void main(){
      vec4 wp = world * vec4(position, 1.0);
      vWorld = wp.xyz;
      vNormal = normalize(mat3(world) * normal);
      vColor = color.rgb;
      gl_Position = worldViewProjection * vec4(position, 1.0);
    }`;

  BABYLON.Effect.ShadersStore['groundFragmentShader'] = /* glsl */`
    precision highp float;
    varying vec3 vWorld; varying vec3 vNormal; varying vec3 vColor;
    ${shaders.FRAG_PRELUDE}
    void main(){
      if (uDebug > 0.5) { gl_FragColor = vec4(vColor, 1.0); return; }
      vec3 N = normalize(vNormal);
      vec3 V = normalize(uCamPos - vWorld);

      vec3 col = toonLit(vColor, N, V, 0.30, 0.10, 0.14);

      // a damp sheen where the beach meets the sea
      float wet = 1.0 - smoothstep(-0.3, 1.4, vWorld.y);
      if (wet > 0.001) {
        vec3 H = normalize(uSunDir + V);
        float spec = pow(max(dot(N, H), 0.0), 60.0);
        col = mix(col, col * 0.72, wet * 0.55);
        col += uSunCol * spec * wet * 0.55;
      }

      col = applyAerial(col, vWorld);
      gl_FragColor = vec4(col, 1.0);
    }`;

  groundMat = new BABYLON.ShaderMaterial('groundMat', scene,
    { vertex: 'ground', fragment: 'ground' },
    shaders.shaderOptions(['color'], []));
  groundMat.backFaceCulling = true;
  return groundMat;
}

/* ==========================================================================
   Ground geometry

   sampleGround() is the one routine that turns a patch of the height field
   into vertex data. Tiles, the far field and the legacy whole-island mesh all
   go through it, so they can never disagree about what the ground looks like.

   Heights are cached into a grid WITH a one-cell apron, and normals come from
   finite differences on that cache rather than from four fresh heightAt calls
   per vertex. That is a 5x saving on the dominant cost of building a tile, and
   the apron is what keeps the normals correct right up to the tile's edge.
   ========================================================================== */

export function sampleGround(field, o) {
  const { x0, z0, size, seg } = o;
  const step = size / seg;
  const N = seg + 1;
  const NA = seg + 3;                    // apron: one extra cell each side

  const rngJit = o.jitter || makeNoise2D(field.seed + 555);
  const rngDrift = o.drift || makeNoise2D(field.seed + 991);
  const take = o.pool ? (n) => o.pool.take(n) : (n) => new Float32Array(n);

  // --- heights, with the apron -------------------------------------------
  const H = take(NA * NA);
  for (let j = 0; j < NA; j++) {
    const z = z0 + (j - 1) * step;
    for (let i = 0; i < NA; i++) {
      H[j * NA + i] = field.heightAt(x0 + (i - 1) * step, z);
    }
  }

  const positions = take(N * N * 3);
  const normals = take(N * N * 3);
  const colors = take(N * N * 4);
  const uvs = take(N * N * 2);

  const inv = 1 / (2 * step);
  for (let j = 0; j < N; j++) {
    const z = z0 + j * step;
    for (let i = 0; i < N; i++) {
      const x = x0 + i * step;
      const a = (j + 1) * NA + (i + 1);
      const y = H[a];
      const k3 = (j * N + i) * 3;
      positions[k3] = x; positions[k3 + 1] = y; positions[k3 + 2] = z;

      // central differences on the cached grid
      let nx = (H[a - 1] - H[a + 1]) * inv;
      let ny = 1;
      let nz = (H[a - NA] - H[a + NA]) * inv;
      const L = Math.hypot(nx, ny, nz) || 1;
      nx /= L; ny /= L; nz /= L;
      normals[k3] = nx; normals[k3 + 1] = ny; normals[k3 + 2] = nz;

      const slope = 1 - clamp(ny, 0, 1);
      const moist = field.moistureAt(x, z);
      const w = field.climate.climateAt(x, z, y, field.inlandOf(x, z), moist);
      const jit = rngJit(x * 0.35, z * 0.35) * 0.5 + 0.5;
      const drift = rngDrift(x * 0.006, z * 0.006) * 0.5 + 0.5;
      const c = groundColor(w, y, slope, moist, jit, drift);

      const k4 = (j * N + i) * 4;
      colors[k4] = c[0]; colors[k4 + 1] = c[1]; colors[k4 + 2] = c[2]; colors[k4 + 3] = 1;
      if (o.onVertex) o.onVertex(x, z, y, w, c, k4, colors);

      const k2 = (j * N + i) * 2;
      uvs[k2] = i / seg; uvs[k2 + 1] = j / seg;
    }
  }

  return { positions, normals, colors, uvs, heights: H, N, NA, step };
}

/** Indices for an N x N vertex grid. Winding matters — see the note below. */
export function gridIndices(seg) {
  const N = seg + 1;
  const idx = new Uint32Array(seg * seg * 6);
  let k = 0;
  for (let j = 0; j < seg; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
      // Babylon is left-handed, and the reverse order here culled every front
      // face — leaving only the island's far slopes visible.
      idx[k++] = a; idx[k++] = b; idx[k++] = c;
      idx[k++] = b; idx[k++] = d; idx[k++] = c;
    }
  }
  return idx;
}

export function buildTerrain(BABYLON, scene, field, shaders, opts) {
  opts = opts || {};
  const half = opts.halfExtent || WORLD.halfExtent;
  const seg = opts.segments || 240;              // 240x240 quads
  const step = (half * 2) / seg;

  const positions = [], normals = [], colors = [], uvs = [], indices = [];
  const rngJit = makeNoise2D(field.seed + 555);
  const rngDrift = makeNoise2D(field.seed + 991);

  for (let j = 0; j <= seg; j++) {
    for (let i = 0; i <= seg; i++) {
      const x = -half + i * step;
      const z = -half + j * step;
      const y = field.heightAt(x, z);
      positions.push(x, y, z);

      const n = field.normalAt(x, z, step * 0.85);
      normals.push(n[0], n[1], n[2]);

      const slope = 1 - clamp(n[1], 0, 1);
      const moist = field.moistureAt(x, z);
      const jit = rngJit(x * 0.35, z * 0.35) * 0.5 + 0.5;
      const w = field.climate.climateAt(x, z, y, field.inlandOf(x, z), moist);
      const drift = rngDrift(x * 0.006, z * 0.006) * 0.5 + 0.5;
      const c = groundColor(w, y, slope, moist, jit, drift);
      colors.push(c[0], c[1], c[2], 1);

      uvs.push(i / seg, j / seg);
    }
  }
  for (let j = 0; j < seg; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i;
      const b = a + 1, c = a + seg + 1, d = c + 1;
      // winding matters: Babylon is left-handed, and the reverse order here
      // culled every front face — leaving only the island's far slopes visible
      indices.push(a, b, c, b, d, c);
    }
  }

  const mesh = new BABYLON.Mesh('terrain', scene);
  const vd = new BABYLON.VertexData();
  vd.positions = positions; vd.indices = indices;
  vd.normals = normals; vd.colors = colors; vd.uvs = uvs;
  vd.applyToMesh(mesh, false);
  mesh.isPickable = false;
  mesh.freezeWorldMatrix();

  const mat = makeGroundMaterial(BABYLON, scene, shaders);
  mesh.material = mat;

  return { mesh, mat };
}

/* ==========================================================================
   One streamed tile
   ========================================================================== */

/**
 * Build the ground for one tile. Returns the mesh and the height cache, so the
 * caller can place flora against heights that have already been paid for.
 *
 * `skirt` hangs a short apron around the edge. Neighbouring tiles at different
 * resolutions do not share edge vertices, so without it you see slivers of sky
 * through the seams; with it, the gap is filled by geometry that is the right
 * colour and is hidden by the aerial fog anyway.
 */
export function buildTerrainTile(BABYLON, scene, field, mat, o) {
  const { x0, z0, size, seg } = o;
  const g = sampleGround(field, o);
  const N = g.N;
  const skirt = o.skirt == null ? 2.5 : o.skirt;

  let positions = g.positions, normals = g.normals, colors = g.colors, uvs = g.uvs;
  let indices = gridIndices(seg);

  if (skirt > 0) {
    // one extra vertex hanging below each edge vertex, sewn to it
    const edges = [];
    for (let i = 0; i < N; i++) edges.push(i);                       // z0 edge
    for (let i = 0; i < N; i++) edges.push((N - 1) * N + i);         // z1 edge
    for (let j = 0; j < N; j++) edges.push(j * N);                   // x0 edge
    for (let j = 0; j < N; j++) edges.push(j * N + (N - 1));         // x1 edge

    const extra = edges.length;
    const P = new Float32Array((N * N + extra) * 3);
    const NM = new Float32Array((N * N + extra) * 3);
    const C = new Float32Array((N * N + extra) * 4);
    const U = new Float32Array((N * N + extra) * 2);
    P.set(positions); NM.set(normals); C.set(colors); U.set(uvs);

    const skirtIdx = new Uint32Array(indices.length + (extra - 4) * 6);
    skirtIdx.set(indices);
    let k = indices.length;

    for (let e = 0; e < extra; e++) {
      const src = edges[e];
      const dst = N * N + e;
      P[dst * 3] = positions[src * 3];
      P[dst * 3 + 1] = positions[src * 3 + 1] - skirt;
      P[dst * 3 + 2] = positions[src * 3 + 2];
      NM[dst * 3] = normals[src * 3]; NM[dst * 3 + 1] = normals[src * 3 + 1]; NM[dst * 3 + 2] = normals[src * 3 + 2];
      C[dst * 4] = colors[src * 4]; C[dst * 4 + 1] = colors[src * 4 + 1];
      C[dst * 4 + 2] = colors[src * 4 + 2]; C[dst * 4 + 3] = 1;
      U[dst * 2] = uvs[src * 2]; U[dst * 2 + 1] = uvs[src * 2 + 1];
    }
    // stitch each run of N edge vertices into a strip; the four runs are
    // wound in opposite pairs so every skirt faces outward
    for (let run = 0; run < 4; run++) {
      const base = run * N;
      const flip = (run === 1 || run === 2);
      for (let i = 0; i < N - 1; i++) {
        const a = edges[base + i], b = edges[base + i + 1];
        const c = N * N + base + i, d = N * N + base + i + 1;
        if (flip) { skirtIdx[k++] = a; skirtIdx[k++] = b; skirtIdx[k++] = c;
                    skirtIdx[k++] = b; skirtIdx[k++] = d; skirtIdx[k++] = c; }
        else      { skirtIdx[k++] = a; skirtIdx[k++] = c; skirtIdx[k++] = b;
                    skirtIdx[k++] = b; skirtIdx[k++] = c; skirtIdx[k++] = d; }
      }
    }
    // the pooled grid arrays are done with; the skirted copies replace them
    if (o.pool) { o.pool.give(positions); o.pool.give(normals); o.pool.give(colors); o.pool.give(uvs); }
    positions = P; normals = NM; colors = C; uvs = U; indices = skirtIdx;
  }

  const mesh = new BABYLON.Mesh(o.name || `tile_${x0}_${z0}`, scene);
  const vd = new BABYLON.VertexData();
  vd.positions = positions; vd.indices = indices;
  vd.normals = normals; vd.colors = colors; vd.uvs = uvs;
  vd.applyToMesh(mesh, false);
  mesh.material = mat;
  mesh.isPickable = false;
  mesh.freezeWorldMatrix();
  mesh.doNotSyncBoundingInfo = true;

  // The mesh owns GPU copies now. Hand the CPU-side grid arrays back, but keep
  // the height cache — the caller still needs it to place what grows here.
  if (o.pool && skirt <= 0) {
    o.pool.give(positions); o.pool.give(normals); o.pool.give(colors); o.pool.give(uvs);
  }

  return { mesh, heights: g.heights, NA: g.NA, step: g.step };
}

/* ==========================================================================
   The far field

   A residency ring alone would end the island at ~320m, which breaks the whole
   promise of the summit — that from up there you can see everything. So one
   coarse mesh covers the entire island, always resident, and the streamed
   tiles draw over it.

   It sits slightly BELOW true ground so the detailed tiles always win where
   they overlap. At the distance the far field is actually seen, the drop is
   invisible; up close it is covered.
   ========================================================================== */

export function buildFarField(BABYLON, scene, field, mat, opts) {
  opts = opts || {};
  const half = opts.halfExtent || WORLD.halfExtent;
  const seg = opts.segments || 128;
  const drop = opts.drop == null ? 0.35 : opts.drop;

  const g = sampleGround(field, {
    x0: -half, z0: -half, size: half * 2, seg,
    // Distant woodland with no trees drawn at all: where the climate says
    // forest, pull the ground toward the canopy colour. Cheaper than any
    // impostor, and it is the difference between distant forest and bare hill.
    onVertex: (x, z, y, w, c, k4, colors) => {
      const f = clamp(w.forest * 1.25, 0, 1);
      if (f > 0.002) {
        colors[k4] = lerp(c[0], 0.20, f);
        colors[k4 + 1] = lerp(c[1], 0.32, f);
        colors[k4 + 2] = lerp(c[2], 0.18, f);
      }
      const p = clamp(w.snow * 0.9, 0, 1);
      if (p > 0.002) {
        colors[k4] = lerp(colors[k4], 0.88, p);
        colors[k4 + 1] = lerp(colors[k4 + 1], 0.91, p);
        colors[k4 + 2] = lerp(colors[k4 + 2], 0.96, p);
      }
    },
  });

  for (let i = 1; i < g.positions.length; i += 3) g.positions[i] -= drop;

  const mesh = new BABYLON.Mesh('farField', scene);
  const vd = new BABYLON.VertexData();
  vd.positions = g.positions; vd.indices = gridIndices(seg);
  vd.normals = g.normals; vd.colors = g.colors; vd.uvs = g.uvs;
  vd.applyToMesh(mesh, false);
  mesh.material = mat;
  mesh.isPickable = false;
  mesh.freezeWorldMatrix();
  mesh.alwaysSelectAsActiveMesh = true;

  return { mesh, mat };
}

/* ==========================================================================
   Stylised water — fresnel to the real sky colour, depth tint, sun glitter,
   foam at the shoreline. No planar reflection (that costs a second full scene
   render); the fresnel-to-skyColor trick reads as reflection for far less.
   ========================================================================== */
export function buildWaterBody(BABYLON, scene, field, shaders, opts) {
  opts = opts || {};
  const level = opts.level == null ? SEA_LEVEL : opts.level;
  const cx = opts.cx || 0, cz = opts.cz || 0;
  const span = opts.span || WORLD.halfExtent;          // half-extent of the depth bake
  const DMAX = opts.maxDepth || 30;
  const outside = opts.outsideDepth == null ? DMAX : opts.outsideDepth;

  /* ---- depth map ---------------------------------------------------------
     A water body is a flat surface, so the shader has no idea how deep the
     water is under any given pixel — which is why a naive version paints the
     whole thing one colour. Bake the terrain's height into a texture once and
     the water gets true depth tinting AND a shoreline foam band for free. */
  const DRES = opts.depthRes || 384;
  const depthTex = new BABYLON.DynamicTexture(opts.name + 'Depth',
    { width: DRES, height: DRES }, scene, false, BABYLON.Texture.BILINEAR_SAMPLINGMODE);
  depthTex.wrapU = depthTex.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
  {
    const ctx = depthTex.getContext();
    const img = ctx.createImageData(DRES, DRES);
    const d = img.data;
    for (let j = 0; j < DRES; j++) {
      const z = cz - span + (2 * span) * (j / (DRES - 1));
      for (let i2 = 0; i2 < DRES; i2++) {
        const x = cx - span + (2 * span) * (i2 / (DRES - 1));
        const depth = Math.max(0, level - field.heightAt(x, z));
        const v = Math.round(255 * clamp(depth / DMAX, 0, 1));
        const o = (j * DRES + i2) * 4;
        d[o] = v; d[o + 1] = v; d[o + 2] = v; d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    depthTex.update(false);
  }

  BABYLON.Effect.ShadersStore['seaVertexShader'] = /* glsl */`
    precision highp float;
    attribute vec3 position; attribute vec2 uv;
    uniform mat4 world; uniform mat4 worldViewProjection; uniform float uTime;
    varying vec3 vWorld; varying vec2 vUV;
    void main(){
      vec3 p = position;
      // two crossing swells so the surface never looks like a repeating sheet
      p.y += sin(p.x * 0.035 + uTime * 0.85) * 0.16
           + sin(p.z * 0.028 - uTime * 0.62) * 0.13;
      vec4 wp = world * vec4(p, 1.0);
      vWorld = wp.xyz; vUV = uv;
      gl_Position = worldViewProjection * vec4(p, 1.0);
    }`;

  BABYLON.Effect.ShadersStore['seaFragmentShader'] = /* glsl */`
    precision highp float;
    varying vec3 vWorld; varying vec2 vUV;
    uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uFoam;
    uniform sampler2D uDepthMap;
    uniform vec4 uDepthSpan;      // xy = bake centre, z = half extent, w = max depth
    uniform vec2 uWaveMix;        // x = ripple scale, y = depth outside the bake
    ${shaders.FRAG_PRELUDE}

    /* Five directional waves whose directions step by the golden angle and
       whose frequencies are incommensurate — three coherent sines produce the
       corrugated-iron stripes this replaced. fade flattens the surface with
       distance: distant water really is a smooth sheet, and it is also the
       only way to stop the ripple aliasing into moire at the horizon. */
    vec3 rippleNormal(vec2 p, float t, float fade){
      vec2 dsum = vec2(0.0);
      float a = 1.0, f = 0.42, ang = 0.7;
      for (int i = 0; i < 5; i++){
        vec2 d = vec2(cos(ang), sin(ang));
        float ph = dot(p, d) * f + t * (1.1 + float(i) * 0.37);
        dsum += cos(ph) * f * a * d;
        a *= 0.52; f *= 1.93; ang += 2.399;
      }
      return normalize(vec3(-dsum.x * 0.09 * fade, 1.0, -dsum.y * 0.09 * fade));
    }

    void main(){
      vec3  toCam = uCamPos - vWorld;
      float dist  = length(toCam);
      vec3  V     = toCam / max(dist, 1e-4);

      float fade = exp(-dist * 0.008);
      vec3  N    = rippleNormal(vWorld.xz * uWaveMix.x, uTime, fade);

      /* depth under this pixel, in metres */
      vec2  duv  = (vWorld.xz - uDepthSpan.xy + uDepthSpan.z) / (2.0 * uDepthSpan.z);
      float edge = step(0.0, duv.x) * step(duv.x, 1.0) * step(0.0, duv.y) * step(duv.y, 1.0);
      float depth = mix(uWaveMix.y, texture2D(uDepthMap, duv).r * uDepthSpan.w, edge);

      // fresnel: glancing angles mirror the sky, steep angles show the depths
      float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.4);
      vec3  refl = skyColor(normalize(reflect(-V, N)));

      vec3 body = mix(uShallow, uDeep, smoothstep(0.4, 14.0, depth));
      body *= (uAmbCol + uSunCol * 0.45);

      vec3 col = mix(body, refl, clamp(fres * 1.1, 0.0, 0.92));

      // the sun's road — broad, and survives to the horizon where glitter can't
      vec3 Hf = normalize(uSunDir + V);
      col += uSunCol * pow(max(Hf.y, 0.0), 42.0) * 0.55;

      // sharp glitter, only where the ripple is still resolved
      col += uSunCol * pow(max(dot(N, Hf), 0.0), 220.0) * 2.4 * fade;

      /* foam where the water runs out — the single detail that most sells a
         shoreline. Driven by a slow wave so the line breathes. */
      float surge = 0.70 + 0.30 * sin(dot(vWorld.xz, vec2(0.62, 0.78)) * 0.95 - uTime * 1.35);
      float foam  = smoothstep(1.3, 0.10, depth) * surge;
      foam += smoothstep(0.35, 0.0, depth) * 0.45;      // a constant lace at the very edge
      col = mix(col, uFoam * (uAmbCol + uSunCol * 0.8), clamp(foam, 0.0, 0.92));

      col = applyAerial(col, vWorld);
      gl_FragColor = vec4(col, 1.0);
    }`;

  const mat = new BABYLON.ShaderMaterial(opts.name + 'Mat', scene,
    { vertex: 'sea', fragment: 'sea' },
    shaders.shaderOptions([], ['uShallow', 'uDeep', 'uFoam', 'uDepthSpan', 'uWaveMix', 'uDepthMap'], []));
  mat.setColor3('uShallow', new BABYLON.Color3(...(opts.shallow || [0.26, 0.58, 0.58])));
  mat.setColor3('uDeep', new BABYLON.Color3(...(opts.deep || [0.04, 0.13, 0.26])));
  mat.setColor3('uFoam', new BABYLON.Color3(0.95, 0.97, 1.0));
  mat.setVector4('uDepthSpan', new BABYLON.Vector4(cx, cz, span, DMAX));
  mat.setVector2('uWaveMix', new BABYLON.Vector2(opts.rippleScale || 1, outside));
  mat.setTexture('uDepthMap', depthTex);
  mat.backFaceCulling = false;

  let mesh;
  if (opts.radius) {
    mesh = BABYLON.MeshBuilder.CreateDisc(opts.name,
      { radius: opts.radius, tessellation: 96 }, scene);
    // A disc is born facing +z. The rotation MUST be baked: the vertex shader
    // displaces p.y in local space, so with an unbaked rotation the swell
    // pushes the lake sideways instead of up — and a disc lies in local XY, so
    // p.z would be zero everywhere and the second sine a constant.
    mesh.rotation.x = Math.PI / 2;
    mesh.bakeCurrentTransformIntoVertices();
  } else {
    const half = opts.halfExtent || WORLD.halfExtent * 2.4;
    mesh = BABYLON.MeshBuilder.CreateGround(opts.name,
      { width: half * 2, height: half * 2, subdivisions: 96 }, scene);
  }
  mesh.position.set(cx, level, cz);
  mesh.material = mat;
  mesh.isPickable = false;

  return { mesh, mat, depthTex, level };
}

/** The sea. */
export function buildWater(BABYLON, scene, field, shaders, opts) {
  return buildWaterBody(BABYLON, scene, field, shaders, Object.assign({
    name: 'sea', level: SEA_LEVEL, span: WORLD.halfExtent, maxDepth: 30,
  }, opts || {}));
}

/** The inland lake — smaller waves, greener water, and it ends at its bank. */
export function buildLake(BABYLON, scene, field, shaders) {
  if (!field.lake) return null;
  return buildWaterBody(BABYLON, scene, field, shaders, {
    name: 'lake',
    level: field.lakeLevel,
    cx: field.lake.x, cz: field.lake.z,
    radius: field.lake.r * 1.02,
    span: field.lake.r * 1.3,
    maxDepth: 16,
    outsideDepth: 0.2,          // beyond the bake is the bank, so: foam
    depthRes: 256,
    rippleScale: 2.1,           // a lake's chop is tighter than the sea's
    shallow: [0.30, 0.54, 0.44],
    deep: [0.05, 0.16, 0.19],
  });
}
