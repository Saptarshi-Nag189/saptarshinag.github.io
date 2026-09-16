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
import { createBoat } from './boat.js';
import { loadRigged } from './rigged.js';
import { buildWeather } from './weather.js';
import { createCompanion } from './companion.js';
import { guessTier, createGovernor, TIERS, TIER_ORDER, TIER_LABEL } from './quality.js';
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

/* ---------- quality: guess first, measure second ----------
   The guess happens BEFORE anything is built, so a phone never allocates a
   desktop's worth of tiles and then throws them away. */
const forcedTier = QS.get('tier');
const savedTier = (() => {
  // a choice made last visit should survive; a broken storage must not break boot
  try { return localStorage.getItem('longlight.quality'); } catch (e) { return null; }
})();
const chosen = (forcedTier && (TIERS[forcedTier] || forcedTier === 'auto')) ? forcedTier
             : ((savedTier && (TIERS[savedTier] || savedTier === 'auto')) ? savedTier : null);
const startTier = (chosen && TIERS[chosen]) ? chosen : guessTier(engine);
// only an explicit tier locks the governor; 'auto' deliberately leaves it free
const gov = createGovernor(engine, { start: startTier, locked: !!(chosen && TIERS[chosen]) });
let TIER = TIERS[startTier];
engine.setHardwareScalingLevel(TIER.scaling / Math.min(window.devicePixelRatio || 1, 2));

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
    nearRings: num('near', TIER.nearRings),
    midRings: num('mid', TIER.midRings),
    grassScale: TIER.grassScale,
    floraScale: TIER.floraScale,
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
  deer: { count: num('deer', TIERS.high.deer) },
  birds: { count: num('birds', TIERS.high.birds) },
}));
/* Weather is OFF by default and enabled with ?weather=1.
   The system is complete and its state is correct under inspection — the right
   number of instances, in the right places, the right size, alpha-blended, the
   effect compiled without error — and it still draws nothing on screen. Rather
   than leave something unproven running every frame, it is opt-in until the
   cause is found. Everything else in the world is unaffected. */
const WEATHER_ON = QS.get('weather') === '1';
const weather = stage('weather', () => buildWeather(B, scene, field, SH, {
  fireflies: WEATHER_ON ? num('fireflies', 260) : 0,
  petals: WEATHER_ON ? num('petals', 180) : 0,
  sand: WEATHER_ON ? num('sand', 300) : 0,
  snow: WEATHER_ON ? num('snowfall', 420) : 0,
}));

/* ---------- the boat ---------- */
const boat = (landmarks.items.boat && landmarks.items.boatHome)
  ? createBoat(field, landmarks.items.boat, landmarks.items.boatHome, {})
  : null;

/* ---------- the traveller, the rig, the hands ---------- */
const traveller = createTraveller(B, scene, SH, {});

/* A rigged figure with real limbs replaces the procedural cone, but it loads
   asynchronously so the world is walkable immediately and simply gets a better
   body a moment later. If the load fails for any reason the procedural figure
   is already standing there — a missing model must not mean no character. */
let rigged = null;
const RIG_ON = QS.get('rig') !== '0';
if (RIG_ON) {
  loadRigged(B, scene, SH, {
    name: 'traveller3d',
    url: 'assets/traveller.glb',
    height: 1.78,
    /* He is dressed in the shader, cut from the bind pose — the downloaded rig
       is a nude mannequin and one flat colour over all of it just made a naked
       man in a cape. Tunic, sash, trousers, boots, skin. */
    cloth: [0.66, 0.31, 0.25],
    trim: [0.86, 0.74, 0.52],
    trouser: [0.25, 0.21, 0.26],
    boot: [0.15, 0.12, 0.14],
    skin: [0.55, 0.38, 0.29],
    clips: { idle: 'idle', walk: 'walk', run: 'run' },
    hood: true, hoodRadius: 0.135, hoodLift: 0.05,
  }).then((r) => {
    rigged = r;
    traveller.body.setEnabled(false);       // the cone stands down; the cape stays
    BOOT.rigged = Math.round(performance.now() - t0);
  }).catch((e) => {
    console.warn('rigged traveller unavailable, keeping the procedural one:', e && e.message);
  });

}
const control = createController(field, {
  x: WORLD.startX, z: WORLD.startZ, heading: 0,
  colliders: chunks ? chunks.colliders : null,
});
// the built things are permanent, so they register once rather than per tile
if (chunks) landmarks.addColliders(chunks.colliders);
const rig = createCameraRig(B, scene, camera, field, {});
traveller.reset(control.me, control.me.heading);
rig.snap(control.yaw, control.pitch, control.me);
// Only the near ring is built before the veil lifts. The rest streams in over
// the next few seconds under the frame budget, which is the entire point.
stage('prime', () => {
  if (chunks) chunks.prime(control.me.x, control.me.z, chunks.rings.near);
  else flora.grass.refocus(control.me.x, control.me.z);
});

