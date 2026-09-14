/* ==========================================================================
   main.js — THE LONG LIGHT
   Boots the engine, grows the world, and runs the loop.
   ========================================================================== */
import { createHeightField, buildTerrain, buildWater, WORLD, SEA_LEVEL } from './terrain.js';
import { createSkyState, setSkyTime, createSky, SKY_KEYS } from './sky.js';
import { buildFlora } from './flora.js';
import { createTraveller } from './traveller.js';
import { createCameraRig, createController } from './camera.js';
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

/* ---------- camera ---------- */
const camera = new B.FreeCamera('cam', new B.Vector3(0, 6, -205), scene);
camera.minZ = 0.4;
camera.maxZ = 4000;
camera.fov = 0.96;
camera.setTarget(new B.Vector3(0, 8, -120));

/* ---------- world ---------- */
const field = createHeightField(WORLD.seed);
const skyObj = createSky(B, scene, sky, SH);
const terrain = buildTerrain(B, scene, field, SH, { halfExtent: WORLD.halfExtent, segments: 300 });
const water = buildWater(B, scene, field, SH, {});

/* what grows on it — counts are tunable so quality tiers can scale them */
const QS = new URLSearchParams(location.search);
const num = (k, d) => (QS.has(k) ? Math.max(0, parseInt(QS.get(k), 10) || 0) : d);
const flora = buildFlora(B, scene, field, SH, {
  grass: { count: num('grass', 55000) },
  trees: { count: num('trees', 4200) },
  rocks: { count: num('rocks', 1400) },
});

/* ---------- the traveller, the rig, the hands ---------- */
const traveller = createTraveller(B, scene, SH, {});
const control = createController(field, { x: WORLD.startX, z: WORLD.startZ, heading: 0 });
const rig = createCameraRig(B, scene, camera, field, {});
traveller.reset(control.me, control.me.heading);
rig.snap(control.yaw, control.pitch, control.me);
flora.grass.refocus(control.me.x, control.me.z);

const worldMats = [skyObj.mat, terrain.mat, water.mat, traveller.mat].concat(flora.mats);

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
let frozen = false;
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

let firstPerson = false;
let hintsGone = false;
let walked = 0;
let last = performance.now();

engine.runRenderLoop(() => {
  frames++;
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const t = (now - t0) / 1000;

  if (!frozen) {
    const me = control.update(dt);
    traveller.update(dt, me, me.heading, me.speed, me.running, t);
    rig.update(dt, control.yaw, control.pitch, me, me.fwd, me.speed, me.running, firstPerson);
    traveller.body.setEnabled(!firstPerson);
    traveller.cloak.setEnabled(!firstPerson);
    // the dense grass disc follows, refilling only when we leave the patch
    flora.grass.follow(me.x, me.z);

    // once you have walked a little way, the hints have done their job
    if (!hintsGone) {
      walked += me.speed * dt;
      if (walked > 22) { hintsGone = true; const k = document.getElementById('keys'); if (k) k.classList.add('gone'); }
    }
  }

  applyTimeOfDay();
  scene.render();
  if (frames === 3) liftVeil();
});

addEventListener('resize', () => engine.resize());

/* ---------- input ---------- */
let pointerLocked = false;
addEventListener('keydown', (e) => {
  if (e.code === 'KeyP') { /* photo mode lands in a later phase */ }
  if (e.code === 'KeyV') { firstPerson = !firstPerson; }
  if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  control.key(e.code, true);
});
addEventListener('keyup', (e) => control.key(e.code, false));
addEventListener('blur', () => { for (const k of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight']) control.key(k, false); });

canvas.addEventListener('click', () => { if (!pointerLocked) canvas.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => { pointerLocked = document.pointerLockElement === canvas; });
addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
  control.orbit(e.movementX * 0.0022, -e.movementY * 0.0016);
});

/* touch: drag anywhere to look, and the left third acts as a walk pad */
let touchId = null, lastTX = 0, lastTY = 0;
canvas.addEventListener('touchstart', (e) => {
  const t = e.changedTouches[0];
  touchId = t.identifier; lastTX = t.clientX; lastTY = t.clientY;
  if (t.clientX < innerWidth * 0.33) control.key('KeyW', true);
}, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier !== touchId) continue;
    control.orbit((t.clientX - lastTX) * 0.005, -(t.clientY - lastTY) * 0.004);
    lastTX = t.clientX; lastTY = t.clientY;
  }
}, { passive: true });
canvas.addEventListener('touchend', () => { touchId = null; control.key('KeyW', false); }, { passive: true });

/* ---------- test + authoring hooks ---------- */
window.__LL = {
  /** move the day: 0 = dawn on the shore … 1 = night */
  setTime(t) { setSkyTime(sky, t); return sky.label; },
  /** place the camera for a shot */
  look(px, py, pz, tx, ty, tz) {
    frozen = true;
    camera.position.set(px, py, pz);
    camera.setTarget(new B.Vector3(tx, ty, tz));
    flora.grass.follow(px, pz);
  },
  /** stand the camera on the ground at (x,z), looking toward (lx,lz) */
  stand(x, z, lx, lz, eye) {
    frozen = true;
    const h = field.heightAt(x, z);
    camera.position.set(x, h + (eye == null ? 1.7 : eye), z);
    flora.grass.follow(x, z);
    const lh = field.heightAt(lx, lz);
    camera.setTarget(new B.Vector3(lx, lh + 2, lz));
  },
  /** stand at (x,z) and look along the sun's bearing — the light is the subject */
  faceSun(x, z, eye) {
    frozen = true;
    const h = field.heightAt(x, z);
    camera.position.set(x, h + (eye == null ? 1.75 : eye), z);
    const d = sky.sunDir;
    const lx = x + d.x * 120, lz = z + d.z * 120;
    camera.setTarget(new B.Vector3(lx, field.heightAt(lx, lz) + 30, lz));
    flora.grass.follow(x, z);
    return { sun: [d.x.toFixed(2), d.y.toFixed(2), d.z.toFixed(2)] };
  },
  heightAt: (x, z) => field.heightAt(x, z),
  /** move the dense grass disc to a point (the traveller will drive this) */
  grassAt(x, z) { return flora.grass.refocus(x, z); },
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
      flora: flora.counts,
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
  /** hand control back to the traveller after a scripted shot */
  unfreeze() { frozen = false; rig.snap(control.yaw, control.pitch, control.me); return true; },
  /** put the traveller somewhere and let the rig follow */
  goto(x, z, heading) { frozen = false; control.place(x, z, heading);
    traveller.reset(control.me, control.me.heading);
    rig.snap(control.yaw, control.pitch, control.me);
    flora.grass.refocus(x, z); return { x: control.me.x, y: control.me.y, z: control.me.z }; },
  /** where the traveller is and what it is doing */
  who() { const m = control.me; return { x:+m.x.toFixed(2), y:+m.y.toFixed(2), z:+m.z.toFixed(2),
    heading:+m.heading.toFixed(2), speed:+m.speed.toFixed(2), running:+m.running.toFixed(2) }; },
  ready: true,
};
