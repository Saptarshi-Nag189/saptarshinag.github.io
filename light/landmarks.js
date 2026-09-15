/* ==========================================================================
   landmarks.js — the things somebody built, and the things the sea left.

   A world of pure terrain has no memory. Landmarks give it one: a temple on a
   ridge is a destination, a torii on the beach frames the sea, a boat drawn up
   on the lake shore implies somebody rowed it there. They are also what breaks
   the visual monotony of an island that is otherwise all ground and foliage.

   Unique structures are SITED, not scattered. findSite() scans the island for
   ground that actually suits a temple — high, flat, and with a view — so the
   building sits where a builder would have put it.
   ========================================================================== */
import { makeRNG, makeNoise2D, clamp, lerp, smoothstep } from './noise.js';
import { WORLD } from './terrain.js';
import { makePropMaterial, paint, deform, populate } from './flora.js';

/* ==========================================================================
   Siting
   ========================================================================== */

/** Scan the island and return the single best spot for a one-off structure. */
export function findSite(field, o) {
  let best = null;
  const step = o.step || 14;
  const lim = WORLD.halfExtent - 40;
  for (let x = -lim; x <= lim; x += step) {
    for (let z = -lim; z <= lim; z += step) {
      const h = field.heightAt(x, z);
      if (h < (o.minY || 0) || h > (o.maxY || 999)) continue;
      if (field.lake && field.lakeT(x, z) < 1.25) continue;

      // flatness over the structure's actual footprint, not at a single point
      const r = o.flatR || 9;
      let lo = 1e9, hi = -1e9;
      for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) {
        const hh = field.heightAt(x + dx, z + dz);
        if (hh < lo) lo = hh;
        if (hh > hi) hi = hh;
      }
      const relief = hi - lo;
      if (relief > (o.maxRelief || 4.5)) continue;

      const w = field.climate.climateAt(x, z, h, field.inlandOf(x, z), field.moistureAt(x, z));
      const s = o.score(w, h, x, z, relief);
      if (s > 0 && (!best || s > best.score)) best = { x, z, h, w, score: s, relief };
    }
  }
  return best;
}

/* ==========================================================================
   A material for things that do not move and are not instanced
   ========================================================================== */

const staticMats = new Map();

function makeStaticMaterial(BABYLON, scene, shaders, name, opts) {
  opts = opts || {};
  if (staticMats.has(name)) return staticMats.get(name);

  BABYLON.Effect.ShadersStore[name + 'VertexShader'] = /* glsl */`
    precision highp float;
    attribute vec3 position; attribute vec3 normal; attribute vec4 color; attribute vec2 uv;
    uniform mat4 world; uniform mat4 worldViewProjection;
    varying vec3 vWorld; varying vec3 vNormal; varying vec3 vCol; varying float vGlow;
    void main(){
      vec4 wp = world * vec4(position, 1.0);
      vWorld = wp.xyz;
      vNormal = normalize(mat3(world) * normal);
      vCol = color.rgb;
      vGlow = uv.x;                 // 1 = this surface emits rather than reflects
      gl_Position = worldViewProjection * vec4(position, 1.0);
    }`;

  BABYLON.Effect.ShadersStore[name + 'FragmentShader'] = /* glsl */`
    precision highp float;
    varying vec3 vWorld; varying vec3 vNormal; varying vec3 vCol; varying float vGlow;
    uniform vec3 uEmber;            // the lantern colour, and how strong it burns
    ${shaders.FRAG_PRELUDE}
    void main(){
      if (uDebug > 0.5) { gl_FragColor = vec4(vCol, 1.0); return; }
      vec3 N = normalize(vNormal);
      vec3 V = normalize(uCamPos - vWorld);
      vec3 col = toonLit(vCol, N, V, ${(opts.shadeSoft || 0.34).toFixed(2)},
                         ${(opts.bandLift || 0.10).toFixed(2)},
                         ${(opts.rimScale || 0.9).toFixed(2)});
      // a lantern is brightest when the sky is darkest
      col = mix(col, uEmber, vGlow);
      col = applyAerial(col, vWorld);
      gl_FragColor = vec4(col, 1.0);
    }`;

  const mat = new BABYLON.ShaderMaterial(name + 'Mat', scene,
    { vertex: name, fragment: name },
    shaders.shaderOptions(['color'], ['uEmber']));
  mat.setColor3('uEmber', new BABYLON.Color3(1, 0.72, 0.36));
  mat.backFaceCulling = opts.cull !== false;
  staticMats.set(name, mat);
  return mat;
}

