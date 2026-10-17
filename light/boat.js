/* ==========================================================================
   boat.js — the verb that only works on water.

   A boat is not a car. Rowing is deliberately heavy: slow to gather way, slow
   to shed it, and it turns about its own axis rather than steering toward
   wherever the camera happens to point. That resistance is the whole appeal —
   the lake should feel like a different medium from the meadow, not like the
   meadow with a different texture.

   Confinement reuses `field.lakeT(x,z)`, the same normalised radius the basin
   was carved with, so the boat can never row out through its own shoreline.
   ========================================================================== */
import { clamp, lerp } from './noise.js';

export function createBoat(field, mesh, home, opts) {
  opts = opts || {};
  const MAX = opts.max || 3.4;              // metres per second under oars
  const ACCEL = opts.accel || 1.5;
  const DRAG = opts.drag || 0.5;
  const TURN = opts.turn || 0.95;           // radians per second at way
  const REACH = opts.reach || 5.0;          // how close you must be to board

  const s = {
    x: home.x, z: home.z, y: home.y,
    heading: home.rotY || 0,
    speed: 0, aboard: false,
    lean: 0, pitch: 0, bob: 0,
  };

  const level = field.lakeLevel;

  /** Is the traveller near enough to climb in? */
  function canBoard(px, pz) {
    return !s.aboard && Math.hypot(px - s.x, pz - s.z) < REACH;
  }

  function board() { s.aboard = true; return s; }

  /**
   * Step off onto the nearest piece of land. Tries straight ahead first,
   * because that is where the player was pointing, then sweeps outward.
   */
  function disembark() {
    s.aboard = false;
    s.speed = 0;
    const tryAt = (a, r) => {
      const x = s.x + Math.sin(a) * r, z = s.z + Math.cos(a) * r;
      const h = field.heightAt(x, z);
      return (h > level + 0.35) ? { x, z, y: h } : null;
    };
    for (let r = 3; r <= 34; r += 1.5) {
      const ahead = tryAt(s.heading, r);
      if (ahead) return ahead;
      for (let k = 1; k <= 12; k++) {
        const off = (k / 12) * Math.PI;
        const a = tryAt(s.heading + off, r) || tryAt(s.heading - off, r);
        if (a) return a;
      }
    }
    // the lake has no bank within reach: stay aboard rather than drown
    s.aboard = true;
    return null;
  }

  /**
   * @param stick optional analog intent {x, z, mag} from the touch thumbstick.
   *   Without it the boat reads the keyboard only, and a phone could board her
   *   but never row her — the one verb in the world that needed a boat.
   */
  function update(dt, keys, timeSec, stick) {
    dt = Math.min(dt, 0.05);

    let fwd = 0, turn = 0;
    if (s.aboard) {
      if (keys['KeyW'] || keys['ArrowUp']) fwd += 1;
      if (keys['KeyS'] || keys['ArrowDown']) fwd -= 1;
      if (keys['KeyA'] || keys['ArrowLeft']) turn -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) turn += 1;
      // a held stick speaks over the keys, and its push is the throttle
      if (stick && stick.mag > 0.08) { fwd = stick.z; turn = stick.x; }
    }

    // a boat with no way on answers the helm badly; that is correct
    const bite = 0.30 + clamp(Math.abs(s.speed) / MAX, 0, 1) * 0.70;
    s.heading += turn * TURN * bite * dt * (s.speed < -0.05 ? -1 : 1);

    s.speed += fwd * ACCEL * dt * (fwd < 0 ? 0.55 : 1);
    s.speed *= Math.exp(-DRAG * dt);
    s.speed = clamp(s.speed, -MAX * 0.4, MAX);
    if (Math.abs(s.speed) < 0.015) s.speed = 0;

    if (s.speed !== 0) {
      const nx = s.x + Math.sin(s.heading) * s.speed * dt;
      const nz = s.z + Math.cos(s.heading) * s.speed * dt;
      if (field.lakeT(nx, nz) < 0.96) { s.x = nx; s.z = nz; }
      else s.speed *= 0.35;                  // nudged the bank; lose way
    }

    // hull motion: heel into the turn, squat under acceleration, and always
    // the slow breathing of water underneath
    s.bob += dt;
    const wantLean = -turn * bite * 0.16 * clamp(Math.abs(s.speed) / MAX + 0.25, 0, 1);
    s.lean += (wantLean - s.lean) * Math.min(1, dt * 3.5);
    const wantPitch = -clamp(s.speed / MAX, -1, 1) * 0.045;
    s.pitch += (wantPitch - s.pitch) * Math.min(1, dt * 2.5);
    s.y = level - 0.22 + Math.sin(s.bob * 1.15) * 0.045 + Math.sin(s.bob * 0.63) * 0.03;

    if (mesh) {
      mesh.position.set(s.x, s.y, s.z);
      mesh.rotation.set(s.pitch, s.heading, s.lean);
    }
    return s;
  }

  /** Where the traveller sits, and facing which way. */
  function seat() {
    return {
      x: s.x - Math.sin(s.heading) * 0.35,
      y: s.y + 0.34,
      z: s.z - Math.cos(s.heading) * 0.35,
      heading: s.heading,
    };
  }

  return { state: s, mesh, canBoard, board, disembark, update, seat,
           get aboard() { return s.aboard; } };
}
