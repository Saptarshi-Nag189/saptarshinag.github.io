/* ==========================================================================
   biome.js — the island's climate.

   Variety placed at random reads as noise. Variety placed by a CLIMATE reads
   as a world: you can feel why the desert is where it is, and walking from one
   land to the next means something.

   Two fields decide everything, the way a Whittaker diagram does:

     temperature  warm in the south where the traveller lands, cooling north,
                  and falling with altitude — so the summit is snow no matter
                  what latitude it sits at.
     moisture     dry in the west, wet in the east, plus the lake's own halo.

   Every biome is a WEIGHT, never a hard id, so the ground, the flora and the
   terrain shape all cross-fade. Hard biome borders are the single most common
   way a procedural world announces that it is procedural.
   ========================================================================== */
import { makeNoise2D, fbm, billow, clamp, lerp, smoothstep } from './noise.js';

export const BIOME = {
  BEACH: 'beach',
  DESERT: 'desert',
  MEADOW: 'meadow',
  FOREST: 'forest',
  MARSH: 'marsh',
  ROCK: 'rock',
  SNOW: 'snow',
};

export const BIOME_ORDER = [
  BIOME.BEACH, BIOME.DESERT, BIOME.MEADOW, BIOME.FOREST,
  BIOME.MARSH, BIOME.ROCK, BIOME.SNOW,
];

/** Ground albedo per biome. Flat, desaturated, for the toon shader to light. */
export const GROUND = {
  beach:  [0.80, 0.72, 0.56],
  desert: [0.84, 0.70, 0.46],
  meadow: [0.30, 0.44, 0.22],
  forest: [0.19, 0.31, 0.16],
  marsh:  [0.27, 0.32, 0.19],
  rock:   [0.46, 0.44, 0.45],
  snow:   [0.86, 0.89, 0.95],
};

/** A second tone per biome, mixed in by a slow drift so nothing reads as paint. */
export const GROUND_ALT = {
  beach:  [0.72, 0.63, 0.48],
  desert: [0.72, 0.56, 0.36],
  meadow: [0.42, 0.47, 0.25],
  forest: [0.24, 0.36, 0.18],
  marsh:  [0.20, 0.26, 0.16],
  rock:   [0.55, 0.53, 0.52],
  snow:   [0.74, 0.80, 0.92],
};

/**
 * @param seed  the world seed
 * @param W     { halfExtent, shoreZ, lake: {x, z, r} }
 */
