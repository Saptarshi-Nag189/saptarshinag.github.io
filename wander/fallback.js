/* ==========================================================================
   fallback.js: The Wander as a plain page.

   Shown when the browser has no WebGL, or when the 3D world fails to start.
   Without it the loading veil stayed up forever ("the fairy is waking…") and
   covered the only link out. It reads the same DOMAINS the world uses, so the
   facts can't drift apart.
   ========================================================================== */
import { DOMAINS } from './twin-data.js';

const ORDER = ['forest', 'river', 'desert', 'snow', 'sky', 'city', 'meadow'];

export function showFallback() {
  const veil = document.getElementById('veil');
  if (veil) veil.remove();
  for (const id of ['chip', 'sparks', 'journey', 'chatFab', 'povBtn', 'photoBtn', 'runBtn', 'mark', 'pad']) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  }

  const host = document.getElementById('fallback');
  if (!host) return;

  let html = '<div class="fw">' +
    '<h1>The Wander</h1>' +
    '<p class="lede">This is the plain version. The 3D walk needs WebGL, which this browser doesn\'t ' +
    'have turned on, so here is everything the world holds, in the order you would walk it. ' +
    '<a href="../index.html">Back to the portfolio</a>.</p>';

  for (const id of ORDER) {
    const d = DOMAINS[id];
    if (!d) continue;
    html += '<h2><small>' + d.sub + '</small>' + d.name + '</h2>';
    for (const s of d.stations) {
      html += '<h3>' + s.t + '</h3><div class="k">' + s.k + '</div>' + s.b;
    }
  }
  html += '</div>';

  host.innerHTML = html;
  // the simulated machines need the 3D world; their invitations make no sense here
  host.querySelectorAll('p > i').forEach((i) => {
    if (/console|pool|lets you|simulated/i.test(i.textContent)) i.parentElement.remove();
  });
  host.hidden = false;
  document.title = 'The Wander (plain version) · Saptarshi Nag';
}
