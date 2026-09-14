/* ==========================================================================
   flora.js — what grows on the island.

   Grass, trees and rocks, all procedural, all placed by the one authoritative
   heightAt(x,z) so nothing floats or sinks. Everything is drawn with thin
   instances: one draw call per species, however many there are.

   Two art-direction rules are load-bearing here, and both exist because the
   default of each looks like plastic:

     1. Grass blades are OPAQUE. No alpha texture, no discard. Alpha-tested
        foliage defeats early-Z on tile-based GPUs (phones), and alpha-blended
        foliage sorts wrong against itself. Geometry is cheaper and cleaner.
     2. Every blade darkens toward its root. A grass field lit uniformly reads
        as green carpet; the shadow gathering at the base is what makes it read
        as a mass of separate blades. This one multiply does more for the look
        than any amount of shader complexity.
   ========================================================================== */
import { makeRNG, makeNoise2D, clamp, lerp, smoothstep } from './noise.js';
import { WORLD, SEA_LEVEL } from './terrain.js';

/* ==========================================================================
   Placement — rejection sampling against the real height field
   ========================================================================== */

/**
 * Scatter n points over the island, keeping only ground that suits the
 * species. Returns plain arrays so the caller can build instance buffers
 * without a second pass.
 */
function scatter(field, rng, n, o) {
  const out = [];
  const half = o.radius;
  const cx = o.cx || 0, cz = o.cz || 0;
  let tries = 0;
  const maxTries = n * 40;

  while (out.length < n && tries++ < maxTries) {
    // sqrt keeps the disc evenly covered instead of crowding the centre
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * half;
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;

    if (Math.abs(x) > WORLD.halfExtent - 6 || Math.abs(z) > WORLD.halfExtent - 6) continue;

    const y = field.heightAt(x, z);
    if (y < o.minY || y > o.maxY) continue;

    const nrm = field.normalAt(x, z, 1.6);
    const slope = 1 - clamp(nrm[1], 0, 1);
    if (slope > o.maxSlope) continue;

    const moist = field.moistureAt(x, z);
    if (moist < (o.minMoist || 0)) continue;

    // a soft probabilistic thinning so edges of a species fade out rather
    // than stopping on a contour line
    if (o.fade && rng() > o.fade(y, slope, moist)) continue;

    out.push({ x, y, z, slope, moist, nx: nrm[0], ny: nrm[1], nz: nrm[2] });
  }
  return out;
}

/* ==========================================================================
   Materials
   ========================================================================== */

/** Shared vertex preamble: thin-instance aware, wind-capable, world-space. */
function instancedVertex(shaders, body) {
  return /* glsl */`
    precision highp float;
    #include<instancesDeclaration>
    attribute vec3 position;
    attribute vec3 normal;
    attribute vec2 uv;
    attribute vec4 color;
    attribute vec3 aTint;
    uniform mat4 viewProjection;
    uniform float uTime;
    varying vec3 vWorld; varying vec3 vNormal; varying vec3 vTint;
    varying float vSway; varying vec3 vVCol;
    ${shaders.WIND_FN}
    void main(){
      #include<instancesVertex>
      vec4 wp = finalWorld * vec4(position, 1.0);
      vNormal = normalize(mat3(finalWorld) * normal);
      vTint = aTint;
      vVCol = color.rgb;
      vSway = uv.y;
      ${body}
      vWorld = wp.xyz;
      gl_Position = viewProjection * wp;
    }`;
}

function makeGrassMaterial(BABYLON, scene, shaders) {
  BABYLON.Effect.ShadersStore['grassVertexShader'] = instancedVertex(shaders, `
      // phase from world position: neighbouring tufts never pulse in unison,
      // and it costs nothing to store
      float phase = wp.x * 0.37 + wp.z * 0.53;
      wp.xyz = applyWind(wp.xyz, vSway, phase, 0.10);
  `);

  BABYLON.Effect.ShadersStore['grassFragmentShader'] = /* glsl */`
    precision highp float;
    varying vec3 vWorld; varying vec3 vNormal; varying vec3 vTint;
    varying float vSway; varying vec3 vVCol;
    ${shaders.FRAG_PRELUDE}
    void main(){
      if (uDebug > 0.5) { gl_FragColor = vec4(vTint, 1.0); return; }
      vec3 N = normalize(vNormal);
      vec3 V = normalize(uCamPos - vWorld);

      // the root shadow — see the note at the top of this file
      vec3 albedo = vTint * mix(0.42, 1.06, vSway);

      vec3 col = toonLit(albedo, N, V, 0.45, 0.06, 0.55);
      col = applyAerial(col, vWorld);
      gl_FragColor = vec4(col, 1.0);
    }`;

  const mat = new BABYLON.ShaderMaterial('grassMat', scene,
    { vertex: 'grass', fragment: 'grass' },
    shaders.shaderOptions(['color', 'aTint'], ['viewProjection']));
  mat.backFaceCulling = false;          // blades are single-sided geometry
  return mat;
}