export function createClimate(seed, W) {
  const nT = makeNoise2D(seed + 1201);
  const nM = makeNoise2D(seed + 1301);
  const nD = makeNoise2D(seed + 1409);   // dune field
  const nS = makeNoise2D(seed + 1511);   // snowline wobble
  const nJ = makeNoise2D(seed + 1613);   // the blotchy edge noise

  const H = W.halfExtent;

  /**
   * Climate BEFORE altitude is known. Terrain shape reads this — the dunes
   * have to exist before there is a height to ask about.
   */
  function regionAt(x, z) {
    // warm in the south (where you land), cooling as you go north
    const lat = 1 - (z + H) / (2 * H);                 // 1 at the south edge
    const temp0 = clamp(0.20 + lat * 0.72 + fbm(nT, x * 0.0022, z * 0.0022, 3) * 0.30, 0, 1.3);

    // dry in the west, wet in the east
    const lon = (x + H) / (2 * H);
    let moist0 = clamp(0.04 + lon * 0.80 + fbm(nM, x * 0.0022, z * 0.0022, 3) * 0.26, 0, 1.3);

    // the lake waters its own country
    if (W.lake) {
      const d = Math.hypot(x - W.lake.x, z - W.lake.z) / (W.lake.r * 2.6);
      moist0 += (1 - clamp(d, 0, 1)) * 0.45;
    }
    return { temp0, moist0: clamp(moist0, 0, 1.4) };
  }

  /** 0 = not sand, 1 = dune sea. Used by the height field. */
  function duneAt(x, z) {
    const r = regionAt(x, z);
    return smoothstep(0.44, 0.14, r.moist0) * smoothstep(0.28, 0.54, r.temp0);
  }

  /** The dune surface itself — billow noise, which makes rounded crests. */
  function duneHeight(x, z) {
    return billow(nD, x * 0.0085, z * 0.0085, 3) * 11.0
         + billow(nD, x * 0.028, z * 0.028, 2) * 2.4;
  }

  /**
   * The full climate at a point, once height is known.
   * Returns a weight per biome, normalised to sum to 1.
   */
  function climateAt(x, z, h, inland, moistureAt) {
    const r = regionAt(x, z);

    // altitude lapse rate: the summit is arctic whatever the latitude
    const temp = r.temp0 - Math.max(0, h - 38) / 105;
    // The local damp-noise gets a SMALL say. Given a large one it floors the
    // moisture everywhere and the desert never forms — the first pass came out
    // at 2% sand in scattered patches instead of a dune sea.
    const moist = clamp(r.moist0 * 0.82 + (moistureAt ? moistureAt * 0.24 : 0.12), 0, 1.3);

    // a blotchy edge noise so no border is a clean contour line
    const edge = fbm(nJ, x * 0.012, z * 0.012, 2) * 0.09;

    const w = { beach: 0, desert: 0, meadow: 0, forest: 0, marsh: 0, rock: 0, snow: 0 };

    // snow: cold, and the snowline itself wanders
    const snowline = 0.16 + nS(x * 0.004, z * 0.004) * 0.06;
    w.snow = smoothstep(snowline + 0.14, snowline - 0.06, temp + edge);

    // bare rock on anything steep or high but not yet frozen
    w.rock = clamp(smoothstep(52, 104, h) * (1 - w.snow), 0, 1);

    // desert: dry and warm
    w.desert = smoothstep(0.46, 0.17, moist + edge) * smoothstep(0.26, 0.50, r.temp0)
             * (1 - w.snow) * (1 - w.rock * 0.6);

    // marsh: the lake's shoreline
    if (W.lake) {
      const d = Math.hypot(x - W.lake.x, z - W.lake.z);
      w.marsh = smoothstep(W.lake.r * 1.55, W.lake.r * 1.02, d) * (1 - w.snow);
    }

    // forest: wet, not frozen, not sand
    w.forest = smoothstep(0.50, 0.78, moist + edge) * (1 - w.snow) * (1 - w.rock * 0.7);

    // beach: the strip where the land meets the sea
    w.beach = smoothstep(46, 6, inland) * smoothstep(7.5, 1.0, h);

    // whatever is left is meadow
    const taken = clamp(w.snow + w.rock + w.desert + w.forest + w.marsh + w.beach, 0, 1);
    w.meadow = 1 - taken;

    // normalise
    let sum = 0;
    for (const k in w) sum += w[k];
    if (sum > 1e-6) for (const k in w) w[k] /= sum;

    w.temp = temp;
    w.moist = moist;
    return w;
  }

  /** The single strongest biome — for labels and for placement rules. */
  function dominant(w) {
    let best = BIOME.MEADOW, bv = -1;
    for (const k of BIOME_ORDER) if (w[k] > bv) { bv = w[k]; best = k; }
    return best;
  }

  return { regionAt, duneAt, duneHeight, climateAt, dominant };
}

/** Blend the per-biome ground palettes by weight. */
export function groundFromWeights(w, drift) {
  let r = 0, g = 0, b = 0;
  for (const k of BIOME_ORDER) {
    const t = w[k];
    if (t <= 0.0005) continue;
    const a = GROUND[k], c = GROUND_ALT[k];
    r += lerp(a[0], c[0], drift) * t;
    g += lerp(a[1], c[1], drift) * t;
    b += lerp(a[2], c[2], drift) * t;
  }
  return [r, g, b];
}