/* -------------------------------------------------------------------------- */

const STONE = [0.64, 0.60, 0.52];
const STONE_DARK = [0.46, 0.44, 0.41];
const ROOF = [0.34, 0.29, 0.31];
const WOOD = [0.42, 0.29, 0.20];
const VERMILION = [0.60, 0.19, 0.15];

function box(BABYLON, scene, w, h, d, x, y, z, rgb, glow) {
  const m = BABYLON.MeshBuilder.CreateBox('b', { width: w, height: h, depth: d }, scene);
  m.position.set(x, y, z);
  m.bakeCurrentTransformIntoVertices();
  paint(BABYLON, m, rgb, glow || 0, 0);
  return m;
}

function cyl(BABYLON, scene, h, dTop, dBot, tess, x, y, z, rgb, glow) {
  const m = BABYLON.MeshBuilder.CreateCylinder('c',
    { height: h, diameterTop: dTop, diameterBottom: dBot, tessellation: tess }, scene);
  m.position.set(x, y, z);
  m.bakeCurrentTransformIntoVertices();
  paint(BABYLON, m, rgb, glow || 0, 0);
  return m;
}

/* ==========================================================================
   The Temple
   ========================================================================== */

function templeGeometry(BABYLON, scene, field) {
  const noise = makeNoise2D(field.seed + 3131);
  const p = [];

  // three steps, each smaller than the last
  p.push(box(BABYLON, scene, 15.0, 0.6, 15.0, 0, 0.30, 0, STONE_DARK));
  p.push(box(BABYLON, scene, 13.4, 0.6, 13.4, 0, 0.90, 0, STONE_DARK));
  p.push(box(BABYLON, scene, 12.0, 0.7, 12.0, 0, 1.55, 0, STONE));

  // a colonnade round the edge — corners plus two to a side
  const R = 4.9, COLH = 5.4;
  const spots = [];
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (i === 0 && j === 0) continue;
      spots.push([i * R, j * R]);
    }
  }
  for (const [cx, cz] of spots) {
    p.push(cyl(BABYLON, scene, COLH, 0.62, 0.80, 10, cx, 1.9 + COLH / 2, cz, STONE));
    p.push(cyl(BABYLON, scene, 0.34, 0.98, 0.78, 10, cx, 1.9 + COLH + 0.17, cz, STONE));  // capital
    p.push(cyl(BABYLON, scene, 0.30, 0.86, 1.02, 10, cx, 1.9 + 0.15, cz, STONE));         // base
  }

  // architrave and a low tiered roof
  const top = 1.9 + COLH + 0.34;
  p.push(box(BABYLON, scene, 12.4, 0.75, 12.4, 0, top + 0.37, 0, STONE));
  p.push(box(BABYLON, scene, 11.2, 0.55, 11.2, 0, top + 1.02, 0, ROOF));
  // a four-sided pyramid is a cylinder with four sides, turned to sit square
  const cap = BABYLON.MeshBuilder.CreateCylinder('cap',
    { height: 2.6, diameterTop: 0, diameterBottom: 13.2, tessellation: 4 }, scene);
  cap.rotation.y = Math.PI / 4;
  cap.position.y = top + 1.3 + 1.3;
  cap.bakeCurrentTransformIntoVertices();
  paint(BABYLON, cap, ROOF, 0, 0);
  p.push(cap);
  p.push(cyl(BABYLON, scene, 1.1, 0.10, 0.5, 8, 0, top + 4.1, 0, STONE));   // finial

  // the inner chamber, and the flame inside it
  p.push(box(BABYLON, scene, 4.4, 3.2, 4.4, 0, 1.9 + 1.6, 0, STONE_DARK));
  p.push(cyl(BABYLON, scene, 0.9, 1.05, 1.25, 10, 0, 1.9 + 3.6, 0, STONE));
  p.push(cyl(BABYLON, scene, 0.62, 0.52, 0.72, 8, 0, 1.9 + 4.3, 0, [1, 0.82, 0.5], 1));

  const m = BABYLON.Mesh.MergeMeshes(p, true, true, undefined, false, false);
  m.name = 'temple';
  deform(BABYLON, m, noise, 0.035, 2.2, 1.0);       // weathering, barely there
  return m;
}

/* ==========================================================================
   The Standing Stones
   ========================================================================== */

