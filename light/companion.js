/* ==========================================================================
   companion.js — the fairy, and the chat she opens.

   /wander/ had one and it was the best thing in it: a small light that follows
   you and will answer questions about Saptarshi. It gives a wordless world a
   voice, and it gives a recruiter somewhere to type.

   The chat's important details are all about NOT fighting the game, and every
   one of them is a lesson from the old build:

     · The input stops key events propagating. Without that, typing "was" into
       the box walks the traveller backwards into the sea while you type.
     · The hotkey ignores presses while the input has focus, or you cannot type
       the letter that opens the chat.
     · Escape closes it and returns focus to the canvas.
     · The greeting is added once, not every time it opens.
     · Answers type themselves in, because an instant wall of text reads as a
       canned response while a typed one reads as a reply.
   ========================================================================== */
import { FAIRY, CORPUS_FALLBACK, installBrain } from './twin.js';
import { clamp } from './noise.js';

/* ==========================================================================
   The light that follows you
   ========================================================================== */

function fairyMesh(BABYLON, scene, shaders) {
  BABYLON.Effect.ShadersStore['fairyVertexShader'] = /* glsl */`
    precision highp float;
    attribute vec3 position; attribute vec2 uv;
    uniform mat4 viewProjection;
    uniform vec3 uCentre; uniform vec3 uRight; uniform vec3 uUp; uniform float uSize;
    varying vec2 vUV; varying vec3 vWorld;
    void main(){
      vec3 wp = uCentre + (uRight * position.x + uUp * position.y) * uSize;
      vUV = uv; vWorld = wp;
      gl_Position = viewProjection * vec4(wp, 1.0);
    }`;

  BABYLON.Effect.ShadersStore['fairyFragmentShader'] = /* glsl */`
    precision highp float;
    varying vec2 vUV; varying vec3 vWorld;
    uniform vec3 uGlow; uniform float uPulse;
    ${shaders.FRAG_PRELUDE}
    void main(){
      vec2 d = vUV - 0.5;
      float r = length(d) * 2.0;
      // a hot core inside a soft halo — one expression, no texture
      float core = 1.0 - smoothstep(0.0, 0.30, r);
      float halo = (1.0 - smoothstep(0.0, 1.0, r)) * 0.55;
      float a = clamp(core + halo * uPulse, 0.0, 1.0);
      if (a < 0.01) discard;
      gl_FragColor = vec4(uGlow * (0.6 + core * 0.9), a);
    }`;

  const m = new BABYLON.Mesh('fairy', scene);
  const vd = new BABYLON.VertexData();
  vd.positions = [-0.5,-0.5,0, 0.5,-0.5,0, -0.5,0.5,0, 0.5,0.5,0];
  vd.indices = [0,1,2, 1,3,2];
  vd.uvs = [0,0, 1,0, 0,1, 1,1];
  vd.normals = [0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1];
  vd.applyToMesh(m, false);

  const mat = new BABYLON.ShaderMaterial('fairyMat', scene,
    { vertex: 'fairy', fragment: 'fairy' },
    {
      attributes: ['position', 'uv'],
      uniforms: shaders.COMMON_UNIFORM_NAMES.concat(
        ['viewProjection', 'uCentre', 'uRight', 'uUp', 'uSize', 'uGlow', 'uPulse']),
      defines: [], needAlphaBlending: false, needAlphaTesting: false,
    });
  mat.needAlphaBlending = () => true;
  mat.alphaMode = BABYLON.Constants.ALPHA_ADD;
  mat.disableDepthWrite = true;
  mat.backFaceCulling = false;
  mat.setColor3('uGlow', new BABYLON.Color3(1.0, 0.86, 0.52));
  mat.setFloat('uSize', 0.42);
  m.material = mat;
  m.isPickable = false;
  m.alwaysSelectAsActiveMesh = true;
  m.renderingGroupId = 1;
  return { mesh: m, mat };
}

/* ==========================================================================
   The whole companion
   ========================================================================== */

