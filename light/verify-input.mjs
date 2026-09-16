/* ==========================================================================
   verify-input.mjs — the thumbstick's maths, without a browser.

   The controller is pure: a field, some intent, and dt. That means the one
   thing a phone test cannot give us here — real frame rates — can be supplied
   directly. In the sandbox the software renderer manages one or two frames a
   second, so a browser reading of "speed 1.01 after letting go" proves nothing
   about the release logic and everything about swiftshader. This does.

       node light/verify-input.mjs
   ========================================================================== */
import { createController } from './camera.js';

const WALK = 3.9, RUN = 8.75;                // the tuned speeds, +25% on the originals
const flat = { heightAt: () => 5 };          // level ground, safely above the sea

let bad = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) bad++; };

function run(fn) {
  const c = createController(flat, { x: 0, z: 0 });
  const step = (n, dt) => { for (let i = 0; i < n; i++) c.update(dt); };
  return fn(c, step);
}

// a full push is the walk speed, and holding run is the run speed
ok(Math.abs(run((c, s) => { c.axis(0, 1, false); s(180, 1 / 60); return c.me.speed; }) - WALK) < 0.05,
   `a full push walks at ${WALK} m/s`);
ok(Math.abs(run((c, s) => { c.axis(0, 1, true); s(180, 1 / 60); return c.me.speed; }) - RUN) < 0.05,
   `a full push with run held is ${RUN} m/s`);

// the point of an analog stick: a part push is a part speed
for (const frac of [0.3, 0.45, 0.7]) {
  const got = run((c, s) => { c.axis(0, frac, false); s(240, 1 / 60); return c.me.speed; });
  ok(Math.abs(got - WALK * frac) < 0.05,
     `a ${Math.round(frac * 100)}% push strolls at ${(WALK * frac).toFixed(2)} m/s (got ${got.toFixed(2)})`);
}

// and the stick's direction is honoured regardless of how hard it is pushed
const headings = [[0, 1, 0], [1, 0, Math.PI / 2], [0, -1, Math.PI], [-1, 0, -Math.PI / 2]];
for (const [x, z, want] of headings) {
  const got = run((c, s) => { c.axis(x * 0.4, z * 0.4, false); s(300, 1 / 60); return c.me.heading; });
  let d = got - want;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  ok(Math.abs(d) < 0.02, `a push toward (${x}, ${z}) turns him to ${want.toFixed(2)} rad`);
}

// letting go must stop him, at a good frame rate and at a terrible one
for (const [fps, dt] of [[60, 1 / 60], [20, 0.05], [8, 0.05]]) {
  const got = run((c, s) => {
    c.axis(0, 1, false); s(Math.round(fps * 2), dt);
    c.axis(0, 0, false); s(Math.round(fps * 3), dt);
    return c.me.speed;
  });
  ok(got === 0, `letting go stops him dead at ${fps} fps (got ${got})`);
}

// the keyboard still works, and the stick overrides it while it is held
ok(Math.abs(run((c, s) => { c.key('KeyW', true); s(180, 1 / 60); return c.me.speed; }) - WALK) < 0.05,
   'the keyboard still walks at the same speed');
ok(run((c, s) => { c.key('KeyW', true); c.axis(0, 0.3, false); s(240, 1 / 60); return c.me.speed; }) < WALK * 0.4,
   'a held stick speaks over a held key');
ok(Math.abs(run((c, s) => { c.key('KeyW', true); c.axis(0, 0, false); s(180, 1 / 60); return c.me.speed; }) - WALK) < 0.05,
   'and a released stick hands the keyboard back');

/* The boat reads the same stick. Without this a phone can board her with the
   use button and then sit there: the one verb in the world that needs a boat. */
{
  const { createBoat } = await import('./boat.js');
  const lake = { lakeT: () => 0, heightAt: () => 0 };
  const hull = { position: { set() {} }, rotation: { set() {} }, setEnabled() {} };
  const home = { x: 0, z: 0, heading: 0 };
  const b = createBoat(lake, hull, home, {});
  b.board();
  const keys = Object.create(null);
  for (let i = 0; i < 180; i++) b.update(1 / 60, keys, i / 60, { x: 0, z: 1, mag: 1 });
  ok(b.state.speed > 0.5, `a pushed stick rows the boat (got ${b.state.speed.toFixed(2)} m/s)`);
  const turned = b.state.heading;
  for (let i = 0; i < 120; i++) b.update(1 / 60, keys, i / 60, { x: 1, z: 0.2, mag: 1 });
  ok(b.state.heading > turned + 0.2, 'and steers her');
}

console.log(bad ? `\n${bad} FAILED` : '\nall input checks pass');
process.exit(bad ? 1 : 0);
