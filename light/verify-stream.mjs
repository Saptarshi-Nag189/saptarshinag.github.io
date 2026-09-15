import { chromium } from 'playwright';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--enable-unsafe-swiftshader','--no-sandbox','--js-flags=--expose-gc']});
const p = await b.newPage({viewport:{width:900,height:560}});
let fails = 0;
const ok = (c,m)=>{ console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fails++; };
const errs=[]; p.on('pageerror',e=>errs.push('PE: '+e));
p.on('console',m=>{ if(m.type()==='error' && !/404|favicon/.test(m.text())) errs.push('C: '+m.text().slice(0,200)); });

await p.goto('http://localhost:8601/light/index.html',{waitUntil:'load'});
await p.waitForFunction(()=>window.__LL&&window.__LL.ready,{timeout:180000});
await p.waitForTimeout(5000);
await p.evaluate(()=>{ window.__LL.clearVeil(); window.__LL.freeze(true); });

// ---- 1. DETERMINISM: a tile must regenerate byte-identical ---------------
console.log('\nDETERMINISM');
const A = [120, -96];                      // deep forest: plenty of instances
const t = await p.evaluate(a=>window.__LL.tileOf(a[0],a[1]), A);
await p.evaluate(a=>window.__LL.settle(a[0],a[1]), A);
const first = await p.evaluate(tt=>window.__LL.tileSnapshot(tt.i,tt.j), t);
ok(first && Object.keys(first.species||{}).length>0,
   'tile '+t.i+','+t.j+' generated with content: '+JSON.stringify(first && first.species).slice(0,110));

await p.evaluate(()=>window.__LL.settle(-432,-64));    // walk to the far desert
const gone = await p.evaluate(tt=>window.__LL.tileSnapshot(tt.i,tt.j), t);
ok(gone === null, 'and is evicted once out of range');

await p.evaluate(a=>window.__LL.settle(a[0],a[1]), A); // walk back
const second = await p.evaluate(tt=>window.__LL.tileSnapshot(tt.i,tt.j), t);
const same = JSON.stringify(first) === JSON.stringify(second);
ok(same, 'and regenerates byte-identical'+(same?'':'\n     was '+JSON.stringify(first)+'\n     now '+JSON.stringify(second)));

// ---- 2. MEMORY: walking the island must not grow anything ----------------
console.log('\nMEMORY');
const LOOP = [[-432,-64],[-232,-240],[20,-262],[120,-96],[230,-73],[-160,144],[-120,64],[-432,-64],[120,-96]];
const samples = [];
for (let lap = 0; lap < 2; lap++) {
  for (const [x,z] of LOOP) {
    await p.evaluate(a=>window.__LL.settle(a[0],a[1]), [x,z]);
    samples.push(await p.evaluate(()=>window.__LL.mem()));
  }
}
const resident = samples.map(s=>s.resident);
const meshes = samples.map(s=>s.meshes);
const heap = samples.map(s=>s.heapMB).filter(v=>v!=null);
const inst = samples.map(s=>s.totalInstances);
const last = samples[samples.length-1];
console.log('  resident tiles', Math.min(...resident)+'..'+Math.max(...resident),
            '| meshes', Math.min(...meshes)+'..'+Math.max(...meshes),
            '| instances', Math.min(...inst)+'..'+Math.max(...inst));
if (heap.length) console.log('  heap MB', Math.min(...heap).toFixed(1)+'..'+Math.max(...heap).toFixed(1),
                             '| first', heap[0], 'last', heap[heap.length-1]);
console.log('  built', last.built, 'disposed', last.disposed,
            '| pool', (last.pooledBytes/1048576).toFixed(2)+'MB', 'recycle', last.poolRecycleRate);

ok(Math.max(...resident) <= 130, 'resident tiles stay bounded (max '+Math.max(...resident)+')');
ok(Math.max(...meshes) <= 200, 'mesh count stays bounded (max '+Math.max(...meshes)+')');
ok(last.disposed > 100, 'tiles are actually being disposed ('+last.disposed+')');
ok(last.pooledBytes < 24*1048576, 'the pool itself is capped ('+(last.pooledBytes/1048576).toFixed(2)+'MB)');
ok(last.poolRecycleRate > 0.3, 'buffers are being recycled, not reallocated (rate '+last.poolRecycleRate+')');
if (heap.length > 4) {
  // compare the two laps: the second must not cost materially more than the first
  const half = Math.floor(heap.length/2);
  const lap1 = Math.max(...heap.slice(0,half)), lap2 = Math.max(...heap.slice(half));
  ok(lap2 < lap1 * 1.35 + 20, 'heap does not climb lap over lap ('+lap1.toFixed(1)+' -> '+lap2.toFixed(1)+' MB)');
}

ok(errs.length===0, 'zero page/console errors'+(errs.length? ': '+errs.slice(0,3).join(' | '):''));
console.log('\n'+(fails? fails+' FAILURE(S)':'ALL CHECKS PASSED'));
await b.close();
process.exit(fails?1:0);
