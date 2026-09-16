/* ==========================================================================
   sky.js — time of day.

   One state object holds every colour in the world: the sky gradient, the sun,
   the ambient and bounce light, the rim tint and the fog. Every material reads
   it (shaders.js: applyCommonUniforms), so moving through the day re-lights
   the entire island by animating a single number.

   The journey advances the clock: dawn on the shore, last light at the spire,
   night on the glide home.
   ========================================================================== */
import { clamp, smoothstep } from './noise.js';

const C = (r, g, b) => ({ r, g, b });

/**
 * The day's keyframes. `at` is the journey position 0..1 that this light
 * belongs to, so progress through the world drives the sun.
 * Elevation/azimuth are degrees; elevation 0 = on the horizon.
 */
export const SKY_KEYS = [
  {
    id: 'dawn', at: 0.00, label: 'Dawn Shore',
    elevation: 2.5, azimuth: 96,
    zenith:  C(0.13, 0.17, 0.38),   horizon: C(1.00, 0.52, 0.34),
    ground:  C(0.28, 0.20, 0.28),   sunCol:  C(1.00, 0.64, 0.36),
    ambient: C(0.34, 0.40, 0.62),   bounce:  C(0.30, 0.22, 0.22),
    rimCol:  C(1.00, 0.72, 0.50),   rimStr: 0.55, rimPow: 3.0,
    sunSize: 900, sunGlow: 0.42,
    fogDensity: 0.0020, fogStrength: 1.0, fogHeight: 0.016,
    exposure: 1.05, contrast: 1.15,
  },
  {
    id: 'earlyMorning', at: 0.17, label: 'The Grove',
    elevation: 20, azimuth: 102,
    zenith:  C(0.22, 0.42, 0.78),   horizon: C(0.88, 0.87, 0.79),
    ground:  C(0.40, 0.42, 0.44),   sunCol:  C(1.00, 0.92, 0.76),
    ambient: C(0.44, 0.56, 0.78),   bounce:  C(0.32, 0.34, 0.26),
    rimCol:  C(0.86, 0.93, 1.00),   rimStr: 0.42, rimPow: 3.4,
    sunSize: 1400, sunGlow: 0.22,
    fogDensity: 0.0016, fogStrength: 0.95, fogHeight: 0.014,
    exposure: 1.12, contrast: 1.12,
  },
  {
    id: 'midMorning', at: 0.33, label: 'The Listening Water',
    elevation: 38, azimuth: 112,
    zenith:  C(0.20, 0.45, 0.86),   horizon: C(0.78, 0.88, 0.92),
    ground:  C(0.42, 0.48, 0.52),   sunCol:  C(1.00, 0.96, 0.88),
    ambient: C(0.46, 0.60, 0.84),   bounce:  C(0.30, 0.38, 0.38),
    rimCol:  C(0.80, 0.92, 1.00),   rimStr: 0.38, rimPow: 3.6,
    sunSize: 1800, sunGlow: 0.16,
    fogDensity: 0.0012, fogStrength: 0.92, fogHeight: 0.011,
    exposure: 1.14, contrast: 1.10,
  },
  {
    id: 'noon', at: 0.48, label: 'The Dune Sea',
    elevation: 76, azimuth: 150,
    zenith:  C(0.16, 0.40, 0.86),   horizon: C(0.92, 0.85, 0.70),
    ground:  C(0.62, 0.52, 0.38),   sunCol:  C(1.00, 0.98, 0.92),
    ambient: C(0.52, 0.62, 0.82),   bounce:  C(0.58, 0.46, 0.30),
    rimCol:  C(1.00, 0.96, 0.86),   rimStr: 0.30, rimPow: 4.0,
    sunSize: 2400, sunGlow: 0.12,
    fogDensity: 0.0011, fogStrength: 0.88, fogHeight: 0.010,
    exposure: 1.05, contrast: 1.09,
  },
  {
    id: 'afternoon', at: 0.62, label: 'The Frost Shelf',
    elevation: 34, azimuth: 232,
    zenith:  C(0.26, 0.44, 0.80),   horizon: C(0.82, 0.88, 0.96),
    ground:  C(0.60, 0.68, 0.78),   sunCol:  C(0.96, 0.94, 0.98),
    ambient: C(0.54, 0.66, 0.88),   bounce:  C(0.56, 0.64, 0.76),
    rimCol:  C(0.78, 0.90, 1.00),   rimStr: 0.50, rimPow: 3.0,
    sunSize: 1600, sunGlow: 0.20,
    fogDensity: 0.0014, fogStrength: 1.0, fogHeight: 0.012,
    exposure: 1.16, contrast: 1.11,
  },
  {
    id: 'goldenHour', at: 0.76, label: 'The Neon Port',
    elevation: 7, azimuth: 260,
    zenith:  C(0.20, 0.26, 0.52),   horizon: C(1.00, 0.62, 0.34),
    ground:  C(0.34, 0.26, 0.30),   sunCol:  C(1.00, 0.70, 0.40),
    ambient: C(0.38, 0.44, 0.68),   bounce:  C(0.38, 0.28, 0.26),
    rimCol:  C(1.00, 0.76, 0.50),   rimStr: 0.62, rimPow: 2.8,
    sunSize: 1000, sunGlow: 0.40,
    fogDensity: 0.0018, fogStrength: 1.0, fogHeight: 0.015,
    exposure: 1.10, contrast: 1.14,
  },
  {
    id: 'lastLight', at: 0.88, label: 'The Spire',
    elevation: -1.5, azimuth: 272,
    zenith:  C(0.08, 0.11, 0.30),   horizon: C(0.86, 0.42, 0.36),
    ground:  C(0.16, 0.14, 0.24),   sunCol:  C(1.00, 0.52, 0.34),
    ambient: C(0.24, 0.30, 0.54),   bounce:  C(0.20, 0.16, 0.22),
    rimCol:  C(1.00, 0.62, 0.44),   rimStr: 0.70, rimPow: 2.6,
    sunSize: 700, sunGlow: 0.50,
    fogDensity: 0.0021, fogStrength: 1.0, fogHeight: 0.017,
    exposure: 1.20, contrast: 1.17,
  },
  {
    id: 'night', at: 1.00, label: 'The Glide Home',
    elevation: -12, azimuth: 285,
    zenith:  C(0.03, 0.05, 0.14),   horizon: C(0.10, 0.13, 0.28),
    ground:  C(0.03, 0.04, 0.08),   sunCol:  C(0.34, 0.42, 0.70),   // moonlight
    ambient: C(0.10, 0.15, 0.32),   bounce:  C(0.05, 0.06, 0.11),
    rimCol:  C(0.56, 0.70, 1.00),   rimStr: 0.75, rimPow: 2.4,
    sunSize: 2600, sunGlow: 0.10,
    fogDensity: 0.0017, fogStrength: 1.0, fogHeight: 0.013,
    exposure: 1.30, contrast: 1.20,
  },
];