/* ---------- the fairy, and the twin she speaks for ----------
   /wander/ had her and she was the best thing in it: a light that follows you,
   and a way for a visitor to ask a question instead of reading a wall. */
const companion = createCompanion(B, scene, SH, {});
/* Group 1 is drawn after the world. Babylon clears depth between rendering
   groups by default, which would let the fairy shine straight through a hill —
   she is a light in the world, not an overlay on it. */
scene.setRenderingAutoClearDepthStencil(1, false, false, false);

const worldMats = [skyObj.mat, water.mat, traveller.mat, companion.mat]
  .concat(lake ? [lake.mat] : [])
  .concat(chunks ? chunks.mats : [terrain.mat].concat(flora.mats))
  .concat(landmarks.mats)
  .concat(fauna.mats)
  .concat(weather.mats);

/* ---------- post-processing: the dreamy half of the look ---------- */
const pipeline = new B.DefaultRenderingPipeline('longlight', true, scene, [camera]);
pipeline.samples = 1;
pipeline.fxaaEnabled = true;

pipeline.bloomEnabled = true;
pipeline.bloomThreshold = 0.86;
pipeline.bloomWeight = 0.38;
pipeline.bloomKernel = TIER.bloomKernel;
pipeline.bloomScale = 0.55;

pipeline.imageProcessingEnabled = true;
pipeline.imageProcessing.toneMappingEnabled = true;
pipeline.imageProcessing.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
pipeline.imageProcessing.vignetteEnabled = true;
pipeline.imageProcessing.vignetteWeight = 1.5;
pipeline.imageProcessing.vignetteStretch = 0.4;
pipeline.imageProcessing.vignetteCameraFov = 1.1;

pipeline.grainEnabled = TIER.grain > 0;
pipeline.grain.intensity = TIER.grain;
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

/* ---------- quality: one place that applies a tier to everything --------- */

/**
 * @param name     'low' | 'mid' | 'high'
 * @param rebuild  false while the world is still booting, when the chunk
 *                 manager has not been primed yet and there is nothing to redo
 */
function applyTier(name, rebuild, quiet) {
  TIER = TIERS[name];
  engine.setHardwareScalingLevel(TIER.scaling / Math.min(window.devicePixelRatio || 1, 2));
  pipeline.bloomKernel = TIER.bloomKernel;
  pipeline.grainEnabled = TIER.grain > 0;
  pipeline.grain.intensity = TIER.grain;
  fauna.setDensity(TIER.deer / TIERS.high.deer);

  if (chunks && rebuild !== false) {
    const changed = chunks.setQuality({
      nearRings: TIER.nearRings, midRings: TIER.midRings,
      grassScale: TIER.grassScale, floraScale: TIER.floraScale,
    });
    // setQuality drops every tile; put the ground back under your feet at once
    // rather than letting it stream in and leaving you standing on the far field
    if (changed) chunks.prime(control.me.x, control.me.z, chunks.rings.near);
  }
  showQuality(quiet);
  return name;
}

/** Pick a tier by hand, or hand control back to the governor. */
function setQuality(choice) {
  if (choice === 'auto') {
    gov.auto();
    remember('auto');
    showQuality();
    return 'auto';
  }
  if (!TIERS[choice]) return currentChoice();
  gov.set(choice);
  applyTier(choice, true);
  remember(choice);
  return choice;
}

function remember(v) {
  try { localStorage.setItem('longlight.quality', v); } catch (e) { /* private window */ }
}
const currentChoice = () => (gov.locked ? gov.name : 'auto');

