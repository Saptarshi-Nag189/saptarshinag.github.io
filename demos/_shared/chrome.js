/* ==========================================================================
   chrome.js — injects the standardized page chrome for every experience:
   a back pill (top-left → ../index.html) and a concept tag (top-right).
   Pages set their accent via  :root { --chrome-accent: … }  (or a
   data-accent attribute on this script tag). Removes legacy bespoke
   back-links/tags so old markup can't drift out of sync.
   Load AFTER chrome.css:  <script src="../_shared/chrome.js" data-tag="experience 04"></script>
   ========================================================================== */
(function () {
  'use strict';

  var script = document.currentScript;
  var tagText = (script && script.getAttribute('data-tag')) || 'experience';
  var accent = script && script.getAttribute('data-accent');

  function build() {
    if (accent) document.documentElement.style.setProperty('--chrome-accent', accent);

    // remove legacy bespoke chrome (old ids/classes from earlier iterations)
    ['backlink', 'back-link', 'backLink', 'back', 'tag', 'conceptTag', 'concept-tag'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.id !== 'exp-back' && el.id !== 'exp-tag') el.remove();
    });
    ['.top-left', '.concept-tag', '.back-link', 'a.back', 'a.chrome', 'div.chrome'].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        if (el.id === 'exp-back' || el.id === 'exp-tag') return;
        // only remove obvious chrome elements (fixed-positioned links/tags), never content
        var cs = getComputedStyle(el);
        if (cs.position === 'fixed') el.remove();
      });
    });

    if (!document.getElementById('exp-back')) {
      var back = document.createElement('a');
      back.id = 'exp-back';
      back.href = '../index.html';
      back.setAttribute('aria-label', 'Back to all experiences');
      back.innerHTML = '<i class="fa-solid fa-arrow-left" aria-hidden="true"></i><span>demos</span>';
      back.addEventListener('pointerdown', function () {
        if (window.SFX) { try { SFX.play('back'); } catch (e) {} }
      });
      document.body.appendChild(back);
    }

    if (!document.getElementById('exp-tag')) {
      var tag = document.createElement('div');
      tag.id = 'exp-tag';
      tag.setAttribute('aria-hidden', 'true');
      tag.innerHTML = '<i class="fa-solid fa-flask" aria-hidden="true"></i><span>' + tagText + '</span>';
      document.body.appendChild(tag);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
