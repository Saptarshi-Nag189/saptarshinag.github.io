/* ==========================================================================
   sfx.js — shared synthesized sound engine for the experience demos
   Zero assets. Web Audio API only. Themeable per experience.
   Usage:
     <script src="../_shared/sfx.js"></script>
     SFX.init({ accent:'#7cff9b', ambient:true, ambientFreq:110 });
     SFX.play('click');           // hover/click/select/back/beep/type/success/error/lock/rev/whoosh
     SFX.startProjector();        // old film-reel clatter (cinema intro)
     SFX.stopProjector();
   Sound only begins after the first user gesture (autoplay policy).
   A floating mute button is added automatically; state persists in localStorage.
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'exp-sfx-muted';
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, master = null;
  var muted = (localStorage.getItem(KEY) === '1');
  var unlocked = false;
  var ambient = null, projector = null;
  var accent = '#9aa0ff';

  function ensure() {
    if (ctx || !AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
  }
  function unlock() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    unlocked = true;
  }

  // ---- primitive: enveloped oscillator tone ----
  function tone(o) {
    if (!ctx || muted) return;
    o = o || {};
    var t0 = ctx.currentTime + (o.delay || 0);
    var dur = o.dur || 0.12;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq || 440, t0);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.gain || 0.2, t0 + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }

  // ---- primitive: filtered noise burst ----
  function noise(o) {
    if (!ctx || muted) return;
    o = o || {};
    var t0 = ctx.currentTime + (o.delay || 0);
    var dur = o.dur || 0.2;
    var n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource(); src.buffer = buf;
    var filt = ctx.createBiquadFilter();
    filt.type = o.filter || 'highpass'; filt.frequency.value = o.freq || 1000;
    if (o.q) filt.Q.value = o.q;
    var g = ctx.createGain();
    g.gain.setValueAtTime(o.gain || 0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur);
  }

  // ---- named sounds ----
  var lib = {
    hover:   function () { tone({ freq: 680, type: 'sine', dur: 0.045, gain: 0.05 }); },
    click:   function () { tone({ freq: 520, type: 'square', dur: 0.05, gain: 0.08 }); tone({ freq: 820, type: 'square', dur: 0.04, gain: 0.04, delay: 0.018 }); },
    select:  function () { tone({ freq: 440, type: 'triangle', dur: 0.11, gain: 0.11, slideTo: 880 }); },
    back:    function () { tone({ freq: 660, type: 'triangle', dur: 0.11, gain: 0.1, slideTo: 300 }); },
    beep:    function () { tone({ freq: 880, type: 'square', dur: 0.08, gain: 0.07 }); },
    type:    function () { tone({ freq: 280 + Math.random() * 220, type: 'square', dur: 0.018, gain: 0.035 }); },
    whoosh:  function () { noise({ dur: 0.35, gain: 0.12, filter: 'bandpass', freq: 1100, q: 0.8 }); },
    success: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone({ freq: f, type: 'triangle', dur: 0.2, gain: 0.11, delay: i * 0.07 }); }); },
    error:   function () { tone({ freq: 220, type: 'sawtooth', dur: 0.28, gain: 0.12, slideTo: 110 }); },
    lock:    function () { tone({ freq: 300, type: 'sine', dur: 0.32, gain: 0.13, slideTo: 920 }); noise({ dur: 0.12, gain: 0.06, filter: 'highpass', freq: 3000, delay: 0.28 }); },
    rev:     function () { tone({ freq: 70, type: 'sawtooth', dur: 0.45, gain: 0.13, slideTo: 420 }); },
    coin:    function () { tone({ freq: 988, type: 'square', dur: 0.06, gain: 0.09 }); tone({ freq: 1319, type: 'square', dur: 0.12, gain: 0.09, delay: 0.06 }); },
    step:    function () { noise({ dur: 0.06, gain: 0.05, filter: 'lowpass', freq: 600 }); }
  };

  function play(name, o) {
    ensure();
    if (!unlocked) return;
    var f = lib[name];
    if (f) f(o);
  }

  // ---- ambient drone (themeable) ----
  function startAmbient(base) {
    ensure();
    if (!ctx || ambient || muted) return;
    base = base || 110;
    var g = ctx.createGain(); g.gain.value = 0; g.connect(master);
    g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 2.5);
    var voices = [base, base * 1.5, base * 2.01].map(function (f) {
      var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      var lfo = ctx.createOscillator(); lfo.frequency.value = 0.07 + Math.random() * 0.15;
      var lg = ctx.createGain(); lg.gain.value = 2.5;
      lfo.connect(lg); lg.connect(o.frequency);
      o.connect(g); o.start(); lfo.start();
      return [o, lfo];
    });
    ambient = { g: g, voices: voices };
  }
  function stopAmbient() {
    if (!ambient || !ctx) return;
    var a = ambient; ambient = null;
    a.g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
    setTimeout(function () { a.voices.forEach(function (v) { v.forEach(function (n) { try { n.stop(); } catch (e) {} }); }); }, 1400);
  }

  // ---- old film-reel projector clatter (motor hum + rhythmic flutter) ----
  function startProjector() {
    ensure();
    if (!ctx || projector || muted) return;
    var out = ctx.createGain(); out.gain.value = 0; out.connect(master);
    out.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.4);

    // motor hum: two detuned saws through a lowpass + slow wobble
    var hum = ctx.createGain(); hum.gain.value = 0.05; hum.connect(out);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.connect(hum);
    var s1 = ctx.createOscillator(); s1.type = 'sawtooth'; s1.frequency.value = 58;
    var s2 = ctx.createOscillator(); s2.type = 'sawtooth'; s2.frequency.value = 87;
    var wob = ctx.createOscillator(); wob.frequency.value = 5.2;
    var wobG = ctx.createGain(); wobG.gain.value = 6; wob.connect(wobG); wobG.connect(lp.frequency);
    s1.connect(lp); s2.connect(lp); s1.start(); s2.start(); wob.start();

    // clatter: short filtered-noise clicks scheduled ~ every 0.05s (≈ sprocket flutter)
    var clickBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate);
    var cd = clickBuf.getChannelData(0);
    for (var i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / cd.length, 2);
    var clatter = ctx.createGain(); clatter.gain.value = 0.08; clatter.connect(out);
    var cbp = ctx.createBiquadFilter(); cbp.type = 'bandpass'; cbp.frequency.value = 2400; cbp.Q.value = 1.2; cbp.connect(clatter);

    var nextTime = ctx.currentTime;
    var interval = 0.05;
    function schedule() {
      if (!projector) return;
      var ahead = ctx.currentTime + 0.2;
      while (nextTime < ahead) {
        var src = ctx.createBufferSource(); src.buffer = clickBuf;
        var g = ctx.createGain();
        g.gain.value = 0.6 + Math.random() * 0.5;
        src.playbackRate.value = 0.85 + Math.random() * 0.3;
        src.connect(g); g.connect(cbp);
        src.start(nextTime);
        nextTime += interval * (0.9 + Math.random() * 0.2);
      }
      projector.timer = setTimeout(schedule, 80);
    }
    projector = { out: out, nodes: [s1, s2, wob], timer: null };
    schedule();
  }
  function stopProjector() {
    if (!projector || !ctx) return;
    var p = projector; projector = null;
    clearTimeout(p.timer);
    p.out.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    setTimeout(function () { p.nodes.forEach(function (n) { try { n.stop(); } catch (e) {} }); }, 700);
  }

  // ---- mute control ----
  var btn = null;
  function paint() {
    if (!btn) return;
    btn.innerHTML = muted
      ? '<i class="fa-solid fa-volume-xmark"></i>'
      : '<i class="fa-solid fa-volume-high"></i>';
    btn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute sound');
    btn.style.color = muted ? 'rgba(255,255,255,0.5)' : accent;
  }
  function setMuted(m) {
    muted = m;
    try { localStorage.setItem(KEY, m ? '1' : '0'); } catch (e) {}
    if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.04);
    if (m) { stopAmbient(); stopProjector(); }
    paint();
  }
  function toggleMute() { setMuted(!muted); if (!muted) play('click'); }

  function addButton() {
    btn = document.createElement('button');
    btn.id = 'sfx-mute';
    btn.type = 'button';
    var s = btn.style;
    s.position = 'fixed'; s.bottom = '16px'; s.left = '16px'; s.zIndex = '99999';
    s.width = '38px'; s.height = '38px'; s.borderRadius = '9px';
    s.border = '1px solid rgba(255,255,255,0.22)'; s.background = 'rgba(8,8,12,0.6)';
    s.cursor = 'pointer'; s.backdropFilter = 'blur(6px)'; s.webkitBackdropFilter = 'blur(6px)';
    s.fontSize = '14px'; s.lineHeight = '1'; s.transition = 'transform .15s, border-color .15s';
    btn.addEventListener('click', function (e) { e.stopPropagation(); toggleMute(); });
    btn.addEventListener('mouseenter', function () { btn.style.transform = 'scale(1.08)'; btn.style.borderColor = accent; play('hover'); });
    btn.addEventListener('mouseleave', function () { btn.style.transform = 'none'; btn.style.borderColor = 'rgba(255,255,255,0.22)'; });
    var attach = function () { if (document.body && !document.getElementById('sfx-mute')) document.body.appendChild(btn); paint(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
    else attach();
  }

  function init(opts) {
    opts = opts || {};
    if (opts.accent) accent = opts.accent;
    addButton();
    var fired = false;
    var onGesture = function () {
      if (fired) return; fired = true;
      unlock();
      if (opts.ambient && !muted) startAmbient(opts.ambientFreq || 110);
    };
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    window.addEventListener('touchstart', onGesture, { passive: true });
  }

  window.SFX = {
    init: init, play: play,
    startAmbient: startAmbient, stopAmbient: stopAmbient,
    startProjector: startProjector, stopProjector: stopProjector,
    toggleMute: toggleMute, setMuted: setMuted,
    get muted() { return muted; },
    get unlocked() { return unlocked; }
  };
})();
