/* ==========================================================================
   traveller.js — the robed figure, built in code.

   No downloaded model, no skeleton, no animation clips. A hooded traveller is
   the one character design that can be done well procedurally, because the
   robe hides exactly the things that are hard: legs, joints, weight transfer.
   What is left is silhouette and cloth, and both of those are cheap.

     · The robe is ONE cone whose vertices are swayed in the vertex shader from
       a walk phase. No CPU work, no bones.
     · The cloak is a verlet ribbon: 11 points, gravity, a wind push and a
       distance constraint back to the shoulders. It trails when you run,
       settles when you stop, and lags through turns — which is most of what
       sells a character as physically present.
     · The figure takes the FULL rim light (rimScale 1.0) while the ground
       takes a fraction, so the silhouette is always drawn in sky colour
       against whatever is behind it.
   ========================================================================== */

const UP = 0;   // the robe's hem sits on the ground plane of the figure's root

/* -------------------------------------------------------------------------- */

function figureMaterial(BABYLON, scene, shaders) {
  BABYLON.Effect.ShadersStore['figureVertexShader'] = /* glsl */`
    precision highp float;
    attribute vec3 position; attribute vec3 normal; attribute vec4 color;
    uniform mat4 world; uniform mat4 worldViewProjection;
    uniform float uWalk;      // gait phase, radians
    uniform float uGait;      // 0 = still, 1 = running
    varying vec3 vWorld; varying vec3 vNormal; varying vec3 vCol;
    void main(){
      vec3 p = position;

      // The hem swings, the shoulders do not. Weighting by height means one
      // cone behaves like cloth hanging off a body, with no extra geometry.
      float hem = clamp(1.0 - p.y / 1.35, 0.0, 1.0);
      float sway = sin(uWalk + p.x * 1.2) * 0.055 + sin(uWalk * 0.5) * 0.03;
      p.x += sway * hem * hem * (0.35 + uGait);
      p.z += cos(uWalk * 0.87) * 0.035 * hem * hem * (0.35 + uGait);

      // a small vertical bob at twice the step rate — the gait's heartbeat
      p.y += sin(uWalk * 2.0) * 0.016 * uGait;

      vec4 wp = world * vec4(p, 1.0);
      vWorld = wp.xyz;
      vNormal = normalize(mat3(world) * normal);
      vCol = color.rgb;
      gl_Position = worldViewProjection * vec4(p, 1.0);
    }`;

  BABYLON.Effect.ShadersStore['figureFragmentShader'] = /* glsl */`
    precision highp float;
    varying vec3 vWorld; varying vec3 vNormal; varying vec3 vCol;
    ${shaders.FRAG_PRELUDE}
    void main(){
      if (uDebug > 0.5) { gl_FragColor = vec4(vCol, 1.0); return; }
      vec3 N = normalize(vNormal);
      vec3 V = normalize(uCamPos - vWorld);
      // full rim: this silhouette must never be lost against the land
      vec3 col = toonLit(vCol, N, V, 0.36, 0.12, 1.0);
      col = applyAerial(col, vWorld);
      gl_FragColor = vec4(col, 1.0);
    }`;

  const mat = new BABYLON.ShaderMaterial('figureMat', scene,
    { vertex: 'figure', fragment: 'figure' },
    shaders.shaderOptions(['color'], ['uWalk', 'uGait']));
  mat.backFaceCulling = false;
  return mat;
}

function paintMesh(BABYLON, mesh, rgb) {
  const p = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  const c = new Float32Array((p.length / 3) * 4);
  for (let k = 0; k < c.length; k += 4) {
    c[k] = rgb[0]; c[k + 1] = rgb[1]; c[k + 2] = rgb[2]; c[k + 3] = 1;
  }
  mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, c, false);
}

/* ==========================================================================
   The cloak — a verlet ribbon
   ========================================================================== */

const GRAVITY = 34.0;   // exaggerated, so the cloth settles in a beat

