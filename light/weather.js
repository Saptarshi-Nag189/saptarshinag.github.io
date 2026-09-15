/* ==========================================================================
   weather.js — the air, and what is moving in it.

   Ground and foliage make a place; particles make it feel alive and make it
   feel like a TIME. Four effects, each tied to a biome and to an hour, so
   walking somewhere new or staying somewhere long enough both change what is
   in the air:

     fireflies  forest and marsh, dusk into night. The biggest single mood win
                available, and the reason to still be out after the light goes.
     petals     drifting where the blossom trees are, which is what gives the
                rare tree a reason to be walked to.
     sand       streaming off the dune crests, hardest in the middle of the day
                when the desert should feel least hospitable.
     snow       falling over the cold ground, thickening with altitude.

   All four share one trick: a fixed pool of quads in a box that FOLLOWS the
   camera, with each particle wrapped back to the far side when it leaves.
   Nothing is ever created or destroyed at runtime, so there is no allocation,
   no garbage, and the cost is exactly the same whether you stand still or run
   across the island. Density is a per-frame count, not a rebuild — which is
   what lets the quality governor turn it down for free.
   ========================================================================== */
import { makeRNG, clamp, lerp, smoothstep } from './noise.js';

/* -------------------------------------------------------------------------- */

function quadMesh(BABYLON, scene, name, size, aspect) {
  const w = size * (aspect || 1) * 0.5, h = size * 0.5;
  const pos = [-w, -h, 0, w, -h, 0, -w, h, 0, w, h, 0];
  const uv = [0, 0, 1, 0, 0, 1, 1, 1];
  const idx = [0, 1, 2, 1, 3, 2];
  const col = [];
  for (let i = 0; i < 4; i++) col.push(1, 1, 1, 1);
  const m = new BABYLON.Mesh(name, scene);
  const vd = new BABYLON.VertexData();
  vd.positions = pos; vd.indices = idx; vd.uvs = uv; vd.colors = col;
  vd.normals = [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1];
  vd.applyToMesh(m, false);
  return m;
}

/**
 * Particles always face the camera, so the quad is built in VIEW space and
 * only its centre is a world position. `aFade` carries per-particle alpha and
 * size; `uGlow` decides whether it is lit by the sky or lights itself.
 */
function particleMaterial(BABYLON, scene, shaders, name, opts) {
  opts = opts || {};
  BABYLON.Effect.ShadersStore[name + 'VertexShader'] = /* glsl */`
    precision highp float;
    #include<instancesDeclaration>
    attribute vec3 position; attribute vec2 uv; attribute vec4 color;
    attribute vec3 aTint;
    attribute vec2 aAnim;                 // x = alpha, y = size
    uniform mat4 viewProjection;
    uniform mat4 uInvView;                // camera basis, for billboarding
    uniform float uTime;
    varying vec2 vUV; varying vec3 vTint; varying float vAlpha; varying vec3 vWorld;
    void main(){
      #include<instancesVertex>
      vec3 centre = vec3(finalWorld[3][0], finalWorld[3][1], finalWorld[3][2]);
      vec3 right = vec3(uInvView[0][0], uInvView[0][1], uInvView[0][2]);
      vec3 up    = vec3(uInvView[1][0], uInvView[1][1], uInvView[1][2]);
      vec3 wp = centre + (right * position.x + up * position.y) * aAnim.y;
      vUV = uv; vTint = aTint; vAlpha = aAnim.x; vWorld = wp;
      gl_Position = viewProjection * vec4(wp, 1.0);
    }`;

  BABYLON.Effect.ShadersStore[name + 'FragmentShader'] = /* glsl */`
    precision highp float;
    varying vec2 vUV; varying vec3 vTint; varying float vAlpha; varying vec3 vWorld;
    ${shaders.FRAG_PRELUDE}
    void main(){
      // a soft round grain; no texture, no fetch
      vec2 d = vUV - 0.5;
      float r = dot(d, d) * 4.0;
      float a = (1.0 - smoothstep(${(opts.core || 0.25).toFixed(2)}, 1.0, r)) * vAlpha;
      if (a < 0.01) discard;

      vec3 col = vTint;
      ${opts.glow
        ? '// a firefly makes its own light, so the sky must not dim it'
        : 'col *= (uAmbCol + uSunCol * 0.85);\n      col = applyAerial(col, vWorld);'}
      gl_FragColor = vec4(col, a);
    }`;

  const mat = new BABYLON.ShaderMaterial(name + 'Mat', scene,
    { vertex: name, fragment: name },
    shaders.shaderOptions(['color', 'aTint', 'aAnim'], ['viewProjection', 'uInvView']));
  mat.backFaceCulling = false;
  mat.alpha = 0.999;                     // tells Babylon to treat it as blended
  mat.alphaMode = opts.glow ? BABYLON.Constants.ALPHA_ADD : BABYLON.Constants.ALPHA_COMBINE;
  mat.needDepthPrePass = false;
  mat.disableDepthWrite = true;          // particles must never occlude each other
  return mat;
}

