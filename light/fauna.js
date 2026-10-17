/* ==========================================================================
   fauna.js — the things that move on their own.

   Two kinds, chosen because they do different jobs:

     deer   give the ground scale and make the meadow feel inhabited. They
            graze, wander, and break into a run if you get too close — which
            is the moment the world stops being scenery.
     birds  give the SKY something to do. An empty sky is the fastest way to
            make an outdoor scene feel like a diorama.

   Both are thin-instanced: one draw call each, however many there are. The
   legs and wings are animated in the VERTEX shader from a per-instance gait
   phase, so the CPU only ever moves a transform — no skeletons, no per-limb
   matrices, and a herd costs about what one animal costs.
   ========================================================================== */
import { makeRNG, makeNoise2D, clamp, lerp, smoothstep } from './noise.js';
import { WORLD } from './terrain.js';
import { paint } from './flora.js';

/* ==========================================================================
   Materials
   ========================================================================== */

function faunaMaterial(BABYLON, scene, shaders, name, body) {
  BABYLON.Effect.ShadersStore[name + 'VertexShader'] = /* glsl */`
    precision highp float;
    #include<instancesDeclaration>
    attribute vec3 position; attribute vec3 normal; attribute vec4 color; attribute vec2 uv;
    attribute vec3 aTint;
    attribute vec2 aAnim;            // x = gait phase, y = 0..1 effort
    uniform mat4 viewProjection;
    uniform float uTime;
    varying vec3 vWorld; varying vec3 vNormal; varying vec3 vCol;
    void main(){
      #include<instancesVertex>
      vec3 p = position;
      ${body}
      vec4 wp = finalWorld * vec4(p, 1.0);
      vWorld = wp.xyz;
      vNormal = normalize(mat3(finalWorld) * normal);
      vCol = color.rgb * aTint;
      gl_Position = viewProjection * wp;
    }`;

  BABYLON.Effect.ShadersStore[name + 'FragmentShader'] = /* glsl */`
    precision highp float;
    varying vec3 vWorld; varying vec3 vNormal; varying vec3 vCol;
    ${shaders.FRAG_PRELUDE}
    void main(){
      if (uDebug > 0.5) { gl_FragColor = vec4(vCol, 1.0); return; }
      vec3 N = normalize(vNormal);
      vec3 V = normalize(uCamPos - vWorld);
      // full rim: a living thing should never be lost against the ground
      vec3 col = toonLit(vCol, N, V, 0.38, 0.12, 1.0);
      col = applyAerial(col, vWorld);
      gl_FragColor = vec4(col, 1.0);
    }`;

  const mat = new BABYLON.ShaderMaterial(name + 'Mat', scene,
    { vertex: name, fragment: name },
    shaders.shaderOptions(['color', 'aTint', 'aAnim'], ['viewProjection']));
  mat.backFaceCulling = false;
  return mat;
}

/* ==========================================================================
   Deer
   ========================================================================== */

const HIDE = [0.52, 0.38, 0.26];
const HIDE_PALE = [0.72, 0.62, 0.50];

