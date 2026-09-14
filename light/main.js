/* ==========================================================================
   main.js — THE LONG LIGHT
   Boots the engine, grows the world, and runs the loop.
   ========================================================================== */
import { createHeightField, buildTerrain, buildWater, WORLD, SEA_LEVEL } from './terrain.js';
import { createSkyState, setSkyTime, createSky, SKY_KEYS } from './sky.js';
import * as SH from './shaders.js';
import { clamp, lerp } from './noise.js';

const B = window.BABYLON;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- engine ---------- */
const canvas = document.getElementById('view');
const engine = new B.Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: false,
  antialias: true,
  powerPreference: 'high-performance',
});
engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));

const scene = new B.Scene(engine);
scene.clearColor = new B.Color4(0.02, 0.03, 0.06, 1);
scene.autoClear = true;
scene.ambientColor = new B.Color3(0, 0, 0);

/* ---------- the day ---------- */
const sky = createSkyState(B);
setSkyTime(sky, 0);                       // dawn

/* ---------- camera (temporary rig — the real one lands with the traveller) */
const camera = new B.FreeCamera('cam', new B.Vector3(0, 6, -205), scene);
camera.minZ = 0.4;
camera.maxZ = 4000;
camera.fov = 0.95;
camera.setTarget(new B.Vector3(0, 8, -120));

/* ---------- world ---------- */
const field = createHeightField(WORLD.seed);
const skyObj = createSky(B, scene, sky, SH);
const terrain = buildTerrain(B, scene, field, SH, { halfExtent: WORLD.halfExtent, segments: 300 });
const water = buildWater(B, scene, field, SH, {});

const worldMats = [skyObj.mat, terrain.mat, water.mat];

/* ---------- post-processing: the dreamy half of the look ---------- */
const pipeline = new B.DefaultRenderingPipeline('longlight', true, scene, [camera]);
pipeline.samples = 1;
pipeline.fxaaEnabled = true;

pipeline.bloomEnabled = true;
pipeline.bloomThreshold = 0.86;
pipeline.bloomWeight = 0.38;
pipeline.bloomKernel = 64;
pipeline.bloomScale = 0.55;

pipeline.imageProcessingEnabled = true;
pipeline.imageProcessing.toneMappingEnabled = true;
pipeline.imageProcessing.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
pipeline.imageProcessing.vignetteEnabled = true;
pipeline.imageProcessing.vignetteWeight = 1.5;
pipeline.imageProcessing.vignetteStretch = 0.4;
pipeline.imageProcessing.vignetteCameraFov = 1.1;

pipeline.grainEnabled = true;
pipeline.grain.intensity = 3.0;
pipeline.grain.animated = true;

pipeline.depthOfFieldEnabled = false;   // enabled per-tier; costly under software GL

/* ---------- loop ---------- */
let t0 = performance.now();
let frames = 0;

/* diagnostics — lets a headless test isolate fog, post and geometry so a
   rendering bug can't hide inside the atmosphere */
const DBG = { fog: true, post: true, water: true };

function applyTimeOfDay() {
  for (const m of worldMats) SH.applyCommonUniforms(m, sky, camera.position, (performance.now() - t0) / 1000);
  if (!DBG.fog) for (const m of worldMats) m.setFloat('uFogStrength', 0);
  if (pipeline.imageProcessing) {
    pipeline.imageProcessing.exposure = DBG.post ? sky.exposure : 1;
    pipeline.imageProcessing.contrast = DBG.post ? sky.contrast : 1;
    pipeline.imageProcessing.vignetteEnabled = DBG.post;
  }
  // the bloom follows the sun: strong at dawn and golden hour, restrained at noon
  pipeline.bloomWeight = lerp(0.28, 0.58, clamp(sky.sunGlow / 0.5, 0, 1));
}

/* lift the veil once the world has actually drawn a frame or two — not on
   'load', which fires long before the shaders have compiled */
const veil = document.getElementById('veil');
function liftVeil() {
  if (!veil || veil.classList.contains('gone')) return;
  veil.classList.add('gone');
  setTimeout(() => veil.remove(), 1400);
}

engine.runRenderLoop(() => {
  frames++;
  applyTimeOfDay();
  scene.render();
  if (frames === 3) liftVeil();
});

addEventListener('resize', () => engine.resize());

/* ---------- test + authoring hooks ---------- */
window.__LL = {
  /** move the day: 0 = dawn on the shore … 1 = night */
  setTime(t) { setSkyTime(sky, t); return sky.label; },
  /** place the camera for a shot */
  look(px, py, pz, tx, ty, tz) {
    camera.position.set(px, py, pz);
    camera.setTarget(new B.Vector3(tx, ty, tz));
  },
  /** stand the camera on the ground at (x,z), looking toward (lx,lz) */
  stand(x, z, lx, lz, eye) {
    const h = field.heightAt(x, z);
    camera.position.set(x, h + (eye == null ? 1.7 : eye), z);
    const lh = field.heightAt(lx, lz);
    camera.setTarget(new B.Vector3(lx, lh + 2, lz));
  },
  heightAt: (x, z) => field.heightAt(x, z),
  skyKeys: () => SKY_KEYS.map(k => ({ id: k.id, at: k.at, label: k.label })),
  stats() {
    return {
      frames,
      fps: Math.round(engine.getFps()),
      gl: engine.webGLVersion,
      drawCalls: scene.getEngine()._drawCalls ? scene.getEngine()._drawCalls.current : null,
      activeMeshes: scene.getActiveMeshes().length,
      totalVertices: scene.getTotalVertices(),
      meshes: scene.meshes.length,
      time: sky.t,
      label: sky.label,
      reduced: REDUCED,
    };
  },
  /** tests: isolate parts of the pipeline */
  debug(o) {
    Object.assign(DBG, o || {});
    pipeline.bloomEnabled = DBG.post;
    pipeline.grainEnabled = DBG.post;
    water.mesh.setEnabled(DBG.water);
    return { ...DBG };
  },
  wire(on) { terrain.mesh.material.wireframe = !!on; return !!on; },
  cull(on) { terrain.mesh.material.backFaceCulling = !!on; return !!on; },
  /** flat albedo for the ground, magenta for the sea — shows what is what */
  flat(on) { sky.debug = on ? 1 : 0; return !!on; },
  /** tests: skip the fade and clear the overlay immediately */
  clearVeil() { if (veil) veil.remove(); return true; },
  veilGone: () => !document.getElementById('veil'),
  ready: true,
};
