/* ==========================================================================
   a11y.js: shared keyboard and screen-reader plumbing for the archive demos.

   Most demos open their chapters by clicking a canvas, which a keyboard can't
   do, and their panels were plain divs: focus stayed behind them, Tab walked
   into the scene underneath, and closing dropped focus on <body>.

   A11Y.dialog(wrap, panel, closeBtn, titleId)
     Makes a panel a modal dialog. Call .opened() after showing it and
     .closed() after hiding it. Focus moves to the close button, Tab is
     trapped inside, and focus returns to whatever opened it.

   A11Y.chapters(labels, open)
     A "chapters" list of real buttons, one per chapter, each calling
     open(index). It stays out of sight until a keyboard user tabs into it
     (like a skip link), so the scene looks exactly as before for a mouse.
   ========================================================================== */
(function () {
  'use strict';

  var FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

  function dialog(wrap, panel, closeBtn, titleId) {
    var opener = null;
    var box = panel || wrap;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    if (titleId) box.setAttribute('aria-labelledby', titleId);

    function trap(e) {
      if (e.key !== 'Tab') return;
      var f = [].filter.call(box.querySelectorAll(FOCUSABLE), function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      else if (!box.contains(document.activeElement)) { first.focus(); e.preventDefault(); }
    }

    return {
      opened: function (from) {
        opener = from || document.activeElement;
        document.body.classList.add('exp-panel-open');
        document.addEventListener('keydown', trap);
        // after the open animation has started, so the focus ring lands on a visible button
        setTimeout(function () { (closeBtn || box).focus({ preventScroll: true }); }, 30);
      },
      closed: function () {
        document.body.classList.remove('exp-panel-open');
        document.removeEventListener('keydown', trap);
        if (opener && document.contains(opener) && opener !== document.body) {
          try { opener.focus({ preventScroll: true }); } catch (e) {}
        }
        opener = null;
      }
    };
  }

  function chapters(labels, open, title) {
    var nav = document.createElement('nav');
    nav.id = 'exp-chapters';
    nav.setAttribute('aria-label', title || 'Chapters');
    var h = document.createElement('span');
    h.className = 'exp-ch-title';
    h.textContent = title || 'Chapters';
    nav.appendChild(h);
    labels.forEach(function (label, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', function () { open(i, b); });
      nav.appendChild(b);
    });
    var attach = function () { document.body.appendChild(nav); };
    if (document.body) attach(); else document.addEventListener('DOMContentLoaded', attach);
    return nav;
  }

  window.A11Y = { dialog: dialog, chapters: chapters };
})();