const lerpC = (a, b, t) => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
});
const lerpN = (a, b, t) => a + (b - a) * t;

/** Build the live state object. BABYLON types are created once and mutated. */
export function createSkyState(BABYLON) {
  return {
    t: 0,
    key: SKY_KEYS[0].id,
    label: SKY_KEYS[0].label,
    sunDir: new BABYLON.Vector3(0, 0.1, 1),
    sunCol: new BABYLON.Color3(1, 1, 1),
    zenith: new BABYLON.Color3(0, 0, 0),
    horizon: new BABYLON.Color3(0, 0, 0),
    ground: new BABYLON.Color3(0, 0, 0),
    ambient: new BABYLON.Color3(0, 0, 0),
    bounce: new BABYLON.Color3(0, 0, 0),
    rimCol: new BABYLON.Color3(0, 0, 0),
    rimStr: 0.5, rimPow: 3, sunSize: 1000, sunGlow: 0.3,
    fogDensity: 0.0015, fogStrength: 1, fogHeight: 0.013,
    debug: 0,
    exposure: 1.1, contrast: 1.12,
    elevation: 0, azimuth: 0,
  };
}

/**
 * Set the clock. `t` is journey progress 0..1; the sun and every colour in the
 * world follow from it. Blending is smoothstepped so the light never snaps.
 */
