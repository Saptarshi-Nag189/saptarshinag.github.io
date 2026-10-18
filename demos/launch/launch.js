/* ==========================================================================
   launch.js: the detection simulation, the drawings, the nav.

   The detection section is the page's one orchestrated moment. Scrolling through
   it plays a simulation of the C-DAC pipeline: management frames arrive, the
   stream is cut into 1-second windows, a deauth flood gets flagged, and the
   device's 7-pillar trust score falls. The data is made up and the page says so.
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
  var rand = rng(2025);
  /* ---------------- the detection pipeline (simulated) ---------------- */
  // 20 seconds of 802.11 management frames from one device; seconds 11 to 15 carry a deauth flood
  var SECS = 20, ATTACK = [11, 16];
  var frames = [];
  (function build() {
    for (var sec = 0; sec < SECS; sec++) {
      var attack = sec >= ATTACK[0] && sec < ATTACK[1];
      var n = attack ? 44 + Math.floor(rand() * 16) : 7 + Math.floor(rand() * 7);
      for (var i = 0; i < n; i++) frames.push({ t: sec + rand(), h: 0.35 + rand() * 0.65 });
    }
    frames.sort(function (a, b) { return a.t - b.t; });
  })();
  var perSec = [];
  for (var s0 = 0; s0 < SECS; s0++) perSec.push(0);
  frames.forEach(function (f) { perSec[Math.floor(f.t)]++; });
  var maxPerSec = Math.max.apply(null, perSec);

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var RED = '255,69,58', GREEN = '48,209,88', WHITE = '245,245,247';

  // draw the pipeline at scroll progress p (0..1); returns the counter text
  function drawFold(ctx, w, h, p, dpr) {
    ctx.clearRect(0, 0, w, h);
    var wide = w / h > 1.6, pad = 8 * dpr;
    var L = wide
      ? { x0: pad, x1: w * 0.66, tick: [h * 0.10, h * 0.36], win: [h * 0.44, h * 0.58], bar: [h * 0.62, h * 0.88], cx: w * 0.84, cy: h * 0.5, r: Math.min(h * 0.3, w * 0.11) }
      : { x0: pad, x1: w - pad, tick: [h * 0.1, h * 0.25], win: [h * 0.31, h * 0.4], bar: [h * 0.42, h * 0.56], cx: w / 2, cy: h * 0.8, r: Math.min(h * 0.14, w * 0.26) };
    var tw = L.x1 - L.x0, sx = function (t) { return L.x0 + (t / SECS) * tw; };

    // the clock: how much of the stream has arrived
    var T = p < 0.2 ? lerp(0, 8, p / 0.2) : p < 0.42 ? lerp(8, 10.9, (p - 0.2) / 0.22) : lerp(10.9, SECS, clamp((p - 0.42) / 0.2, 0, 1));
    var winAlpha = ease(clamp((p - 0.18) / 0.1, 0, 1));
    var classify = p >= 0.42;
    var trust = lerp(0.92, 0.34, ease(clamp((p - 0.66) / 0.18, 0, 1)));

    // frames: one tick each
    ctx.lineWidth = 1.2 * dpr;
    var nShown = 0;
    for (var i = 0; i < frames.length && frames[i].t < T; i++) {
      var f = frames[i], x = sx(f.t);
      ctx.strokeStyle = 'rgba(' + WHITE + ',0.75)';
      ctx.beginPath(); ctx.moveTo(x, L.tick[1]); ctx.lineTo(x, L.tick[1] - f.h * (L.tick[1] - L.tick[0])); ctx.stroke();
      nShown++;
    }
    // the arrival cursor
    if (T < SECS) {
      ctx.strokeStyle = 'rgba(' + WHITE + ',0.35)';
      ctx.setLineDash([3 * dpr, 4 * dpr]);
      ctx.beginPath(); ctx.moveTo(sx(T), L.tick[0] - 6 * dpr); ctx.lineTo(sx(T), L.bar[1]); ctx.stroke();
      ctx.setLineDash([]);
    }

    // 1-second windows, their feature bar, and the model's verdict
    var done = Math.floor(T), flagged = 0;
    if (winAlpha > 0) {
      var gap = 3 * dpr, bw = tw / SECS - gap;
      for (var sec = 0; sec < done; sec++) {
        var x0 = sx(sec) + gap / 2, isAtk = sec >= ATTACK[0] && sec < ATTACK[1];
        var hit = classify && isAtk;
        if (hit) flagged++;
        ctx.globalAlpha = winAlpha;
        ctx.beginPath();
        ctx.roundRect(x0, L.win[0], bw, L.win[1] - L.win[0], 4 * dpr);
        if (hit) { ctx.fillStyle = 'rgba(' + RED + ',0.9)'; ctx.fill(); }
        else { ctx.strokeStyle = 'rgba(' + WHITE + ',' + (classify ? 0.45 : 0.3) + ')'; ctx.lineWidth = 1.2 * dpr; ctx.stroke(); }
        var bh = (perSec[sec] / maxPerSec) * (L.bar[1] - L.bar[0]);
        ctx.fillStyle = hit ? 'rgba(' + RED + ',0.9)' : 'rgba(' + WHITE + ',0.5)';
        ctx.beginPath(); ctx.roundRect(x0 + bw * 0.25, L.bar[1] - bh, bw * 0.5, Math.max(bh, 2 * dpr), 3 * dpr); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.font = '500 ' + (12 * dpr) + 'px ' + getComputedStyle(document.body).fontFamily;
      ctx.fillStyle = 'rgba(161,161,166,' + winAlpha + ')';
      ctx.textBaseline = 'top';
      ctx.fillText('frames per window', L.x0, L.bar[1] + 6 * dpr);
      if (flagged) {
        ctx.fillStyle = 'rgb(' + RED + ')';
        ctx.textBaseline = 'bottom';
        ctx.fillText('attack', sx(ATTACK[0]) + gap / 2, L.win[0] - 6 * dpr);
      }
    }

    // the device trust score: 7 pillars, lit in proportion to trust
    var segs = 7, gapA = 0.16, lw = Math.max(6 * dpr, L.r * 0.16);
    ctx.lineCap = 'round'; ctx.lineWidth = lw;
    for (var k = 0; k < segs; k++) {
      var a0 = -Math.PI / 2 + k * 2 * Math.PI / segs + gapA / 2, a1 = a0 + 2 * Math.PI / segs - gapA;
      var lit = clamp(trust * segs - k, 0, 1);
      ctx.strokeStyle = '#3a3a3c';
      ctx.beginPath(); ctx.arc(L.cx, L.cy, L.r, a0, a1); ctx.stroke();
      if (lit > 0) {
        ctx.strokeStyle = 'rgb(' + GREEN + ')';
        ctx.beginPath(); ctx.arc(L.cx, L.cy, L.r, a0, a0 + (a1 - a0) * lit); ctx.stroke();
      }
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgb(' + WHITE + ')';
    ctx.font = '600 ' + Math.round(L.r * 0.34) + 'px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillText('trust', L.cx, L.cy - L.r * 0.08);
    ctx.fillStyle = '#a1a1a6';
    ctx.font = '500 ' + Math.max(12 * dpr, Math.round(L.r * 0.15)) + 'px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillText('7 pillars', L.cx, L.cy + L.r * 0.24);
    ctx.textAlign = 'start';

    if (p >= 0.66) return 'trust score updated';
    if (classify) return flagged + ' of ' + done + ' windows flagged';
    if (winAlpha > 0.5) return done + (done === 1 ? ' window' : ' windows');
    return nShown + (nShown === 1 ? ' frame' : ' frames');
  }

  function sizeCanvas(cv) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return dpr;
  }

  var fold = $('detect'), canvas = $('foldCanvas'), steps = [].slice.call(document.querySelectorAll('#foldSteps li'));
  var countEl = $('foldCount');

  if (REDUCED) {
    // two still frames, the flagged windows and the fallen trust score, then the steps as a list
    var box = document.createElement('div');
    box.className = 'fold-static';
    box.setAttribute('aria-hidden', 'true');
    [0, 1].forEach(function () {
      var c = document.createElement('canvas');
      c.style.width = '100%'; c.style.height = 'min(34vh, 320px)'; c.style.display = 'block';
      box.appendChild(c);
    });
    $('foldSteps').parentNode.insertBefore(box, $('foldSteps'));
    var drawStill = function () {
      [].forEach.call(box.children, function (c, i) {
        var dpr = sizeCanvas(c);
        drawFold(c.getContext('2d'), c.width, c.height, i ? 1 : 0.64, dpr);
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
      countEl.textContent = drawFold(ctx, canvas.width, canvas.height, p, dpr);
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
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitSteps(); render(true); });
    render(true);
  }

  /* ---------------- tile drawings ---------------- */
  function el(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
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
  // sixty-three features
  (function features() {
    var sv = $('featArt'); if (!sv) return;
    for (var i = 0; i < 63; i++) el('rect', { x: (i % 21) * 12, y: Math.floor(i / 21) * 26, width: 8, height: 20, rx: 2.5 }, sv);
  })();
  // a question in embedding space: chunks from three documents, and the five nearest to the query
  (function rag() {
    var sv = $('ragArt'); if (!sv) return;
    var r = rng(50), pts = [], q = { x: 214, y: 112 };
    [[96, 80], [236, 98], [150, 188]].forEach(function (c) {
      for (var i = 0; i < 18; i++) pts.push({ x: c[0] + (r() - 0.5) * 120, y: c[1] + (r() - 0.5) * 90 });
    });
    pts.forEach(function (p) { p.x = clamp(p.x, 8, 352); p.y = clamp(p.y, 8, 242); p.d = Math.hypot(p.x - q.x, p.y - q.y); });
    var near = pts.slice().sort(function (a, b) { return a.d - b.d; }).slice(0, 5);
    el('circle', { cx: q.x, cy: q.y, r: near[4].d + 6, 'class': 'reach' }, sv);
    near.forEach(function (p) { el('line', { x1: q.x, y1: q.y, x2: p.x, y2: p.y, 'class': 'link' }, sv); });
    pts.forEach(function (p) { el('circle', { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: 4.5, 'class': near.indexOf(p) >= 0 ? 'pt near' : 'pt' }, sv); });
    el('circle', { cx: q.x, cy: q.y, r: 8, 'class': 'q' }, sv);
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
    // sections the nav doesn't list (the hero, the detection scroll, Llama, earlier work) clear the mark
    [].forEach.call(document.querySelectorAll('main > section[id]'), function (sec) { io.observe(sec); });
  }
})();