/* ---------- the governor, ratcheting down if the guess was generous ------ */
function governQuality(dt) {
  const dropped = gov.step(dt);
  if (!dropped) return;
  applyTier(dropped, true);
}

/* ---------- the quality control -----------------------------------------
   Four states rather than three: low / medium / high are explicit choices that
   stick, and 'auto' hands the decision back to the governor. A setting that
   quietly overrides itself is worse than no setting, so picking a tier locks
   the measurement off until you choose auto again. */
const qualityEl = document.getElementById('quality');
const toastEl = document.getElementById('toast');
let toastTimer = 0;

function toast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function showQuality(quiet) {
  const choice = currentChoice();
  if (qualityEl) {
    for (const el of qualityEl.querySelectorAll('span')) {
      el.setAttribute('aria-pressed', String(el.dataset.q === choice));
    }
  }
  if (!quiet) {
    toast(choice === 'auto'
      ? 'quality · auto (' + TIER_LABEL[gov.name] + ')'
      : 'quality · ' + TIER_LABEL[choice]);
  }
}

function cycleQuality() {
  const order = ['auto'].concat(TIER_ORDER);
  const i = order.indexOf(currentChoice());
  return setQuality(order[(i + 1) % order.length]);
}

if (qualityEl) {
  qualityEl.addEventListener('click', (e) => {
    const el = e.target.closest('span[data-q]');
    if (!el) return;
    setQuality(el.dataset.q);
    canvas.focus();
  });
}

/* Apply the starting tier for real, now that the pipeline and the fauna both
   exist. No rebuild: the chunk manager was primed at this tier already. */
applyTier(startTier, false, true);

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

const EMPTY_KEYS = Object.create(null);

/* The speeds the walk and run clips were authored for. Playback is scaled by
   the ratio of actual speed to these, so the feet never skate. */
const WALK_AT = 3.9, RUN_AT = 8.75;

/* ---------- the prompt that appears when something is within reach ------- */
const promptEl = document.getElementById('prompt');
let promptShown = false;
function updatePrompt(me) {
  if (!promptEl || !boat) return;
  const want = boat.aboard ? 'step ashore' : (boat.canBoard(me.x, me.z) ? 'take the boat' : null);
  if (!!want !== promptShown || (want && promptEl.dataset.k !== want)) {
    promptShown = !!want;
    promptEl.dataset.k = want || '';
    promptEl.innerHTML = want ? '<b>E</b> ' + want : '';
    promptEl.classList.toggle('show', !!want);
  }
}

let firstPerson = false;
let hintsGone = false;
let walked = 0;
let last = performance.now();