function stonesGeometry(BABYLON, scene, field) {
  const rng = makeRNG(field.seed + 5757);
  const noise = makeNoise2D(field.seed + 5858);
  const p = [];
  const N = 9, R = 10.5;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + rng() * 0.12;
    const h = 3.2 + rng() * 2.6;
    const s = BABYLON.MeshBuilder.CreateBox('m',
      { width: 1.1 + rng() * 0.7, height: h, depth: 0.7 + rng() * 0.5 }, scene);
    s.rotation.set((rng() - 0.5) * 0.14, a + (rng() - 0.5) * 0.4, (rng() - 0.5) * 0.14);
    s.position.set(Math.cos(a) * R, h * 0.44, Math.sin(a) * R);
    s.bakeCurrentTransformIntoVertices();
    paint(BABYLON, s, STONE_DARK, 0, 0);
    p.push(s);
  }
  // a fallen one, because a circle that is perfect reads as a fence
  const f = BABYLON.MeshBuilder.CreateBox('fallen', { width: 1.2, height: 4.4, depth: 0.8 }, scene);
  f.rotation.set(Math.PI / 2 - 0.1, 1.2, 0.08);
  f.position.set(Math.cos(2.1) * R * 0.86, 0.45, Math.sin(2.1) * R * 0.86);
  f.bakeCurrentTransformIntoVertices();
  paint(BABYLON, f, STONE_DARK, 0, 0);
  p.push(f);

  // the altar at the centre
  p.push(box(BABYLON, scene, 3.0, 0.5, 2.0, 0, 0.28, 0, STONE));

  const m = BABYLON.Mesh.MergeMeshes(p, true, true, undefined, false, false);
  m.name = 'stones';
  deform(BABYLON, m, noise, 0.07, 1.6, 1.0);
  return m;
}

/* ==========================================================================
   The Gate — a torii on the strand, framing the sea
   ========================================================================== */

function gateGeometry(BABYLON, scene) {
  const p = [];
  const W = 4.4, H = 6.0;
  for (const s of [-1, 1]) {
    p.push(cyl(BABYLON, scene, H, 0.40, 0.56, 9, s * W / 2, H / 2, 0, VERMILION));
  }
  // the upper lintel sweeps wider than the lower tie-beam
  const lintel = box(BABYLON, scene, W + 2.6, 0.42, 0.70, 0, H + 0.10, 0, VERMILION);
  p.push(lintel);
  p.push(box(BABYLON, scene, W + 3.3, 0.30, 0.86, 0, H + 0.46, 0, [0.16, 0.13, 0.15]));
  p.push(box(BABYLON, scene, W + 0.7, 0.34, 0.50, 0, H - 1.15, 0, VERMILION));
  p.push(box(BABYLON, scene, 0.44, 0.9, 0.44, 0, H - 0.52, 0, VERMILION));

  const m = BABYLON.Mesh.MergeMeshes(p, true, true, undefined, false, false);
  m.name = 'gate';
  return m;
}

/* ==========================================================================
   The Boat
   ========================================================================== */

