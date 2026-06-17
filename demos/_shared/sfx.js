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
  var ambient = null, projector = null, engine = null, chiptune = null;
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
    step:    function () { noise({ dur: 0.06, gain: 0.05, filter: 'lowpass', freq: 600 }); },

    // ---- retro / chiptune one-shots (2D world) ----
    jump:    function () { tone({ freq: 300, type: 'square', dur: 0.18, gain: 0.10, slideTo: 760 }); },
    blip:    function () { tone({ freq: 660, type: 'square', dur: 0.045, gain: 0.07 }); },
    power:   function () { [392, 523, 659, 784, 1047].forEach(function (f, i) { tone({ freq: f, type: 'square', dur: 0.10, gain: 0.08, delay: i * 0.05 }); }); },
    pickup:  function () { tone({ freq: 523, type: 'square', dur: 0.05, gain: 0.08 }); tone({ freq: 784, type: 'square', dur: 0.09, gain: 0.08, delay: 0.05 }); tone({ freq: 1047, type: 'square', dur: 0.12, gain: 0.08, delay: 0.11 }); },
    hurt:    function () { tone({ freq: 240, type: 'square', dur: 0.22, gain: 0.10, slideTo: 90 }); },

    // ---- F1 / motorsport one-shots ----
    blip_throttle: function () { tone({ freq: 90, type: 'sawtooth', dur: 0.28, gain: 0.13, slideTo: 380 }); tone({ freq: 180, type: 'sawtooth', dur: 0.28, gain: 0.07, slideTo: 760 }); noise({ dur: 0.2, gain: 0.05, filter: 'highpass', freq: 2200, delay: 0.12 }); },
    upshift: function () { noise({ dur: 0.05, gain: 0.10, filter: 'highpass', freq: 3500 }); tone({ freq: 520, type: 'square', dur: 0.04, gain: 0.05 }); },
    radio:   function () { noise({ dur: 0.06, gain: 0.06, filter: 'bandpass', freq: 1800, q: 2 }); tone({ freq: 1200, type: 'square', dur: 0.05, gain: 0.04, delay: 0.05 }); },
    light:   function () { tone({ freq: 660, type: 'sine', dur: 0.18, gain: 0.10 }); },

    // ---- observatory / radio-astronomy ----
    sonar:   function () { tone({ freq: 1400, type: 'sine', dur: 0.6, gain: 0.09, slideTo: 760 }); },
    pulse:   function () { tone({ freq: 920, type: 'sine', dur: 0.16, gain: 0.07, slideTo: 1300 }); },

    // ---- signal-decode (radio) ----
    static:  function () { noise({ dur: 0.05, gain: 0.045, filter: 'highpass', freq: 2200 }); },
    tick:    function () { tone({ freq: 1500 + Math.random() * 400, type: 'square', dur: 0.012, gain: 0.03 }); }
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
    if (m) { stopAmbient(); stopProjector(); stopEngine(); stopChiptune(); }
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

  // ---- V8 engine synth (F1) — startEngine, setThrottle(0..1), revTo(t,ms), stopEngine ----
  function startEngine() {
    ensure();
    if (!ctx || engine || muted) return;
    var out = ctx.createGain(); out.gain.value = 0; out.connect(master);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480; lp.Q.value = 5; lp.connect(out);
    var og = ctx.createGain(); og.gain.value = 0.42; og.connect(lp);
    // detuned saws + sub for the rumble
    var idle = 46;
    var o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = idle;
    var o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = idle * 1.5; o2.detune.value = 8;
    var o3 = ctx.createOscillator(); o3.type = 'square';   o3.frequency.value = idle * 0.5;
    o1.connect(og); o2.connect(og); o3.connect(og);
    // burble tremolo on the engine gain (uneven V8 firing)
    var lfo = ctx.createOscillator(); lfo.type = 'sawtooth'; lfo.frequency.value = idle / 3;
    var lfoG = ctx.createGain(); lfoG.gain.value = 0.28; lfo.connect(lfoG); lfoG.connect(og.gain);
    // looped exhaust noise
    var nb = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
    var nd = nb.getChannelData(0); for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    var ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
    var nbp = ctx.createBiquadFilter(); nbp.type = 'bandpass'; nbp.frequency.value = 1200; nbp.Q.value = 0.6;
    var ng = ctx.createGain(); ng.gain.value = 0.04; ns.connect(nbp); nbp.connect(ng); ng.connect(out);
    o1.start(); o2.start(); o3.start(); lfo.start(); ns.start();
    out.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.35);
    engine = { out: out, lp: lp, og: og, o1: o1, o2: o2, o3: o3, lfo: lfo, ng: ng, ns: ns, idle: idle };
    setThrottle(0);
  }
  function setThrottle(t) {
    if (!engine || !ctx) return;
    t = Math.max(0, Math.min(1, t));
    var now = ctx.currentTime, tc = 0.08, f = engine.idle + t * 200;
    engine.o1.frequency.setTargetAtTime(f, now, tc);
    engine.o2.frequency.setTargetAtTime(f * 1.5, now, tc);
    engine.o3.frequency.setTargetAtTime(f * 0.5, now, tc);
    engine.lfo.frequency.setTargetAtTime(f / 3, now, tc);
    engine.lp.frequency.setTargetAtTime(480 + t * 3600, now, tc);
    engine.ng.gain.setTargetAtTime(0.035 + t * 0.11, now, tc);
  }
  var revTimer = null;
  function revTo(t, ms) {
    if (!engine) startEngine();
    if (!engine) return;
    setThrottle(t == null ? 0.92 : t);
    clearTimeout(revTimer);
    revTimer = setTimeout(function () { setThrottle(0); }, ms || 420);
  }
  function stopEngine() {
    if (!engine || !ctx) return;
    var e = engine; engine = null; clearTimeout(revTimer);
    e.out.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    setTimeout(function () { [e.o1, e.o2, e.o3, e.lfo, e.ns].forEach(function (n) { try { n.stop(); } catch (x) {} }); }, 800);
  }

  // ---- chiptune loop (2D world) — gentle square-wave arpeggio + bass ----
  function blipAt(freq, t, dur, type, gain, dest) {
    var o = ctx.createOscillator(); o.type = type || 'square'; o.frequency.value = freq;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime((gain || 0.5) * 0.5, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.02);
  }
  function startChiptune() {
    ensure();
    if (!ctx || chiptune || muted) return;
    var out = ctx.createGain(); out.gain.value = 0; out.connect(master);
    out.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 1.2);
    var tempo = 0.16;
    var lead = [523, 659, 784, 659, 587, 494, 587, 659];
    var bass = [131, 131, 165, 196];
    var step = 0, nextTime = ctx.currentTime + 0.1;
    function schedule() {
      if (!chiptune) return;
      var ahead = ctx.currentTime + 0.3;
      while (nextTime < ahead) {
        blipAt(lead[step % lead.length], nextTime, 0.13, 'square', 0.45, out);
        if (step % 2 === 0) blipAt(bass[(step / 2) % bass.length], nextTime, 0.24, 'triangle', 0.6, out);
        step++; nextTime += tempo;
      }
      chiptune.timer = setTimeout(schedule, 70);
    }
    chiptune = { out: out, timer: null };
    schedule();
  }
  function stopChiptune() {
    if (!chiptune || !ctx) return;
    var c = chiptune; chiptune = null; clearTimeout(c.timer);
    c.out.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
  }

  window.SFX = {
    init: init, play: play,
    startAmbient: startAmbient, stopAmbient: stopAmbient,
    startProjector: startProjector, stopProjector: stopProjector,
    startEngine: startEngine, setThrottle: setThrottle, revTo: revTo, stopEngine: stopEngine,
    startChiptune: startChiptune, stopChiptune: stopChiptune,
    toggleMute: toggleMute, setMuted: setMuted,
    get muted() { return muted; },
    get unlocked() { return unlocked; }
  };
})();
