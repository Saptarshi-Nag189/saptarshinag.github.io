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

  /* ---- Phase 2: the world has more than one kind of place in it ------- */
  console.log('\nBIOMES');
  const SPOTS = {
    beach:  [-168, 464], desert: [-432, -64], forest: [120, -96],
    marsh:  [144, -16],  meadow: [-232, -240], snow: [-160, 144],
  };
  const found = [];
  for (const [want, xz] of Object.entries(SPOTS)) {
    const got = await p.evaluate(a=>window.__LL.biomeAt(a[0], a[1]), xz);
    if (got.biome === want) found.push(want);
    else console.log('       note: '+want+' spot reads as '+got.biome);
  }
  ok(found.length >= 5, 'the island really has distinct lands: '+found.join(', '));

  const lakeInfo = await p.evaluate(()=>window.__LL.sites());
  ok(lakeInfo.lake && lakeInfo.lake.level > 1,
     'the lake sits at a level carved from the land ('+(lakeInfo.lake && lakeInfo.lake.level)+'m)');

  console.log('\nWHAT IS BUILT AND WHAT LIVES HERE');
  for (const k of ['temple','stones','gate']) {
    const site = lakeInfo[k];
    if (!site) { ok(false, k+' was never sited'); continue; }
    const h = await p.evaluate(s2=>window.__LL.heightAt(s2.x, s2.z), site);
    ok(Math.abs(h - site.h) < 2.5,
       k+' stands on the ground at ('+site.x+','+site.z+'), h '+site.h+' vs '+h.toFixed(1));
  }

  // deer must be on the ground and never in the lake
  const deerCheck = await p.evaluate(()=>{
    const sc = BABYLON.Engine.LastCreatedScene;
    const m = sc.meshes.find(mm=>mm.name==='deer');
    if (!m || !m.thinInstanceCount) return null;
    const buf = m._thinInstanceDataStorage.matrixData;
    let worst = 0, inLake = 0;
    for (let i=0;i<m.thinInstanceCount;i++){
      const o=i*16, x=buf[o+12], y=buf[o+13], z=buf[o+14];
      worst = Math.max(worst, Math.abs(y - window.__LL.heightAt(x,z)));
      const s = window.__LL.sites().lake;
      if (s && Math.hypot(x-s.x, z-s.z) < s.r && y < s.level) inLake++;
    }
    return { n: m.thinInstanceCount, worst: +worst.toFixed(3), inLake };
  });
  ok(deerCheck && deerCheck.worst < 0.05,
     'all '+(deerCheck&&deerCheck.n)+' deer stand on the ground (worst '+(deerCheck&&deerCheck.worst)+'m)');
  ok(deerCheck && deerCheck.inLake === 0, 'and none of them are standing in the lake');

  console.log('\nTHE BOAT');
  const b0 = await p.evaluate(()=>window.__LL.boat());
  ok(b0 && Math.abs(b0.y - b0.level) < 0.6, 'the boat floats at the lake surface ('+(b0&&b0.y)+' vs '+(b0&&b0.level)+')');
  ok(b0 && b0.lakeT < 0.97, 'and sits inside its own shoreline (t='+(b0&&b0.lakeT)+')');
  ok(await p.evaluate(()=>window.__LL.board()), 'you can board it');
  await p.evaluate(()=>{ dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'})); });
  await p.waitForTimeout(9000);
  await p.evaluate(()=>{ dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'})); });
  const b1 = await p.evaluate(()=>window.__LL.boat());
  ok(b1.speed > 0.1, 'rowing gathers way (speed '+b1.speed+')');
  const land = await p.evaluate(()=>window.__LL.ashore());
  ok(land && land.y > b0.level, 'and it puts you ashore above the waterline (y '+(land&&land.y.toFixed(2))+')');

  console.log('\nWEATHER (opt-in; see main.js)');
  const wx = {};
  for (const [name, t, x, z] of [['fireflies',1.0,120,-96],['sandGrain',0.48,-400,-90],
                                 ['snowFlake',0.34,-160,144]]) {
    await p.evaluate(a=>{ window.__LL.setTime(a.t); window.__LL.goto(a.x,a.z,0); }, {t,x,z});
    await p.waitForTimeout(2500);
    wx[name] = (await p.evaluate(()=>window.__LL.stats())).weather;
  }
  const anyWeather = Object.values(wx).some(o => Object.values(o).some(v => v > 0));
  if (!anyWeather) console.log('       weather is off by default — run with ?weather=1 to exercise it');
  else {
    ok(wx.fireflies.firefly > 0, 'fireflies come out in the wood after dark ('+wx.fireflies.firefly+')');
    ok(wx.sandGrain.sandGrain > 0 && wx.sandGrain.firefly === 0,
       'sand blows in the desert at noon, and nothing else does');
    ok(wx.snowFlake.snowFlake > 0 && wx.snowFlake.sandGrain === 0,
       'snow falls on the cold ground, and sand does not');
  }

  ok(errs.length === 0, 'zero console/page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await p.close();
}
console.log('\n'+(fails? fails+' FAILURE(S)' : 'ALL CHECKS PASSED'));
await b.close();
process.exit(fails?1:0);
