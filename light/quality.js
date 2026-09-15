/* ==========================================================================
   quality.js — find out what this machine can do, without asking.

   Two stages, because neither alone is honest:

     1. GUESS from static hints before anything is built, so a phone never even
        allocates a desktop's worth of tiles.
     2. MEASURE once it is running, and step DOWN if the guess was generous.

   It only ever steps down. Stepping up as well sounds fairer and produces a
   rig that oscillates: raise the tier, lose the frame rate, lower it, regain
   it, raise it again. A one-way ratchet settles.

   The order of sacrifice matters more than the thresholds. Grain and bloom
   kernel go first because nobody can name what left; the ring radius and flora
   density go late because they change what the world IS; and the art direction
   — the palette, the toon ramp, the aerial fog — is never touched at all. A
   world that runs at sixty frames and looks like a different game has not been
   optimised, it has been replaced.

   Streaming made this much cheaper than it would otherwise have been: ring
   radius is now the strongest single knob, and changing it costs nothing but a
   rebuild of tiles that were going to churn anyway.
   ========================================================================== */

export const TIERS = {
  low:    { nearRings: 1, midRings: 3, grassScale: 0.35, floraScale: 0.45,
            weatherScale: 0.35, bloomKernel: 24, grain: 0, scaling: 1.35, deer: 8, birds: 18 },
  mid:    { nearRings: 2, midRings: 4, grassScale: 0.7,  floraScale: 0.75,
            weatherScale: 0.7,  bloomKernel: 48, grain: 2.0, scaling: 1.0, deer: 16, birds: 34 },
  high:   { nearRings: 2, midRings: 5, grassScale: 1.0,  floraScale: 1.0,
            weatherScale: 1.0,  bloomKernel: 64, grain: 3.0, scaling: 1.0, deer: 26, birds: 54 },
};

const ORDER = ['low', 'mid', 'high'];

/**
 * A first guess from what the browser will tell us for free.
 * Deliberately conservative: being wrong downward costs a little detail,
 * being wrong upward costs the first impression.
 */
export function guessTier(engine) {
  let score = 0;

  const cores = navigator.hardwareConcurrency || 4;
  score += cores >= 8 ? 2 : (cores >= 4 ? 1 : 0);

  const memGB = navigator.deviceMemory || 4;
  score += memGB >= 8 ? 2 : (memGB >= 4 ? 1 : 0);

  // a coarse-pointer primary input is a phone or a TV, and neither is a desktop
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch) score -= 2;

  // a very high DPR means a lot more pixels for the same picture
  if ((window.devicePixelRatio || 1) > 2.5) score -= 1;

  try {
    const gl = engine._gl;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '') || '';
    // software rasterisers are honest about themselves, and they are slow
    if (/swiftshader|llvmpipe|software|basic render/i.test(r)) score -= 4;
    if (/rtx|radeon rx|apple m[1-9]|geforce/i.test(r)) score += 2;
  } catch (e) { /* the extension is optional; the guess survives without it */ }

  if (engine.webGLVersion < 2) score -= 2;

  return score >= 4 ? 'high' : (score >= 1 ? 'mid' : 'low');
}

/**
 * Watch the frame rate and ratchet the tier down if the guess was too kind.
 *
 * @param apply  (tier, name) => void — the caller decides what a tier means
 */
export function createGovernor(engine, opts) {
  opts = opts || {};
  const target = opts.target || 30;
  const warmup = opts.warmup == null ? 2.5 : opts.warmup;   // seconds to ignore
  const window_ = opts.window || 3.0;                       // seconds per verdict
  const maxSteps = opts.maxSteps == null ? 2 : opts.maxSteps;

  let name = opts.start || 'high';
  let elapsed = 0, acc = 0, frames = 0, steps = 0;
  let locked = !!opts.locked;
  const history = [];

  function step(dt) {
    if (locked || steps >= maxSteps) return null;
    elapsed += dt;
    if (elapsed < warmup) return null;

    acc += dt; frames++;
    if (acc < window_) return null;

    const fps = frames / acc;
    history.push(Math.round(fps));
    acc = 0; frames = 0;

    if (fps >= target) {
      // one good window is enough to stop worrying about this machine
      locked = true;
      return null;
    }
    const i = ORDER.indexOf(name);
    if (i <= 0) { locked = true; return null; }
    name = ORDER[i - 1];
    steps++;
    return name;
  }

  return {
    step,
    get tier() { return TIERS[name]; },
    get name() { return name; },
    get locked() { return locked; },
    lock() { locked = true; },
    set(n) { if (TIERS[n]) { name = n; locked = true; } return name; },
    stats() { return { name, steps, locked, fpsWindows: history.slice(-6) }; },
  };
}