/* -------------------------------------------------------------------------- */

/**
 * One drifting system.
 *
 * @param spec.box      half-extent of the volume that follows the camera
 * @param spec.fall     metres/second downward (negative rises)
 * @param spec.drift    lateral speed
 * @param spec.weight   (climate, y, t) -> 0..1 how much of this belongs here
 */
function createDrift(BABYLON, scene, field, shaders, spec) {
  const CAP = spec.cap;
  const mesh = quadMesh(BABYLON, scene, spec.name, spec.size, spec.aspect);
  mesh.material = particleMaterial(BABYLON, scene, shaders, spec.name, spec);
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.renderingGroupId = 1;             // after the world, so blending is right

  const rng = makeRNG(field.seed + spec.salt);
  const M = new Float32Array(CAP * 16);
  const T = new Float32Array(CAP * 3);
  const A = new Float32Array(CAP * 2);

  const px = new Float32Array(CAP), py = new Float32Array(CAP), pz = new Float32Array(CAP);
  const ph = new Float32Array(CAP), sz = new Float32Array(CAP);
  for (let i = 0; i < CAP; i++) {
    px[i] = (rng() * 2 - 1) * spec.box;
    py[i] = rng() * spec.height;
    pz[i] = (rng() * 2 - 1) * spec.box;
    ph[i] = rng() * 6.283;
    sz[i] = spec.size * (0.6 + rng() * 0.8);
    const t = spec.tint(rng);
    T[i * 3] = t[0]; T[i * 3 + 1] = t[1]; T[i * 3 + 2] = t[2];
  }
  mesh.thinInstanceSetBuffer('matrix', M, 16, true);
  mesh.thinInstanceSetBuffer('aTint', T, 3, true);
  mesh.thinInstanceSetBuffer('aAnim', A, 2, true);
  mesh.thinInstanceCount = 0;

  let bound = true;
  let live = 0;
  const wrap = (v, half) => (v > half ? v - 2 * half : (v < -half ? v + 2 * half : v));

  function update(dt, cam, w, sky, timeSec, scale) {
    const amount = clamp(spec.weight(w, cam.y, sky) * (scale == null ? 1 : scale), 0, 1);
    live = Math.round(CAP * amount);
    if (live <= 0) { mesh.thinInstanceCount = 0; return 0; }

    const box = spec.box;
    for (let i = 0; i < live; i++) {
      ph[i] += dt * spec.swirl;
      px[i] += (Math.sin(ph[i]) * spec.drift + spec.wind) * dt;
      pz[i] += (Math.cos(ph[i] * 0.83) * spec.drift) * dt;
      py[i] -= spec.fall * dt;
      if (spec.bob) py[i] += Math.sin(ph[i] * 1.7) * spec.bob * dt;

      // wrap within the box that rides along with the camera
      px[i] = wrap(px[i], box);
      pz[i] = wrap(pz[i], box);
      if (py[i] < 0) py[i] += spec.height;
      else if (py[i] > spec.height) py[i] -= spec.height;

      const wx = cam.x + px[i], wz = cam.z + pz[i];
      // ride the ground, so nothing drifts through a hillside
      const g = spec.ground ? field.heightAt(wx, wz) : 0;
      const wy = g + spec.base + py[i];

      const o = i * 16;
      M[o] = 1; M[o + 5] = 1; M[o + 10] = 1; M[o + 15] = 1;
      M[o + 12] = wx; M[o + 13] = wy; M[o + 14] = wz;

      // fade at the edges of the box so nothing pops in or out
      const edge = 1 - smoothstep(box * 0.62, box * 0.98,
        Math.max(Math.abs(px[i]), Math.abs(pz[i])));
      let a = edge * amount;
      if (spec.twinkle) a *= 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(timeSec * spec.twinkle + ph[i] * 3.1));
      A[i * 2] = a;
      A[i * 2 + 1] = sz[i];
    }
    mesh.thinInstanceBufferUpdated('matrix');
    mesh.thinInstanceBufferUpdated('aAnim');
    mesh.thinInstanceCount = live;
    return live;
  }

  return { mesh, update, get count() { return live; }, cap: CAP };
}

