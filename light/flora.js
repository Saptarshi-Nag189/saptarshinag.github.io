/* ==========================================================================
   flora.js — what grows on the island, and where.

   Every species is placed by the CLIMATE, not by a random scatter: cactus
   where it is dry and warm, pine where it is cold, reeds where the lake wets
   the ground, palms along the strand. That is what makes walking from one land
   into the next feel like travelling rather than like a texture changing.

   Everything is drawn with thin instances — one draw call per species, however
   many there are.

   Two art-direction rules are load-bearing, and both exist because the default
   of each looks like plastic:

     1. Grass blades are OPAQUE. No alpha texture, no discard. Alpha-tested
        foliage defeats early-Z on tile-based GPUs (phones), and alpha-blended
        foliage sorts wrong against itself. Geometry is cheaper and cleaner.
     2. Every blade darkens toward its root. A grass field lit uniformly reads
        as green carpet; the shadow gathering at the base is what makes it read
        as a mass of separate blades.

   Per-instance tint applies only to parts flagged as foliage (uv.x = 1), so an
   autumn maple gets a red canopy and keeps a brown trunk.
   ========================================================================== */
import { makeRNG, makeNoise2D, clamp, lerp, smoothstep } from './noise.js';
import { WORLD } from './terrain.js';

/* ==========================================================================
   Placement
   ========================================================================== */

/**
 * Rejection-sample the island for ground that suits a species.
 * The cheap tests run first: climate before slope, because the surface normal
 * costs four more height lookups and most candidates die before needing it.
 */
function scatter(field, rng, n, o) {
  const out = [];
  const radius = o.radius, cx = o.cx || 0, cz = o.cz || 0;
  const lim = WORLD.halfExtent - 8;
  let tries = 0;
  const maxTries = n * (o.effort || 26);

  while (out.length < n && tries++ < maxTries) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * radius;
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    if (Math.abs(x) > lim || Math.abs(z) > lim) continue;

    const y = field.heightAt(x, z);
    if (y < (o.minY == null ? 0.6 : o.minY) || y > (o.maxY == null ? 999 : o.maxY)) continue;

    // never in the lake
    if (field.lake && field.lakeT(x, z) < 1.02 && y < field.lakeLevel + 0.15) continue;

    const inland = field.inlandOf(x, z);
    const moist = field.moistureAt(x, z);
    const w = field.climate.climateAt(x, z, y, inland, moist);

    const p = o.pick(w, y, inland, moist);
    if (p <= 0 || rng() > p) continue;

    const nrm = field.normalAt(x, z, 1.6);
    const slope = 1 - clamp(nrm[1], 0, 1);
    if (slope > (o.maxSlope == null ? 0.5 : o.maxSlope)) continue;

    out.push({ x, y, z, slope, moist, w });
  }
  return out;
}

/* ==========================================================================
   Materials
   ========================================================================== */

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
    varying float vSway; varying vec3 vVCol; varying float vLeaf;
    ${shaders.WIND_FN}
    void main(){
      #include<instancesVertex>
      vec4 wp = finalWorld * vec4(position, 1.0);
      vNormal = normalize(mat3(finalWorld) * normal);
      vTint = aTint;
      vVCol = color.rgb;
      vSway = uv.y;
      vLeaf = uv.x;          // 1 = takes the instance tint, 0 = keeps its own colour
      ${body}
      vWorld = wp.xyz;
      gl_Position = viewProjection * wp;
    }`;
}

export function grassMaterial(BABYLON, scene, shaders) {
  return makeGrassMaterial(BABYLON, scene, shaders);
}

let grassMatCache = null;

function makeGrassMaterial(BABYLON, scene, shaders) {
  if (grassMatCache) return grassMatCache;
  BABYLON.Effect.ShadersStore['grassVertexShader'] = instancedVertex(shaders, `
      // phase from world position: neighbouring tufts never pulse in unison,
      // and it costs nothing to store
      float phase = wp.x * 0.37 + wp.z * 0.53;
      wp.xyz = applyWind(wp.xyz, vSway, phase, 0.10);
  `);

  BABYLON.Effect.ShadersStore['grassFragmentShader'] = /* glsl */`
    precision highp float;
    varying vec3 vWorld; varying vec3 vNormal; varying vec3 vTint;
    varying float vSway; varying vec3 vVCol; varying float vLeaf;
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

  grassMatCache = new BABYLON.ShaderMaterial('grassMat', scene,
    { vertex: 'grass', fragment: 'grass' },
    shaders.shaderOptions(['color', 'aTint'], ['viewProjection']));
  grassMatCache.backFaceCulling = false;   // blades are single-sided geometry
  return grassMatCache;
}

