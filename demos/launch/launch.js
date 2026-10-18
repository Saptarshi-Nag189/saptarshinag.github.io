/* ==========================================================================
   launch.js: the fold, the tile drawings, the projects gallery, the nav.

   The fold is the page's one orchestrated moment. Scrolling through it runs
   real epoch folding on synthetic data: single noisy turns of a pulsar stack
   into a ridgeline (the way CP 1919's turns were famously drawn), then average
   into one clean profile. Every frame is computed, not faked: the line you see
   at the end is the mean of the first k turns, and k is the counter.
   With reduced motion the section doesn't scrub; it shows two still frames.
   ========================================================================== */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var $ = function (id) { return document.getElementById(id); };

  // seeded random numbers, so the noise is the same on every visit
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rand = rng(1919);
  function gauss() {
    var u = 1 - rand(), v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  // pulse shape over one rotation (phase 0..1): a main peak and a small shoulder
  function profile(x) {
    return Math.exp(-Math.pow(x - 0.36, 2) / (2 * 0.017 * 0.017)) +
           0.32 * Math.exp(-Math.pow(x - 0.405, 2) / (2 * 0.012 * 0.012));
  }

  /* ---------------- the fold ---------------- */
  var K = 512;   // turns recorded
  var B = 200;   // phase bins per turn
  var R = 26;    // turns drawn in the ridgeline
  var AMP = 0.9; // pulse height against smoothed noise of about 0.44: lost in one turn, visible once turns line up

  var KERNEL = [1, 4, 7, 9, 7, 4, 1];
  var rows = [];
  var cum = new Float32Array((K + 1) * B); // running sums, so the mean of the first k turns is O(B)
  (function build() {
    for (var r = 0; r < K; r++) {
      var raw = new Float32Array(B), row = new Float32Array(B);
      for (var b = 0; b < B; b++) raw[b] = AMP * profile(b / B) + gauss();
      for (b = 0; b < B; b++) { // 7-tap smoothing (noise sd about 0.44), so each turn reads as a line
        var acc = 0;
        for (var k = -3; k <= 3; k++) acc += KERNEL[k + 3] * raw[(b + k + B) % B];
        row[b] = acc / 33;
        cum[(r + 1) * B + b] = cum[r * B + b] + row[b];
      }
      rows.push(row);
    }
  })();
  function meanOf(k, out) {
    for (var b = 0; b < B; b++) out[b] = (cum[k * B + b]) / k;
    return out;
  }
  var tmp = new Float32Array(B), meanK = new Float32Array(B), finalMean = meanOf(K, new Float32Array(B));

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  // draw the state of the fold at scroll progress p (0..1); returns the number of turns shown
  function drawFold(ctx, w, h, p, dpr) {
    ctx.clearRect(0, 0, w, h);
    var padX = 8 * dpr, iw = w - padX * 2;
    var top = h * 0.14, bottom = h * 0.96, gap = (bottom - top) / (R - 1);
    var yCenter = h * 0.62, yFinal = h * 0.8;
    var bigAmp = h * 0.14, rowAmp = gap * 1.3, finalAmp = h * 0.62;

    var layoutT = ease(clamp((p - 0.14) / 0.1, 0, 1));
    var shown = p < 0.14 ? 1 : Math.max(1, Math.round(lerp(1, R, clamp((p - 0.14) / 0.38, 0, 1))));
    var collapse = ease(clamp((p - 0.54) / 0.3, 0, 1));
    var turns = shown;
    if (collapse > 0) {
      turns = Math.round(R * Math.pow(K / R, collapse));
      meanOf(turns, meanK);
    }

    function trace(vals, y, amp) {
      for (var b = 0; b < B; b++) {
        var x = padX + (b / (B - 1)) * iw, yy = y - vals[b] * amp;
        if (b === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
    }
    function line(vals, y, amp, alpha, fill, width) {
      if (fill) { // occlude the turns behind, as in the CP 1919 plot
        ctx.beginPath(); trace(vals, y, amp);
        ctx.lineTo(padX + iw, y + gap * 4); ctx.lineTo(padX, y + gap * 4); ctx.closePath();
        ctx.fillStyle = '#000'; ctx.fill();
      }
      ctx.beginPath(); trace(vals, y, amp);
      ctx.lineWidth = width * dpr;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(245,245,247,' + alpha + ')';
      ctx.stroke();
    }

    if (collapse < 1) {
      for (var r = 0; r < shown; r++) {
        var slotY = top + r * gap;
        var y = r === 0 ? lerp(yCenter, slotY, layoutT) : slotY;
        var amp = r === 0 ? lerp(bigAmp, rowAmp, layoutT) : rowAmp;
        var vals = rows[r];
        if (collapse > 0) {
          for (var b = 0; b < B; b++) tmp[b] = lerp(vals[b], meanK[b], collapse);
          vals = tmp;
          y = lerp(y, yFinal, collapse);
          amp = lerp(amp, finalAmp, collapse);
        }
        var fadeIn = r === 0 ? 1 : clamp((shown - r), 0, 1);
        line(vals, y, amp, 0.9 * fadeIn * Math.pow(1 - collapse, 1.6), collapse === 0, 1.4);
      }
    }
    if (collapse > 0) {
      var src = collapse >= 1 ? finalMean : meanK;
      ctx.save();
      ctx.shadowColor = 'rgba(255,255,255,0.35)';
      ctx.shadowBlur = 18 * dpr * collapse;
      line(src, yFinal, finalAmp, collapse, false, 2.4);
      ctx.restore();
    }
    return collapse >= 1 ? K : turns;
  }

  function sizeCanvas(cv) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return dpr;
  }

  var fold = $('fold'), canvas = $('foldCanvas'), steps = [].slice.call(document.querySelectorAll('#foldSteps li'));
  var turnsEl = $('foldTurns'), unitEl = $('foldUnit');

  if (REDUCED) {
    // two still frames, the stacked turns and the folded profile, then the steps as a list
    var box = document.createElement('div');
    box.className = 'fold-static';
    box.setAttribute('aria-hidden', 'true');
    [0.5, 1].forEach(function (p) {
      var c = document.createElement('canvas');
      c.style.width = '100%'; c.style.height = 'min(34vh, 320px)'; c.style.display = 'block';
      box.appendChild(c);
    });
    $('foldSteps').parentNode.insertBefore(box, $('foldSteps'));
    var drawStill = function () {
      [].forEach.call(box.children, function (c, i) {
        var dpr = sizeCanvas(c);
        drawFold(c.getContext('2d'), c.width, c.height, i ? 1 : 0.5, dpr);
      });
    };
    drawStill();
    window.addEventListener('resize', drawStill);
  } else {
    var ctx = canvas.getContext('2d'), lastP = -1, queued = false;
    var render = function (force) {
      queued = false;
      var rect = fold.getBoundingClientRect();
      var span = rect.height - window.innerHeight;
      var p = clamp(-rect.top / (span > 0 ? span : 1), 0, 1);
      if (!force && Math.abs(p - lastP) < 0.0005) return;
      lastP = p;
      var dpr = sizeCanvas(canvas);
      var t = drawFold(ctx, canvas.width, canvas.height, p, dpr);
      turnsEl.textContent = t;
      unitEl.textContent = t === 1 ? 'turn' : 'turns';
      var on = 0;
      steps.forEach(function (li, i) { if (p >= +li.dataset.at) on = i; });
      steps.forEach(function (li, i) { li.classList.toggle('on', i === on); });
    };
    var queue = function () { if (!queued) { queued = true; requestAnimationFrame(function () { render(false); }); } };
    // the captions stack in one box; it takes the height of the longest, so none spills on a phone
    var fitSteps = function () {
      var hmax = 0;
      steps.forEach(function (li) { hmax = Math.max(hmax, li.offsetHeight); });
      $('foldSteps').style.height = hmax + 'px';
    };
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', function () { fitSteps(); render(true); });
    fitSteps();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitSteps);
    render(true);
  }

  /* ---------------- tile drawings ---------------- */
  function el(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  // seven arcs for the seven pillars of the device trust score
  (function ring() {
    var g = $('ringSegs'); if (!g) return;
    var cx = 100, cy = 100, rad = 80, n = 7, gapDeg = 11;
    for (var i = 0; i < n; i++) {
      var a0 = (-90 + i * 360 / n + gapDeg / 2) * Math.PI / 180;
      var a1 = (-90 + (i + 1) * 360 / n - gapDeg / 2) * Math.PI / 180;
      var x0 = cx + rad * Math.cos(a0), y0 = cy + rad * Math.sin(a0);
      var x1 = cx + rad * Math.cos(a1), y1 = cy + rad * Math.sin(a1);
      el('path', { d: 'M' + x0.toFixed(2) + ' ' + y0.toFixed(2) + ' A' + rad + ' ' + rad + ' 0 0 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2) }, g);
    }
  })();
  // the folded pulse profile, the same shape the fold ends on
  (function pulse() {
    var p = $('tilePulse'); if (!p) return;
    var d = '';
    for (var i = 0; i <= 150; i++) {
      var x = i / 150, y = 80 - profile(x) * 66;
      d += (i ? 'L' : 'M') + (x * 296 + 2).toFixed(1) + ' ' + y.toFixed(1);
    }
    p.setAttribute('d', d);
  })();
  // 1-second windows; the burst in the middle is what the window model flags
  (function windows() {
    var s = $('winArt'); if (!s) return;
    for (var i = 0; i < 28; i++) el('rect', { x: i * 10, y: 4, width: 7, height: 32, rx: 2, 'class': (i >= 12 && i <= 17) ? 'hit' : '' }, s);
  })();
  // sixteen fixes
  (function dots() {
    var s = $('aroDots'); if (!s) return;
    for (var i = 0; i < 16; i++) el('circle', { cx: 10 + (i % 8) * 20, cy: 10 + Math.floor(i / 8) * 20, r: 6 }, s);
  })();
  // a query among document chunks, and its five nearest neighbours
  (function omni() {
    var s = $('omniArt'); if (!s) return;
    var r = rng(50), pts = [], q = { x: 168, y: 70 };
    for (var i = 0; i < 46; i++) pts.push({ x: 14 + r() * 292, y: 10 + r() * 120 });
    pts.forEach(function (p) { p.d = Math.hypot(p.x - q.x, p.y - q.y); });
    var near = pts.slice().sort(function (a, b) { return a.d - b.d; }).slice(0, 5);
    near.forEach(function (p) { el('line', { x1: q.x, y1: q.y, x2: p.x, y2: p.y, stroke: 'currentColor', 'stroke-width': 1.5, opacity: 0.7 }, s); });
    pts.forEach(function (p) { el('circle', { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: 4.5, 'class': near.indexOf(p) >= 0 ? 'pt near' : 'pt' }, s); });
    el('circle', { cx: q.x, cy: q.y, r: 8, 'class': 'q' }, s);
  })();

  /* ---------------- projects gallery ---------------- */
  (function gallery() {
    var g = $('gallery'), prev = $('galPrev'), next = $('galNext'); if (!g) return;
    var step = function () { var c = g.querySelector('.card'); return c ? c.getBoundingClientRect().width + 20 : 400; };
    var update = function () {
      prev.disabled = g.scrollLeft <= 4;
      next.disabled = g.scrollLeft + g.clientWidth >= g.scrollWidth - 4;
    };
    prev.addEventListener('click', function () { g.scrollBy({ left: -step(), behavior: REDUCED ? 'auto' : 'smooth' }); });
    next.addEventListener('click', function () { g.scrollBy({ left: step(), behavior: REDUCED ? 'auto' : 'smooth' }); });
    g.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  })();

  /* ---------------- navigation ---------------- */
  var nav = $('lnav'), links = $('lnavLinks'), menu = $('lnavMenu');
  // small bars adapt between light and dark to the content beneath them (liquid-glass.md › Color on glass)
  var darkBands = [].slice.call(document.querySelectorAll('.fold, .band-dark'));
  var onScroll = function () {
    nav.classList.toggle('is-scrolled', window.scrollY > 4);
    var y = nav.offsetHeight / 2, over = false;
    darkBands.forEach(function (d) { var r = d.getBoundingClientRect(); if (r.top <= y && r.bottom >= y) over = true; });
    nav.classList.toggle('on-dark', over);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function setMenu(open) {
    links.classList.toggle('open', open);
    menu.setAttribute('aria-expanded', String(open));
  }
  menu.addEventListener('click', function () { setMenu(menu.getAttribute('aria-expanded') !== 'true'); });
  links.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { setMenu(false); menu.focus(); }
  });

  // the nav marks the section you're reading
  if ('IntersectionObserver' in window) {
    var byId = {};
    [].forEach.call(links.querySelectorAll('a'), function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        for (var id in byId) byId[id].removeAttribute('aria-current');
        if (byId[en.target.id]) byId[en.target.id].setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(byId).forEach(function (id) { var s = $(id); if (s) io.observe(s); });
  }
})();