function deerGeometry(BABYLON, scene) {
  const p = [];
  const add = (m, rgb) => { m.bakeCurrentTransformIntoVertices(); paint(BABYLON, m, rgb, 1, 0); p.push(m); };

  // body
  const body = BABYLON.MeshBuilder.CreateIcoSphere('bd', { radius: 0.52, subdivisions: 2 }, scene);
  body.scaling.set(0.78, 0.82, 1.55);
  body.position.set(0, 1.02, 0);
  add(body, HIDE);

  // chest, a little deeper than the rump
  const chest = BABYLON.MeshBuilder.CreateIcoSphere('ch', { radius: 0.40, subdivisions: 2 }, scene);
  chest.scaling.set(0.86, 0.96, 1.0);
  chest.position.set(0, 0.98, 0.46);
  add(chest, HIDE);

  // neck and head
  const neck = BABYLON.MeshBuilder.CreateCylinder('nk',
    { height: 0.68, diameterTop: 0.22, diameterBottom: 0.34, tessellation: 6 }, scene);
  neck.rotation.x = -0.62;
  neck.position.set(0, 1.42, 0.72);
  add(neck, HIDE);

  const head = BABYLON.MeshBuilder.CreateIcoSphere('hd', { radius: 0.19, subdivisions: 2 }, scene);
  head.scaling.set(0.9, 0.9, 1.5);
  head.position.set(0, 1.74, 0.96);
  add(head, HIDE);

  for (const s of [-1, 1]) {
    const ear = BABYLON.MeshBuilder.CreateIcoSphere('er', { radius: 0.09, subdivisions: 1 }, scene);
    ear.scaling.set(0.5, 1.1, 1.6);
    ear.rotation.z = s * 0.5;
    ear.position.set(s * 0.15, 1.85, 0.88);
    add(ear, HIDE_PALE);

    // antlers: a beam and two tines
    const beam = BABYLON.MeshBuilder.CreateCylinder('at',
      { height: 0.52, diameterTop: 0.025, diameterBottom: 0.05, tessellation: 4 }, scene);
    beam.rotation.set(-0.25, 0, s * 0.42);
    beam.position.set(s * 0.12, 2.06, 0.86);
    add(beam, HIDE_PALE);
    for (const [ty, tz, tr] of [[2.22, 0.98, 0.9], [2.30, 0.74, -0.5]]) {
      const tine = BABYLON.MeshBuilder.CreateCylinder('ti',
        { height: 0.30, diameterTop: 0.015, diameterBottom: 0.032, tessellation: 4 }, scene);
      tine.rotation.set(tr * 0.6, 0, s * 0.9);
      tine.position.set(s * 0.24, ty, tz);
      add(tine, HIDE_PALE);
    }
  }

  // tail
  const tail = BABYLON.MeshBuilder.CreateIcoSphere('tl', { radius: 0.12, subdivisions: 1 }, scene);
  tail.scaling.set(0.8, 1.2, 0.6);
  tail.position.set(0, 1.18, -0.72);
  add(tail, HIDE_PALE);

  // four legs. Their LOCAL x/z signs are what the shader reads to pick a
  // diagonal gait, so the geometry has to stay on its own quarter.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = BABYLON.MeshBuilder.CreateCylinder('lg',
        { height: 0.92, diameterTop: 0.065, diameterBottom: 0.105, tessellation: 4 }, scene);
      leg.position.set(sx * 0.27, 0.46, sz * 0.52);
      add(leg, HIDE);
      const hoof = BABYLON.MeshBuilder.CreateCylinder('hf',
        { height: 0.10, diameterTop: 0.085, diameterBottom: 0.065, tessellation: 4 }, scene);
      hoof.position.set(sx * 0.27, 0.05, sz * 0.52);
      add(hoof, [0.20, 0.16, 0.14]);
    }
  }

  const m = BABYLON.Mesh.MergeMeshes(p, true, true, undefined, false, false);
  m.name = 'deer';
  return m;
}

/* The gait. Legs swing about the shoulder; the diagonal pairs are half a
   cycle apart, which is what a trot looks like. Everything above the belly
   just rides the bob. */
const DEER_GAIT = `
      float legTop = 0.92;
      if (p.y < legTop) {
        float diag = (p.x * p.z > 0.0) ? 0.0 : 3.14159;
        float ph = aAnim.x + diag;
        float lever = (legTop - p.y);
        p.z += sin(ph) * lever * 0.52 * aAnim.y;
        p.y += max(0.0, cos(ph)) * lever * 0.16 * aAnim.y;
      } else {
        p.y += sin(aAnim.x * 2.0) * 0.035 * aAnim.y;
      }
`;