engine.runRenderLoop(() => {
  // ported from the old wander build: a hidden tab has no business simulating
  // a world, streaming tiles or animating a herd
  if (document.hidden) return;

  frames++;
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const t = (now - t0) / 1000;

  if (!frozen) {
    let me, subject, fwd, speed, running;

    if (boat && boat.aboard) {
      // Rowing. The traveller is cargo: seated, no gait, carried by the hull.
      const bs = boat.update(dt, control.keys, t, control.stick);
      const seat = boat.seat();
      control.place(bs.x, bs.z, bs.heading);
      me = control.me;
      if (rigged) { rigged.root.position.set(seat.x, seat.y, seat.z);
                    rigged.root.rotation.y = seat.heading;
                    rigged.setSpeed(dt, 0, WALK_AT, RUN_AT);
                    rigged.follow(seat.heading); }
      traveller.update(dt, seat, seat.heading, 0, 0, t, rigged ? rigged.shoulders() : null);
      subject = { x: bs.x, y: bs.y, z: bs.z };
      fwd = { x: Math.sin(bs.heading), z: Math.cos(bs.heading) };
      speed = Math.abs(bs.speed); running = 0;
    } else {
      me = control.update(dt);
      if (boat) boat.update(dt, EMPTY_KEYS, t);      // she still rides the swell
      /* Order matters: the figure moves and animates first, THEN the cape is
         told where its shoulders ended up. Reversed, the cape hangs one frame
         behind the body and visibly lags on every turn. */
      if (rigged) { rigged.root.position.set(me.x, me.y, me.z);
                    rigged.root.rotation.y = me.heading;
                    rigged.setSpeed(dt, me.speed, WALK_AT, RUN_AT);
                    rigged.follow(me.heading); }
      traveller.update(dt, me, me.heading, me.speed, me.running, t,
                       rigged ? rigged.shoulders() : null);
      subject = me; fwd = me.fwd; speed = me.speed; running = me.running;
    }

    updatePrompt(me);
    rig.update(dt, control.yaw, control.pitch, subject, fwd, speed, running, firstPerson);
    traveller.body.setEnabled(!firstPerson && !rigged);
    traveller.cloak.setEnabled(!firstPerson);
    if (rigged) rigged.setEnabled(!firstPerson);

    // The world streams around wherever you are. The budget is what keeps
    // tile building from ever becoming a hitch: a frame spends at most this
    // many milliseconds on it and picks up where it left off next frame.
    if (chunks) chunks.update(me.x, me.z, 4);
    else flora.grass.follow(me.x, me.z);

    fauna.update(dt, me.x, me.z);
    weather.update(dt, camera, me.x, me.z, sky, t, TIER.weatherScale);
    companion.update(dt, camera, subject, me.heading, sky, t);
    announcePlace(me.x, me.z, dt);
    governQuality(dt);

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
  if (e.code === 'KeyQ') { cycleQuality(); return; }
  if (e.code === 'KeyE') useAction();
  if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  control.key(e.code, true);
});
addEventListener('keyup', (e) => control.key(e.code, false));
addEventListener('blur', () => { for (const k of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight']) control.key(k, false); });

/** board or leave the boat — bound to E, and to the touch pad's own button */
function useAction() {
  if (!boat || frozen) return;
  if (boat.aboard) {
    const land = boat.disembark();
    if (land) { control.place(land.x, land.z, boat.state.heading); traveller.reset(control.me, control.me.heading); }
  } else if (boat.canBoard(control.me.x, control.me.z)) {
    boat.board();
  }
}

canvas.addEventListener('click', () => { if (!pointerLocked) canvas.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => { pointerLocked = document.pointerLockElement === canvas; });
addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
  control.orbit(e.movementX * 0.0022, -e.movementY * 0.0016);
});

/* ---------- touch ----------------------------------------------------------
   The first pass here was "the left third of the screen means forward", which
   is not a control scheme — you cannot steer, you cannot stroll, and half the
   screen you want to look around with is a walk button.

   So: a real thumbstick bottom-left (analog, so a half push strolls), a run
   toggle and a use button bottom-right, and everything else on the canvas is
   the camera. The pads live in #touch, which is pointer-events:none except on
   the pads themselves, so a finger that lands on glass reaches the canvas and
   a finger that lands on the stick never becomes a camera drag. */
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints || 0) > 0;
if (IS_TOUCH) document.body.classList.add('touch');

(function touchPad() {
  const stick = document.getElementById('stick');
  const knob = document.getElementById('knob');
  const runBtn = document.getElementById('tRun');
  const useBtn = document.getElementById('tUse');
  if (!stick || !knob) return;

  const R = 40;                     // how far the knob travels, in px
  let stickId = null, running = false;

  function setKnob(dx, dy) {
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  function drive(e) {
    const r = stick.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const m = Math.hypot(dx, dy) || 1;
    // the knob stops at the ring; the *intent* saturates there too
    const k = Math.min(1, R / m);
    setKnob(dx * k, dy * k);
    const mag = Math.min(1, m / R);
    // screen up is forward; the controller takes (right, forward)
    control.axis((dx / m) * mag, (-dy / m) * mag, running);
  }
  function release() {
    stickId = null;
    stick.classList.remove('on');
    setKnob(0, 0);
    control.axis(0, 0, false);
  }

  stick.addEventListener('pointerdown', (e) => {
    stickId = e.pointerId;
    // capture keeps the moves coming when the thumb slides off the ring; a
    // synthetic pointer has nothing to capture, so this must not be fatal
    try { stick.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
    stick.classList.add('on');
    drive(e);
    e.preventDefault();
  });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) drive(e); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    stick.addEventListener(ev, (e) => { if (e.pointerId === stickId) release(); });
  }

  /* Run is a TOGGLE, not a hold. Holding a second button down while your other
     thumb steers is a two-hand problem nobody wants on a phone. */
  if (runBtn) runBtn.addEventListener('pointerdown', (e) => {
    running = !running;
    runBtn.classList.toggle('on', running);
    if (stickId !== null) drive(e);            // take effect without re-pushing
    else control.axis(0, 0, false);
    e.preventDefault();
  });

  if (useBtn) useBtn.addEventListener('pointerdown', (e) => { useAction(); e.preventDefault(); });
})();

/* the camera: any drag on the canvas itself, one finger at a time */
let touchId = null, lastTX = 0, lastTY = 0;
canvas.addEventListener('touchstart', (e) => {
  if (touchId !== null) return;
  const t = e.changedTouches[0];
  touchId = t.identifier; lastTX = t.clientX; lastTY = t.clientY;
}, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier !== touchId) continue;
    control.orbit((t.clientX - lastTX) * 0.005, -(t.clientY - lastTY) * 0.004);
    lastTX = t.clientX; lastTY = t.clientY;
  }
}, { passive: true });
for (const ev of ['touchend', 'touchcancel']) {
  canvas.addEventListener(ev, (e) => {
    for (const t of e.changedTouches) if (t.identifier === touchId) touchId = null;
  }, { passive: true });
}

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
      colliders: chunks ? chunks.colliders.count : 0,
      blocked: !!control.me.blocked,
      flora: chunks ? chunks.mem().instances : flora.counts,
      fauna: fauna.counts,
      weather: weather.counts(),
      tier: gov.name,
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
  /** tests: the boat, and riding it */
  boat() {
    if (!boat) return null;
    const s = boat.state;
    return { x:+s.x.toFixed(2), y:+s.y.toFixed(2), z:+s.z.toFixed(2),
             heading:+s.heading.toFixed(2), speed:+s.speed.toFixed(2), aboard: s.aboard,
             lakeT: +field.lakeT(s.x, s.z).toFixed(3), level: +field.lakeLevel.toFixed(2) };
  },
  board() { if (!boat) return false; frozen = false;
    control.place(boat.state.x + 2, boat.state.z + 2, boat.state.heading);
    const ok = boat.canBoard(control.me.x, control.me.z); if (ok) boat.board(); return ok; },
  ashore() { if (!boat || !boat.aboard) return null;
    const l = boat.disembark();
    if (l) { control.place(l.x, l.z, boat.state.heading); traveller.reset(control.me, control.me.heading); }
    return l; },
  /** what the quality governor decided, and why */
  quality() { return Object.assign({ tier: gov.name, choice: currentChoice() }, gov.stats(),
    { applied: TIER, fauna: fauna.counts }); },
  setTier(n) { return setQuality(n); },
  cycleQuality() { return cycleQuality(); },
  /** the rigged figure: is it in, and what did it bring */
  rig() {
    if (!rigged) return { loaded: false };
    return { loaded: true, scale: +rigged.scale.toFixed(3),
             clips: rigged.names, bones: rigged.skeleton ? rigged.skeleton.bones.length : 0,
             have: { idle: !!rigged.clips.idle, walk: !!rigged.clips.walk, run: !!rigged.clips.run } };
  },
  /** the fairy and her twin: is the light in, and what does she answer with */
  twin() {
    return { mesh: companion.mesh.isEnabled(), brain: companion.brainKind(),
             open: companion.open,
             pos: [+companion.pos.x.toFixed(2), +companion.pos.y.toFixed(2), +companion.pos.z.toFixed(2)] };
  },
  /** ask the twin a question the way the input box does */
  async ask(q) { companion.toggle(true); const a = await window.TwinBrain.answer(q); companion.add('twin', a); return a; },
  chat(open) { companion.toggle(open); return companion.open; },
  /** drive the virtual thumbstick from a test */
  stick(x, z, run) { control.axis(x, z, run); return { x, z, run: !!run }; },
  touch: () => ({ enabled: document.body.classList.contains('touch'),
                  pads: ['stick', 'knob', 'tRun', 'tUse'].every((i) => !!document.getElementById(i)) }),
  boot: BOOT,
  ready: true,
};
