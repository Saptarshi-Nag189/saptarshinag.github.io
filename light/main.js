/* ==========================================================================
   main.js — THE LONG LIGHT
   Boots the engine, grows the world, and runs the loop.
   ========================================================================== */
import { createHeightField, buildTerrain, buildWater, buildLake, WORLD, SEA_LEVEL } from './terrain.js';
import { createSkyState, setSkyTime, createSky, SKY_KEYS } from './sky.js';
import { buildFlora } from './flora.js';
import { createChunkManager } from './chunks.js';
import { buildLandmarks } from './landmarks.js';
import { buildFauna } from './fauna.js';
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
const QS = new URLSearchParams(location.search);
const num = (k, d) => (QS.has(k) ? Math.max(0, parseInt(QS.get(k), 10) || 0) : d);
const STREAM = QS.get('stream') !== '0';

/* boot timings — the only way to know which stage is actually the slow one */
const BOOT = {};
const stage = (k, fn) => { const t = performance.now(); const r = fn(); BOOT[k] = Math.round(performance.now() - t); return r; };

const field = stage('field', () => createHeightField(WORLD.seed));
const skyObj = stage('sky', () => createSky(B, scene, sky, SH));
const water = stage('sea', () => buildWater(B, scene, field, SH, {}));
const lake = stage('lake', () => buildLake(B, scene, field, SH));

/* The ground and everything growing on it.
   Streaming builds only what is near enough to see and frees the rest; the
   legacy whole-island build stays behind ?stream=0 so the two can be compared
   directly when something looks wrong. */
let chunks = null, terrain = null, flora = null;
if (STREAM) {
  chunks = stage('chunkInit', () => createChunkManager(B, scene, field, SH, {
    tile: 64,
    nearRings: num('near', 2),
    midRings: num('mid', 5),
    grassPerTile: num('grasstile', 2600),
  }));
} else {
  terrain = buildTerrain(B, scene, field, SH, { halfExtent: WORLD.halfExtent, segments: 300 });
  flora = buildFlora(B, scene, field, SH, {
    grass: { count: num('grass', 55000) },
  });
}

/* ---------- what was built, and what lives here ---------- */
const landmarks = stage('landmarks', () => buildLandmarks(B, scene, field, SH, {
  lanterns: num('lanterns', 46),
  driftwood: num('driftwood', 150),
  shards: num('shards', 260),
}));
const fauna = stage('fauna', () => buildFauna(B, scene, field, SH, {
  deer: { count: num('deer', 26) },
  birds: { count: num('birds', 54) },
}));

/* ---------- the traveller, the rig, the hands ---------- */
const traveller = createTraveller(B, scene, SH, {});
const control = createController(field, { x: WORLD.startX, z: WORLD.startZ, heading: 0 });
const rig = createCameraRig(B, scene, camera, field, {});
traveller.reset(control.me, control.me.heading);
rig.snap(control.yaw, control.pitch, control.me);
// Only the near ring is built before the veil lifts. The rest streams in over
// the next few seconds under the frame budget, which is the entire point.
stage('prime', () => {
  if (chunks) chunks.prime(control.me.x, control.me.z, chunks.rings.near);
  else flora.grass.refocus(control.me.x, control.me.z);
});

const worldMats = [skyObj.mat, water.mat, traveller.mat]
  .concat(lake ? [lake.mat] : [])
  .concat(chunks ? chunks.mats : [terrain.mat].concat(flora.mats))
  .concat(landmarks.mats)
  .concat(fauna.mats);

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
  // lanterns burn brightest when the sky is darkest
  landmarks.update(sky);
}

/* ---------- naming the land you are standing in ----------
   The card only appears once a biome has held for a moment. Without that
   hysteresis, walking a border flickers the title on and off, which reads as a
   bug rather than as arrival. */
const PLACES = {
  beach:  ['The Long Strand', 'where the island begins'],
  desert: ['The Dune Sea', 'dry, and older than the rest'],
  meadow: ['The Open Meadow', 'the easy middle of the world'],
  forest: ['The Deep Wood', 'close, and full of quiet'],
  marsh:  ['The Still Water', 'reeds, and something moored'],
  rock:   ['The Bare Shoulder', 'above where things grow'],
  snow:   ['The Frozen Crown', 'the cold top of the light'],
};
const placeEl = document.getElementById('placeCard');
const placeName = document.getElementById('placeName');
const placeSub = document.getElementById('placeSub');
let placeShown = null, placeCandidate = null, placeHeld = 0, placeTimer = 0;