export function buildDeer(BABYLON, scene, field, shaders, opts) {
  opts = opts || {};
  const COUNT = opts.count == null ? 26 : opts.count;
  if (COUNT <= 0) return null;

  const rng = makeRNG(field.seed + 4747);
  const mesh = deerGeometry(BABYLON, scene);
  mesh.material = faunaMaterial(BABYLON, scene, shaders, 'deer', DEER_GAIT);
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;

  /* home ranges: meadow and forest edge, never on ice, sand or water */
  const herd = [];
  let tries = 0;
  const lim = WORLD.halfExtent - 30;
  while (herd.length < COUNT && tries++ < COUNT * 400) {
    const x = (rng() * 2 - 1) * lim, z = (rng() * 2 - 1) * lim;
    const y = field.heightAt(x, z);
    if (y < 2 || y > 70) continue;
    if (field.lake && field.lakeT(x, z) < 1.3) continue;
    const w = field.climate.climateAt(x, z, y, field.inlandOf(x, z), field.moistureAt(x, z));
    const p = clamp(w.meadow * 1.0 + w.forest * 0.55 + w.marsh * 0.4 - w.desert - w.snow, 0, 1);
    if (rng() > p) continue;
    herd.push({
      hx: x, hz: z,                       // the centre of its range
      x, z, y,
      heading: rng() * Math.PI * 2,
      speed: 0, gait: 0, phase: rng() * 6.28,
      rest: rng() * 6,                    // seconds left of grazing
      range: 26 + rng() * 34,
      tint: 0.82 + rng() * 0.36,
      scale: 0.86 + rng() * 0.3,
    });
  }

  const M = new Float32Array(herd.length * 16);
  const T = new Float32Array(herd.length * 3);
  const A = new Float32Array(herd.length * 2);
  for (let i = 0; i < herd.length; i++) {
    const d = herd[i];
    T[i * 3] = d.tint; T[i * 3 + 1] = d.tint * 0.98; T[i * 3 + 2] = d.tint * 0.94;
  }
  const m = BABYLON.Matrix.Identity();
  const sv = new BABYLON.Vector3(), pv = new BABYLON.Vector3();

  function writeInstances() {
    for (let i = 0; i < visible; i++) {
      const d = herd[i];
      sv.set(d.scale, d.scale, d.scale);
      pv.set(d.x, d.y, d.z);
      BABYLON.Matrix.ComposeToRef(sv,
        BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, d.heading), pv, m);
      m.copyToArray(M, i * 16);
      A[i * 2] = d.phase;
      A[i * 2 + 1] = d.gait;
    }
    if (bound) {
      // the arrays are already on the GPU; say they changed, do not resend
      mesh.thinInstanceBufferUpdated('matrix');
      mesh.thinInstanceBufferUpdated('aAnim');
    } else {
      mesh.thinInstanceSetBuffer('matrix', M, 16, true);
      mesh.thinInstanceSetBuffer('aAnim', A, 2, true);
      bound = true;
    }
  }

  /* The herd is built once at full size and then CAPPED. Rebuilding it to
     change density would mean re-scattering home ranges, which would teleport
     every animal; capping lets quality move up and down freely and the deer
     that remain stay exactly where they were. */
  let visible = herd.length;

  let bound = false;
  writeInstances();
  mesh.thinInstanceSetBuffer('aTint', T, 3, true);
  mesh.thinInstanceRefreshBoundingInfo(false);

  const FLEE = 22, CALM = 60;

  function update(dt, px, pz) {
    dt = Math.min(dt, 0.06);
    /* Ported from the old wander build: gate every animated thing behind a
       cheap compare before doing any real work. A deer four hundred metres
       away, invisible through the fog, does not need simulating — and the
       squared test avoids a sqrt for the ones that fail it. */
    const FAR2 = 260 * 260;

    for (let i = 0; i < visible; i++) {
      const d = herd[i];
      const ddx = d.x - px, ddz = d.z - pz;
      const far2 = ddx * ddx + ddz * ddz;
      if (far2 > FAR2) continue;
      const toYou = Math.sqrt(far2);

      let want = 0;
      if (toYou < FLEE) {
        // bolt, directly away from you
        d.heading = Math.atan2(d.x - px, d.z - pz);
        want = 7.4;
        d.rest = 1.6 + (i % 3) * 0.4;
      } else if (d.rest > 0) {
        d.rest -= dt;                     // grazing
        want = 0;
      } else {
        // drift back toward the middle of its range, wandering as it goes
        const home = Math.hypot(d.x - d.hx, d.z - d.hz);
        if (home > d.range) d.heading = Math.atan2(d.hx - d.x, d.hz - d.z);
        else d.heading += (Math.sin(d.phase * 0.31 + i) * 0.9) * dt;
        want = 1.5;
        if (toYou > CALM && Math.random() < dt * 0.25) d.rest = 3 + Math.random() * 7;
      }

      d.speed += (want - d.speed) * Math.min(1, dt * 3.4);
      if (d.speed < 0.03) d.speed = 0;

      if (d.speed > 0) {
        const nx = d.x + Math.sin(d.heading) * d.speed * dt;
        const nz = d.z + Math.cos(d.heading) * d.speed * dt;
        const nh = field.heightAt(nx, nz);
        // deer do not swim, and they do not climb cliffs
        const grade = Math.abs(nh - d.y) / Math.max(d.speed * dt, 1e-3);
        if (nh > 1.2 && grade < 1.4 &&
            !(field.lake && field.lakeT(nx, nz) < 1.05 && nh < field.lakeLevel + 0.4)) {
          d.x = nx; d.z = nz;
        } else {
          d.heading += 1.9;               // turn away and try again next frame
        }
      }
      d.y = field.heightAt(d.x, d.z);
      d.phase += dt * (2.0 + d.speed * 1.5);
      d.gait += (clamp(d.speed / 3.2, 0, 1) - d.gait) * Math.min(1, dt * 5);
    }
    writeInstances();
  }

  function setDensity(f) {
    visible = Math.max(0, Math.min(herd.length, Math.round(herd.length * f)));
    mesh.thinInstanceCount = visible;
    return visible;
  }

  return { mesh, herd, update, setDensity, get count() { return visible; } };
}

