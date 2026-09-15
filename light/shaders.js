/* ==========================================================================
   shaders.js — the shared shading language of THE LONG LIGHT.

   Everything visible uses these chunks, which is what makes the world cohere:
     · skyColor() is used by BOTH the skybox AND the aerial-perspective fog, so
       distant geometry melts exactly into the horizon instead of sitting on it.
     · toonLit() gives a banded terminator + sky-tinted rim light — stylised,
       never photoreal. No PBR, no IBL, no metal/roughness anywhere.
   One set of uniforms drives the whole world, so time-of-day is a single state
   object animated once per frame (see sky.js).
   ========================================================================== */

/** Uniform names every world material declares. Keep in sync with COMMON_UNIFORMS. */
export const COMMON_UNIFORM_NAMES = [
  'world', 'worldViewProjection', 'uTime', 'uCamPos',
  'uSunDir', 'uSunCol', 'uSkyZenith', 'uSkyHorizon', 'uSkyGround',
  'uSunSize', 'uSunGlow', 'uAmbCol', 'uGroundCol',
  'uRimCol', 'uRimStr', 'uRimPow',
  'uFogDensity', 'uFogStrength', 'uFogHeight', 'uDebug',
];

/** GLSL declarations — prepend to any fragment shader using the chunks below. */
export const COMMON_UNIFORMS = /* glsl */`
  uniform float uTime;
  uniform vec3  uCamPos;
  uniform vec3  uSunDir;        // normalised, points TOWARD the sun
  uniform vec3  uSunCol;
  uniform vec3  uSkyZenith;
  uniform vec3  uSkyHorizon;
  uniform vec3  uSkyGround;
  uniform float uSunSize;
  uniform float uSunGlow;
  uniform vec3  uAmbCol;        // hemisphere light from above
  uniform vec3  uGroundCol;     // bounce from below
  uniform vec3  uRimCol;
  uniform float uRimStr;
  uniform float uRimPow;
  uniform float uFogDensity;
  uniform float uFogStrength;
  uniform float uFogHeight;
  uniform float uDebug;         // 0 = render, 1 = flat albedo / mesh id
`;

/**
 * The sky. Shared by the skybox and by the fog, so they can never disagree.
 * `d` must be a normalised direction in world space.
 */
export const SKY_FN = /* glsl */`
  vec3 skyColor(vec3 d){
    float h = d.y;

    // gradient, compressed toward the horizon where the interesting colour is
    float t   = pow(clamp(h, 0.0, 1.0), 0.42);
    vec3  col = mix(uSkyHorizon, uSkyZenith, t);

    // haze below the horizon line
    col = mix(col, uSkyGround, smoothstep(0.0, -0.20, h));

    float sd = max(dot(d, uSunDir), 0.0);

    // the warm band that spreads along the horizon toward the sun —
    // this is what sells dawn and golden hour
    vec3  flat3 = normalize(vec3(d.x, 0.0, d.z) + 1e-5);
    vec3  flatS = normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + 1e-5);
    float band  = pow(1.0 - abs(h), 7.0) * pow(max(dot(flat3, flatS), 0.0), 2.0);
    col += uSunCol * band * 0.45;

    // broad glow, then the disc itself
    col += uSunCol * pow(sd, 6.0)        * uSunGlow;
    col += uSunCol * pow(sd, uSunSize)   * 3.2;

    return col;
  }
`;

/**
 * Aerial perspective. Distant things lose contrast and take the sky's colour —
 * the cheapest, strongest depth cue there is.
 */
export const FOG_FN = /* glsl */`
  vec3 applyAerial(vec3 col, vec3 worldPos){
    vec3  toCam = worldPos - uCamPos;
    float dist  = length(toCam);
    vec3  viewDir = toCam / max(dist, 1e-4);

    // Haze pools low and thins with altitude, so distant peaks rise clear out
    // of it instead of dissolving. Exponential in distance, NOT distance
    // squared: the squared form stays invisible up close and then swallows
    // everything past a few hundred metres.
    float hFade = exp(-max(worldPos.y, 0.0) * uFogHeight);
    float f = 1.0 - exp(-dist * uFogDensity * hFade);
    f = clamp(f * uFogStrength, 0.0, 1.0);

    return mix(col, skyColor(viewDir), f);
  }
`;

/**
 * Stylised lighting: a banded sun terminator, hemisphere ambient, and a rim
 * light tinted to the sky. `shadeSoft` widens the terminator (small = crisp
 * toon edge, large = soft organic falloff).
 */
