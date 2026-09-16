/* ==========================================================================
   rigged.js — a real skeleton, wearing our light.

   The procedural figure was a cone with a subtle sway, and from behind at five
   metres it read, in his words, like "a cockroach with no actual movement".
   A rigged model fixes that in the only way that really works: actual limbs
   taking actual steps.

   The problem with dropping in a downloaded model is that it arrives with its
   own material and stops belonging to the world — a grey PBR figure standing
   in a hand-toned, fog-bound, toon-shaded island looks pasted on. So the mesh
   comes in, and then its material is thrown away and replaced with the SAME
   toonLit used by the ground, the trees and the deer, with skinning added. The
   figure is lit by our sun, tinted our red-ochre and fogged by our haze.

   Skinning in a custom ShaderMaterial is the fiddly part: Babylon's
   `bonesDeclaration` / `bonesVertex` includes do the work, but the material
   must declare the matricesIndices/matricesWeights attributes and the
   NUM_BONE_INFLUENCERS + BonesPerMesh defines itself.
   ========================================================================== */

/** The toon material, with bones. */
function riggedMaterial(BABYLON, scene, shaders, opts) {
  opts = opts || {};

  BABYLON.Effect.ShadersStore['riggedVertexShader'] = /* glsl */`
    precision highp float;
    attribute vec3 position;
    attribute vec3 normal;
    #include<bonesDeclaration>
    uniform mat4 world;
    uniform mat4 viewProjection;
    varying vec3 vWorld; varying vec3 vNormal; varying float vUp;
    void main(){
      /* bonesVertex declares influence itself and MULTIPLIES an existing
         finalWorld -- it does not create one. Declaring either here is a
         redefinition error, which is exactly how this failed first time. */
      mat4 finalWorld = world;
      #include<bonesVertex>
      vec4 wp = finalWorld * vec4(position, 1.0);
      vWorld = wp.xyz;
      vNormal = normalize(mat3(finalWorld) * normal);
      // height up the body, for the cloth gradient
      vUp = position.y;
      gl_Position = viewProjection * wp;
    }`;

  BABYLON.Effect.ShadersStore['riggedFragmentShader'] = /* glsl */`
    precision highp float;
    varying vec3 vWorld; varying vec3 vNormal; varying float vUp;
    uniform vec3 uCloth;
    uniform vec3 uTrim;
    ${shaders.FRAG_PRELUDE}
    void main(){
      vec3 N = normalize(vNormal);
      vec3 V = normalize(uCamPos - vWorld);

      // the robe darkens toward the hem, the way heavy cloth does
      vec3 albedo = mix(uCloth * 0.82, uCloth, clamp(vUp / 1.7, 0.0, 1.0));
      // a pale sash about the waist, which is what gives the silhouette a waist
      albedo = mix(albedo, uTrim, smoothstep(0.98, 1.02, vUp) * (1.0 - smoothstep(1.06, 1.12, vUp)));

      if (uDebug > 0.5) { gl_FragColor = vec4(albedo, 1.0); return; }
      // full rim: this silhouette must never be lost against the land
      vec3 col = toonLit(albedo, N, V, 0.36, 0.26, 1.0);
      col = applyAerial(col, vWorld);
      gl_FragColor = vec4(col, 1.0);
    }`;

  const mat = new BABYLON.ShaderMaterial('riggedMat', scene,
    { vertex: 'rigged', fragment: 'rigged' },
    {
      /* Babylon adds the bone attributes, the bone uniforms and the
         NUM_BONE_INFLUENCERS / BONETEXTURE defines itself once it sees a
         skinned mesh. Declaring them here as well produced duplicates. */
      attributes: ['position', 'normal'],
      uniforms: shaders.COMMON_UNIFORM_NAMES.concat(['viewProjection', 'uCloth', 'uTrim']),
      defines: [],
      needAlphaBlending: false,
      needAlphaTesting: false,
    });
  mat.setColor3('uCloth', new BABYLON.Color3(...(opts.cloth || [0.42, 0.20, 0.17])));
  mat.setColor3('uTrim', new BABYLON.Color3(...(opts.trim || [0.78, 0.66, 0.45])));
  mat.backFaceCulling = false;
  return mat;
}

