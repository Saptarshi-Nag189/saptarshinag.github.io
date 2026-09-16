/* ==========================================================================
   noise.js — seeded, deterministic procedural noise.
   The whole world is grown from these numbers, so the same seed must always
   produce the same island. No Math.random() anywhere in world generation.
   ========================================================================== */

/* mulberry32 — small, fast, well-distributed seeded PRNG */
export function makeRNG(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- 2D simplex noise (Gustavson), seeded permutation ---- */
const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

export function makeNoise2D(seed) {
  const rng = makeRNG(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {                 // seeded Fisher-Yates
    const j = Math.floor(rng() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;

  return function noise2D(xin, yin) {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) { const g = GRAD2[perm[ii + perm[jj]] & 7]; t0 *= t0; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) { const g = GRAD2[perm[ii + i1 + perm[jj + j1]] & 7]; t1 *= t1; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) { const g = GRAD2[perm[ii + 1 + perm[jj + 1]] & 7]; t2 *= t2; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2); }

    return 70 * (n0 + n1 + n2);                   // ~[-1,1]
  };
}

/* ---- fractal layers ---- */

/** classic fBm — rolling, organic; good for plains, dunes, moisture masks */
export function fbm(noise, x, y, octaves, lacunarity, gain) {
  octaves = octaves || 5; lacunarity = lacunarity || 2.0; gain = gain || 0.5;
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * freq, y * freq);
    norm += amp;
    amp *= gain; freq *= lacunarity;
  }
  return sum / norm;                              // ~[-1,1]
}

/** ridged multifractal — sharp crests; the spire, rock, mountain silhouettes */
export function ridged(noise, x, y, octaves, lacunarity, gain) {
  octaves = octaves || 5; lacunarity = lacunarity || 2.05; gain = gain || 0.5;
  let amp = 1, freq = 1, sum = 0, norm = 0, prev = 1;
  for (let o = 0; o < octaves; o++) {
    let n = 1 - Math.abs(noise(x * freq, y * freq));
    n *= n;
    n *= prev;                                    // feed-forward sharpens crests
    prev = n;
    sum += amp * n;
    norm += amp;
    amp *= gain; freq *= lacunarity;
  }
  return sum / norm;                              // [0,1]
}

/** billowy — puffy, cloud-like; canopies and clouds */
export function billow(noise, x, y, octaves, lacunarity, gain) {
  octaves = octaves || 4; lacunarity = lacunarity || 2.0; gain = gain || 0.5;
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * Math.abs(noise(x * freq, y * freq));
    norm += amp;
    amp *= gain; freq *= lacunarity;
  }
  return sum / norm;                              // [0,1]
}

/** domain warp — the single cheapest trick that stops noise looking like noise */
export function warp(noise, x, y, strength, freq) {
  strength = strength == null ? 1 : strength;
  freq = freq == null ? 1 : freq;
  const wx = fbm(noise, x * freq + 11.3, y * freq + 5.1, 3);
  const wy = fbm(noise, x * freq - 7.7, y * freq + 19.4, 3);
  return [x + wx * strength, y + wy * strength];
}

/* ---- small helpers used all over world generation ---- */
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
/** remap ~[-1,1] noise to [0,1] */
export const unit = (n) => n * 0.5 + 0.5;
