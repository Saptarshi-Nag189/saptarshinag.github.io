/* ==========================================================================
   APP.JS — Saptarshi Nag Portfolio
   Terminal / brutalist rebuild. No frameworks, no WebGL.
   Lightweight Canvas 2D background + UI interactions.
   ========================================================================== */

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const IS_SMALL = window.matchMedia('(max-width: 768px)').matches;


// ---------------------------------------------------------------------------
// THEMED BACKGROUND — Canvas 2D oscilloscope / signal field
// A faint moving waveform over a sparse character drift. Cheap to render,
// pauses when the tab is hidden, and renders a single static frame when the
// user prefers reduced motion.
// ---------------------------------------------------------------------------

function initBackground() {
  const canvas = document.getElementById('bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const ACCENT = 'rgba(124, 255, 155, ';   // matches --accent
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  let w = 0;
  let h = 0;
  let t = 0;

  // Sparse drifting glyphs (terminal "noise")
  const GLYPHS = '01<>/_[]{}#$*+=.';
  const glyphCount = IS_SMALL ? 26 : 60;
  const glyphs = [];

  function seedGlyphs() {
    glyphs.length = 0;
    for (let i = 0; i < glyphCount; i++) {
      glyphs.push({
        x: Math.random() * w,
        y: Math.random() * h,
        char: GLYPHS[(Math.random() * GLYPHS.length) | 0],
        speed: 0.15 + Math.random() * 0.45,
        alpha: 0.04 + Math.random() * 0.10,
        size: 11 + ((Math.random() * 5) | 0),
      });
    }
  }

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * DPR;
    canvas.height = h * DPR;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    seedGlyphs();
  }

  function drawWaveforms() {
    // Two layered sine waves crossing the lower third of the viewport.
    const baseY = h * 0.72;
    const waves = [
      { amp: 26, freq: 0.012, phase: t * 0.9, a: 0.16, off: 0 },
      { amp: 16, freq: 0.020, phase: -t * 1.4, a: 0.09, off: 40 },
    ];
    for (const wv of waves) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 6) {
        const y = baseY + wv.off
          + Math.sin(x * wv.freq + wv.phase) * wv.amp
          + Math.sin(x * wv.freq * 2.3 + wv.phase * 1.7) * (wv.amp * 0.3);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = ACCENT + wv.a + ')';
      ctx.lineWidth = 1.25;
      ctx.stroke();
    }
  }

  function drawGlyphs() {
    ctx.font = '13px "JetBrains Mono", monospace';
    for (const g of glyphs) {
      ctx.fillStyle = ACCENT + g.alpha + ')';
      ctx.font = g.size + 'px "JetBrains Mono", monospace';
      ctx.fillText(g.char, g.x, g.y);
      g.y += g.speed;
      if (g.y > h + 20) {
        g.y = -20;
        g.x = Math.random() * w;
        g.char = GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
    }
  }

  function render() {
    ctx.clearRect(0, 0, w, h);
    drawWaveforms();
    drawGlyphs();
  }

  let rafId = null;
  function loop() {
    t += 1;
    render();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (rafId == null) loop();
  }
  function stop() {
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
  }

  resize();
  window.addEventListener('resize', resize);

  if (REDUCED_MOTION) {
    render();                                  // single static frame
  } else {
    start();
    document.addEventListener('visibilitychange', () => {
      document.hidden ? stop() : start();      // pause off-screen
    });
  }
}


// ---------------------------------------------------------------------------
// HERO TYPING EFFECT
// ---------------------------------------------------------------------------

function initTyping() {
  const el = document.getElementById('typed');
  if (!el) return;
  const text = el.dataset.text || el.textContent || '';

  if (REDUCED_MOTION) {
    el.textContent = text;
    return;
  }

  el.textContent = '';
  let i = 0;
  const step = () => {
    if (i <= text.length) {
      el.textContent = text.slice(0, i);
      i++;
      setTimeout(step, 70);
    }
  };
  setTimeout(step, 450);
}


// ---------------------------------------------------------------------------
// NAVIGATION — scroll state, mobile toggle, smooth scroll, scroll-spy
// ---------------------------------------------------------------------------

function initNav() {
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('nav-toggle');
  const menu = document.getElementById('nav-menu');
  if (!nav || !toggle || !menu) return;

  const links = menu.querySelectorAll('.nav__link');
  const allLinks = menu.querySelectorAll('a');

  const onScroll = () => {
    nav.classList.toggle('nav--scrolled', window.scrollY > 40);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const closeMenu = () => {
    menu.classList.remove('open');
    toggle.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  toggle.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('open');
    toggle.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  allLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          const top = target.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top, behavior: REDUCED_MOTION ? 'auto' : 'smooth' });
        }
      }
      closeMenu();
    });
  });

  // Scroll-spy
  const sections = document.querySelectorAll('section[id]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        links.forEach((link) => {
          link.classList.toggle('active', link.getAttribute('href') === '#' + id);
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

  sections.forEach((section) => observer.observe(section));
}


// ---------------------------------------------------------------------------
// REVEAL ON SCROLL
// ---------------------------------------------------------------------------

function initReveal() {
  const reveals = document.querySelectorAll('.reveal');

  if (REDUCED_MOTION) {
    reveals.forEach((el) => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

  reveals.forEach((el) => observer.observe(el));
}


// ---------------------------------------------------------------------------
// FOOTER YEAR
// ---------------------------------------------------------------------------

function initFooter() {
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}


// ---------------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------------

function init() {
  initBackground();
  initTyping();
  initNav();
  initReveal();
  initFooter();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