/* ==========================================================================
   Birds
   ========================================================================== */

function birdGeometry(BABYLON, scene) {
  // a body and two wings, as flat triangles. At the distance birds are seen
  // from, silhouette is the whole of the design.
  const pos = [
    0, 0, 0.34,  -0.05, 0, -0.30,  0.05, 0, -0.30,          // body
    0.03, 0, 0.10,  0.62, 0, -0.06,  0.05, 0, -0.24,        // right wing
    -0.03, 0, 0.10,  -0.05, 0, -0.24,  -0.62, 0, -0.06,     // left wing
  ];
  const idx = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const col = [], uv = [];
  for (let i = 0; i < 9; i++) { col.push(1, 1, 1, 1); uv.push(0, 0); }
  const mesh = new BABYLON.Mesh('bird', scene);
  const vd = new BABYLON.VertexData();
  vd.positions = pos; vd.indices = idx; vd.colors = col; vd.uvs = uv;
  const nn = []; BABYLON.VertexData.ComputeNormals(pos, idx, nn); vd.normals = nn;
  vd.applyToMesh(mesh, false);
  return mesh;
}

/* Wings hinge on |x|: the further out along the wing, the more it lifts. */
const BIRD_FLAP = `
      float span = abs(p.x);
      p.y += sin(aAnim.x) * span * span * 2.6 * aAnim.y;
      p.z += (1.0 - cos(aAnim.x)) * span * 0.18 * aAnim.y;
`;

