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
    attribute vec3 aBody;          // upright body coordinates, resolved on load
    #include<bonesDeclaration>
    uniform mat4 world;
    uniform mat4 viewProjection;
    varying vec3 vWorld; varying vec3 vNormal; varying vec3 vBind;
    void main(){
      /* bonesVertex declares influence itself and MULTIPLIES an existing
         finalWorld -- it does not create one. Declaring either here is a
         redefinition error, which is exactly how this failed first time. */
      mat4 finalWorld = world;
      #include<bonesVertex>
      vec4 wp = finalWorld * vec4(position, 1.0);
      vWorld = wp.xyz;
      vNormal = normalize(mat3(finalWorld) * normal);
      /* The garment pattern: where on the BODY this vertex is, measured from
         the soles in the rest pose. Unskinned, so it is identical in every
         frame of every animation — reading the skinned position instead would
         slide the trousers up his legs as he walks. Built on the CPU at load
         rather than taken from the position attribute, because the two meshes
         in this file do not share a frame; see the note where aBody is set. */
      vBind = aBody;
      gl_Position = viewProjection * wp;
    }`;

  BABYLON.Effect.ShadersStore['riggedFragmentShader'] = /* glsl */`
    precision highp float;
    varying vec3 vWorld; varying vec3 vNormal; varying vec3 vBind;
    uniform vec3 uCloth;
    uniform vec3 uTrim;
    uniform vec3 uTrouser;
    uniform vec3 uBoot;
    uniform vec3 uSkin;
    ${shaders.FRAG_PRELUDE}

    /* Clothes, cut from the bind pose.

       The downloaded rig is a nude mannequin, and painting the whole of it one
       robe colour did not dress it — it produced a naked man in a hood and a
       cape, which is exactly what it looked like. There is no texture to paint
       and no garment mesh to add; there is, however, a T-pose, and a T-pose is
       a dressmaker's pattern. Every measurement below is a FRACTION OF HIS
       HEIGHT (soles 0, crown 1), which is how aBody arrives. On this rig
       nothing but an arm ever gets past 0.11 out from the centre line — the
       arms run straight out to 0.50 — so the body divides cleanly by height
       and spread, and each garment is a threshold rather than geometry. */
    vec3 garment() {
      float bx = abs(vBind.x);
      float by = vBind.y;

      // an arm: sleeve from the shoulder, bare hand past the cuff
      if (bx > 0.110) {
        return mix(uCloth * 0.93, uSkin, smoothstep(0.362, 0.387, bx));
      }
      // boots, with a shaft that stops on the calf
      vec3 leg = mix(uBoot, uTrouser, smoothstep(0.166, 0.190, by));
      // trousers give way to the tunic at the hip
      vec3 body = mix(leg, uCloth, smoothstep(0.497, 0.525, by));
      // and the tunic gives way to bare neck under the hood
      return mix(body, uSkin, smoothstep(0.856, 0.884, by));
    }

    void main(){
      vec3 N = normalize(vNormal);
      vec3 V = normalize(uCamPos - vWorld);

      vec3 albedo = garment();
      // cloth darkens toward the ground, the way heavy fabric does
      albedo *= mix(0.86, 1.0, clamp(vBind.y / 0.94, 0.0, 1.0));
      // a pale sash about the waist, which is what gives the silhouette a waist
      albedo = mix(albedo, uTrim,
        smoothstep(0.541, 0.564, vBind.y) * (1.0 - smoothstep(0.586, 0.619, vBind.y))
        * (1.0 - smoothstep(0.110, 0.134, abs(vBind.x))));

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
      attributes: ['position', 'normal', 'aBody'],
      uniforms: shaders.COMMON_UNIFORM_NAMES.concat(
        ['viewProjection', 'uCloth', 'uTrim', 'uTrouser', 'uBoot', 'uSkin']),
      defines: [],
      needAlphaBlending: false,
      needAlphaTesting: false,
    });
  mat.setColor3('uCloth', new BABYLON.Color3(...(opts.cloth || [0.42, 0.20, 0.17])));
  mat.setColor3('uTrim', new BABYLON.Color3(...(opts.trim || [0.78, 0.66, 0.45])));
  mat.setColor3('uTrouser', new BABYLON.Color3(...(opts.trouser || [0.24, 0.21, 0.25])));
  mat.setColor3('uBoot', new BABYLON.Color3(...(opts.boot || [0.15, 0.12, 0.14])));
  mat.setColor3('uSkin', new BABYLON.Color3(...(opts.skin || [0.54, 0.37, 0.28])));
  mat.backFaceCulling = false;
  return mat;
}