const propMats = new Map();

export function makePropMaterial(BABYLON, scene, shaders, name, opts) {
  opts = opts || {};
  if (propMats.has(name)) return propMats.get(name);

  BABYLON.Effect.ShadersStore[name + 'VertexShader'] = instancedVertex(shaders,
    opts.wind ? `
      float phase = wp.x * 0.21 + wp.z * 0.33;
      wp.xyz = applyWind(wp.xyz, vSway, phase, ${opts.wind.toFixed(2)});
    ` : '');

  BABYLON.Effect.ShadersStore[name + 'FragmentShader'] = /* glsl */`
    precision highp float;
    varying vec3 vWorld; varying vec3 vNormal; varying vec3 vTint;
    varying float vSway; varying vec3 vVCol; varying float vLeaf;
    ${shaders.FRAG_PRELUDE}
    void main(){
      // only foliage takes the instance tint, so an autumn canopy keeps a brown trunk
      vec3 albedo = vVCol * mix(vec3(1.0), vTint, vLeaf);
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
  propMats.set(name, mat);
  return mat;
}

/* ==========================================================================
   Geometry helpers
   ========================================================================== */

export function deform(BABYLON, mesh, noise, amt, freq, flatten) {
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

/**
 * @param leaf  1 = this part takes the per-instance tint (foliage, stone)
 * @param yTop  height that maps to full wind sway
 */
export function paint(BABYLON, mesh, rgb, leaf, yTop) {
  const p = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  const c = new Float32Array((p.length / 3) * 4);
  const u = new Float32Array((p.length / 3) * 2);
  for (let i = 0, k = 0, j = 0; i < p.length; i += 3, k += 4, j += 2) {
    c[k] = rgb[0]; c[k + 1] = rgb[1]; c[k + 2] = rgb[2]; c[k + 3] = 1;
    u[j] = leaf;
    u[j + 1] = yTop ? clamp(p[i + 1] / yTop, 0, 1) : 0;
  }
  mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, c, false);
  mesh.setVerticesData(BABYLON.VertexBuffer.UVKind, u, false);
}

/** Build the instance buffers and hand the mesh its crowd. */
export function populate(BABYLON, mesh, spots, rng, opts) {
  const M = new Float32Array(spots.length * 16);
  const T = new Float32Array(spots.length * 3);
  const m = BABYLON.Matrix.Identity();
  const sv = new BABYLON.Vector3(), pv = new BABYLON.Vector3();

  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    const sc = opts.scale(s, rng);
    sv.set(sc.x, sc.y, sc.z);
    pv.set(s.x, s.y + (opts.sink ? opts.sink(s, sc, rng) : 0), s.z);
    BABYLON.Matrix.ComposeToRef(sv,
      opts.rot ? opts.rot(s, rng) : BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, rng() * Math.PI * 2),
      pv, m);
    m.copyToArray(M, i * 16);
    const t = opts.tint(s, rng);
    T[i * 3] = t[0]; T[i * 3 + 1] = t[1]; T[i * 3 + 2] = t[2];
  }

  mesh.thinInstanceSetBuffer('matrix', M, 16, true);
  mesh.thinInstanceSetBuffer('aTint', T, 3, true);
  mesh.thinInstanceRefreshBoundingInfo(false);
  mesh.isPickable = false;
  return spots.length;
}

const uniScale = (lo, hi) => (s, rng) => {
  const v = lo + rng() * (hi - lo);
  return { x: v * (0.9 + rng() * 0.2), y: v, z: v * (0.9 + rng() * 0.2) };
};

/* ==========================================================================
   Grass — tufts, not single blades
   ========================================================================== */

/** The grass tuft mesh, for whoever wants to instance it. */
export function tuftMesh(BABYLON, scene, field, blades) {
  return buildTuftGeometry(BABYLON, scene, makeRNG(field.seed + 4242), blades || 6);
}

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
     The centre seeds the RNG, so walking away and back finds the same grass. */
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
    const rng = makeRNG(seed + Math.round(centreX) * 73856093 + Math.round(centreZ) * 19349663);
    const spots = scatter(field, rng, capacity, {
      radius, cx: centreX, cz: centreZ, effort: 14,
      minY: 0.9, maxY: 150, maxSlope: 0.50,
      // grass everywhere it can live: thick in meadow and marsh, thinner under
      // the forest canopy, dry wisps in sand, nothing on ice or bare rock
      pick: (w) => clamp(
        w.meadow * 1.0 + w.marsh * 0.95 + w.forest * 0.55 +
        w.beach * 0.14 + w.desert * 0.07 - w.snow * 0.9 - w.rock * 0.6, 0, 1),
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

      // colour drifts in broad patches, and follows the biome underfoot
      const drift = tint(s.x * 0.013, s.z * 0.013) * 0.5 + 0.5;
      const w = s.w;
      const dry = clamp(clamp(1 - s.moist, 0, 1) * 0.6 + clamp(w.desert + w.beach, 0, 1) * 0.9, 0, 1);
      const deep = clamp(w.forest + w.marsh, 0, 1);
      T[i * 3 + 0] = lerp(lerp(0.19, 0.52, dry), 0.15, deep) * lerp(0.86, 1.12, drift);
      T[i * 3 + 1] = lerp(lerp(0.42, 0.49, dry), 0.33, deep) * lerp(0.88, 1.10, drift);
      T[i * 3 + 2] = lerp(lerp(0.16, 0.26, dry), 0.16, deep) * lerp(0.82, 1.14, drift);
    }
    live = spots.length;

    mesh.thinInstanceSetBuffer('matrix', M, 16, true);
    mesh.thinInstanceSetBuffer('aTint', T, 3, true);
    mesh.thinInstanceCount = live;
    mesh.thinInstanceRefreshBoundingInfo(false);
    return live;
  }

  refocus(opts.cx || 0, opts.cz || 0);

  function follow(x, z, slack) {
    if (Math.hypot(x - cx, z - cz) > (slack == null ? radius * 0.45 : slack)) refocus(x, z);
  }

  return { mesh, refocus, follow, radius, get count() { return live; } };
}

/* ==========================================================================
   Species geometry
   ========================================================================== */

/** Broadleaf: four canopy masses sitting low on a short trunk. */
function broadleafGeometry(BABYLON, scene, field) {
  const noise = makeNoise2D(field.seed + 606);
  const parts = [];
  const H = 4.0;

  const trunk = BABYLON.MeshBuilder.CreateCylinder('tr',
    { height: H, diameterTop: 0.30, diameterBottom: 0.72, tessellation: 6 }, scene);
  trunk.position.y = H / 2;
  trunk.bakeCurrentTransformIntoVertices();
  deform(BABYLON, trunk, noise, 0.10, 0.9, 0.2);
  paint(BABYLON, trunk, [0.27, 0.21, 0.17], 0, H * 3.0);
  parts.push(trunk);

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
    paint(BABYLON, s, [1, 1, 1], 1, H * 2.0);      // white: the tint IS the leaf colour
    parts.push(s);
  }

  const m = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, false);
  m.name = 'broadleaf';
  return m;
}

/** Pine: stacked cones, narrowing upward. Reads as conifer from any distance. */
function pineGeometry(BABYLON, scene, field) {
  const noise = makeNoise2D(field.seed + 717);
  const parts = [];
  const H = 9.5;

  const trunk = BABYLON.MeshBuilder.CreateCylinder('tr',
    { height: H * 0.9, diameterTop: 0.16, diameterBottom: 0.52, tessellation: 5 }, scene);
  trunk.position.y = H * 0.45;
  trunk.bakeCurrentTransformIntoVertices();
  paint(BABYLON, trunk, [0.24, 0.18, 0.14], 0, H * 2.4);
  parts.push(trunk);

  const tiers = [[1.9, 2.9, 3.2], [3.7, 2.4, 2.9], [5.4, 1.8, 2.6], [7.0, 1.2, 2.2]];
  for (const [y, d, hh] of tiers) {
    const c = BABYLON.MeshBuilder.CreateCylinder('tier',
      { height: hh, diameterTop: 0.0, diameterBottom: d, tessellation: 7 }, scene);
    c.position.y = y + hh / 2;
    c.bakeCurrentTransformIntoVertices();
    deform(BABYLON, c, noise, 0.16, 1.1, 0.35);
    paint(BABYLON, c, [1, 1, 1], 1, H * 1.5);
    parts.push(c);
  }

  const m = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, false);
  m.name = 'pine';
  return m;
}

/** Palm: a leaning trunk and a crown of drooping fronds. */
function palmGeometry(BABYLON, scene) {
  const parts = [];
  const H = 7.0;
  const bend = 1.5;

  // the trunk is stacked segments, each nudged along a curve, so it leans
  const SEGS = 7;
  for (let i = 0; i < SEGS; i++) {
    const t = i / (SEGS - 1);
    const seg = BABYLON.MeshBuilder.CreateCylinder('ts',
      { height: H / SEGS * 1.18, diameterTop: 0.40 - t * 0.16, diameterBottom: 0.46 - t * 0.16,
        tessellation: 6 }, scene);
    seg.position.set(bend * t * t, H * t + H / SEGS / 2, bend * 0.35 * t * t);
    seg.rotation.z = -t * 0.28;
    seg.bakeCurrentTransformIntoVertices();
    paint(BABYLON, seg, [0.40, 0.31, 0.22], 0, H * 2.6);
    parts.push(seg);
  }

  // fronds: long tapered strips radiating from the crown and drooping
  const crown = new BABYLON.Vector3(bend, H, bend * 0.35);
  const FR = 9;
  for (let i = 0; i < FR; i++) {
    const a = (i / FR) * Math.PI * 2 + 0.3;
    const len = 2.9 + (i % 3) * 0.45;
    const pos = [], idx = [], col = [], uv = [];
    const ca = Math.cos(a), sa = Math.sin(a);
    const N = 5;
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const droop = -t * t * 2.1;
      const wdt = Math.sin(Math.PI * Math.min(t * 1.25, 1)) * 0.34 * (1 - t * 0.35);
      const px = ca * len * t, pz = sa * len * t, py = droop + t * 0.55;
      pos.push(px - sa * wdt, py, pz + ca * wdt);
      pos.push(px + sa * wdt, py, pz - ca * wdt);
      col.push(1, 1, 1, 1, 1, 1, 1, 1);
      uv.push(1, t, 1, t);
      if (k < N) {
        const b = k * 2;
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    const f = new BABYLON.Mesh('frond', scene);
    const vd = new BABYLON.VertexData();
    vd.positions = pos; vd.indices = idx; vd.colors = col; vd.uvs = uv;
    const nn = []; BABYLON.VertexData.ComputeNormals(pos, idx, nn); vd.normals = nn;
    vd.applyToMesh(f, false);
    f.position.copyFrom(crown);
    f.bakeCurrentTransformIntoVertices();
    parts.push(f);
  }

  const m = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, false);
  m.name = 'palm';
  return m;
}

/** Cactus: a fluted column with two raised arms. */
function cactusGeometry(BABYLON, scene) {
  const parts = [];
  const col = [0.30, 0.44, 0.28];

  const body = BABYLON.MeshBuilder.CreateCylinder('cb',
    { height: 3.0, diameterTop: 0.72, diameterBottom: 0.86, tessellation: 9 }, scene);
  body.position.y = 1.5;
  body.bakeCurrentTransformIntoVertices();
  paint(BABYLON, body, col, 1, 0);
  parts.push(body);

  const cap = BABYLON.MeshBuilder.CreateIcoSphere('cc', { radius: 0.36, subdivisions: 2 }, scene);
  cap.position.y = 3.0; cap.scaling.y = 0.8; cap.bakeCurrentTransformIntoVertices();
  paint(BABYLON, cap, col, 1, 0);
  parts.push(cap);

  for (const side of [-1, 1]) {
    const lift = side > 0 ? 0.3 : 0;
    const arm = BABYLON.MeshBuilder.CreateCylinder('ca',
      { height: 1.15, diameterTop: 0.40, diameterBottom: 0.44, tessellation: 7 }, scene);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(side * 0.62, 1.55 + lift, 0);
    arm.bakeCurrentTransformIntoVertices();
    paint(BABYLON, arm, col, 1, 0);
    parts.push(arm);

    const up = BABYLON.MeshBuilder.CreateCylinder('cu',
      { height: 1.25, diameterTop: 0.34, diameterBottom: 0.40, tessellation: 7 }, scene);
    up.position.set(side * 1.16, 2.15 + lift, 0);
    up.bakeCurrentTransformIntoVertices();
    paint(BABYLON, up, col, 1, 0);
    parts.push(up);

    const tip = BABYLON.MeshBuilder.CreateIcoSphere('ct', { radius: 0.19, subdivisions: 1 }, scene);
    tip.position.set(side * 1.16, 2.78 + lift, 0);
    tip.bakeCurrentTransformIntoVertices();
    paint(BABYLON, tip, col, 1, 0);
    parts.push(tip);
  }

  const m = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, false);
  m.name = 'cactus';
  return m;
}

/** A dead shrub: crossed sticks, no leaves. Desert punctuation. */
function shrubGeometry(BABYLON, scene, field) {
  const rng = makeRNG(field.seed + 818);
  const parts = [];
  for (let i = 0; i < 9; i++) {
    const s = BABYLON.MeshBuilder.CreateCylinder('sb',
      { height: 0.7 + rng() * 0.8, diameterTop: 0.012, diameterBottom: 0.055, tessellation: 3 }, scene);
    s.rotation.set((rng() - 0.5) * 1.5, rng() * Math.PI * 2, (rng() - 0.5) * 1.5);
    s.position.set((rng() - 0.5) * 0.4, 0.35 + rng() * 0.2, (rng() - 0.5) * 0.4);
    s.bakeCurrentTransformIntoVertices();
    paint(BABYLON, s, [1, 1, 1], 1, 1.4);
    parts.push(s);
  }
  const m = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, false);
  m.name = 'shrub';
  return m;
}

/** Reeds: tall thin blades, for the lake's margin. */
function reedGeometry(BABYLON, scene, field) {
  const rng = makeRNG(field.seed + 919);
  const pos = [], nrm = [], uv = [], col = [], idx = [];
  let v = 0;
  for (let b = 0; b < 9; b++) {
    const ang = rng() * Math.PI * 2;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const h = 1.1 + rng() * 0.9;
    const w = 0.026;
    const ox = (rng() - 0.5) * 0.55, oz = (rng() - 0.5) * 0.55;
    const lean = (rng() - 0.5) * 0.5;
    const ring = [
      [-w, 0, 0], [w, 0, 0],
      [-w * 0.5, h * 0.6, lean * h * 0.5], [w * 0.5, h * 0.6, lean * h * 0.5],
      [0, h, lean * h * 1.2],
    ];
    for (let k = 0; k < ring.length; k++) {
      const [lx, ly, lz] = ring[k];
      pos.push(ca * lx - sa * lz + ox, ly, sa * lx + ca * lz + oz);
      nrm.push(0, 0.96, 0.28);
      uv.push(1, k < 2 ? 0 : (k === 4 ? 1 : 0.6));
      col.push(1, 1, 1, 1);
    }
    idx.push(v, v + 1, v + 3, v, v + 3, v + 2, v + 2, v + 3, v + 4);
    v += 5;
  }
  const mesh = new BABYLON.Mesh('reeds', scene);
  const vd = new BABYLON.VertexData();
  vd.positions = pos; vd.normals = nrm; vd.uvs = uv; vd.colors = col; vd.indices = idx;
  vd.applyToMesh(mesh, false);
  return mesh;
}

/* ==========================================================================
   Species — one declarative table

   The streaming chunk system and the legacy whole-island path both read this,
   so there is exactly one answer to "what grows here, how big, what colour".
   `perTile` is a target for a 64 m tile at full density; `islandCount` is the
   equivalent for the non-streaming path.
   ========================================================================== */

/** Autumn is a place, not a random roll: the cold, wet north turns first. */
let leafNoise = null;
function leafTint(s, rng, field) {
  if (!leafNoise) leafNoise = makeNoise2D(field.seed + 5150);
  const turn = clamp(leafNoise(s.x * 0.0035, s.z * 0.0035) * 0.5 + 0.5, 0, 1);
  const cold = clamp((0.55 - s.w.temp) * 1.9, 0, 1);
  const amber = clamp(turn * 0.75 + cold * 0.75 - 0.42, 0, 1) * (1 - s.w.snow);
  const jitter = 0.88 + rng() * 0.26;

  // green -> amber -> rust, and a rare tree goes the whole way
  const deep = rng() < 0.12 ? 1 : 0;
  const t = clamp(amber + deep * 0.35, 0, 1);
  return [
    lerp(0.21, 0.66, t) * jitter,
    lerp(0.37, 0.33, t) * jitter,
    lerp(0.19, 0.14, t) * jitter,
  ];
}

let rockTintNoise = null;

/** Rock: one icosphere, deformed so it is never twice the same shape. */
let rockMeshCache = null;
function rockGeometry(BABYLON, scene, field) {
  const noise = makeNoise2D(field.seed + 99);
  const base = BABYLON.MeshBuilder.CreateIcoSphere('rk',
    { radius: 1, subdivisions: 2, flat: true }, scene);
  base.scaling.set(1.25, 0.78, 1.05);
  base.bakeCurrentTransformIntoVertices();
  deform(BABYLON, base, noise, 0.30, 1.4, 0.7);
  paint(BABYLON, base, [0.60, 0.575, 0.55], 1, 0);
  base.name = 'rock';
  return base;
}

export const SPECIES = [
  {
    name: 'broadleaf', rngSalt: 10193, perTile: 140, islandCount: 3600,
    geom: (B, sc, f) => broadleafGeometry(B, sc, f),
    mat: { wind: 0.16, shadeSoft: 0.40, bandLift: 0.06, rimScale: 0.9 },
    rule: {
      effort: 6, minY: 2.4, maxY: 78, maxSlope: 0.42,
      // dense where it is forest, scattered where it is meadow
      pick: (w) => clamp(w.forest * 1.0 + w.meadow * 0.22 + w.marsh * 0.25
                         - w.desert - w.snow - w.rock * 0.8, 0, 1),
    },
    place: { scale: uniScale(0.58, 1.12), sink: () => -0.25, tint: leafTint },
  },
  {
    name: 'pine', rngSalt: 20411, perTile: 100, islandCount: 2400,
    geom: (B, sc, f) => pineGeometry(B, sc, f),
    mat: { wind: 0.07, shadeSoft: 0.44, bandLift: 0.07, rimScale: 0.9 },
    rule: {
      effort: 6, minY: 8, maxY: 118, maxSlope: 0.52,
      // pine takes over from broadleaf as the ground gets cold and high
      pick: (w, y) => clamp((w.forest * 0.55 + w.meadow * 0.20 + w.snow * 0.55)
                            * smoothstep(0.62, 0.22, w.temp)
                            * (1 - smoothstep(0.55, 0.95, w.snow))
                            + smoothstep(30, 70, y) * 0.35 - w.desert * 2, 0, 1),
    },
    place: {
      scale: uniScale(0.50, 1.0), sink: () => -0.4,
      tint: (s, rng) => {
        const j = 0.86 + rng() * 0.3;
        const f = clamp(s.w.snow * 1.3, 0, 1);       // pines frost over
        return [lerp(0.15, 0.52, f) * j, lerp(0.29, 0.60, f) * j, lerp(0.19, 0.58, f) * j];
      },
    },
  },
  {
    name: 'blossom', rngSalt: 30637, perTile: 4, islandCount: 190,
    geom: (B, sc, f) => broadleafGeometry(B, sc, f),
    mat: { wind: 0.20, shadeSoft: 0.46, bandLift: 0.14, rimScale: 1.0 },
    rule: {
      effort: 10, minY: 4, maxY: 54, maxSlope: 0.34,
      pick: (w) => clamp((w.meadow * 0.8 + w.forest * 0.5 + w.marsh * 0.6)
                         - w.desert * 2 - w.snow * 2, 0, 1) * 0.5,
    },
    place: {
      scale: uniScale(0.62, 1.0), sink: () => -0.25,
      tint: (s, rng) => (rng() < 0.45 ? [0.96, 0.74, 0.82] : [0.97, 0.90, 0.93]),
    },
  },
  {
    name: 'palm', rngSalt: 40763, perTile: 16, islandCount: 420,
    geom: (B, sc) => palmGeometry(B, sc),
    mat: { wind: 0.26, shadeSoft: 0.42, bandLift: 0.08, rimScale: 0.95, cull: false },
    rule: {
      effort: 8, minY: 1.2, maxY: 26, maxSlope: 0.30,
      pick: (w) => clamp((w.beach * 0.9 + w.desert * 0.35 + w.marsh * 0.5)
                         * smoothstep(0.34, 0.66, w.temp) * (1 - w.snow), 0, 1),
    },
    place: {
      scale: uniScale(0.62, 1.05), sink: () => -0.3,
      tint: (s, rng) => { const j = 0.85 + rng() * 0.3; return [0.30 * j, 0.44 * j, 0.24 * j]; },
    },
  },
  {
    name: 'cactus', rngSalt: 50909, perTile: 42, islandCount: 900,
    geom: (B, sc) => cactusGeometry(B, sc),
    mat: { shadeSoft: 0.36, bandLift: 0.10, rimScale: 0.9 },
    rule: {
      effort: 6, minY: 2.5, maxY: 60, maxSlope: 0.30,
      pick: (w) => clamp(w.desert * 1.15 - w.snow * 2, 0, 1),
    },
    place: {
      scale: uniScale(0.62, 1.30), sink: () => -0.25,
      tint: (s, rng) => { const j = 0.88 + rng() * 0.26; return [j, j * 1.02, j * 0.95]; },
    },
  },
  {
    name: 'shrub', rngSalt: 61027, perTile: 58, islandCount: 1600, nearOnly: true,
    geom: (B, sc, f) => shrubGeometry(B, sc, f),
    mat: { wind: 0.12, shadeSoft: 0.50, bandLift: 0.18, rimScale: 0.9, cull: false },
    rule: {
      effort: 5, minY: 1.6, maxY: 82, maxSlope: 0.44,
      pick: (w) => clamp(w.desert * 1.0 + w.beach * 0.25 + w.rock * 0.3
                         + w.meadow * 0.10 - w.snow * 2, 0, 1),
    },
    place: {
      scale: uniScale(0.6, 1.25), sink: () => -0.1,
      tint: (s, rng) => { const j = 0.85 + rng() * 0.3; return [0.50 * j, 0.40 * j, 0.27 * j]; },
    },
  },
  {
    name: 'reeds', rngSalt: 71143, perTile: 80, islandCount: 2200, nearOnly: true,
    geom: (B, sc, f) => reedGeometry(B, sc, f),
    mat: { wind: 0.22, shadeSoft: 0.48, bandLift: 0.08, rimScale: 0.8, cull: false },
    rule: {
      effort: 6, minY: 0.8, maxY: 120, maxSlope: 0.36,
      pick: (w) => clamp(w.marsh * 1.25 - w.snow * 2, 0, 1),
    },
    place: {
      scale: uniScale(0.7, 1.3), sink: () => -0.12,
      tint: (s, rng) => { const j = 0.85 + rng() * 0.32; return [0.34 * j, 0.40 * j, 0.20 * j]; },
    },
  },
  {
    name: 'rock', rngSalt: 81281, perTile: 46, islandCount: 1600,
    geom: (B, sc, f) => rockGeometry(B, sc, f),
    mat: { shadeSoft: 0.50, bandLift: 0.22, rimScale: 0.8 },
    rule: {
      effort: 5, minY: -0.6, maxY: 150, maxSlope: 0.75,
      // rocks belong on the shore, the heights and the bare ground
      pick: (w) => clamp(w.rock * 1.2 + w.snow * 0.55 + w.beach * 0.45 + w.desert * 0.30
                         + w.meadow * 0.10 + w.forest * 0.10, 0, 1),
    },
    place: {
      scale: (s, r) => { const v = 0.28 + Math.pow(r(), 2.6) * 1.9;
        return { x: v * (0.8 + r() * 0.5), y: v * (0.6 + r() * 0.5), z: v * (0.8 + r() * 0.5) }; },
      // sunk slightly, so they sit IN the ground rather than on it
      sink: (s, sc) => -sc.y * 0.42,
      rot: (s, r, B) => B.Quaternion.FromEulerAngles((r() - 0.5) * 0.5, r() * Math.PI * 2, (r() - 0.5) * 0.5),
      tint: (s, r, field) => {
        if (!rockTintNoise) rockTintNoise = makeNoise2D(field.seed + 4004);
        const drift = rockTintNoise(s.x * 0.02, s.z * 0.02) * 0.5 + 0.5;
        // stone goes pale under snow and warm in the desert
        const snow = clamp(s.w.snow * 1.2, 0, 1);
        const sand = clamp(s.w.desert, 0, 1);
        return [
          lerp(lerp(0.92, 1.12, drift), 1.32, snow) * lerp(1, 1.10, sand),
          lerp(lerp(0.90, 1.06, drift), 1.36, snow) * lerp(1, 1.00, sand),
          lerp(lerp(0.88, 1.08, 1 - drift), 1.44, snow) * lerp(1, 0.86, sand),
        ];
      },
    },
  },
];

export const SPECIES_BY_NAME = Object.fromEntries(SPECIES.map((s) => [s.name, s]));

/** The mesh and material for one species. Built once; instanced everywhere. */
export function speciesMesh(BABYLON, scene, field, shaders, def) {
  const mesh = def.geom(BABYLON, scene, field);
  mesh.material = makePropMaterial(BABYLON, scene, shaders, def.name, def.mat);
  mesh.isPickable = false;
  return mesh;
}

/** Write instance matrices and tints for a set of spots into caller-owned arrays. */
export function fillInstances(BABYLON, spots, rng, M, T, field, place) {
  const m = BABYLON.Matrix.Identity();
  const sv = new BABYLON.Vector3(), pv = new BABYLON.Vector3();
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    const sc = place.scale(s, rng);
    sv.set(sc.x, sc.y, sc.z);
    pv.set(s.x, s.y + (place.sink ? place.sink(s, sc, rng) : 0), s.z);
    BABYLON.Matrix.ComposeToRef(sv,
      place.rot ? place.rot(s, rng, BABYLON)
                : BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, rng() * Math.PI * 2),
      pv, m);
    m.copyToArray(M, i * 16);
    const t = place.tint(s, rng, field);
    T[i * 3] = t[0]; T[i * 3 + 1] = t[1]; T[i * 3 + 2] = t[2];
  }
}

/** Bound to each definition so the chunk system can call it without plumbing. */
for (const def of SPECIES) {
  def.fill = (B, spots, rng, M, T, field) => fillInstances(B, spots, rng, M, T, field, def.place);
}

/* ==========================================================================
   The legacy whole-island path (kept behind ?stream=0)
   ========================================================================== */

export function buildSpecies(BABYLON, scene, field, shaders, counts) {
  const out = {};
  for (const def of SPECIES) {
    const n = counts && counts[def.name] != null ? counts[def.name] : def.islandCount;
    if (n <= 0) continue;
    const rng = makeRNG(field.seed + def.rngSalt);
    const mesh = speciesMesh(BABYLON, scene, field, shaders, def);
    const spots = scatter(field, rng, n, Object.assign({ radius: 470 }, def.rule,
      { effort: (def.rule.effort || 6) * 4 }));
    const M = new Float32Array(spots.length * 16);
    const T = new Float32Array(spots.length * 3);
    fillInstances(BABYLON, spots, rng, M, T, field, def.place);
    mesh.thinInstanceSetBuffer('matrix', M, 16, true);
    mesh.thinInstanceSetBuffer('aTint', T, 3, true);
    mesh.thinInstanceRefreshBoundingInfo(false);
    out[def.name] = { mesh, count: spots.length };
  }
  return out;
}

/** Everything that grows, in one call — the non-streaming build. */
export function buildFlora(BABYLON, scene, field, shaders, opts) {
  opts = opts || {};
  const grass = buildGrass(BABYLON, scene, field, shaders, opts.grass);
  const species = buildSpecies(BABYLON, scene, field, shaders, opts.species);

  const mats = [grass.mesh.material];
  const counts = { grass: grass.count };
  for (const k in species) {
    mats.push(species[k].mesh.material);
    counts[k] = species[k].count;
  }
  return { grass, species, mats, counts };
}