function createCloak(BABYLON, scene, mat, opts) {
  const N = opts.points || 11;
  const seg = opts.segLen || 0.095;
  const halfW = opts.halfWidth || 0.20;

  // Two parallel chains so the ribbon can twist. They MUST start apart: seeded
  // collinear, every cross product is degenerate, the normals come out NaN and
  // the whole cloak renders as a black slab.
  const chains = [[], []];
  for (let s = 0; s < 2; s++) {
    const side = s ? -1 : 1;
    for (let i = 0; i < N; i++) {
      const v = new BABYLON.Vector3(side * halfW, 1.26 - i * seg * 0.55, -i * seg * 0.8);
      chains[s].push({ p: v.clone(), o: v.clone() });
    }
  }

  const positions = new Float32Array(N * 2 * 3);
  const normals = new Float32Array(N * 2 * 3);
  const colors = new Float32Array(N * 2 * 4);
  const uvs = new Float32Array(N * 2 * 2);
  const indices = [];
  for (let i = 0; i < N - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.push(a, b, c, b, d, c);
  }
  for (let i = 0; i < N; i++) {
    for (let s = 0; s < 2; s++) {
      const k = (i * 2 + s) * 4;
      colors[k] = opts.rgb[0]; colors[k + 1] = opts.rgb[1]; colors[k + 2] = opts.rgb[2]; colors[k + 3] = 1;
      uvs[(i * 2 + s) * 2 + 1] = 1 - i / (N - 1);
    }
  }

  const mesh = new BABYLON.Mesh('cloak', scene);
  const vd = new BABYLON.VertexData();
  vd.positions = positions; vd.normals = normals; vd.colors = colors;
  vd.uvs = uvs; vd.indices = indices;
  vd.applyToMesh(mesh, true);          // updatable: rewritten every frame
  mesh.material = mat;
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;

  // A constant-width ribbon reads as a plank. Real capes are narrow at the
  // collar, widest across the back and drawn to a point at the hem.
  const profile = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    profile[i] = halfW * 2 * (0.42 + 1.05 * Math.sin(Math.PI * Math.min(u * 1.06, 1)) * (1 - u * 0.55));
  }

  const anchor = [new BABYLON.Vector3(), new BABYLON.Vector3()];
  const tmp = new BABYLON.Vector3();
  const e1 = new BABYLON.Vector3(), e2 = new BABYLON.Vector3(), nrm = new BABYLON.Vector3();

  function update(dt, ox, oy, oz, hs, hc, speed, windT) {
    // the figure's right, and its back
    const rx = hc, rz = -hs;
    const bx = -hs, bz = -hc;

    for (let s = 0; s < 2; s++) {
      const side = s ? -1 : 1;
      anchor[s].set(ox + rx * profile[0] * 0.5 * side + bx * 0.13,
                    oy + 1.28,
                    oz + rz * profile[0] * 0.5 * side + bz * 0.13);
    }

    const gust = 0.6 + 0.4 * Math.sin(windT * 0.8);
    // Stream backwards, harder the faster we move — but gravity has to stay
    // the bigger force or the cape flies out dead horizontal like a banner.
    // At a run this balance trails it around 35 degrees off vertical.
    const drag = 5.5 + speed * 4.2;
    const fx = bx * drag + 1.1 * gust;
    const fz = bz * drag + 0.7 * gust;

    for (let s = 0; s < 2; s++) {
      const ch = chains[s];
      ch[0].p.copyFrom(anchor[s]);
      ch[0].o.copyFrom(anchor[s]);

      for (let i = 1; i < N; i++) {
        const pt = ch[i];
        tmp.copyFrom(pt.p);
        // verlet: velocity is implied by the previous position
        pt.p.x += (pt.p.x - pt.o.x) * 0.90 + fx * dt * dt * 9;
        pt.p.y += (pt.p.y - pt.o.y) * 0.90 - GRAVITY * dt * dt * 9;
        pt.p.z += (pt.p.z - pt.o.z) * 0.90 + fz * dt * dt * 9;
        pt.o.copyFrom(tmp);
        // never let the hem sink through the ground the figure stands on
        if (pt.p.y < oy + 0.10) pt.p.y = oy + 0.10;
      }

      // relaxation: pull each link back to its rest length, anchor pinned
      for (let it = 0; it < 5; it++) {
        ch[0].p.copyFrom(anchor[s]);
        for (let i = 1; i < N; i++) {
          const a = ch[i - 1].p, b = ch[i].p;
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
          const d = Math.hypot(dx, dy, dz);
          if (d < 1e-6) { b.x += 1e-3; continue; }
          const k = (d - seg) / d;
          const wa = i === 1 ? 0 : 0.5, wb = i === 1 ? 1 : 0.5;
          a.x += dx * k * wa; a.y += dy * k * wa; a.z += dz * k * wa;
          b.x -= dx * k * wb; b.y -= dy * k * wb; b.z -= dz * k * wb;
        }
      }
    }

    // keep the two chains a cloak's width apart, or the ribbon collapses to a
    // line and the normals go degenerate again
    for (let i = 1; i < N; i++) {
      const A = chains[0][i].p, B = chains[1][i].p;
      const dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z;
      const d = Math.hypot(dx, dy, dz);
      const want = profile[i];
      if (d < 1e-5) { B.x = A.x + rx * want; B.z = A.z + rz * want; continue; }
      const k = (d - want) / d * 0.5;
      A.x += dx * k; A.y += dy * k; A.z += dz * k;
      B.x -= dx * k; B.y -= dy * k; B.z -= dz * k;
    }

    flush();
  }

  /** Push the simulation into the mesh. Separate from update() because reset()
      must do it too: a teleport that only moves the simulation points leaves
      the vertex buffer holding the PREVIOUS position's cape, which shows up as
      a cloak floating unattached beside the traveller. */
  function flush() {
    for (let i = 0; i < N; i++) {
      const A = chains[0][i].p, B = chains[1][i].p;
      const o = i * 6;
      positions[o] = A.x; positions[o + 1] = A.y; positions[o + 2] = A.z;
      positions[o + 3] = B.x; positions[o + 4] = B.y; positions[o + 5] = B.z;
    }
    for (let i = 0; i < N; i++) {
      const iN = i < N - 1 ? i + 1 : i - 1;
      const A = chains[0][i].p, B = chains[1][i].p, C = chains[0][iN].p;
      e1.copyFrom(B).subtractInPlace(A);
      e2.copyFrom(C).subtractInPlace(A);
      BABYLON.Vector3.CrossToRef(e2, e1, nrm);
      let L = nrm.length();
      if (!(L > 1e-6)) { nrm.set(0, 1, 0); L = 1; }     // guard, not decoration
      if (i === N - 1) { nrm.scaleInPlace(-1); }
      const o = i * 6;
      normals[o] = normals[o + 3] = nrm.x / L;
      normals[o + 1] = normals[o + 4] = nrm.y / L;
      normals[o + 2] = normals[o + 5] = nrm.z / L;
    }
    mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions, false, false);
    mesh.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals, false, false);
  }

  /** drop the ribbon into its rest pose behind the figure */
  function reset(x, y, z, heading) {
    const hs = Math.sin(heading || 0), hc = Math.cos(heading || 0);
    const rx = hc, rz = -hs, bx = -hs, bz = -hc;
    for (let s = 0; s < 2; s++) {
      const side = s ? -1 : 1;
      for (let i = 0; i < N; i++) {
        chains[s][i].p.set(
          x + rx * profile[i] * 0.5 * side + bx * (0.13 + i * seg * 0.45),
          y + 1.26 - i * seg * 0.82,
          z + rz * profile[i] * 0.5 * side + bz * (0.13 + i * seg * 0.45));
        chains[s][i].o.copyFrom(chains[s][i].p);
      }
    }
    flush();
  }

  return { mesh, update, reset, flush };
}