function boatGeometry(BABYLON, scene) {
  const LEN = 4.6, BEAM = 1.42, DEPTH = 0.62;
  const N = 11;
  const pos = [], idx = [], col = [], uv = [];

  // Loft a U-shaped cross-section along the hull. Width follows a sine so the
  // boat is fullest amidships and comes to a point at both ends.
  const ring = (t) => {
    const z = (t - 0.5) * LEN;
    const w = Math.pow(Math.sin(Math.PI * t), 0.62) * BEAM / 2;
    const sheer = DEPTH + Math.pow(Math.abs(t - 0.5) * 2, 2.2) * 0.30;   // rise at the ends
    return [
      [-w, sheer, z],
      [-w * 0.86, sheer * 0.34, z],
      [0, 0, z],
      [w * 0.86, sheer * 0.34, z],
      [w, sheer, z],
    ];
  };

  for (let i = 0; i < N; i++) {
    for (const v of ring(i / (N - 1))) { pos.push(v[0], v[1], v[2]); col.push(0.46, 0.32, 0.22, 1); uv.push(0, 0); }
  }
  for (let i = 0; i < N - 1; i++) {
    for (let k = 0; k < 4; k++) {
      const a = i * 5 + k, b = a + 1, c = a + 5, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }

  const hull = new BABYLON.Mesh('hull', scene);
  const vd = new BABYLON.VertexData();
  vd.positions = pos; vd.indices = idx; vd.colors = col; vd.uvs = uv;
  const nn = []; BABYLON.VertexData.ComputeNormals(pos, idx, nn); vd.normals = nn;
  vd.applyToMesh(hull, false);

  const p = [hull];
  // gunwale rails
  for (const s of [-1, 1]) {
    const rail = BABYLON.MeshBuilder.CreateBox('rail',
      { width: 0.10, height: 0.13, depth: LEN * 0.92 }, scene);
    rail.position.set(s * BEAM / 2 * 0.93, DEPTH + 0.05, 0);
    rail.bakeCurrentTransformIntoVertices();
    paint(BABYLON, rail, [0.33, 0.22, 0.15], 0, 0);
    p.push(rail);
  }
  // two thwarts
  for (const z of [-0.85, 0.75]) {
    p.push(box(BABYLON, scene, BEAM * 0.92, 0.09, 0.34, 0, DEPTH * 0.78, z, [0.38, 0.27, 0.19]));
  }
  // an oar shipped along the rail
  const oar = BABYLON.MeshBuilder.CreateCylinder('oar',
    { height: 2.9, diameterTop: 0.055, diameterBottom: 0.075, tessellation: 5 }, scene);
  oar.rotation.set(Math.PI / 2, 0.14, 0);
  oar.position.set(-0.26, DEPTH + 0.14, 0.2);
  oar.bakeCurrentTransformIntoVertices();
  paint(BABYLON, oar, [0.44, 0.33, 0.22], 0, 0);
  p.push(oar);
  const blade = box(BABYLON, scene, 0.30, 0.05, 0.75, -0.26, DEPTH + 0.14, 1.72, [0.44, 0.33, 0.22]);
  p.push(blade);

  const m = BABYLON.Mesh.MergeMeshes(p, true, true, undefined, false, false);
  m.name = 'boat';
  return m;
}

/* ==========================================================================
   Small scattered things
   ========================================================================== */

function lanternGeometry(BABYLON, scene) {
  const p = [];
  p.push(cyl(BABYLON, scene, 0.28, 0.72, 0.88, 8, 0, 0.14, 0, STONE_DARK));
  p.push(cyl(BABYLON, scene, 0.95, 0.28, 0.34, 7, 0, 0.75, 0, STONE));
  p.push(cyl(BABYLON, scene, 0.20, 0.82, 0.54, 8, 0, 1.32, 0, STONE));
  p.push(box(BABYLON, scene, 0.62, 0.58, 0.62, 0, 1.70, 0, [1, 0.80, 0.48], 1));   // the light
  const roof = BABYLON.MeshBuilder.CreateCylinder('lr',
    { height: 0.42, diameterTop: 0.10, diameterBottom: 1.10, tessellation: 6 }, scene);
  roof.position.y = 2.16;
  roof.bakeCurrentTransformIntoVertices();
  paint(BABYLON, roof, STONE_DARK, 0, 0);
  p.push(roof);
  const m = BABYLON.Mesh.MergeMeshes(p, true, true, undefined, false, false);
  m.name = 'lantern';
  return m;
}

function driftwoodGeometry(BABYLON, scene, field) {
  const rng = makeRNG(field.seed + 6161);
  const noise = makeNoise2D(field.seed + 6262);
  const p = [];
  const trunk = BABYLON.MeshBuilder.CreateCylinder('dw',
    { height: 3.6, diameterTop: 0.34, diameterBottom: 0.52, tessellation: 6 }, scene);
  trunk.rotation.set(Math.PI / 2 - 0.08, 0, 0.06);
  trunk.position.y = 0.26;
  trunk.bakeCurrentTransformIntoVertices();
  paint(BABYLON, trunk, [1, 1, 1], 1, 0);
  p.push(trunk);
  for (let i = 0; i < 3; i++) {
    const b = BABYLON.MeshBuilder.CreateCylinder('br',
      { height: 1.0 + rng() * 0.8, diameterTop: 0.07, diameterBottom: 0.17, tessellation: 4 }, scene);
    b.rotation.set(1.1 + rng() * 0.7, rng() * 6.28, (rng() - 0.5) * 1.1);
    b.position.set((rng() - 0.5) * 0.5, 0.35, (rng() - 0.5) * 2.6);
    b.bakeCurrentTransformIntoVertices();
    paint(BABYLON, b, [1, 1, 1], 1, 0);
    p.push(b);
  }
  const m = BABYLON.Mesh.MergeMeshes(p, true, true, undefined, false, false);
  m.name = 'driftwood';
  deform(BABYLON, m, noise, 0.05, 1.8, 1.0);
  return m;
}

function shardGeometry(BABYLON, scene, field) {
  const noise = makeNoise2D(field.seed + 6363);
  const m = BABYLON.MeshBuilder.CreateCylinder('sh',
    { height: 3.4, diameterTop: 0.05, diameterBottom: 1.05, tessellation: 5 }, scene);
  m.position.y = 1.5;
  m.bakeCurrentTransformIntoVertices();
  deform(BABYLON, m, noise, 0.10, 1.3, 0.5);
  paint(BABYLON, m, [1, 1, 1], 1, 0);
  m.name = 'shard';
  return m;
}

/* ==========================================================================
   Build
   ========================================================================== */

export function buildLandmarks(BABYLON, scene, field, shaders, opts) {
  opts = opts || {};
  const rng = makeRNG(field.seed + 8080);
  const items = {};
  const mats = [];
  const stone = makeStaticMaterial(BABYLON, scene, shaders, 'monument',
    { shadeSoft: 0.36, bandLift: 0.12, rimScale: 0.9, cull: false });
  mats.push(stone);

  const place = (mesh, x, z, lift, rotY) => {
    mesh.material = stone;
    mesh.position.set(x, field.heightAt(x, z) + (lift || 0), z);
    mesh.rotation.y = rotY || 0;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    return mesh;
  };

  /* --- the temple: high, flat, and looking out over everything ----------- */
  const tSite = findSite(field, {
    minY: 34, maxY: 82, flatR: 9, maxRelief: 5.0, step: 12,
    // it wants open ground with a view, not a clearing in the trees
    score: (w, h, x, z) => (w.meadow * 1.0 + w.rock * 0.5 + w.forest * 0.15)
      * (h / 80) * (1 - w.snow) * (1 - w.desert * 0.8)
      // and it should be a walk from the landing, not on top of it
      * smoothstep(120, 300, Math.hypot(x - WORLD.startX, z - WORLD.startZ)),
  });
  if (tSite) {
    items.temple = place(templeGeometry(BABYLON, scene, field), tSite.x, tSite.z, -0.9,
      rng() * Math.PI * 2);
    items.templeSite = tSite;
  }

  /* --- the standing stones: a bare high shoulder -------------------------- */
  const sSite = findSite(field, {
    minY: 26, maxY: 96, flatR: 11, maxRelief: 5.5, step: 12,
    score: (w, h, x, z) => (w.meadow * 0.7 + w.rock * 1.0 + w.snow * 0.5)
      * (1 - w.forest) * (h / 90)
      * (tSite ? smoothstep(90, 260, Math.hypot(x - tSite.x, z - tSite.z)) : 1),
  });
  if (sSite) items.stones = place(stonesGeometry(BABYLON, scene, field), sSite.x, sSite.z, -0.5, rng() * 6.28);

  /* --- the gate: on the strand near where the traveller lands ------------- */
  const gSite = findSite(field, {
    minY: 1.4, maxY: 7.0, flatR: 5, maxRelief: 3.0, step: 8,
    score: (w, h, x, z) => w.beach * 1.0
      * smoothstep(150, 26, Math.hypot(x - WORLD.startX, z - WORLD.startZ)),
  });
  if (gSite) {
    // turned to face the open sea, so you walk through it toward the water
    const face = Math.atan2(gSite.x - WORLD.startX, gSite.z - (WORLD.shoreZ - 120));
    items.gate = place(gateGeometry(BABYLON, scene), gSite.x, gSite.z, -0.35, face + Math.PI / 2);
  }

  /* --- the boat, drawn up on the lake ------------------------------------ */
  if (field.lake) {
    const a = rng() * Math.PI * 2;
    const bx = field.lake.x + Math.cos(a) * field.lake.r * 0.80;
    const bz = field.lake.z + Math.sin(a) * field.lake.r * 0.80;
    const boat = boatGeometry(BABYLON, scene);
    boat.material = stone;
    boat.position.set(bx, field.lakeLevel - 0.22, bz);
    boat.rotation.y = a + 1.3;
    boat.isPickable = false;
    boat.alwaysSelectAsActiveMesh = true;
    items.boat = boat;
    items.boatHome = { x: bx, z: bz, y: field.lakeLevel - 0.22, rotY: boat.rotation.y };
  }

  /* --- scattered small things -------------------------------------------- */
  const scatterProp = (name, mesh, matOpts, n, rule, popOpts) => {
    if (n <= 0) return;
    const r2 = makeRNG(field.seed + name.length * 1319 + 7);
    mesh.material = makePropMaterial(BABYLON, scene, shaders, name, matOpts);
    const spots = [];
    let tries = 0;
    const lim = WORLD.halfExtent - 12;
    while (spots.length < n && tries++ < n * 60) {
      const ang = r2() * Math.PI * 2, rad = Math.sqrt(r2()) * 470;
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      if (Math.abs(x) > lim || Math.abs(z) > lim) continue;
      const y = field.heightAt(x, z);
      if (field.lake && field.lakeT(x, z) < 1.05 && y < field.lakeLevel + 0.1) continue;
      const w = field.climate.climateAt(x, z, y, field.inlandOf(x, z), field.moistureAt(x, z));
      const nrm = field.normalAt(x, z, 1.8);
      const slope = 1 - clamp(nrm[1], 0, 1);
      const p = rule(w, y, slope, x, z);
      if (p <= 0 || r2() > p) continue;
      spots.push({ x, y, z, slope, w, moist: 0 });
    }
    const live = populate(BABYLON, mesh, spots, r2, popOpts);
    items[name] = { mesh, count: live };
    mats.push(mesh.material);
  };

  // stone lanterns: a path of them near the temple, a few by the lake
  scatterProp('lantern', lanternGeometry(BABYLON, scene),
    { shadeSoft: 0.34, bandLift: 0.16, rimScale: 0.9 },
    opts.lanterns == null ? 46 : opts.lanterns,
    (w, y, slope, x, z) => {
      if (slope > 0.30) return 0;
      let p = 0;
      if (tSite) p += smoothstep(120, 16, Math.hypot(x - tSite.x, z - tSite.z)) * 0.9;
      if (field.lake) p += smoothstep(1.9, 1.15, field.lakeT(x, z)) * 0.5;
      return clamp(p, 0, 1);
    },
    { scale: () => ({ x: 1, y: 1, z: 1 }), sink: () => -0.15,
      tint: () => [1, 1, 1] });

  // driftwood on the strand
  scatterProp('driftwood', driftwoodGeometry(BABYLON, scene, field),
    { shadeSoft: 0.44, bandLift: 0.16, rimScale: 0.85, cull: false },
    opts.driftwood == null ? 150 : opts.driftwood,
    (w, y, slope) => (slope > 0.34 ? 0 : clamp(w.beach * 1.1 - w.snow, 0, 1)),
    { scale: (s, r) => { const v = 0.55 + r() * 0.75; return { x: v, y: v * (0.8 + r() * 0.4), z: v }; },
      sink: () => -0.12,
      tint: (s, r) => { const j = 0.9 + r() * 0.24; return [0.66 * j, 0.62 * j, 0.56 * j]; } });

  // ice shards up in the snow
  scatterProp('shard', shardGeometry(BABYLON, scene, field),
    { shadeSoft: 0.52, bandLift: 0.26, rimScale: 1.0, cull: false },
    opts.shards == null ? 260 : opts.shards,
    (w, y, slope) => (slope > 0.62 ? 0 : clamp(w.snow * 1.25 - 0.15, 0, 1)),
    { scale: (s, r) => { const v = 0.5 + Math.pow(r(), 1.8) * 1.5;
      return { x: v * (0.6 + r() * 0.6), y: v * (0.8 + r() * 0.9), z: v * (0.6 + r() * 0.6) }; },
      sink: (s, sc) => -sc.y * 0.22,
      rot: (s, r) => BABYLON.Quaternion.FromEulerAngles((r() - 0.5) * 0.35, r() * 6.28, (r() - 0.5) * 0.35),
      tint: (s, r) => { const j = 0.92 + r() * 0.2;
        return [0.72 * j, 0.86 * j, 0.98 * j]; } });

  /* --- the lantern flame answers the sky --------------------------------- */
  function update(sky) {
    // embers barely show at noon and burn hard at night
    const night = clamp(1 - (sky.elevation != null ? Math.sin(sky.elevation) : 0.5) * 2.2, 0, 1);
    stone.setColor3('uEmber', new BABYLON.Color3(
      1.00 * (0.35 + night * 0.9),
      0.74 * (0.35 + night * 0.85),
      0.42 * (0.35 + night * 0.7)));
  }

  return { items, mats, update, templeSite: tSite, stonesSite: sSite, gateSite: gSite };
}