function makePropMaterial(BABYLON, scene, shaders, name, opts) {
  opts = opts || {};
  BABYLON.Effect.ShadersStore[name + 'VertexShader'] = instancedVertex(shaders,
    opts.wind ? `
      float phase = wp.x * 0.21 + wp.z * 0.33;
      wp.xyz = applyWind(wp.xyz, vSway, phase, ${opts.wind.toFixed(2)});
    ` : '');

  BABYLON.Effect.ShadersStore[name + 'FragmentShader'] = /* glsl */`
    precision highp float;
    varying vec3 vWorld; varying vec3 vNormal; varying vec3 vTint;
    varying float vSway; varying vec3 vVCol;
    ${shaders.FRAG_PRELUDE}
    void main(){
      vec3 albedo = vVCol * vTint;
      if (uDebug > 0.5) { gl_FragColor = vec4(albedo, 1.0); return; }
      vec3 N = normalize(vNormal);
      vec3 V = normalize(uCamPos - vWorld);
      vec3 col = toonLit(albedo, N, V, ${(opts.shadeSoft || 0.34).toFixed(2)},
                         ${(opts.bandLift || 0.08).toFixed(2)},
                         ${(opts.rimScale || 0.85).toFixed(2)});
      col = applyAerial(col, vWorld);
      gl_FragColor = vec4(col, 1.0);
    }`;

  const mat = new BABYLON.ShaderMaterial(name + 'Mat', scene,
    { vertex: name, fragment: name },
    shaders.shaderOptions(['color', 'aTint'], ['viewProjection']));
  mat.backFaceCulling = opts.cull !== false;
  return mat;
}

/* ==========================================================================
   Grass — tufts, not single blades
   ========================================================================== */

/**
 * One tuft = BLADES blades sharing an instance. Fewer instances for the same
 * apparent density, and a tuft reads as a clump the way real grass does.
 * Each blade is 5 verts / 3 tris: a tapered quad plus a tip triangle, so it
 * can bend smoothly instead of hinging at one joint.
 */
function buildTuftGeometry(BABYLON, scene, rng, BLADES) {
  const pos = [], nrm = [], uv = [], col = [], idx = [];
  let v = 0;

  for (let b = 0; b < BLADES; b++) {
    const ang = rng() * Math.PI * 2;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const h = 0.17 + rng() * 0.26;                 // blade height, metres
    const w = 0.014 + rng() * 0.013;               // half-width at the base
    const off = (rng() - 0.5) * 0.24;              // spread within the tuft
    const ofz = (rng() - 0.5) * 0.24;
    const lean = (rng() - 0.5) * 0.30;             // a resting tilt

    // local blade axes, rotated around Y
    const ax = (dx, dz) => [ca * dx - sa * dz, sa * dx + ca * dz];

    const ring = [
      [-w, 0.00, 0.0],
      [ w, 0.00, 0.0],
      [-w * 0.62, h * 0.55, lean * h * 0.55],
      [ w * 0.62, h * 0.55, lean * h * 0.55],
      [ 0.0, h, lean * h * 1.25],
    ];

    for (let k = 0; k < ring.length; k++) {
      const [lx, ly, lz] = ring[k];
      const [px, pz] = ax(lx, lz);
      pos.push(px + off, ly, pz + ofz);

      // Blades take a mostly-upward normal on purpose. A true per-face normal
      // makes a grass field flicker into dark and light shards; shading the
      // whole clump like the ground it sits on keeps it soft and coherent.
      const [nxo, nzo] = ax(lx * 6.0, 1.0);
      const n = [nxo * 0.22, 0.94, nzo * 0.22];
      const L = Math.hypot(n[0], n[1], n[2]);
      nrm.push(n[0] / L, n[1] / L, n[2] / L);

      uv.push(0, k === 0 || k === 1 ? 0 : (k === 4 ? 1 : 0.55));
      col.push(1, 1, 1, 1);
    }

    idx.push(v, v + 1, v + 3,  v, v + 3, v + 2,  v + 2, v + 3, v + 4);
    v += 5;
  }

  const mesh = new BABYLON.Mesh('grassTuft', scene);
  const vd = new BABYLON.VertexData();
  vd.positions = pos; vd.normals = nrm; vd.uvs = uv; vd.colors = col; vd.indices = idx;
  vd.applyToMesh(mesh, false);
  return mesh;
}