function announcePlace(x, z, dt) {
  placeTimer -= dt;
  if (placeTimer > 0) return;
  placeTimer = 0.35;                       // sampling four times a second is plenty

  const h = field.heightAt(x, z);
  const w = field.climate.climateAt(x, z, h, field.inlandOf(x, z), field.moistureAt(x, z));
  const here = field.climate.dominant(w);

  if (here !== placeCandidate) { placeCandidate = here; placeHeld = 0; return; }
  placeHeld += 0.35;
  if (placeHeld < 2.0 || here === placeShown) return;

  placeShown = here;
  const p = PLACES[here];
  if (!p || !placeEl) return;
  placeName.textContent = p[0];
  placeSub.textContent = p[1];
  placeEl.classList.add('show');
  clearTimeout(announcePlace._t);
  announcePlace._t = setTimeout(() => placeEl.classList.remove('show'), 4200);
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

    // The world streams around wherever you are. The budget is what keeps
    // tile building from ever becoming a hitch: a frame spends at most this
    // many milliseconds on it and picks up where it left off next frame.
    if (chunks) chunks.update(me.x, me.z, 4);
    else flora.grass.follow(me.x, me.z);

    fauna.update(dt, me.x, me.z);
    announcePlace(me.x, me.z, dt);

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

/** Bring the world in around a point. Camera hooks jump; streaming has to
    catch up before a screenshot, or the shot is of an empty ring. */
function settle(x, z) {
  if (chunks) chunks.prime(x, z);
  else flora.grass.follow(x, z);
}

/** the ground material, whichever path built it */
const groundMaterial = () => (chunks ? chunks.mats[0] : terrain.mat);

window.__LL = {
  /** move the day: 0 = dawn on the shore … 1 = night */
  setTime(t) { setSkyTime(sky, t); return sky.label; },
  /** place the camera for a shot */
  look(px, py, pz, tx, ty, tz) {
    frozen = true;
    camera.position.set(px, py, pz);
    camera.setTarget(new B.Vector3(tx, ty, tz));
    settle(px, pz);
  },
  /** stand the camera on the ground at (x,z), looking toward (lx,lz) */
  stand(x, z, lx, lz, eye) {
    frozen = true;
    const h = field.heightAt(x, z);
    camera.position.set(x, h + (eye == null ? 1.7 : eye), z);
    settle(x, z);
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
    settle(x, z);
    return { sun: [d.x.toFixed(2), d.y.toFixed(2), d.z.toFixed(2)] };
  },
  heightAt: (x, z) => field.heightAt(x, z),
  /** bring the world in around a point without moving the camera */
  settle(x, z) { settle(x, z); return chunks ? chunks.mem().resident : null; },
  /** stop the traveller driving the world, so a test can stream where it likes */
  freeze(on) { frozen = on !== false; return frozen; },
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
      streaming: !!chunks,
      flora: chunks ? chunks.mem().instances : flora.counts,
      fauna: fauna.counts,
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
  wire(on) { groundMaterial().wireframe = !!on; return !!on; },
  /** tests: hide every streamed terrain tile, leaving the coarse island */
  tiles(on) {
    if (!chunks) return null;
    for (const t of chunks.tiles.values()) if (t.mesh) t.mesh.setEnabled(!!on);
    return !!on;
  },
  /** tests: hide the always-resident coarse island */
  far(on) { if (chunks) chunks.far.mesh.setEnabled(!!on); return !!on; },
  /** tests: hide everything that was instanced, leaving bare ground */
  props(on) {
    if (!chunks) return null;
    for (const n in chunks.species) chunks.species[n].mesh.setEnabled(!!on);
    chunks.grass.mesh.setEnabled(!!on);
    return !!on;
  },
  cull(on) { groundMaterial().backFaceCulling = !!on; return !!on; },
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
    settle(x, z); return { x: control.me.x, y: control.me.y, z: control.me.z }; },
  /** where the traveller is and what it is doing */
  who() { const m = control.me; return { x:+m.x.toFixed(2), y:+m.y.toFixed(2), z:+m.z.toFixed(2),
    heading:+m.heading.toFixed(2), speed:+m.speed.toFixed(2), running:+m.running.toFixed(2) }; },
  /** what streaming is holding right now — the proof that memory stays flat */
  mem() {
    if (!chunks) return { streaming: false, meshes: scene.meshes.length,
                          vertices: scene.getTotalVertices(),
                          heapMB: (performance.memory && performance.memory.usedJSHeapSize)
                            ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null };
    return Object.assign({ streaming: true }, chunks.mem());
  },
  /** the exact bytes one tile generated, for the determinism check */
  tileSnapshot(i, j) { return chunks ? chunks.snapshot(i, j) : null; },
  tileOf(x, z) { const T = chunks ? chunks.tileSize : 64;
    return { i: Math.floor(x / T), j: Math.floor(z / T) }; },
  /** the climate under a point */
  biomeAt(x, z) {
    const h = field.heightAt(x, z);
    const w = field.climate.climateAt(x, z, h, field.inlandOf(x, z), field.moistureAt(x, z));
    return { h: +h.toFixed(2), biome: field.climate.dominant(w),
             weights: Object.fromEntries(Object.entries(w)
               .filter(([k, v]) => typeof v === 'number' && v > 0.01)
               .map(([k, v]) => [k, +v.toFixed(3)])) };
  },
  where() { return placeShown; },
  /** where the built things ended up */
  sites() {
    const s = {};
    for (const k of ['templeSite', 'stonesSite', 'gateSite']) {
      const v = landmarks[k];
      if (v) s[k.replace('Site', '')] = { x: Math.round(v.x), z: Math.round(v.z), h: +v.h.toFixed(1) };
    }
    if (landmarks.items.boatHome) {
      const b = landmarks.items.boatHome;
      s.boat = { x: Math.round(b.x), z: Math.round(b.z), y: +b.y.toFixed(2) };
    }
    s.lake = field.lake ? { x: field.lake.x, z: field.lake.z, r: field.lake.r,
                            level: +field.lakeLevel.toFixed(2) } : null;
    return s;
  },
  boot: BOOT,
  ready: true,
};