/**
 * A hood, built in code and carried on the head bone.
 *
 * Without it the rigged model is an anonymous mannequin — it is nobody. A hood
 * is the cheapest possible way to turn a generic humanoid into a specific
 * character, and together with the cape and the red-ochre cloth it reads as
 * the same cloaked traveller the procedural figure was.
 */
function buildHood(BABYLON, scene, mat, r) {
  const parts = [];

  const shell = BABYLON.MeshBuilder.CreateIcoSphere('hoodShell',
    { radius: r, subdivisions: 2, flat: false }, scene);
  shell.scaling.set(1.06, 1.16, 1.24);
  shell.bakeCurrentTransformIntoVertices();
  // draw the back up and behind into a soft peak — that shape is the whole
  // difference between "wearing a hood" and "wearing a helmet"
  {
    const p = shell.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    for (let i = 0; i < p.length; i += 3) {
      const back = Math.max(0, -p[i + 2] / (r * 1.3));
      p[i + 1] += back * r * 0.72;
      p[i + 2] -= back * r * 0.52;
      // and open the front, so a face-shadow reads instead of a closed ball
      const front = Math.max(0, p[i + 2] / (r * 1.2));
      p[i + 2] -= front * r * 0.30;
      p[i] *= 1 - front * 0.18;
    }
    shell.setVerticesData(BABYLON.VertexBuffer.PositionKind, p, false);
    const n = [];
    BABYLON.VertexData.ComputeNormals(p, shell.getIndices(), n);
    shell.setVerticesData(BABYLON.VertexBuffer.NormalKind, n, false);
  }
  parts.push(shell);

  // a collar, so the hood meets the shoulders instead of floating on the neck
  const collar = BABYLON.MeshBuilder.CreateCylinder('hoodCollar',
    { height: r * 0.5, diameterTop: r * 2.0, diameterBottom: r * 2.5, tessellation: 12 }, scene);
  collar.position.y = -r * 1.15;
  collar.bakeCurrentTransformIntoVertices();
  parts.push(collar);

  const hood = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, false);
  hood.name = 'hood';
  hood.material = mat;

  /* THE TRAP: anything that shares this material must carry aBody, because the
     garment pattern reads it to decide what a fragment is wearing. The hood is
     procedural geometry with no body coordinates of its own, so it arrived as
     aBody = (0,0,0) — below the ankle threshold — and Babylon dutifully cut
     the man's hood out of boot leather. Give it a constant that lands in the
     tunic band: a hood is the same cloth as the robe. */
  {
    const n = hood.getTotalVertices();
    const body = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) body[i * 3 + 1] = 0.70;   // squarely in the tunic
    hood.setVerticesData('aBody', body, false, 3);
  }
  hood.isPickable = false;
  hood.alwaysSelectAsActiveMesh = true;
  return hood;
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

  /* ------------------------------------------------------------------ *
     Body coordinates, for the garment pattern.

     The clothes are cut in the shader from where a vertex sits on the body,
     which means the shader needs a height and a spread it can trust. The raw
     `position` attribute is NOT that: this file arrives as two skinned meshes
     whose nodes carry different transforms — one of them a negative Y scale —
     so on that mesh raw y counts DOWNWARD. Trusting it put a band of boot
     leather across his shoulders, because the shader read the top of him as
     "below 0.30, therefore foot".

     So resolve it once, here, on the CPU: push every vertex through its own
     mesh's rest-pose node matrix, which is the thing that differs, and store
     the result as `aBody` relative to the feet. Both meshes then speak the
     same upright frame, in the model's own units, and the thresholds below
     mean the same thing on each. It costs one extra vec3 attribute, written
     once at load.
   * ------------------------------------------------------------------ */
  {
    const V = new BABYLON.Vector3();
    let floor = Infinity, ceil = -Infinity;
    const bodies = [];
    for (const m of skinned) {
      const P = m.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      if (!P) { bodies.push(null); continue; }
      // the node transform only — bone poses do not live in it
      const wm = m.computeWorldMatrix(true);
      const out = new Float32Array(P.length);
      for (let i = 0; i < P.length; i += 3) {
        V.set(P[i], P[i + 1], P[i + 2]);
        BABYLON.Vector3.TransformCoordinatesToRef(V, wm, V);
        out[i] = V.x; out[i + 1] = V.y; out[i + 2] = V.z;
        if (V.y < floor) floor = V.y;
        if (V.y > ceil) ceil = V.y;
      }
      bodies.push(out);
    }

    /* Normalised to a FRACTION OF HIS HEIGHT: soles at 0, crown at 1. Not
       metres. The node matrices on this file carry a 0.01 unit scale that a
       parent compensates for, so anything measured in their units is off by a
       hundred and dividing by the root scaling does not fix it — the first
       attempt did exactly that and dressed him head to toe in boot leather,
       because every vertex came out below the ankle threshold. A fraction of
       the measured span cannot be wrong about that, whatever the transforms
       do, and it survives changing spec.height too. */
    const H = (ceil - floor) || 1;
    for (let k = 0; k < skinned.length; k++) {
      const out = bodies[k];
      if (!out) continue;
      for (let i = 0; i < out.length; i += 3) {
        out[i] /= H;
        out[i + 1] = (out[i + 1] - floor) / H;
        out[i + 2] /= H;
      }
      skinned[k].setVerticesData('aBody', out, false, 3);
    }
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

  /* The hood rides the head bone's world position rather than being parented to
     it: bone local axes differ between rigs, and following the position while
     taking the body's heading is both predictable and enough. */
  let hood = null;
  if (spec.hood !== false) hood = buildHood(BABYLON, scene, mat, (spec.hoodRadius || 0.135));

  /** A bone by name-fragment, so the cape can hang off the spine. */
  function bone(fragment) {
    if (!skeleton) return null;
    const f = fragment.toLowerCase();
    return skeleton.bones.find((b) => b.name.toLowerCase().includes(f)) || null;
  }

  /* Where a bone actually IS this frame, in world space.
     The cape used to hang from a fixed height above the feet, which was
     shoulder height on the old cone and lands somewhere around the hips on a
     humanoid — so it draped over the backside instead of the shoulders. */
  const _bw = new BABYLON.Vector3();
  const anchorMesh = skinned[0] || null;
  let headBone = null, shoulderBone = null;
  function boneWorld(b) {
    if (!b || !anchorMesh) return null;
    b.getAbsolutePositionToRef(anchorMesh, _bw);
    return _bw;
  }

  /** Put the hood where the head is, this frame. */
  function follow(heading) {
    if (!hood) return;
    if (!headBone) headBone = bone('head');
    const w = boneWorld(headBone);
    if (!w) { hood.setEnabled(false); return; }
    hood.setEnabled(true);
    hood.position.set(w.x, w.y + (spec.hoodLift == null ? 0.045 : spec.hoodLift), w.z);
    hood.rotation.y = heading;
  }

  /* Where the cape should hang from, this frame — the midpoint of the two
     shoulder bones, which on this rig sits 1.41 m above the feet. spine2, the
     first thing tried here, is 1.30 m: mid-back, a full 11 cm lower, and a
     cape hung from the middle of someone's back looks like it slipped off. */
  const _sl = new BABYLON.Vector3(), _mid = new BABYLON.Vector3();
  let shoulderL = null, shoulderR = null, shoulderPair = 0;
  function shoulders() {
    if (!shoulderPair) {
      shoulderL = bone('leftShoulder'); shoulderR = bone('rightShoulder');
      shoulderPair = shoulderL && shoulderR ? 1 : -1;
    }
    if (shoulderPair === 1) {
      shoulderL.getAbsolutePositionToRef(anchorMesh, _sl);
      _mid.copyFrom(_sl);
      shoulderR.getAbsolutePositionToRef(anchorMesh, _sl);
      _mid.addInPlace(_sl).scaleInPlace(0.5);
      return _mid;
    }
    if (!shoulderBone) shoulderBone = bone('spine2') || bone('spine1') || bone('neck') || bone('spine');
    return boneWorld(shoulderBone);
  }

  return {
    root, mat, meshes: skinned, skeleton, setSpeed, bone, boneWorld, scale,
    hood, follow, shoulders,
    clips: { idle, walk, run },
    names: Object.keys(groups),
    setEnabled(v) { root.setEnabled(v); if (hood) hood.setEnabled(v); },
    dispose() {
      if (hood) hood.dispose(false, true);
      for (const g of res.animationGroups) g.dispose();
      for (const m of res.meshes) m.dispose(false, true);
      root.dispose();
    },
  };
}