export function buildGrass(BABYLON, scene, field, shaders, opts) {
  opts = opts || {};
  /* Grass only reads as grass when it is DENSE, and density over a whole
     island is impossible — a 430m disc at a believable 1.5 tufts/m^2 would be
     nearly a million instances. So the field is a dense disc that follows the
     viewer: capacity is fixed, and refocus() refills it around a new centre.
     Today the test cameras call it; when the traveller arrives it gets called
     on tile crossings. Same buffer, same cost, wherever you stand. */
  const capacity = opts.count == null ? 55000 : opts.count;
  const radius = opts.radius || 85;
  const seed = field.seed + 4242;
  const tint = makeNoise2D(field.seed + 8181);

  const mesh = buildTuftGeometry(BABYLON, scene, makeRNG(seed), opts.blades || 6);
  mesh.material = makeGrassMaterial(BABYLON, scene, shaders);
  mesh.isPickable = false;

  const M = new Float32Array(capacity * 16);
  const T = new Float32Array(capacity * 3);
  const m = BABYLON.Matrix.Identity();
  const scaleV = new BABYLON.Vector3();
  const posV = new BABYLON.Vector3();
  let live = 0;
  let cx = NaN, cz = NaN;

  function refocus(centreX, centreZ) {
    cx = centreX; cz = centreZ;
    // the centre is part of the seed, so the same ground always grows the same
    // grass — walk away and back and nothing has rearranged itself
    const rng = makeRNG(seed + Math.round(centreX) * 73856093 + Math.round(centreZ) * 19349663);
    const spots = scatter(field, rng, capacity, {
      radius, cx: centreX, cz: centreZ,
      minY: 1.2, maxY: 96, maxSlope: 0.48, minMoist: 0.16,
      fade: (y, slope, moist) =>
        clamp(moist * 1.35, 0, 1) * (1 - smoothstep(0.28, 0.48, slope)) * (1 - smoothstep(58, 96, y)),
    });

    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      const sc = 0.80 + rng() * 0.60;
      const hs = sc * lerp(0.76, 1.28, s.moist);
      scaleV.set(sc, hs, sc);
      posV.set(s.x, s.y - 0.06, s.z);
      BABYLON.Matrix.ComposeToRef(scaleV,
        BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, rng() * Math.PI * 2), posV, m);
      m.copyToArray(M, i * 16);

      // colour drifts in broad patches, not per-blade confetti
      const drift = tint(s.x * 0.013, s.z * 0.013) * 0.5 + 0.5;
      const dry = clamp(1 - s.moist, 0, 1);
      T[i * 3 + 0] = lerp(0.19, 0.42, dry) * lerp(0.86, 1.12, drift);
      T[i * 3 + 1] = lerp(0.42, 0.46, dry) * lerp(0.88, 1.10, drift);
      T[i * 3 + 2] = lerp(0.16, 0.21, dry) * lerp(0.82, 1.14, drift);
    }
    live = spots.length;

    mesh.thinInstanceSetBuffer('matrix', M, 16, true);
    mesh.thinInstanceSetBuffer('aTint', T, 3, true);
    mesh.thinInstanceCount = live;
    mesh.thinInstanceRefreshBoundingInfo(false);
    return live;
  }

  refocus(opts.cx || 0, opts.cz || 0);

  /** refill only if the viewer has wandered off the current patch */
  function follow(x, z, slack) {
    if (Math.hypot(x - cx, z - cz) > (slack == null ? radius * 0.45 : slack)) refocus(x, z);
  }

  return { mesh, refocus, follow, radius, get count() { return live; } };
}

/* ==========================================================================
   Trees — a trunk and a few canopy masses, deformed so no two read alike
   ========================================================================== */