export function setSkyTime(state, t) {
  t = clamp(t, 0, 1);
  state.t = t;

  let i = 0;
  while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1].at <= t) i++;
  const a = SKY_KEYS[i], b = SKY_KEYS[i + 1] || SKY_KEYS[i];
  const span = Math.max(1e-5, b.at - a.at);
  const k = smoothstep(0, 1, clamp((t - a.at) / span, 0, 1));

  state.key = k < 0.5 ? a.id : b.id;
  state.label = k < 0.5 ? a.label : b.label;

  const zc = lerpC(a.zenith, b.zenith, k);   state.zenith.set(zc.r, zc.g, zc.b);
  const hc = lerpC(a.horizon, b.horizon, k); state.horizon.set(hc.r, hc.g, hc.b);
  const gc = lerpC(a.ground, b.ground, k);   state.ground.set(gc.r, gc.g, gc.b);
  const sc = lerpC(a.sunCol, b.sunCol, k);   state.sunCol.set(sc.r, sc.g, sc.b);
  const ac = lerpC(a.ambient, b.ambient, k); state.ambient.set(ac.r, ac.g, ac.b);
  const bc = lerpC(a.bounce, b.bounce, k);   state.bounce.set(bc.r, bc.g, bc.b);
  const rc = lerpC(a.rimCol, b.rimCol, k);   state.rimCol.set(rc.r, rc.g, rc.b);

  state.rimStr      = lerpN(a.rimStr, b.rimStr, k);
  state.rimPow      = lerpN(a.rimPow, b.rimPow, k);
  state.sunSize     = lerpN(a.sunSize, b.sunSize, k);
  state.sunGlow     = lerpN(a.sunGlow, b.sunGlow, k);
  state.fogDensity  = lerpN(a.fogDensity, b.fogDensity, k);
  state.fogStrength = lerpN(a.fogStrength, b.fogStrength, k);
  state.fogHeight   = lerpN(a.fogHeight, b.fogHeight, k);
  state.exposure    = lerpN(a.exposure, b.exposure, k);
  state.contrast    = lerpN(a.contrast, b.contrast, k);

  const el = lerpN(a.elevation, b.elevation, k) * Math.PI / 180;
  const az = lerpN(a.azimuth, b.azimuth, k) * Math.PI / 180;
  state.elevation = el; state.azimuth = az;
  state.sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  state.sunDir.normalize();

  return state;
}

/* ---- the skybox itself ---------------------------------------------------
   A large inverted sphere that follows the camera, painted with the very same
   skyColor() the fog uses.                                                  */
export function createSky(BABYLON, scene, state, shaders) {
  BABYLON.Effect.ShadersStore['longlightskyVertexShader'] = /* glsl */`
    precision highp float;
    attribute vec3 position;
    uniform mat4 worldViewProjection;
    varying vec3 vDir;
    void main(){
      vDir = position;
      gl_Position = worldViewProjection * vec4(position, 1.0);
    }`;

  BABYLON.Effect.ShadersStore['longlightskyFragmentShader'] = /* glsl */`
    precision highp float;
    varying vec3 vDir;
    ${shaders.COMMON_UNIFORMS}
    ${shaders.SKY_FN}
    void main(){
      vec3 d = normalize(vDir);
      vec3 col = skyColor(d);
      // a whisper of dither kills banding across these very smooth gradients
      float dth = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      col += (dth - 0.5) * 0.004;
      gl_FragColor = vec4(col, 1.0);
    }`;

  const mat = new BABYLON.ShaderMaterial('skyMat', scene,
    { vertex: 'longlightsky', fragment: 'longlightsky' },
    {
      attributes: ['position'],
      uniforms: shaders.COMMON_UNIFORM_NAMES,
    });
  mat.backFaceCulling = false;
  mat.disableDepthWrite = true;
  mat.disableLighting = true;

  const mesh = BABYLON.MeshBuilder.CreateSphere('sky', { diameter: 4000, segments: 32 }, scene);
  mesh.material = mat;
  mesh.infiniteDistance = true;      // always centred on the camera
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.renderingGroupId = 0;         // painted before the world

  return { mesh, mat };
}