export function createCompanion(BABYLON, scene, shaders, opts) {
  opts = opts || {};
  const brain = installBrain();
  const { mesh, mat } = fairyMesh(BABYLON, scene, shaders);

  const pos = new BABYLON.Vector3(0, 0, 0);
  const want = new BABYLON.Vector3();
  const right = new BABYLON.Vector3(), up = new BABYLON.Vector3();
  let t = 0, placed = false;

  /* ---- DOM ------------------------------------------------------------- */
  const el = {
    chat: document.getElementById('chat'),
    log: document.getElementById('chatLog'),
    q: document.getElementById('chatQ'),
    go: document.getElementById('chatGo'),
    btn: document.getElementById('chatBtn'),
    close: document.getElementById('chatClose'),
    canvas: document.getElementById('view'),
  };
  let open = false, greeted = false, typing = null;

  function add(who, text) {
    if (!el.log) return null;
    const m = document.createElement('div');
    m.className = 'm ' + who;
    m.textContent = text;
    el.log.appendChild(m);
    el.log.scrollTop = 1e6;
    return m;
  }

  function toggle(force) {
    open = force != null ? force : !open;
    if (el.chat) el.chat.classList.toggle('open', open);
    if (el.btn) el.btn.setAttribute('aria-expanded', String(open));
    if (open) {
      if (el.q) el.q.focus();
      if (!greeted) { greeted = true; add('twin', FAIRY.wake); add('twin', FAIRY.greeting); }
    } else if (el.canvas) {
      // hand the keyboard back to the world, or WASD goes nowhere
      el.canvas.focus();
    }
  }

  async function ask() {
    if (!el.q) return;
    const q = el.q.value.trim();
    if (!q) return;
    el.q.value = '';
    add('you', q);

    let a;
    try { a = await brain.answer(q); } catch (e) { a = CORPUS_FALLBACK; }

    /* Typed reveal: an instant wall of text reads as canned, a typed one reads
       as a reply. Two decisions, both learned the hard way here:

       · How much is shown comes from the CLOCK, not from a fixed number of
         characters per tick. Tick-counted, the reveal is starved to a crawl on
         a device whose main thread is busy rendering — which is exactly the
         device a visitor is most likely to be holding.
       · It is driven by requestAnimationFrame, not setInterval. A 16 ms
         interval on a page rendering at one frame a second may not fire at
         all, and the visitor is left staring at an empty bubble. rAF ticks
         whenever the page advances, so the worst case is the whole answer
         appearing one frame later rather than never. */
    const m = add('twin', '');
    if (!m) return;
    if (typing) cancelAnimationFrame(typing);
    const DUR = Math.min(1400, 240 + a.length * 9);
    const started = performance.now();
    const tick = () => {
      const k = Math.ceil(a.length * Math.min(1, (performance.now() - started) / DUR));
      m.textContent = a.slice(0, k);
      el.log.scrollTop = 1e6;
      typing = k >= a.length ? null : requestAnimationFrame(tick);
    };
    typing = requestAnimationFrame(tick);
  }

  if (el.go) el.go.addEventListener('click', ask);
  if (el.btn) el.btn.addEventListener('click', () => toggle());
  if (el.close) el.close.addEventListener('click', () => toggle(false));

  if (el.q) {
    /* THE important one. Without stopPropagation the game's global key
       handlers see every letter, so typing a question walks the traveller. */
    el.q.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') ask();
      else if (e.key === 'Escape') { toggle(false); el.q.blur(); }
    });
    el.q.addEventListener('keyup', (e) => e.stopPropagation());
  }

  addEventListener('keydown', (e) => {
    const inField = document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (inField) return;                       // or you cannot type the hotkey itself
    if (e.code === 'KeyT') { toggle(); e.preventDefault(); }
    else if (e.code === 'Escape' && open) { toggle(false); }
  });

  /* ---- the light ------------------------------------------------------- */

  function update(dt, camera, subject, heading, sky, timeSec) {
    t += dt;

    // she rides off the traveller's left shoulder, bobbing, and lags into turns
    const side = heading + 1.15;
    want.set(
      subject.x + Math.sin(side) * 0.85,
      subject.y + 1.55 + Math.sin(t * 1.6) * 0.14,
      subject.z + Math.cos(side) * 0.85);

    if (!placed) { pos.copyFrom(want); placed = true; }
    const k = Math.min(1, dt * 3.2);
    pos.x += (want.x - pos.x) * k;
    pos.y += (want.y - pos.y) * k;
    pos.z += (want.z - pos.z) * k;

    const wm = camera.getWorldMatrix().m;
    right.set(wm[0], wm[1], wm[2]);
    up.set(wm[4], wm[5], wm[6]);

    mat.setVector3('uCentre', pos);
    mat.setVector3('uRight', right);
    mat.setVector3('uUp', up);
    // she burns brighter as the light goes
    const night = clamp(1 - Math.sin(sky.elevation || 0) * 2.6, 0, 1);
    mat.setFloat('uPulse', 0.35 + night * 0.5 + Math.sin(t * 2.3) * 0.08);
    mat.setFloat('uSize', 0.30 + night * 0.12);
  }

  return {
    mesh, mat, update, toggle, ask, add,
    /* the billboard is built in the shader, so the mesh's own transform is
       meaningless — this is where she actually is */
    get pos() { return pos; },
    get open() { return open; },
    setEnabled(v) { mesh.setEnabled(v); },
    brainKind: () => (window.TwinBrain ? window.TwinBrain.kind : 'none'),
  };
}
