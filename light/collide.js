/* ==========================================================================
   collide.js — what you cannot walk through.

   Until now the controller tested exactly one thing: whether the ground under
   the next step was above sea level. Every tree, rock, cactus and building was
   scenery you walked straight through.

   Two decisions shape this file:

     1. COLLIDE WITH THE TRUNK, NOT THE CANOPY. A broadleaf's canopy is five
        metres across; its trunk is under one. Using the canopy radius would
        turn a wood into a wall you cannot walk under, which is worse than no
        collision at all. Every species declares its own trunk radius.

     2. SLIDE, DON'T STOP. Blocking the whole step makes a world feel sticky —
        you press forward against a tree and simply stop. Removing only the
        component of motion pointing INTO the obstacle lets you brush past it,
        which is what the body expects.

   The store is a uniform spatial hash rather than a list, and it follows the
   streaming world's lifetime: colliders arrive with their tile and are dropped
   when that tile is disposed, so this cannot become a second thing that leaks.

   Costs are kept in the same style the old wander build used: a cheap integer
   cell lookup first, squared distances only, and never Math.hypot in the loop.
   ========================================================================== */

const CELL = 8;                       // metres; a few colliders per cell
const STRIDE = 5;                     // x, z, r2, r, ownerId

export function createColliders(opts) {
  opts = opts || {};
  const cells = new Map();            // "cx,cz" -> flat array, STRIDE per circle
  const owners = new Map();           // ownerKey -> { id, touched:Set<cellKey> }
  let nextOwnerId = 1;
  let count = 0;

  const key = (cx, cz) => cx + ',' + cz;
  const cellOf = (v) => Math.floor(v / CELL);

  /**
   * Add one circle. `owner` is whatever should be able to remove it again —
   * a tile key for streamed flora, or a string for the permanent landmarks.
   */
  function add(owner, x, z, r) {
    if (!(r > 0)) return;
    let rec = owners.get(owner);
    if (!rec) { rec = { id: nextOwnerId++, touched: new Set() }; owners.set(owner, rec); }

    const k = key(cellOf(x), cellOf(z));
    let bin = cells.get(k);
    if (!bin) { bin = []; cells.set(k, bin); }
    bin.push(x, z, r * r, r, rec.id);
    count++;
    rec.touched.add(k);
  }

  /**
   * Drop everything an owner put in. Called from the chunk manager's dispose.
   *
   * A cell can hold circles from several tiles at once, so this filters by
   * owner id rather than deleting the cell — deleting it would silently take
   * the neighbours' trees with it and leave holes you could walk through.
   */
  function removeOwner(owner) {
    const rec = owners.get(owner);
    if (!rec) return 0;
    let removed = 0;
    for (const k of rec.touched) {
      const bin = cells.get(k);
      if (!bin) continue;
      let w = 0;
      for (let i = 0; i < bin.length; i += STRIDE) {
        if (bin[i + 4] === rec.id) { removed++; continue; }
        if (w !== i) for (let j = 0; j < STRIDE; j++) bin[w + j] = bin[i + j];
        w += STRIDE;
      }
      bin.length = w;
      if (!w) cells.delete(k);
    }
    owners.delete(owner);
    count -= removed;
    return removed;
  }

  /**
   * Resolve a move from (x,z) to (nx,nz) for a body of radius `body`.
   * Returns the position actually reached.
   *
   * The push-out is iterated twice so that a corner between two trunks
   * resolves instead of ping-ponging between them.
   */
  const out = { x: 0, z: 0, hit: false };
  function resolve(x, z, nx, nz, body) {
    out.x = nx; out.z = nz; out.hit = false;
    if (!count) return out;

    for (let pass = 0; pass < 2; pass++) {
      let moved = false;
      const c0 = cellOf(out.x - body - 2), c1 = cellOf(out.x + body + 2);
      const d0 = cellOf(out.z - body - 2), d1 = cellOf(out.z + body + 2);

      for (let cx = c0; cx <= c1; cx++) {
        for (let cz = d0; cz <= d1; cz++) {
          const bin = cells.get(key(cx, cz));
          if (!bin) continue;
          for (let i = 0; i < bin.length; i += STRIDE) {
            const ox = bin[i], oz = bin[i + 1], r = bin[i + 3];
            const reach = r + body;
            const dx = out.x - ox, dz = out.z - oz;
            const d2 = dx * dx + dz * dz;
            if (d2 >= reach * reach) continue;

            // push straight out to the surface — the remaining tangential
            // motion is what lets you slide around the trunk
            const d = Math.sqrt(d2) || 1e-4;
            const push = (reach - d) / d;
            out.x += dx * push;
            out.z += dz * push;
            out.hit = true;
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
    return out;
  }

  /** Is this point inside anything? Used by tests and by prop placement. */
  function blocked(x, z, body) {
    body = body || 0;
    const cx = cellOf(x), cz = cellOf(z);
    for (let i = cx - 1; i <= cx + 1; i++) {
      for (let j = cz - 1; j <= cz + 1; j++) {
        const bin = cells.get(key(i, j));
        if (!bin) continue;
        for (let k = 0; k < bin.length; k += STRIDE) {
          const dx = x - bin[k], dz = z - bin[k + 1];
          const reach = bin[k + 3] + body;
          if (dx * dx + dz * dz < reach * reach) return true;
        }
      }
    }
    return false;
  }

  function stats() {
    return { colliders: count, cells: cells.size, owners: owners.size };
  }

  function clear() { cells.clear(); owners.clear(); count = 0; }

  return { add, removeOwner, resolve, blocked, stats, clear, get count() { return count; } };
}