export const LIGHT_FN = /* glsl */`
  vec3 toonLit(vec3 albedo, vec3 N, vec3 V, float shadeSoft, float bandLift, float rimScale){
    float ndl = dot(N, uSunDir);

    // main terminator — one soft step, not a hard cel edge (dreamy, not comic)
    float lit = smoothstep(-0.05, shadeSoft, ndl);

    // a second, subtler band in the brightest region gives the look its depth
    lit += smoothstep(0.45, 0.85, ndl) * 0.18;

    // Key and fill are deliberately scaled so a fully lit surface lands near
    // 1.2x albedo, not 1.9x. Above that the tonemapper has nothing left to do
    // and every sunlit slope desaturates toward white.
    vec3 sun = uSunCol * lit * 0.85;

    // hemisphere ambient: sky above, warm bounce below
    float up  = N.y * 0.5 + 0.5;
    vec3  amb = mix(uGroundCol, uAmbCol, up) * 0.64;

    vec3 col = albedo * (sun + amb + bandLift);

    // Rim light, tinted to the sky — separates silhouettes from the background.
    // rimScale exists because this term is added flat, independent of albedo:
    // on a big ground plane seen at a grazing angle the Fresnel term is ~1
    // everywhere, so at full strength it washes the whole landscape to the rim
    // colour. Small objects want 1.0; the ground wants a fraction of that.
    float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), uRimPow);
    col += uRimCol * rim * uRimStr * rimScale;

    return col;
  }
`;

/** Everything a world fragment shader needs, in one string. */
export const FRAG_PRELUDE = COMMON_UNIFORMS + SKY_FN + FOG_FN + LIGHT_FN;

/* ---- vertex-shader wind, shared by grass and foliage ---------------------
   Bends geometry around its base. `sway` should be 0 at the root and 1 at the
   tip so blades hinge instead of sliding.                                   */
export const WIND_FN = /* glsl */`
  vec3 applyWind(vec3 worldPos, float sway, float phase, float strength){
    float t = uTime * 1.15 + phase;
    // two incommensurate frequencies stop the field pulsing in unison
    float g = sin(t + worldPos.x * 0.18 + worldPos.z * 0.13)
            + sin(t * 0.53 + worldPos.x * 0.07 - worldPos.z * 0.11) * 0.5;
    float amt = g * sway * sway * strength;
    worldPos.x += amt;
    worldPos.z += amt * 0.55;
    worldPos.y -= abs(amt) * 0.12;      // tips dip slightly as they bend
    return worldPos;
  }
`;

/* ==========================================================================
   Uniform plumbing
   ========================================================================== */

/**
 * Push a time-of-day state object into a ShaderMaterial.
 * `sky` is the object produced by sky.js (createSkyState / setSkyTime).
 */
export function applyCommonUniforms(mat, sky, camPos, timeSec) {
  mat.setFloat('uTime', timeSec);
  mat.setVector3('uCamPos', camPos);
  mat.setVector3('uSunDir', sky.sunDir);
  mat.setColor3('uSunCol', sky.sunCol);
  mat.setColor3('uSkyZenith', sky.zenith);
  mat.setColor3('uSkyHorizon', sky.horizon);
  mat.setColor3('uSkyGround', sky.ground);
  mat.setFloat('uSunSize', sky.sunSize);
  mat.setFloat('uSunGlow', sky.sunGlow);
  mat.setColor3('uAmbCol', sky.ambient);
  mat.setColor3('uGroundCol', sky.bounce);
  mat.setColor3('uRimCol', sky.rimCol);
  mat.setFloat('uRimStr', sky.rimStr);
  mat.setFloat('uRimPow', sky.rimPow);
  mat.setFloat('uFogDensity', sky.fogDensity);
  mat.setFloat('uFogStrength', sky.fogStrength);
  mat.setFloat('uFogHeight', sky.fogHeight);
  mat.setFloat('uDebug', sky.debug || 0);
}

/** Convenience: the standard options blob for a world-space ShaderMaterial. */
export function shaderOptions(extraAttrs, extraUniforms, defines) {
  return {
    attributes: ['position', 'normal', 'uv'].concat(extraAttrs || []),
    uniforms: COMMON_UNIFORM_NAMES.concat(extraUniforms || []),
    defines: defines || [],
    needAlphaBlending: false,
    needAlphaTesting: false,
  };
}