function deform(BABYLON, mesh, noise, amt, freq, flatten) {
  const p = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  for (let i = 0; i < p.length; i += 3) {
    const d = noise(p[i] * freq, p[i + 2] * freq) * amt;
    const d2 = noise(p[i + 1] * freq * 1.7 + 11, p[i] * freq + 7) * amt;
    p[i] += d; p[i + 1] += d2 * flatten; p[i + 2] += d;
  }
  mesh.setVerticesData(BABYLON.VertexBuffer.PositionKind, p, false);
  const n = [];
  BABYLON.VertexData.ComputeNormals(p, mesh.getIndices(), n);
  mesh.setVerticesData(BABYLON.VertexBuffer.NormalKind, n, false);
}

function paint(BABYLON, mesh, rgb, swayFromY, yTop) {
  const p = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  const c = new Float32Array((p.length / 3) * 4);
  const u = new Float32Array((p.length / 3) * 2);
  for (let i = 0, k = 0, j = 0; i < p.length; i += 3, k += 4, j += 2) {
    c[k] = rgb[0]; c[k + 1] = rgb[1]; c[k + 2] = rgb[2]; c[k + 3] = 1;
    u[j] = 0;
    u[j + 1] = swayFromY ? clamp(p[i + 1] / yTop, 0, 1) : 0;
  }
  mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, c, false);
  mesh.setVerticesData(BABYLON.VertexBuffer.UVKind, u, false);
}

function buildTreeGeometry(BABYLON, scene, field, rng) {
  const noise = makeNoise2D(field.seed + 606);
  const parts = [];

  const H = 4.0;
  const trunk = BABYLON.MeshBuilder.CreateCylinder('tr',
    { height: H, diameterTop: 0.30, diameterBottom: 0.72, tessellation: 6 }, scene);
  trunk.position.y = H / 2;
  trunk.bakeCurrentTransformIntoVertices();
  deform(BABYLON, trunk, noise, 0.10, 0.9, 0.2);
  paint(BABYLON, trunk, [0.27, 0.21, 0.17], true, H * 3.0);
  parts.push(trunk);

  // three canopy masses, offset and flattened — one sphere reads as a lollipop
  const blobs = [
    [ 0.0, H * 1.26, 0.0, 5.2],
    [ 1.7, H * 1.05, -1.0, 4.0],
    [-1.6, H * 1.12, 1.3, 3.6],
    [ 0.4, H * 1.58, 0.6, 3.4],
  ];
  for (const [bx, by, bz, d] of blobs) {
    const s = BABYLON.MeshBuilder.CreateIcoSphere('cn',
      { radius: d / 2, subdivisions: 2, flat: true }, scene);
    s.position.set(bx, by, bz);
    s.scaling.y = 0.80;
    s.bakeCurrentTransformIntoVertices();
    deform(BABYLON, s, noise, 0.42, 0.55, 0.8);
    paint(BABYLON, s, [0.21, 0.36, 0.20], true, H * 2.0);
    parts.push(s);
  }

  const merged = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, false);
  merged.name = 'tree';
  return merged;
}

export function buildTrees(BABYLON, scene, field, shaders, opts) {
  opts = opts || {};
  const count = opts.count == null ? 4200 : opts.count;
  const rng = makeRNG(field.seed + 777);
  const tint = makeNoise2D(field.seed + 313);

  const mesh = buildTreeGeometry(BABYLON, scene, field, rng);
  mesh.material = makePropMaterial(BABYLON, scene, shaders, 'tree',
    { wind: 0.16, shadeSoft: 0.40, bandLift: 0.06, rimScale: 0.9 });
  mesh.isPickable = false;

  const spots = scatter(field, rng, count, {
    radius: opts.radius || 400,
    minY: 3.0, maxY: 74, maxSlope: 0.40, minMoist: 0.34,
    fade: (y, slope, moist) =>
      clamp((moist - 0.28) * 2.2, 0, 1) * (1 - smoothstep(48, 74, y)),
  });

  const M = new Float32Array(spots.length * 16);
  const T = new Float32Array(spots.length * 3);
  const m = BABYLON.Matrix.Identity();

  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    const sc = 0.58 + rng() * 0.52;
    BABYLON.Matrix.ComposeToRef(
      new BABYLON.Vector3(sc * (0.88 + rng() * 0.3), sc, sc * (0.88 + rng() * 0.3)),
      BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, rng() * Math.PI * 2),
      new BABYLON.Vector3(s.x, s.y - 0.25, s.z),
      m);
    m.copyToArray(M, i * 16);

    const drift = tint(s.x * 0.009, s.z * 0.009) * 0.5 + 0.5;
    T[i * 3 + 0] = lerp(0.86, 1.14, drift);
    T[i * 3 + 1] = lerp(0.82, 1.16, 1 - drift * 0.7);
    T[i * 3 + 2] = lerp(0.84, 1.10, drift);
  }

  mesh.thinInstanceSetBuffer('matrix', M, 16, true);
  mesh.thinInstanceSetBuffer('aTint', T, 3, true);
  mesh.thinInstanceRefreshBoundingInfo(false);

  return { mesh, count: spots.length };
}

