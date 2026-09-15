/* ==========================================================================
   camera.js — the third-person rig, and the hands that drive the traveller.

   The camera is the cheapest large gain in perceived production value in the
   whole project. A rig that snaps to its target looks like a tech demo; a rig
   that eases, leads, breathes and rolls looks like a game someone made on
   purpose. None of it costs a draw call.

     · Critically damped springs on BOTH the position and the look-at point.
       Damping them separately is what produces the slight lag of the frame
       behind the subject during a turn.
     · The look target is pushed AHEAD of travel, so the camera shows you
       where you are going rather than where you have been.
     · FOV widens on a run and settles on a stop — the oldest speed cue there
       is, and it works because peripheral vision really does open up.
     · A small roll into turns, and handheld noise scaled by speed.
   ========================================================================== */
import { clamp, lerp } from './noise.js';

/**
 * Critically damped spring. `lambda` is the rate: higher is stiffer.
 * Frame-rate independent because the decay is exponential in dt.
 */
function springTo(cur, target, vel, lambda, dt, out) {
  const w = lambda;
  const dx = cur.x - target.x, dy = cur.y - target.y, dz = cur.z - target.z;
  const e = Math.exp(-w * dt);
  // standard critically damped solution: (x + (v + w*x)t) e^{-wt}
  const nvx = (vel.x + w * dx) * dt, nvy = (vel.y + w * dy) * dt, nvz = (vel.z + w * dz) * dt;
  out.x = target.x + (dx + nvx) * e;
  out.y = target.y + (dy + nvy) * e;
  out.z = target.z + (dz + nvz) * e;
  vel.x = (vel.x - w * nvx) * e;
  vel.y = (vel.y - w * nvy) * e;
  vel.z = (vel.z - w * nvz) * e;
}

export function createCameraRig(BABYLON, scene, camera, field, opts) {
  opts = opts || {};
  const V = BABYLON.Vector3;

  const cfg = {
    dist: opts.dist || 5.4,
    height: opts.height || 2.15,
    lookHeight: opts.lookHeight || 1.35,
    lead: opts.lead || 2.2,
    fovWalk: opts.fovWalk || 0.96,          // ~55 deg
    fovRun: opts.fovRun || 1.19,            // ~68 deg
    posLambda: 7.5,
    lookLambda: 10.5,
  };

  const pos = new V(0, 0, 0);
  const look = new V(0, 0, 0);
  const posVel = new V(0, 0, 0);
  const lookVel = new V(0, 0, 0);
  const wantPos = new V(), wantLook = new V(), outV = new V();
  let roll = 0, lastYaw = 0, bobT = 0;

  camera.fov = cfg.fovWalk;
  camera.upVector = new V(0, 1, 0);

  /**
   * @param yaw      camera orbit yaw (radians)
   * @param pitch    camera pitch (radians, negative looks down)
   * @param subject  {x,y,z} the traveller's feet
   * @param fwd      {x,z} unit heading of travel
   * @param speed    m/s
   * @param running  0..1
   */
  function update(dt, yaw, pitch, subject, fwd, speed, running, firstPerson) {
    dt = Math.min(dt, 0.05);
    bobT += dt * (1.6 + speed * 0.9);

    if (firstPerson) {
      pos.set(subject.x, subject.y + 1.62, subject.z);
      posVel.set(0, 0, 0);
      const cp = Math.cos(pitch);
      look.set(pos.x + Math.sin(yaw) * cp * 10,
               pos.y + Math.sin(pitch) * 10,
               pos.z + Math.cos(yaw) * cp * 10);
      lookVel.set(0, 0, 0);
      camera.fov = lerp(camera.fov, cfg.fovWalk + running * 0.10, Math.min(1, dt * 5));
      camera.position.copyFrom(pos);
      camera.upVector.set(0, 1, 0);
      camera.setTarget(look);
      return;
    }

    // where the rig would like to be: behind and above, along the orbit yaw
    let back = cfg.dist * (1 + running * 0.14);
    const cp = Math.cos(pitch);
    const bx = -Math.sin(yaw) * cp, bz = -Math.cos(yaw) * cp;
    const by = cfg.height - Math.sin(pitch);

    /* Walk the boom outward and stop where the hill gets in the way.
       Lifting the camera instead — which is the obvious thing, and what this
       did first — makes it climb the slope behind you and stare down at the
       traveller's hood on any steep ground. Shortening the boom keeps the eye
       level and just brings the camera closer, which is what a camera operator
       backing into a hillside would actually do. */
    const CLEAR = 0.85;
    for (let s = 1; s <= 6; s++) {
      const d = back * (s / 6);
      const gx = subject.x + bx * d, gz = subject.z + bz * d;
      const eye = subject.y + cfg.height - Math.sin(pitch) * d;
      if (eye < field.heightAt(gx, gz) + CLEAR) { back = back * ((s - 1) / 6); break; }
    }
    back = Math.max(back, cfg.dist * 0.28);        // never end up inside the figure

    wantPos.set(
      subject.x + bx * back,
      subject.y + cfg.height - Math.sin(pitch) * back,
      subject.z + bz * back);

    // and as a last resort, do not end up under the ground
    const ground = field.heightAt(wantPos.x, wantPos.z) + 0.55;
    if (wantPos.y < ground) wantPos.y = ground;

    // look AHEAD of the subject, by more the faster it moves
    const leadAmt = cfg.lead * clamp(speed / 6.5, 0, 1);
    wantLook.set(
      subject.x + fwd.x * leadAmt,
      subject.y + cfg.lookHeight,
      subject.z + fwd.z * leadAmt);

    springTo(pos, wantPos, posVel, cfg.posLambda, dt, outV); pos.copyFrom(outV);
    springTo(look, wantLook, lookVel, cfg.lookLambda, dt, outV); look.copyFrom(outV);

    // FOV opens on the run
    camera.fov = lerp(camera.fov, lerp(cfg.fovWalk, cfg.fovRun, running), Math.min(1, dt * 3.2));

    // roll into the turn, from how fast the orbit yaw is changing
    let dyaw = yaw - lastYaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    lastYaw = yaw;
    const wantRoll = clamp(-dyaw / Math.max(dt, 1e-3) * 0.035, -0.026, 0.026) * (0.4 + running);
    roll += (wantRoll - roll) * Math.min(1, dt * 4);

    // handheld noise — tiny, and only really present when moving
    const amp = 0.012 + speed * 0.006;
    const nx = Math.sin(bobT * 1.7) * amp + Math.sin(bobT * 0.9) * amp * 0.5;
    const ny = Math.cos(bobT * 2.3) * amp * 0.8;

    camera.position.set(pos.x + nx, pos.y + ny, pos.z);
    camera.upVector.set(Math.sin(roll), Math.cos(roll), 0);
    camera.setTarget(look);
  }

  /** drop the rig into place with no easing (start, teleport, photo mode) */
  function snap(yaw, pitch, subject) {
    const cp = Math.cos(pitch);
    pos.set(subject.x - Math.sin(yaw) * cp * cfg.dist,
            subject.y + cfg.height - Math.sin(pitch) * cfg.dist,
            subject.z - Math.cos(yaw) * cp * cfg.dist);
    look.set(subject.x, subject.y + cfg.lookHeight, subject.z);
    posVel.set(0, 0, 0); lookVel.set(0, 0, 0);
    lastYaw = yaw; roll = 0;
    camera.position.copyFrom(pos);
    camera.upVector.set(0, 1, 0);
    camera.setTarget(look);
  }

  return { update, snap, cfg };
}

