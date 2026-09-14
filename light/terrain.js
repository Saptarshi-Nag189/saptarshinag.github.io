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

  function heightAt(x, z) {
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
    const rolling =
      fbm(nBase, x * 0.0055, z * 0.0055, 5) * rollAmp +
      fbm(nBase, x * 0.019, z * 0.019, 3) * 1.9 * beach;

    /* --- rocky outcrops, sharpened by a ridged fractal ---------------- */
    const rockMask = smoothstep(0.50, 0.88, fbm(nRock, x * 0.004, z * 0.004, 3) * 0.5 + 0.5);
    const rock = ridged(nRock, x * 0.009, z * 0.009, 4) * 26 * rockMask * rise;

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

  return { heightAt, normalAt, moistureAt, inlandOf, seed };
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

export function groundColor(h, slope, moist, jitter) {
  // slope: 0 = flat, 1 = vertical
  const sandy = 1 - smoothstep(0.6, 3.4, h);            // near the waterline
  const wet   = 1 - smoothstep(-0.4, 1.2, h);

  let col = mix3(PAL.grassDry, PAL.grassLush, moist);
  col = mix3(col, PAL.drySand, sandy);
  col = mix3(col, PAL.wetSand, wet * 0.85);

  // steep ground turns to rock regardless of height
  const rocky = smoothstep(0.42, 0.72, slope);
  const rockCol = mix3(PAL.rock, PAL.rockLit, clamp(h / 60, 0, 1));
  col = mix3(col, rockCol, rocky);
  // a little lichen softens the rock line
  col = mix3(col, PAL.lichen, rocky * (1 - rocky) * 1.6 * moist);

  // per-vertex jitter stops large areas reading as flat paint
  const j = 1 + (jitter - 0.5) * 0.09;
  return [clamp(col[0] * j, 0, 1), clamp(col[1] * j, 0, 1), clamp(col[2] * j, 0, 1)];
}

/* ==========================================================================
   The mesh
   ========================================================================== */
export function buildTerrain(BABYLON, scene, field, shaders, opts) {
  opts = opts || {};
  const half = opts.halfExtent || WORLD.halfExtent;
  const seg = opts.segments || 240;              // 240x240 quads
  const step = (half * 2) / seg;

  const positions = [], normals = [], colors = [], uvs = [], indices = [];
  const rngJit = makeNoise2D(field.seed + 555);

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
      const c = groundColor(y, slope, moist, jit);
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

  /* ---- the ground shader ---- */
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

  const mat = new BABYLON.ShaderMaterial('groundMat', scene,
    { vertex: 'ground', fragment: 'ground' },
    shaders.shaderOptions(['color'], []));
  mat.backFaceCulling = true;
  mesh.material = mat;

  return { mesh, mat };
}

/* ==========================================================================
   Stylised water — fresnel to the real sky colour, depth tint, sun glitter,
   foam at the shoreline. No planar reflection (that costs a second full scene
   render); the fresnel-to-skyColor trick reads as reflection for far less.
   ========================================================================== */
export function buildWater(BABYLON, scene, field, shaders, opts) {
  opts = opts || {};
  const half = opts.halfExtent || WORLD.halfExtent * 2.4;

  /* ---- depth map ---------------------------------------------------------
     The sea is a flat plane, so the shader has no idea how deep the water is
     under any given pixel — which is why a naive version paints the whole
     ocean one colour. Bake the terrain's height into a texture once and the
     water gets true depth tinting AND a shoreline foam band for free. */
  const DRES = opts.depthRes || 512;
  const DSPAN = WORLD.halfExtent;          // baked over the terrain's extent
  const DMAX = 30;                         // metres encoded into 0..255
  const depthTex = new BABYLON.DynamicTexture('seaDepth',
    { width: DRES, height: DRES }, scene, false, BABYLON.Texture.BILINEAR_SAMPLINGMODE);
  depthTex.wrapU = depthTex.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
  {
    const ctx = depthTex.getContext();
    const img = ctx.createImageData(DRES, DRES);
    const d = img.data;
    for (let j = 0; j < DRES; j++) {
      const z = -DSPAN + (2 * DSPAN) * (j / (DRES - 1));
      for (let i = 0; i < DRES; i++) {
        const x = -DSPAN + (2 * DSPAN) * (i / (DRES - 1));
        const depth = Math.max(0, SEA_LEVEL - field.heightAt(x, z));
        const v = Math.round(255 * clamp(depth / DMAX, 0, 1));
        const o = (j * DRES + i) * 4;
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
    uniform vec2 uDepthSpan;      // x = half extent of the baked map, y = max depth
    ${shaders.FRAG_PRELUDE}

    /* Five directional waves whose directions step by the golden angle and
       whose frequencies are incommensurate — three coherent sines produce the
       corrugated-iron stripes this replaced. fade flattens the surface with
       distance: distant water really is a smooth sheet, and it is also the
       only way to stop the ripple aliasing into moiré at the horizon. */
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
      if (uDebug > 0.5) { gl_FragColor = vec4(0.95, 0.05, 0.55, 1.0); return; }
      vec3  toCam = uCamPos - vWorld;
      float dist  = length(toCam);
      vec3  V     = toCam / max(dist, 1e-4);

      float fade = exp(-dist * 0.008);
      vec3  N    = rippleNormal(vWorld.xz, uTime, fade);

      /* depth under this pixel, in metres (outside the baked island: open sea) */
      vec2  duv  = (vWorld.xz + uDepthSpan.x) / (2.0 * uDepthSpan.x);
      float edge = step(0.0, duv.x) * step(duv.x, 1.0) * step(0.0, duv.y) * step(duv.y, 1.0);
      float depth = mix(uDepthSpan.y, texture2D(uDepthMap, duv).r * uDepthSpan.y, edge);

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

      /* foam where the sea runs out — the single detail that most sells a coast.
         Driven by a slow wave so the line breathes instead of sitting still. */
      float surge = 0.70 + 0.30 * sin(dot(vWorld.xz, vec2(0.62, 0.78)) * 0.95 - uTime * 1.35);
      float foam  = smoothstep(1.3, 0.10, depth) * surge;
      foam += smoothstep(0.35, 0.0, depth) * 0.45;      // a constant lace at the very edge
      col = mix(col, uFoam * (uAmbCol + uSunCol * 0.8), clamp(foam, 0.0, 0.92));

      col = applyAerial(col, vWorld);
      gl_FragColor = vec4(col, 1.0);
    }`;

  const mat = new BABYLON.ShaderMaterial('seaMat', scene,
    { vertex: 'sea', fragment: 'sea' },
    shaders.shaderOptions([], ['uShallow', 'uDeep', 'uFoam', 'uDepthSpan', 'uDepthMap'], []));
  mat.setColor3('uShallow', new BABYLON.Color3(0.26, 0.58, 0.58));
  mat.setColor3('uDeep', new BABYLON.Color3(0.04, 0.13, 0.26));
  mat.setColor3('uFoam', new BABYLON.Color3(0.95, 0.97, 1.0));
  mat.setVector2('uDepthSpan', new BABYLON.Vector2(DSPAN, DMAX));
  mat.setTexture('uDepthMap', depthTex);
  mat.backFaceCulling = false;

  const mesh = BABYLON.MeshBuilder.CreateGround('sea',
    { width: half * 2, height: half * 2, subdivisions: 96 }, scene);
  mesh.position.y = SEA_LEVEL;
  mesh.material = mat;
  mesh.isPickable = false;

  return { mesh, mat, depthTex };
}
