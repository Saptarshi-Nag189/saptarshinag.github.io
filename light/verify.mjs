import { chromium } from 'playwright';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--enable-unsafe-swiftshader','--no-sandbox']});
let fails = 0;
const ok = (c,m)=>{ console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fails++; };

// ---- 1. The Ledger must work with NO WebGL at all -------------------------
{
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  await p.addInitScript(()=>{ HTMLCanvasElement.prototype.getContext = () => null; });
  const errs=[]; p.on('pageerror',e=>errs.push(''+e));
  await p.goto('http://localhost:8601/light/index.html',{waitUntil:'load'});
  await p.waitForTimeout(3500);
  const r = await p.evaluate(()=>{
    const t = document.getElementById('ledgerBody').innerText;
    return { len:t.length, has: ['97.93','Saptarshi Nag','C-DAC','99.8','4.1','NCRA','GATE','1790','IoTaIS'].filter(k=>t.includes(k)),
             phone: /\+?\d[\d\s\-]{8,}/.test(t.replace(/\b(19|20)\d\d\b/g,'')),
             heads: document.querySelectorAll('#ledger .lsec h2').length };
  });
  console.log('\nNO-WEBGL FALLBACK');
  ok(r.len > 2000, 'The Ledger renders without a WebGL context ('+r.len+' chars)');
  ok(r.has.length === 9, 'every headline fact present: '+r.has.join(', '));
  ok(r.heads === 5, 'all five sections present ('+r.heads+')');
  ok(!r.phone, 'no phone number published (house rule)');
  await ctx.close();
}

// ---- 2. the world itself --------------------------------------------------
{
  const p = await b.newPage({viewport:{width:1280,height:760}});
  const errs=[]; p.on('pageerror',e=>errs.push('PE:'+e));
  p.on('console',m=>{ if(m.type()==='error' && !/404|favicon/.test(m.text())) errs.push('C:'+m.text().slice(0,200)); });
  await p.goto('http://localhost:8601/light/index.html?grass=8000&trees=500&rocks=250',{waitUntil:'load'});
  await p.waitForFunction(()=>window.__LL&&window.__LL.ready,{timeout:240000});
  await p.waitForTimeout(12000);
  console.log('\nWORLD');
  const s = await p.evaluate(()=>window.__LL.stats());
  ok(s.gl === 2, 'WebGL2 context');
  ok(s.meshes >= 8, 'sky, terrain, sea, grass, trees, rocks, traveller, cloak ('+s.meshes+' meshes)');

  // the veil must lift on its own
  ok(await p.evaluate(()=>{const v=document.getElementById('veil'); return !v || v.classList.contains('gone');}),
     'the loading veil lifts by itself');

  // every one of the eight keyframes must render without error
  const keys = await p.evaluate(()=>window.__LL.skyKeys());
  for (const k of keys) { await p.evaluate(t=>window.__LL.setTime(t), k.at); await p.waitForTimeout(300); }
  ok(keys.length === 8, 'eight sky keyframes: '+keys.map(k=>k.id).join(' '));

  // the traveller must stand ON the ground, not in it or above it
  await p.evaluate(()=>window.__LL.goto(20,-262,0.4));
  await p.waitForTimeout(500);
  let drift = 0, n = 0;
  for (const [x,z] of [[20,-262],[0,-200],[-60,-100],[46,60],[120,-150],[-150,-150]]) {
    const r = await p.evaluate(([x,z])=>{ const w=window.__LL.goto(x,z,0); return {y:w.y, h:window.__LL.heightAt(x,z)}; },[x,z]);
    drift = Math.max(drift, Math.abs(r.y - r.h)); n++;
  }
  ok(drift < 1e-6, 'traveller sits exactly on heightAt at '+n+' points (max drift '+drift.toExponential(1)+')');

  // and must actually walk
  await p.evaluate(()=>window.__LL.goto(20,-262,0.4));
  const before = await p.evaluate(()=>window.__LL.who());
  await p.evaluate(()=>{ dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'})); });
  await p.waitForTimeout(16000);
  await p.evaluate(()=>{ dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'})); });
  const after = await p.evaluate(()=>window.__LL.who());
  const moved = Math.hypot(after.x-before.x, after.z-before.z);
  ok(moved > 2, 'the traveller walks ('+moved.toFixed(1)+'m)');
  // who() rounds x/z to 2dp, so allow for heightAt sampled at the rounded spot
  const gap = Math.abs(after.y - (await p.evaluate(a=>window.__LL.heightAt(a.x,a.z), after)));
  ok(gap < 0.05, 'and stays on the ground while walking (gap '+gap.toFixed(4)+'m)');

  ok(errs.length === 0, 'zero console/page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await p.close();
}
console.log('\n'+(fails? fails+' FAILURE(S)' : 'ALL CHECKS PASSED'));
await b.close();
process.exit(fails?1:0);