export function buildBirds(BABYLON, scene, field, shaders, opts) {
  opts = opts || {};
  const COUNT = opts.count == null ? 54 : opts.count;
  if (COUNT <= 0) return null;

  const rng = makeRNG(field.seed + 5353);
  const noise = makeNoise2D(field.seed + 5454);
  const mesh = birdGeometry(BABYLON, scene);
  mesh.material = faunaMaterial(BABYLON, scene, shaders, 'bird', BIRD_FLAP);
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;

  // three flocks, each turning about its own thermal
  const FLOCKS = 3;
  const flocks = [];
  for (let f = 0; f < FLOCKS; f++) {
    flocks.push({
      cx: (rng() * 2 - 1) * 330,
      cz: (rng() * 2 - 1) * 330,
      r: 42 + rng() * 60,
      y: 46 + rng() * 60,
      spin: (rng() < 0.5 ? -1 : 1) * (0.10 + rng() * 0.10),
      drift: rng() * 6.28,
    });
  }

  const birds = [];
  for (let i = 0; i < COUNT; i++) {
    const f = flocks[i % FLOCKS];
    birds.push({
      f, a: rng() * 6.28,
      rr: 0.55 + rng() * 0.75,          // its own radius within the flock
      dy: (rng() - 0.5) * 13,
      scale: 0.8 + rng() * 0.75,
      flap: rng() * 6.28,
      rate: 7.0 + rng() * 3.4,
      tint: 0.16 + rng() * 0.16,
    });
  }

  const M = new Float32Array(COUNT * 16);
  const T = new Float32Array(COUNT * 3);
  const A = new Float32Array(COUNT * 2);
  for (let i = 0; i < COUNT; i++) {
    const t = birds[i].tint;
    T[i * 3] = t; T[i * 3 + 1] = t * 1.02; T[i * 3 + 2] = t * 1.12;
  }
  const m = BABYLON.Matrix.Identity();
  const sv = new BABYLON.Vector3(), pv = new BABYLON.Vector3();
  let clock = 0;

  function update(dt) {
    dt = Math.min(dt, 0.06);
    clock += dt;
    for (let f = 0; f < FLOCKS; f++) {
      const fl = flocks[f];
      // the whole flock drifts, slowly, so the sky is never the same twice
      fl.cx += Math.sin(fl.drift + clock * 0.03) * 3.4 * dt;
      fl.cz += Math.cos(fl.drift * 1.3 + clock * 0.026) * 3.4 * dt;
    }
    for (let i = 0; i < visible; i++) {
      const b = birds[i];
      b.a += b.f.spin * dt;
      b.flap += dt * b.rate;

      const r = b.f.r * b.rr;
      const x = b.f.cx + Math.cos(b.a) * r;
      const z = b.f.cz + Math.sin(b.a) * r;
      const bob = noise(x * 0.01, z * 0.01 + clock * 0.05) * 4.0;
      const y = Math.max(field.heightAt(x, z) + 14, b.f.y + b.dy + bob);

      sv.set(b.scale, b.scale, b.scale);
      pv.set(x, y, z);
      // face along the circle, and bank into the turn
      const heading = b.a + (b.f.spin > 0 ? Math.PI / 2 : -Math.PI / 2);
      BABYLON.Matrix.ComposeToRef(sv,
        BABYLON.Quaternion.FromEulerAngles(0, heading, b.f.spin > 0 ? 0.42 : -0.42), pv, m);
      m.copyToArray(M, i * 16);
      A[i * 2] = b.flap;
      A[i * 2 + 1] = 1;
    }
    if (bound) {
      mesh.thinInstanceBufferUpdated('matrix');
      mesh.thinInstanceBufferUpdated('aAnim');
    } else {
      mesh.thinInstanceSetBuffer('matrix', M, 16, true);
      mesh.thinInstanceSetBuffer('aAnim', A, 2, true);
      bound = true;
    }
    mesh.thinInstanceCount = visible;
  }

  let visible = COUNT;

  let bound = false;
  update(0);
  mesh.thinInstanceSetBuffer('aTint', T, 3, true);
  mesh.thinInstanceRefreshBoundingInfo(false);
  // the flock roams far; let it draw wherever it is
  mesh.alwaysSelectAsActiveMesh = true;

  function setDensity(f) {
    visible = Math.max(0, Math.min(COUNT, Math.round(COUNT * f)));
    mesh.thinInstanceCount = visible;
    return visible;
  }

  return { mesh, update, setDensity, get count() { return visible; } };
}

/* -------------------------------------------------------------------------- */

export function buildFauna(BABYLON, scene, field, shaders, opts) {
  opts = opts || {};
  const deer = buildDeer(BABYLON, scene, field, shaders, opts.deer);
  const birds = buildBirds(BABYLON, scene, field, shaders, opts.birds);
  const mats = [];
  if (deer) mats.push(deer.mesh.material);
  if (birds) mats.push(birds.mesh.material);
  return {
    deer, birds, mats,
    // a getter, not a snapshot: density moves at runtime and a stale count
    // makes the quality control look like it did nothing
    get counts() {
      return { deer: deer ? deer.count : 0, birds: birds ? birds.count : 0 };
    },
    update(dt, px, pz) {
      if (deer) deer.update(dt, px, pz);
      if (birds) birds.update(dt);
    },
    /** scale the living population without rebuilding it */
    setDensity(f) {
      if (deer) deer.setDensity(f);
      if (birds) birds.setDensity(f);
      return { deer: deer ? deer.count : 0, birds: birds ? birds.count : 0 };
    },
  };
}