/**
 * Load a rigged glTF and drive it by speed.
 *
 * @param spec.url       the .glb
 * @param spec.height    metres the figure should stand, so any model fits the world
 * @param spec.clips     { idle, walk, run } — names as they appear in the file
 */
export async function loadRigged(BABYLON, scene, shaders, spec) {
  const res = await BABYLON.SceneLoader.ImportMeshAsync('', spec.url, '', scene);

  const root = new BABYLON.TransformNode(spec.name || 'rigged', scene);
  const mat = riggedMaterial(BABYLON, scene, shaders, spec);

  // scale the whole thing to the height we actually want in this world
  let lo = Infinity, hi = -Infinity;
  for (const m of res.meshes) {
    if (!m.getTotalVertices || !m.getTotalVertices()) continue;
    const bb = m.getBoundingInfo().boundingBox;
    lo = Math.min(lo, bb.minimumWorld.y);
    hi = Math.max(hi, bb.maximumWorld.y);
  }
  const natural = (hi - lo) || 1;
  const scale = (spec.height || 1.75) / natural;

  for (const m of res.meshes) {
    if (m.parent) continue;
    m.parent = root;
  }
  root.scaling.setAll(scale);

  const skinned = [];
  for (const m of res.meshes) {
    if (!m.getTotalVertices || !m.getTotalVertices()) continue;
    m.material = mat;               // throw away what it came with
    m.isPickable = false;
    m.alwaysSelectAsActiveMesh = true;
    skinned.push(m);
  }

  /* Animation. Babylon starts every group on import; stop them all, then run
     the three we care about together at weight 0 and cross-fade by speed. A
     blend is what stops the legs snapping between gaits. */
  const groups = {};
  for (const g of res.animationGroups) {
    g.stop();
    groups[g.name.toLowerCase()] = g;
  }
  const pick = (want) => groups[String(want).toLowerCase()] || null;
  const idle = pick(spec.clips.idle);
  const walk = pick(spec.clips.walk);
  const run = pick(spec.clips.run);

  for (const g of [idle, walk, run]) {
    if (!g) continue;
    g.play(true);
    g.setWeightForAllAnimatables(0);
  }
  if (idle) idle.setWeightForAllAnimatables(1);

  let wIdle = 1, wWalk = 0, wRun = 0;

  /**
   * @param speed   metres/second
   * @param walkAt  the speed the walk clip looks correct at
   * @param runAt   ditto for run
   */
  function setSpeed(dt, speed, walkAt, runAt) {
    const toWalk = Math.min(1, Math.max(0, speed / (walkAt * 0.65)));
    const toRun = Math.min(1, Math.max(0, (speed - walkAt) / Math.max(0.1, runAt - walkAt)));

    const tIdle = (1 - toWalk);
    const tWalk = toWalk * (1 - toRun);
    const tRun = toWalk * toRun;

    const k = Math.min(1, dt * 8);
    wIdle += (tIdle - wIdle) * k;
    wWalk += (tWalk - wWalk) * k;
    wRun += (tRun - wRun) * k;

    if (idle) idle.setWeightForAllAnimatables(wIdle);
    if (walk) walk.setWeightForAllAnimatables(wWalk);
    if (run) run.setWeightForAllAnimatables(wRun);

    /* Match the clip's playback to how fast the body is actually travelling,
       or the feet skate — the single most noticeable animation fault there is. */
    if (walk && wWalk > 0.01) walk.speedRatio = Math.max(0.35, speed / walkAt);
    if (run && wRun > 0.01) run.speedRatio = Math.max(0.5, speed / runAt);
  }

  const skeleton = res.skeletons && res.skeletons[0] ? res.skeletons[0] : null;

  /** A bone by name-fragment, so the cape can hang off the spine. */
  function bone(fragment) {
    if (!skeleton) return null;
    const f = fragment.toLowerCase();
    return skeleton.bones.find((b) => b.name.toLowerCase().includes(f)) || null;
  }

  return {
    root, mat, meshes: skinned, skeleton, setSpeed, bone, scale,
    clips: { idle, walk, run },
    names: Object.keys(groups),
    setEnabled(v) { root.setEnabled(v); },
    dispose() {
      for (const g of res.animationGroups) g.dispose();
      for (const m of res.meshes) m.dispose(false, true);
      root.dispose();
    },
  };
}