/* ==========================================================================
   The figure
   ========================================================================== */

export function createTraveller(BABYLON, scene, shaders, opts) {
  opts = opts || {};
  const CLOTH = opts.cloth || [0.42, 0.20, 0.17];     // warm, dark, Journey-ish
  const TRIM = opts.trim || [0.78, 0.66, 0.45];
  const mat = figureMaterial(BABYLON, scene, shaders);

  const parts = [];

  // the robe: a tapered cone, subdivided vertically so it can sway smoothly
  const robe = BABYLON.MeshBuilder.CreateCylinder('robe', {
    height: 1.30, diameterTop: 0.40, diameterBottom: 0.76,
    tessellation: 14, subdivisions: 8,
  }, scene);
  robe.position.y = 0.65;
  robe.bakeCurrentTransformIntoVertices();
  paintMesh(BABYLON, robe, CLOTH);
  parts.push(robe);

  // shoulders
  const sh = BABYLON.MeshBuilder.CreateIcoSphere('sh', { radius: 0.24, subdivisions: 2 }, scene);
  sh.scaling.set(1.22, 0.72, 1.0);
  sh.position.y = 1.30;
  sh.bakeCurrentTransformIntoVertices();
  paintMesh(BABYLON, sh, CLOTH);
  parts.push(sh);

  // the hood — a sphere pulled back into a point, which is what makes the
  // head read as hooded rather than bare
  const hood = BABYLON.MeshBuilder.CreateIcoSphere('hood', { radius: 0.19, subdivisions: 2 }, scene);
  hood.scaling.set(1.0, 1.12, 1.24);
  hood.position.set(0, 1.55, -0.03);
  hood.bakeCurrentTransformIntoVertices();
  {
    const p = hood.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    for (let i = 0; i < p.length; i += 3) {
      // draw the back of the hood up and behind into a soft peak
      const back = Math.max(0, -p[i + 2] / 0.24);
      p[i + 1] += back * 0.13;
      p[i + 2] -= back * 0.10;
    }
    hood.setVerticesData(BABYLON.VertexBuffer.PositionKind, p, false);
    const n = [];
    BABYLON.VertexData.ComputeNormals(p, hood.getIndices(), n);
    hood.setVerticesData(BABYLON.VertexBuffer.NormalKind, n, false);
  }
  paintMesh(BABYLON, hood, CLOTH);
  parts.push(hood);

  // a pale sash at the waist: one bright band gives the silhouette a waist
  // and a reading of which way the figure faces
  const sash = BABYLON.MeshBuilder.CreateCylinder('sash', {
    height: 0.075, diameterTop: 0.585, diameterBottom: 0.615, tessellation: 14,
  }, scene);
  sash.position.y = 0.86;
  sash.bakeCurrentTransformIntoVertices();
  paintMesh(BABYLON, sash, TRIM);
  parts.push(sash);

  const body = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, false);
  body.name = 'traveller';
  body.material = mat;
  body.isPickable = false;
  body.alwaysSelectAsActiveMesh = true;

  const cloak = createCloak(BABYLON, scene, mat, {
    /* Sized for a humanoid, not the old cone. At the cone's dimensions it hung
       shoulder-to-knee and 0.7m wide, which covered the legs completely — the
       walk was happening underneath a curtain. */
    points: 9, segLen: 0.072, halfWidth: 0.25,
    rgb: [CLOTH[0] * 1.10, CLOTH[1] * 0.92, CLOTH[2] * 0.90],
  });

  const state = { x: 0, y: 0, z: 0, heading: 0, walk: 0, gait: 0 };

  /* The cloth runs on its OWN fixed clock. Integrated with the frame's dt it
     stretches into a streamer on a slow machine and behaves differently on a
     fast one — verlet with a variable step is not stable. Sub-stepping at a
     fixed 1/60 makes the cape the same cape on every device; the cap stops a
     long frame from trying to catch up forever. */
  const CLOTH_H = 1 / 60;
  const CLOTH_MAX_STEPS = 4;
  let clothAcc = 0;

  /**
   * @param dt      seconds
   * @param pos     {x,y,z} feet position
   * @param heading radians, 0 = +Z
   * @param speed   metres/second
   * @param running 0..1
   */
  function update(dt, pos, heading, speed, running, timeSec) {
    state.x = pos.x; state.y = pos.y; state.z = pos.z;
    state.heading = heading;

    // stride rate scales with speed, so the feet never skate
    state.walk += dt * (2.2 + speed * 1.15);
    state.gait += ((speed > 0.15 ? 0.45 + running * 0.55 : 0) - state.gait) * Math.min(1, dt * 6);

    body.position.set(pos.x, pos.y, pos.z);
    body.rotation.y = heading;

    // lean into the run — small, but it is the difference between moving and
    // being moved
    body.rotation.x = -Math.min(speed * 0.028, 0.12);

    mat.setFloat('uWalk', state.walk);
    mat.setFloat('uGait', state.gait);

    clothAcc = Math.min(clothAcc + dt, CLOTH_H * CLOTH_MAX_STEPS);
    const hs = Math.sin(heading), hc = Math.cos(heading);
    while (clothAcc >= CLOTH_H) {
      clothAcc -= CLOTH_H;
      cloak.update(CLOTH_H, pos.x, pos.y, pos.z, hs, hc, speed, timeSec);
    }
  }

  function reset(pos, heading) {
    body.position.set(pos.x, pos.y, pos.z);
    body.rotation.y = heading || 0;
    cloak.reset(pos.x, pos.y, pos.z, heading || 0);
  }

  return { body, cloak: cloak.mesh, mat, update, reset, state };
}