/* ==========================================================================
   The four
   ========================================================================== */

export function buildWeather(BABYLON, scene, field, shaders, opts) {
  opts = opts || {};
  const N = (k, d) => (opts[k] == null ? d : opts[k]);

  /** how far into the night we are: 0 by day, 1 well after sunset */
  const night = (sky) => clamp(1 - Math.sin(sky.elevation || 0) * 3.2, 0, 1);

  const systems = [];

  if (N('fireflies', 260) > 0) systems.push(createDrift(BABYLON, scene, field, shaders, {
    name: 'firefly', salt: 9101, cap: N('fireflies', 260),
    size: 0.20, aspect: 1, core: 0.02, glow: true, twinkle: 2.4,
    box: 34, height: 6.5, base: 0.5, ground: true,
    fall: 0, drift: 0.55, wind: 0.12, swirl: 0.9, bob: 0.8,
    tint: (r) => [1.0, 0.86 + r() * 0.12, 0.34 + r() * 0.24],
    weight: (w, y, sky) => clamp((w.forest * 1.0 + w.marsh * 1.2 + w.meadow * 0.22), 0, 1)
                           * night(sky),
  }));

  if (N('petals', 180) > 0) systems.push(createDrift(BABYLON, scene, field, shaders, {
    name: 'petal', salt: 9203, cap: N('petals', 180),
    size: 0.16, aspect: 1.7, core: 0.18,
    box: 26, height: 9, base: 0.4, ground: true,
    fall: 0.55, drift: 0.9, wind: 0.35, swirl: 1.5,
    tint: (r) => (r() < 0.5 ? [0.98, 0.76, 0.84] : [0.99, 0.92, 0.95]),
    // petals belong where the blossom does: mild, damp, not frozen or sand
    weight: (w) => clamp((w.meadow * 0.55 + w.forest * 0.35) - w.desert * 2 - w.snow * 2, 0, 1)
                    * 0.55,
  }));

  if (N('sand', 300) > 0) systems.push(createDrift(BABYLON, scene, field, shaders, {
    name: 'sandGrain', salt: 9307, cap: N('sand', 300),
    size: 0.13, aspect: 3.2, core: 0.30,
    box: 32, height: 3.2, base: 0.15, ground: true,
    fall: 0.1, drift: 0.7, wind: 4.2, swirl: 2.2,
    tint: (r) => { const j = 0.86 + r() * 0.24; return [0.90 * j, 0.80 * j, 0.62 * j]; },
    // hardest in the middle of the day, when the desert should feel worst
    weight: (w, y, sky) => clamp(w.desert * 1.25 + w.beach * 0.3, 0, 1)
                            * (0.35 + 0.65 * clamp(Math.sin(sky.elevation || 0) * 1.6, 0, 1)),
  }));

  if (N('snow', 420) > 0) systems.push(createDrift(BABYLON, scene, field, shaders, {
    name: 'snowFlake', salt: 9411, cap: N('snow', 420),
    size: 0.14, aspect: 1, core: 0.12,
    box: 30, height: 22, base: 0.2, ground: true,
    fall: 1.5, drift: 0.8, wind: 0.6, swirl: 0.7,
    tint: (r) => { const j = 0.9 + r() * 0.16; return [0.94 * j, 0.96 * j, 1.0 * j]; },
    weight: (w, y) => clamp(w.snow * 1.35 - 0.08, 0, 1) * clamp(0.45 + y / 150, 0, 1),
  }));

  const mats = systems.map((s) => s.mesh.material);
  const inv = new BABYLON.Matrix();

  function update(dt, camera, x, z, sky, timeSec, scale) {
    if (!systems.length) return;
    const h = field.heightAt(x, z);
    const w = field.climate.climateAt(x, z, h, field.inlandOf(x, z), field.moistureAt(x, z));
    const cam = camera.position;
    // the camera's basis, so every quad can face it without a per-particle rotation
    camera.getWorldMatrix().invertToRef(inv);
    const view = camera.getViewMatrix();
    view.invertToRef(inv);
    for (const s of systems) {
      s.mesh.material.setMatrix('uInvView', inv);
      s.update(dt, cam, w, sky, timeSec, scale);
    }
  }

  function counts() {
    const o = {};
    for (const s of systems) o[s.mesh.name] = s.count;
    return o;
  }

  function dispose() { for (const s of systems) s.mesh.dispose(false, true); }

  return { systems, mats, update, counts, dispose };
}
