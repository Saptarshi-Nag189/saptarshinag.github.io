/* ==========================================================================
   APP.JS — Saptarshi Nag Portfolio
   Three.js particle network + UI interactions
   ========================================================================== */

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------------

const IS_MOBILE = window.matchMedia('(max-width: 768px)').matches;
const IS_TABLET = window.matchMedia('(max-width: 1024px)').matches;

const CONFIG = {
  particles: IS_MOBILE ? 350 : IS_TABLET ? 600 : 900,
  connectionDistance: IS_MOBILE ? 7 : 9,
  maxConnections: IS_MOBILE ? 800 : 2500,
  boundarySize: IS_MOBILE ? 28 : 40,
  particleSize: IS_MOBILE ? 1.8 : 2.2,
  driftSpeed: 0.012,
  mouseInfluence: 0.08,
  scrollRotationMax: 0.4,
  cameraZ: IS_MOBILE ? 35 : 30,
  cameraZScroll: IS_MOBILE ? 8 : 15,
};


// ---------------------------------------------------------------------------
// THREE.JS SCENE
// ---------------------------------------------------------------------------

const canvas = document.getElementById('bg');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !IS_MOBILE,
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = CONFIG.cameraZ;


// ---------------------------------------------------------------------------
// PARTICLE SYSTEM
// ---------------------------------------------------------------------------

const particleCount = CONFIG.particles;
const positions = new Float32Array(particleCount * 3);
const velocities = new Float32Array(particleCount * 3);
const sizes = new Float32Array(particleCount);

for (let i = 0; i < particleCount; i++) {
  const i3 = i * 3;
  positions[i3]     = (Math.random() - 0.5) * CONFIG.boundarySize * 2;
  positions[i3 + 1] = (Math.random() - 0.5) * CONFIG.boundarySize * 2;
  positions[i3 + 2] = (Math.random() - 0.5) * CONFIG.boundarySize * 2;

  velocities[i3]     = (Math.random() - 0.5) * CONFIG.driftSpeed;
  velocities[i3 + 1] = (Math.random() - 0.5) * CONFIG.driftSpeed;
  velocities[i3 + 2] = (Math.random() - 0.5) * CONFIG.driftSpeed;

  sizes[i] = Math.random() * 1.5 + 0.5;
}

const particleGeometry = new THREE.BufferGeometry();
particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