/* ==========================================================================
   Rocks — the same icosphere, never twice the same shape
   ========================================================================== */

export function buildRocks(BABYLON, scene, field, shaders, opts) {
  opts = opts || {};
  const count = opts.count == null ? 900 : opts.count;
  const rng = makeRNG(field.seed + 2024);
  const noise = makeNoise2D(field.seed + 99);
  const tint = makeNoise2D(field.seed + 4004);

  const base = BABYLON.MeshBuilder.CreateIcoSphere('rk',
    { radius: 1, subdivisions: 2, flat: true }, scene);
  base.scaling.set(1.25, 0.78, 1.05);
  base.bakeCurrentTransformIntoVertices();
  deform(BABYLON, base, noise, 0.30, 1.4, 0.7);
  paint(BABYLON, base, [0.60, 0.575, 0.55], false, 1);
  base.name = 'rock';
  base.material = makePropMaterial(BABYLON, scene, shaders, 'rock',
    { shadeSoft: 0.50, bandLift: 0.22, rimScale: 0.8 });
  base.isPickable = false;

  const spots = scatter(field, rng, count, {
    radius: opts.radius || 450,
    minY: -0.6, maxY: 128, maxSlope: 0.72,
    // rocks belong on the shore and the heights, not the meadows
    fade: (y, slope, moist) =>
      clamp(smoothstep(0.22, 0.6, slope) + smoothstep(52, 96, y)
            + (1 - smoothstep(0.4, 3.2, y)) * 0.8, 0, 1),
  });

  const M = new Float32Array(spots.length * 16);
  const T = new Float32Array(spots.length * 3);
  const m = BABYLON.Matrix.Identity();

  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    const sc = 0.28 + Math.pow(rng(), 2.6) * 1.9;      // many small, a few large
    BABYLON.Matrix.ComposeToRef(
      new BABYLON.Vector3(sc * (0.8 + rng() * 0.5), sc * (0.6 + rng() * 0.5), sc * (0.8 + rng() * 0.5)),
      BABYLON.Quaternion.FromEulerAngles((rng() - 0.5) * 0.5, rng() * Math.PI * 2, (rng() - 0.5) * 0.5),
      // sunk slightly, so they sit IN the ground rather than on it
      new BABYLON.Vector3(s.x, s.y - sc * 0.42, s.z),
      m);
    m.copyToArray(M, i * 16);

    const drift = tint(s.x * 0.02, s.z * 0.02) * 0.5 + 0.5;
    const warm = lerp(0.92, 1.12, drift);
    T[i * 3 + 0] = warm;
    T[i * 3 + 1] = lerp(0.90, 1.06, drift);
    T[i * 3 + 2] = lerp(0.88, 1.08, 1 - drift);
  }

  base.thinInstanceSetBuffer('matrix', M, 16, true);
  base.thinInstanceSetBuffer('aTint', T, 3, true);
  base.thinInstanceRefreshBoundingInfo(false);

  return { mesh: base, count: spots.length };
}

/** Everything that grows, in one call. */
export function buildFlora(BABYLON, scene, field, shaders, opts) {
  opts = opts || {};
  const grass = buildGrass(BABYLON, scene, field, shaders, opts.grass);
  const trees = buildTrees(BABYLON, scene, field, shaders, opts.trees);
  const rocks = buildRocks(BABYLON, scene, field, shaders, opts.rocks);
  return {
    grass, trees, rocks,
    mats: [grass.mesh.material, trees.mesh.material, rocks.mesh.material],
    counts: { grass: grass.count, trees: trees.count, rocks: rocks.count },
  };
}