/* ==========================================================================
   The character controller
   ========================================================================== */

export function createController(field, opts) {
  opts = opts || {};
  const WALK = opts.walk || 3.1;
  const RUN = opts.run || 7.0;
  const ACCEL = opts.accel || 9.0;
  const TURN = opts.turn || 9.5;

  const me = {
    x: opts.x || 0, y: 0, z: opts.z || 0,
    heading: opts.heading || 0,
    speed: 0, running: 0,
    fwd: { x: 0, z: 1 },
    grounded: true,
  };
  me.y = field.heightAt(me.x, me.z);

  const keys = Object.create(null);
  let yaw = me.heading, pitch = -0.12;

  function key(code, down) { keys[code] = down; }
  function orbit(dx, dy) {
    yaw -= dx;
    pitch = clamp(pitch + dy, -0.85, 0.62);
  }

  function update(dt) {
    dt = Math.min(dt, 0.05);

    // intent, in camera space
    let ix = 0, iz = 0;
    if (keys['KeyW'] || keys['ArrowUp']) iz += 1;
    if (keys['KeyS'] || keys['ArrowDown']) iz -= 1;
    if (keys['KeyA'] || keys['ArrowLeft']) ix -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) ix += 1;
    const mag = Math.hypot(ix, iz);
    const wantRun = !!(keys['ShiftLeft'] || keys['ShiftRight'] || opts.forceRun);

    me.running += ((mag > 0 && wantRun ? 1 : 0) - me.running) * Math.min(1, dt * 4.5);

    let targetSpeed = 0;
    if (mag > 0) {
      ix /= mag; iz /= mag;
      // camera-relative: forward is where the camera looks
      const sy = Math.sin(yaw), cy = Math.cos(yaw);
      const dx = sy * iz + cy * ix;
      const dz = cy * iz - sy * ix;
      const want = Math.atan2(dx, dz);

      // turn toward the intent rather than snapping to it
      let d = want - me.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      me.heading += d * Math.min(1, dt * TURN);

      targetSpeed = lerp(WALK, RUN, me.running);

      // uphill is slower, downhill a little faster — the land is felt, not
      // just walked over
      const ahead = 1.2;
      const hx = me.x + Math.sin(me.heading) * ahead;
      const hz = me.z + Math.cos(me.heading) * ahead;
      const grade = (field.heightAt(hx, hz) - me.y) / ahead;
      targetSpeed *= clamp(1 - grade * 0.85, 0.35, 1.25);
    }

    me.speed += (targetSpeed - me.speed) * Math.min(1, dt * ACCEL);
    if (me.speed < 0.02) me.speed = 0;

    me.fwd.x = Math.sin(me.heading);
    me.fwd.z = Math.cos(me.heading);

    if (me.speed > 0) {
      const nx = me.x + me.fwd.x * me.speed * dt;
      const nz = me.z + me.fwd.z * me.speed * dt;
      const nh = field.heightAt(nx, nz);
      // the sea is a wall until the boat arrives in a later phase
      if (nh > 0.08) { me.x = nx; me.z = nz; }
    }

    me.y = field.heightAt(me.x, me.z);
    return me;
  }

  return {
    me, key, orbit, update, keys,
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    set yaw(v) { yaw = v; },
    set pitch(v) { pitch = v; },
    place(x, z, heading) {
      me.x = x; me.z = z; me.y = field.heightAt(x, z);
      if (heading != null) { me.heading = heading; yaw = heading; }
      me.speed = 0;
    },
  };
}