// Custom shader for soft glowing particles
const particleMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uColor: { value: new THREE.Color(0x00d4ff) },
    uColorSecondary: { value: new THREE.Color(0x7b61ff) },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uSize: { value: CONFIG.particleSize },
  },
  vertexShader: `
    attribute float size;
    uniform float uPixelRatio;
    uniform float uSize;
    varying float vDepth;

    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * uSize * uPixelRatio * (300.0 / -mvPosition.z);
      gl_PointSize = max(gl_PointSize, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      vDepth = -mvPosition.z;
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    uniform vec3 uColorSecondary;
    varying float vDepth;

    void main() {
      float dist = length(gl_PointCoord - vec2(0.5));
      if (dist > 0.5) discard;

      float strength = 1.0 - (dist * 2.0);
      strength = pow(strength, 1.5);

      // Mix colour based on depth
      float depthMix = smoothstep(10.0, 50.0, vDepth);
      vec3 color = mix(uColor, uColorSecondary, depthMix);

      gl_FragColor = vec4(color, strength * 0.7);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

const particles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particles);


// ---------------------------------------------------------------------------
// CONNECTION LINES
// ---------------------------------------------------------------------------

const maxLines = CONFIG.maxConnections;
const linePositions = new Float32Array(maxLines * 6);
const lineColors = new Float32Array(maxLines * 6);

const lineGeometry = new THREE.BufferGeometry();
lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));
lineGeometry.setDrawRange(0, 0);

const lineMaterial = new THREE.LineBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.25,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
scene.add(lines);

// Pre-compute squared distance threshold
const connDistSq = CONFIG.connectionDistance * CONFIG.connectionDistance;


// ---------------------------------------------------------------------------
// MOUSE & SCROLL TRACKING
// ---------------------------------------------------------------------------

let mouseX = 0;
let mouseY = 0;
let targetRotX = 0;
let targetRotY = 0;
let scrollPercent = 0;

document.addEventListener('mousemove', (e) => {
  mouseX = (e.clientX / window.innerWidth) * 2 - 1;
  mouseY = (e.clientY / window.innerHeight) * 2 - 1;
});

// Passive scroll listener for performance
window.addEventListener('scroll', () => {
  const scrollTop = document.documentElement.scrollTop;
  const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
  scrollPercent = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
}, { passive: true });


// ---------------------------------------------------------------------------
// GLOW TRACKING on project/contact cards
// ---------------------------------------------------------------------------

function initGlowTracking() {
  const cards = document.querySelectorAll('.project-card, .contact-card');
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--glow-x', x + '%');
      card.style.setProperty('--glow-y', y + '%');
    });
  });
}


// ---------------------------------------------------------------------------
// ANIMATION LOOP
// ---------------------------------------------------------------------------

let frameCount = 0;

function animate() {
  requestAnimationFrame(animate);
  frameCount++;

  const pos = particleGeometry.attributes.position.array;
  const bound = CONFIG.boundarySize;

  // Update particle positions
  for (let i = 0; i < particleCount * 3; i++) {
    pos[i] += velocities[i];

    if (pos[i] > bound) {
      pos[i] = bound;
      velocities[i] *= -1;
    } else if (pos[i] < -bound) {
      pos[i] = -bound;
      velocities[i] *= -1;
    }
  }
  particleGeometry.attributes.position.needsUpdate = true;

  // Update connections (skip every other frame on mobile for performance)
  if (!IS_MOBILE || frameCount % 2 === 0) {
    updateConnections(pos);
  }

  // Camera parallax (smooth lerp)
  targetRotY = mouseX * CONFIG.mouseInfluence;
  targetRotX = mouseY * CONFIG.mouseInfluence;

  scene.rotation.y += (targetRotY - scene.rotation.y) * 0.04;
  scene.rotation.x += (targetRotX - scene.rotation.x) * 0.04;

  // Scroll-linked camera
  camera.position.z = CONFIG.cameraZ + scrollPercent * CONFIG.cameraZScroll;
  scene.rotation.z = scrollPercent * CONFIG.scrollRotationMax;

  // Slow continuous rotation for life
  scene.rotation.y += 0.0003;

  renderer.render(scene, camera);
}

function updateConnections(pos) {
  const lp = lineGeometry.attributes.position.array;
  const lc = lineGeometry.attributes.color.array;
  let lineIndex = 0;

  // Cyan: (0, 0.831, 1), Violet: (0.482, 0.380, 1)
  for (let i = 0; i < particleCount && lineIndex < maxLines; i++) {
    const ix = pos[i * 3];
    const iy = pos[i * 3 + 1];
    const iz = pos[i * 3 + 2];

    for (let j = i + 1; j < particleCount && lineIndex < maxLines; j++) {
      const dx = ix - pos[j * 3];
      const dy = iy - pos[j * 3 + 1];
      const dz = iz - pos[j * 3 + 2];
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < connDistSq) {
        const alpha = 1 - Math.sqrt(distSq) / CONFIG.connectionDistance;
        const idx = lineIndex * 6;

        lp[idx]     = ix;
        lp[idx + 1] = iy;
        lp[idx + 2] = iz;
        lp[idx + 3] = pos[j * 3];
        lp[idx + 4] = pos[j * 3 + 1];
        lp[idx + 5] = pos[j * 3 + 2];

        // Cyan end
        lc[idx]     = 0.0 * alpha;
        lc[idx + 1] = 0.83 * alpha;
        lc[idx + 2] = 1.0 * alpha;
        // Violet end
        lc[idx + 3] = 0.48 * alpha;
        lc[idx + 4] = 0.38 * alpha;
        lc[idx + 5] = 1.0 * alpha;

        lineIndex++;
      }
    }
  }

  // Zero out remaining buffer
  for (let k = lineIndex * 6; k < lp.length; k++) {
    lp[k] = 0;
    lc[k] = 0;
  }

  lineGeometry.setDrawRange(0, lineIndex * 2);
  lineGeometry.attributes.position.needsUpdate = true;
  lineGeometry.attributes.color.needsUpdate = true;
}


// ---------------------------------------------------------------------------
// RESIZE HANDLER
// ---------------------------------------------------------------------------

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  particleMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
});


// ---------------------------------------------------------------------------
// NAVIGATION
// ---------------------------------------------------------------------------

function initNav() {
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('nav-toggle');
  const menu = document.getElementById('nav-menu');
  const links = menu.querySelectorAll('.nav__link');
  const allLinks = menu.querySelectorAll('a');

  // Scroll class
  const onScroll = () => {
    nav.classList.toggle('nav--scrolled', window.scrollY > 60);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile toggle
  toggle.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('open');
    toggle.classList.toggle('open');
    toggle.setAttribute('aria-expanded', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  // Close menu on link click
  allLinks.forEach(link => {
    link.addEventListener('click', () => {
      menu.classList.remove('open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });

  // Smooth scroll for anchor links
  allLinks.forEach(link => {
    if (!link.getAttribute('href').startsWith('#')) return;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // Scroll spy
  const sections = document.querySelectorAll('section[id]');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        links.forEach(link => {
          const href = link.getAttribute('href').slice(1);
          link.classList.toggle('active', href === id);
        });
      }
    });
  }, {
    rootMargin: '-40% 0px -55% 0px',
    threshold: 0,
  });

  sections.forEach(section => observer.observe(section));
}


// ---------------------------------------------------------------------------
// REVEAL ANIMATION (Intersection Observer)
// ---------------------------------------------------------------------------

function initReveal() {
  const reveals = document.querySelectorAll('.reveal');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -60px 0px',
  });

  reveals.forEach(el => observer.observe(el));
}


// ---------------------------------------------------------------------------
// FOOTER YEAR
// ---------------------------------------------------------------------------

function initFooter() {
  const yearEl = document.getElementById('footer-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}


// ---------------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------------

function init() {
  initNav();
  initReveal();
  initFooter();
  initGlowTracking();
  animate();
}

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
