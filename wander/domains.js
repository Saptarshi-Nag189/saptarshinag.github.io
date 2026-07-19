/* ==========================================================================
   THE WANDER — domains.js
   Doors on the overworld → soft bloom → prebuilt interiors with stations.
   Six runnable machines. The twin chat (TwinBrain socket for future Llama).
   ========================================================================== */
import { DOMAINS, FAIRY, CORPUS, CORPUS_FALLBACK } from './twin-data.js';
import { buildDungeons } from './dungeons.js';

export function initDomains(ctx){
const { THREE, scene, curve, wanderer, fairy, camera, renderer, state, input,
        fairySay, setPrompt, sfx, REDUCED, showToast } = ctx;

const bloomEl=document.getElementById('bloom');
const plateEl=document.getElementById('plate');
const conEl=document.getElementById('console');

/* ---------------- doors on the overworld ---------------- */
const DOOR_BIOME={ forest:0.155, river:0.318, desert:0.468, snow:0.60, sky:0.742, city:0.878, meadow:0.968 };
const doors=[];
const _p=new THREE.Vector3(), _t=new THREE.Vector3(), _n=new THREE.Vector3(), _up=new THREE.Vector3(0,1,0);
const DOOR_COLORS={forest:0x9defc9,river:0x8fd8ff,desert:0xffd98a,snow:0xdfe8ff,sky:0xffc9d9,city:0xc9a8ff,meadow:0xffe9a8};

Object.keys(DOOR_BIOME).forEach(id=>{
  const t=DOOR_BIOME[id];
  curve.getPointAt(t,_p); curve.getTangentAt(t,_t);
  _n.crossVectors(_t,_up).normalize();
  const g=new THREE.Group();
  const col=DOOR_COLORS[id];
  const pm=new THREE.MeshLambertMaterial({color:0xfff8ee,flatShading:true});
  const p1=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.42,4.6,7),pm); p1.position.set(-1.7,2.3,0);
  const p2=p1.clone(); p2.position.x=1.7;
  const lintel=new THREE.Mesh(new THREE.BoxGeometry(4.6,0.5,0.7),pm); lintel.position.y=4.6;
  const veilM=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.35,side:THREE.DoubleSide});
  const veil=new THREE.Mesh(new THREE.PlaneGeometry(3,4.2),veilM); veil.position.y=2.2;
  g.add(p1,p2,lintel,veil);
  const side = (id==='river'||id==='sky') ? 0 : (Math.random()<0.5?-1:1);
  const dist = side===0 ? 0 : 7.5;
  g.position.set(_p.x+_n.x*dist*side, _p.y-0.4, _p.z+_n.z*dist*side);
  if(side===0){ /* on-path gates (river/sky): straddle the path */
    g.position.set(_p.x,_p.y-0.4,_p.z);
    g.lookAt(_p.x+_t.x,_p.y-0.4,_p.z+_t.z);
  } else g.lookAt(curve.getPointAt(t).x,g.position.y,curve.getPointAt(t).z);
  scene.add(g);
  doors.push({id,t,g,veil,col,side,dist});
});

/* one shared halo light roams to whichever door is nearest — visually identical
   (a door's glow is only ever perceptible up close), far cheaper per fragment  */
const doorHalo=new THREE.PointLight(0xffffff,5,12); doorHalo.visible=false; scene.add(doorHalo);

/* ---------------- interiors: seven distinct worlds (dungeons.js) ---------------- */
const interiors=buildDungeons(THREE, DOMAINS, DOOR_COLORS);
Object.values(interiors).forEach(IN=>IN.stations.forEach(st=>{ st.gem.userData.by=st.gem.position.y; }));

/* ---------------- enter / exit with soft bloom ---------------- */
let activeDomain=null, u=0, uvel=0, activeStation=-1, transitioning=false;
let savedCam=new THREE.Vector3(), savedLook=new THREE.Vector3();
let resting=false, restT=0, escHinted=false;

function bloomTo(fn){
  transitioning=true;
  bloomEl.classList.add('on');
  sfx('bloom');
  setTimeout(()=>{
    fn();
    setTimeout(()=>{ bloomEl.classList.remove('on'); transitioning=false; }, 60);
  }, REDUCED?280:780);
}
function enterDomain(id){
  const D=DOMAINS[id];
  bloomTo(()=>{
    state.mode='domain:'+id;
    activeDomain=id; u=0; uvel=0; activeStation=-1;
    const IN=interiors[id];
    IN.scene.add(wanderer.g); IN.scene.add(fairy.g);
    wanderer.wL.visible=wanderer.wR.visible=false;
    wanderer.g.position.set(0,0,-1); wanderer.g.rotation.set(0,0,0);
    fairy.g.position.set(1.6,2.4,-2);
    savedCam.copy(camera.position); savedLook.copy(state.camLook);
    camera.position.set(0,4.6,-9);
    state.camLook.set(0,1.4,4);
    showToast(D.name, D.sub);
    const dot=document.querySelector('#journey span[data-d="'+id+'"]');
    if(dot && !dot.classList.contains('lit')){ dot.classList.add('lit'); sfx('coin'); }
    const dr=doors.find(d=>d.id===id);
    if(dr){ dr.veil.material.color.set(0xffd98a); dr.col=0xffd98a; }
    if(!escHinted){ escHinted=true; fairySay(FAIRY.doorEnter+' (Esc steps back outside, anytime.)', 4600); }
    else fairySay(FAIRY.doorEnter, 3200);
    setPrompt(null);
  });
}
function exitDomain(){
  bloomTo(()=>{
    const IN=interiors[activeDomain];
    IN.scene.remove(wanderer.g); IN.scene.remove(fairy.g);
    scene.add(wanderer.g); scene.add(fairy.g);
    plateEl.classList.remove('show');
    state.mode='overworld';
    activeDomain=null;
    camera.position.copy(savedCam); state.camPos.copy(savedCam); state.camLook.copy(savedLook);
    fairySay(FAIRY.doorExit, 3000);
  });
}

/* ---------------- plate (station content) ---------------- */
plateEl.style.right='18px'; plateEl.style.top='50%'; plateEl.style.transform='translateY(-50%)';
function showPlate(id, s){
  plateEl.innerHTML='<div class="pk">'+DOMAINS[id].name+' · '+s.k+'</div><h3>'+s.t+'</h3>'+
    '<div class="pb">'+s.b+'</div>'+
    (s.demo?'<div style="margin-top:10px;font-weight:700;color:#e75f9c;font-size:13px"><i class="fa-solid fa-wand-magic-sparkles"></i> press ▲ to run this machine</div>':'');
  plateEl.classList.add('show');
}

/* ---------------- the six machines (console overlay) ---------------- */
const conKick=document.getElementById('conKick'), conTitle=document.getElementById('conTitle'),
      conBody=document.getElementById('conBody'), conClose=document.getElementById('conClose');
let conFrame=null, conCleanup=null;
conClose.addEventListener('click', closeConsole);
function closeConsole(){
  conEl.classList.remove('up');
  if(conFrame) cancelAnimationFrame(conFrame), conFrame=null;
  if(conCleanup){ conCleanup(); conCleanup=null; }
  sfx('back');
}
function openConsole(kick,title,build){
  conKick.textContent=kick; conTitle.textContent=title;
  conBody.innerHTML='';
  conEl.classList.add('up');
  sfx('select');
  build(conBody);
}
function mkCanvas(host,h){
  const cv=document.createElement('canvas');
  host.appendChild(cv);
  const dpr=Math.min(devicePixelRatio||1,2);
  const w=cv.clientWidth||host.clientWidth||600;
  cv.width=w*dpr; cv.height=h*dpr; cv.style.height=h+'px';
  const x=cv.getContext('2d'); x.setTransform(dpr,0,0,dpr,0,0);
  return {x,w,h,cv};
}
function loop(fn){ (function f(ms){ conFrame=requestAnimationFrame(f); if(!document.hidden) fn(ms||0); })(0); }
function stampRow(host, arr){
  const d=document.createElement('div');
  d.style.cssText='display:flex;flex-wrap:wrap;justify-content:center;margin-top:10px';
  arr.forEach((s,i)=>{ const c=document.createElement('span'); c.className='cstamp';
    c.textContent=s; c.style.opacity=0; d.appendChild(c);
    setTimeout(()=>{ c.style.transition='opacity .4s'; c.style.opacity=1; sfx('coin'); }, 300+i*260); });
  host.appendChild(d);
}
function machineDone(msg){
  sfx('success');
  fairySay(FAIRY.demoDone[Math.floor(Math.random()*FAIRY.demoDone.length)],4200);
  if(activeDomain && activeStation>=0) interiors[activeDomain].stations[activeStation].done=true;
}

const MACHINES={
  gmrt(host){
    host.innerHTML='<p style="font-size:13px;color:#7a7194;margin-bottom:10px">The telescope\'s stream pours onto one waterwheel while three sit still. <b>Open the side channels.</b></p>';
    const C=mkCanvas(host,190);
    const row=document.createElement('div'); row.className='crow'; host.appendChild(row);
    let opened=0, lat=240;
    for(let i=1;i<=3;i++){
      const b=document.createElement('button'); b.className='cbtn';
      b.textContent='open channel '+i;
      b.addEventListener('click',()=>{ if(b.disabled)return; b.disabled=true; opened++; lat=240-opened*40; sfx('splash');
        if(opened===3){ lat=120; machineDone(); stampRow(host,['GMRT · NCRA-TIFR · winter 2023','multicore refactor','latency −50% · real-time unblocked']); }});
      row.appendChild(b);
    }
    let t=0;
    loop(()=>{ t+=0.03;
      const {x,w,h}=C; x.fillStyle='#241f38'; x.fillRect(0,0,w,h);
      for(let wh=0;wh<4;wh++){
        const cx=w*(0.14+wh*0.24), cy=h*0.52, on=wh===0||wh<=opened;
        const speed=wh===0?(1-opened*0.22):(wh<=opened?0.9:0);
        x.strokeStyle=on?'#9defc9':'#4a4462'; x.lineWidth=3;
        x.beginPath(); x.arc(cx,cy,26,0,7); x.stroke();
        for(let sp=0;sp<6;sp++){
          const a=t*speed*3+sp/6*Math.PI*2;
          x.beginPath(); x.moveTo(cx,cy); x.lineTo(cx+Math.cos(a)*24,cy+Math.sin(a)*24); x.stroke();
        }
        x.fillStyle='#cbc3e8'; x.font='600 10px JetBrains Mono'; x.textAlign='center';
        x.fillText('WHEEL '+wh,cx,cy+44);
        if(on){ x.fillStyle='rgba(143,216,255,.7)';
          for(let d=0;d<5;d++){ const dy=((t*40+d*22)%(cy-20)); x.fillRect(cx-2,10+dy,4,8); } }
      }
      x.fillStyle='#ffd98a'; x.font='700 13px JetBrains Mono'; x.textAlign='left';
      x.fillText('LATENCY '+lat+' ms'+(lat===120?'  (−50%)':''),14,20);
    });
  },
  pulsar(host){
    host.innerHTML='<p style="font-size:13px;color:#7a7194;margin-bottom:10px">A dead star ticks in this pool. <b>Sweep the folding period</b> — stack its turns until it surfaces. (Real epoch folding.)</p>';
    const C=mkCanvas(host,180);
    const row=document.createElement('div'); row.className='crow'; host.appendChild(row);
    const read=document.createElement('span'); read.className='cread'; row.appendChild(read);
    const sl=document.createElement('input'); sl.type='range'; sl.className='cslider';
    sl.min=5000; sl.max=10000; sl.value=5000; row.appendChild(sl);
    const auto=document.createElement('button'); auto.className='cbtn'; auto.textContent='let his model fold'; row.appendChild(auto);
    const P0=0.7168, NP=90, BIN=72; let P=0.5, locked=false;
    const seed=[]; for(let k=0;k<NP;k++){ seed.push([]); for(let b=0;b<BIN;b++) seed[k].push(Math.random()-0.5); }
    function fold(Pv){
      const prof=new Float32Array(BIN);
      for(let k=0;k<NP;k++){ const sh=(((k*P0)%Pv)/Pv+0.5)%1;
        for(let b=0;b<BIN;b++){ let d=b/BIN-sh; d-=Math.round(d);
          prof[b]+=Math.exp(-(d*d)/(2*0.03*0.03))*0.32+seed[k][b]; } }
      let mx=0; for(let b=1;b<BIN;b++) if(prof[b]>prof[mx]) mx=b;
      const off=[]; let mean=0;
      for(let b=0;b<BIN;b++){ let dd=Math.abs(b-mx); dd=Math.min(dd,BIN-dd); if(dd>9) off.push(prof[b]); }
      off.forEach(v=>mean+=v/off.length);
      let vr=0; off.forEach(v=>vr+=(v-mean)*(v-mean)/off.length);
      return {prof,mean,snr:(prof[mx]-mean)/Math.sqrt(vr+1e-9)};
    }
    let res=fold(P);
    function setP(v){ P=v; res=fold(P);
      read.innerHTML='PERIOD<br><b>'+P.toFixed(4)+' s</b><br><span style="font-size:10px">SNR '+res.snr.toFixed(1)+(res.snr>4?' ▲':'')+'</span>';
      if(!locked&&res.snr>8){ locked=true; sfx('lock'); machineDone();
        let beats=0; const iv=setInterval(()=>{ sfx('pulse'); if(++beats>10) clearInterval(iv); },P0*1000);
        stampRow(host,['pulsar found · 0.7168 s','his ResNet1D+SE · 99.8% F1','70M+ samples · NCRA-TIFR']); } }
    sl.addEventListener('input',()=>{ setP(sl.value/10000); if(Math.random()<0.4) sfx('static'); });
    auto.addEventListener('click',()=>{ auto.disabled=true; let i=0,steps=30,s0=P;
      const iv=setInterval(()=>{ i++; const v=s0+(P0-s0)*(i/steps); sl.value=Math.round(v*10000); setP(v); if(i>=steps) clearInterval(iv); },40); });
    let t=0;
    loop(()=>{ t+=0.02; const {x,w,h}=C;
      x.fillStyle='#241f38'; x.fillRect(0,0,w,h);
      x.beginPath();
      for(let b=0;b<BIN;b++){ const vx=16+(b/(BIN-1))*(w-32);
        const vv=(res.prof[b]-res.mean)/(NP*0.32);
        const vy=h*0.72-vv*h*2.0;
        b===0?x.moveTo(vx,vy):x.lineTo(vx,vy); }
      x.strokeStyle=locked?'#ffd98a':'#8fd8ff'; x.lineWidth=2;
      x.shadowColor=x.strokeStyle; x.shadowBlur=locked?14:5; x.stroke(); x.shadowBlur=0;
      if(locked){ x.fillStyle='rgba(255,217,138,'+(0.5+0.5*Math.sin(t*8))+')';
        x.font='700 12px JetBrains Mono'; x.textAlign='center';
        x.fillText('♥ its heartbeat — every 0.7168 s',w/2,22); }
    });
    setP(0.5);
  },
  f1(host){
    host.innerHTML='<p style="font-size:13px;color:#7a7194;margin-bottom:10px">His PINN splits tyre wear into <b>thermal</b> and <b>mechanical</b>. The race runs — <b>box when you believe.</b></p>';
    const C=mkCanvas(host,190);
    const row=document.createElement('div'); row.className='crow'; host.appendChild(row);
    const box=document.createElement('button'); box.className='cbtn'; box.textContent='█ BOX BOX BOX'; row.appendChild(box);
    const LAPS=24,OPT=15; let lap=1,ff=0,boxed=0,over=false;
    const th=l=>Math.min(1,Math.pow(l/LAPS,1.6)*1.15), me=l=>Math.min(1,l/LAPS*0.75+(l>18?(l-18)*0.06:0));
    const gr=l=>Math.max(0,1-(th(l)*0.55+me(l)*0.45));
    box.addEventListener('click',()=>{ if(over||boxed)return; boxed=lap; box.disabled=true; sfx('upshift');
      setTimeout(()=>{ over=true; const d=Math.abs(boxed-OPT)*0.8+(boxed>20?(boxed-20)*1.2:0);
        box.textContent=d<1?'PERFECT — you matched the model':'+'+d.toFixed(1)+'s vs the model (lap '+OPT+')';
        machineDone(); stampRow(host,['PINN thermal/mech split','LSTM-XGBoost · 10 Hz telemetry','4.1× CUDA speedup']); },700); });
    loop(()=>{ if(!over&&!boxed){ ff++; if(ff%44===0&&lap<LAPS){ lap++; if(lap>=LAPS){ boxed=LAPS; box.disabled=true; box.textContent='tyre cliff — the model would have saved you'; setTimeout(()=>{over=true; machineDone(); stampRow(host,['PINN thermal/mech split','4.1× CUDA speedup']);},600); } } }
      const {x,w,h}=C; x.fillStyle='#241f38'; x.fillRect(0,0,w,h);
      const gx=40,gy=14,gw=w-58,gh=h-48;
      x.strokeStyle='rgba(255,255,255,.15)'; x.strokeRect(gx,gy,gw,gh);
      if(lap>=9){ const x1=gx+13/(LAPS-1)*gw,x2=gx+15/(LAPS-1)*gw;
        x.fillStyle='rgba(157,239,201,.15)'; x.fillRect(x1,gy,x2-x1,gh);
        x.fillStyle='#9defc9'; x.font='600 9px JetBrains Mono'; x.textAlign='center'; x.fillText('PINN WINDOW',(x1+x2)/2,gy+12); }
      const draw=(fn,c)=>{ x.beginPath(); for(let l=1;l<=lap;l++){ const cx2=gx+(l-1)/(LAPS-1)*gw, cy2=gy+gh-fn(l)*gh;
        l===1?x.moveTo(cx2,cy2):x.lineTo(cx2,cy2);} x.strokeStyle=c; x.lineWidth=2; x.stroke(); };
      draw(th,'#ff8a9a'); draw(me,'#ffd98a'); draw(gr,'#8fd8ff');
      x.font='600 9.5px JetBrains Mono'; x.textAlign='left';
      x.fillStyle='#ff8a9a'; x.fillText('thermal',gx+6,gy+14);
      x.fillStyle='#ffd98a'; x.fillText('mechanical',gx+6,gy+26);
      x.fillStyle='#8fd8ff'; x.fillText('grip',gx+6,gy+38);
      x.fillStyle='#fff'; x.font='700 12px JetBrains Mono';
      x.fillText('LAP '+lap+' / '+LAPS+'   GRIP '+Math.round(gr(lap)*100)+'%',gx,h-10);
      if(boxed){ const bx=gx+(boxed-1)/(LAPS-1)*gw; x.fillStyle='#ffd98a'; x.textAlign='center'; x.fillText('▼ you',bx,gy-2); }
    });
  },
  oracle(host){
    host.innerHTML='<p style="font-size:13px;color:#7a7194;margin-bottom:10px">Omniscience Pro, live: pick a question and <b>watch retrieval happen</b> in embedding space.</p>';
    const wrap=document.createElement('div'); wrap.style.cssText='display:flex;gap:12px;flex-wrap:wrap'; host.appendChild(wrap);
    const left=document.createElement('div'); left.style.cssText='flex:1;min-width:190px;display:flex;flex-direction:column;gap:7px';
    const right=document.createElement('div'); right.style.cssText='flex:1.4;min-width:240px';
    wrap.appendChild(left); wrap.appendChild(right);
    const C=mkCanvas(right,130);
    const out=document.createElement('div');
    out.style.cssText="margin-top:8px;height:74px;overflow-y:auto;background:#241f38;border-radius:10px;padding:9px 12px;font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.6;color:#bfe9d9";
    out.textContent='oracle idle…'; right.appendChild(out);
    const chunks=[]; for(let i=0;i<46;i++) chunks.push({x:Math.random(),y:Math.random(),hot:0});
    let q=null, answered=0, t=0;
    const QS=[
      ['How fast is retrieval?','Vector search answers in <b style="color:#ffd98a">&lt;50 ms</b> (HNSW) and first token in <b style="color:#ffd98a">&lt;500 ms</b> — fully offline. [omniscience-pro]'],
      ['What did the audit find?','His own red-team pass on ARO found and fixed <b style="color:#ffd98a">16 vulnerabilities</b> — auth, SSRF, validation, CORS. [aro]'],
      ['How was Llama shrunk?','Fine-tuned Llama 3.2 on <b style="color:#ffd98a">21.5k</b> interactions, quantised to <b style="color:#ffd98a">4-bit</b> with Unsloth — quality intact. [llama-3.2]']
    ];
    QS.forEach(([qq,aa])=>{
      const b=document.createElement('button'); b.className='cbtn'; b.style.fontSize='11.5px'; b.textContent=qq;
      b.addEventListener('click',()=>{ if(b.disabled)return; b.disabled=true;
        q={x:0.2+Math.random()*0.6,y:0.2+Math.random()*0.6};
        const near=chunks.map((c,i)=>({i,d:(c.x-q.x)**2+(c.y-q.y)**2})).sort((a,b)=>a.d-b.d).slice(0,3);
        out.innerHTML='<span style="color:#8fd8ff">» '+qq+'</span><br>searching…';
        setTimeout(()=>{ near.forEach(o=>chunks[o.i].hot=1); sfx('sonar');
          out.innerHTML+='<br><span style="color:#9defc9">3 chunks · 43 ms</span><br>';
          let k=0; const iv=setInterval(()=>{ k+=4;
            out.innerHTML='<span style="color:#8fd8ff">» '+qq+'</span><br><span style="color:#9defc9">3 chunks · 43 ms</span><br>'+aa.slice(0,k);
            out.scrollTop=1e6; if(k%12===0) sfx('type');
            if(k>=aa.length){ clearInterval(iv); chunks.forEach(c=>c.hot=0); q=null;
              if(++answered===2){ machineDone(); stampRow(host,['<50 ms search · <500 ms token','LangChain · ChromaDB · Docker']); } }
          },20); },600);
      });
      left.appendChild(b);
    });
    loop(()=>{ t+=0.016; const {x,w,h}=C;
      x.fillStyle='#241f38'; x.fillRect(0,0,w,h);
      chunks.forEach(c=>{ const cx=10+c.x*(w-20), cy=10+c.y*(h-20);
        x.fillStyle=c.hot?'#ffd98a':'rgba(143,216,255,.5)';
        x.beginPath(); x.arc(cx,cy,c.hot?4.5+Math.sin(t*8):2,0,7); x.fill();
        if(c.hot&&q){ x.strokeStyle='rgba(255,217,138,.5)';
          x.beginPath(); x.moveTo(10+q.x*(w-20),10+q.y*(h-20)); x.lineTo(cx,cy); x.stroke(); } });
      if(q){ x.fillStyle='#fff'; x.beginPath(); x.arc(10+q.x*(w-20),10+q.y*(h-20),5,0,7); x.fill(); }
    });
  },
  aro(host){
    host.innerHTML='<p style="font-size:13px;color:#7a7194;margin-bottom:10px">ARO runs research as a living graph of agents. <b>Give it a task</b> and watch them light.</p>';
    const C=mkCanvas(host,180);
    const row=document.createElement('div'); row.className='crow'; host.appendChild(row);
    const go=document.createElement('button'); go.className='cbtn'; go.textContent='▶ run: "survey zero-trust for IoT"'; row.appendChild(go);
    const NODES=[['plan',0.5,0.16],['search',0.2,0.42],['read',0.5,0.42],['critic',0.8,0.42],['draft',0.35,0.74],['verify',0.65,0.74]];
    const EDGES=[[0,1],[0,2],[0,3],[1,2],[2,4],[3,5],[4,5]];
    let lit=-1,running=false,t=0;
    go.addEventListener('click',()=>{ if(running)return; running=true; go.disabled=true;
      let i=0; const iv=setInterval(()=>{ lit=i; sfx('blip'); i++;
        if(i>NODES.length){ clearInterval(iv); machineDone();
          stampRow(host,['agent graphs · NetworkX','Flask SSE · React','16 vulns found & fixed']); } },650); });
    loop(()=>{ t+=0.02; const {x,w,h}=C;
      x.fillStyle='#241f38'; x.fillRect(0,0,w,h);
      EDGES.forEach(([a,b])=>{ const A=NODES[a],B=NODES[b];
        x.strokeStyle=(lit>=a&&lit>=b)?'rgba(157,239,201,.7)':'rgba(255,255,255,.12)';
        x.lineWidth=1.5; x.beginPath(); x.moveTo(A[1]*w,A[2]*h); x.lineTo(B[1]*w,B[2]*h); x.stroke(); });
      NODES.forEach((n,i)=>{ const on=lit>=i;
        x.fillStyle=on?'#9defc9':'#4a4462';
        x.beginPath(); x.arc(n[1]*w,n[2]*h,on?13+Math.sin(t*6+i)*2:11,0,7); x.fill();
        x.fillStyle=on?'#173a2a':'#cbc3e8'; x.font='700 9px JetBrains Mono'; x.textAlign='center'; x.textBaseline='middle';
        x.fillText(n[0],n[1]*w,n[2]*h); });
      x.textBaseline='alphabetic';
    });
  },
  wifi(host){
    host.innerHTML='<p style="font-size:13px;color:#7a7194;margin-bottom:10px">His C-DAC watch, live: management frames flow — until a <b>deauth storm</b> hits. The window model flags it. <b>You quarantine.</b></p>';
    const C=mkCanvas(host,190);
    const row=document.createElement('div'); row.className='crow'; host.appendChild(row);
    const qb=document.createElement('button'); qb.className='cbtn'; qb.textContent='quarantine flagged device'; qb.disabled=true; row.appendChild(qb);
    const DEV=['cam','lock','therm','plug','sense'];
    let t=0,phase='calm',victim=0,contained=false; const trust=DEV.map(()=>100);
    qb.addEventListener('click',()=>{ if(phase!=='attack'||contained)return; contained=true; phase='ok'; sfx('lock');
      machineDone(); stampRow(host,['C-DAC IoT detection: 97.93% · <1 ms/window','XGBoost + MLP on the edge','SHAP explainability · 2× IoTaIS\'25']); });
    loop(()=>{ t++;
      if(phase==='calm'&&t>140){ phase='attack'; qb.disabled=false; sfx('error'); }
      if(phase==='attack'&&!contained){ trust[victim]=Math.max(10,trust[victim]-0.4); if(t%60===0) sfx('beep'); }
      if(phase==='ok') trust[victim]=Math.min(100,trust[victim]+1);
      const {x,w,h}=C; x.fillStyle='#241f38'; x.fillRect(0,0,w,h);
      const hub={x:w/2,y:h*0.44};
      DEV.forEach((d,i)=>{ const a=i/DEV.length*Math.PI*2-Math.PI/2;
        const px=hub.x+Math.cos(a)*Math.min(w*0.3,120), py=hub.y+Math.sin(a)*54;
        x.strokeStyle=i===victim&&phase==='attack'?'rgba(255,138,154,.7)':'rgba(143,216,255,.25)';
        x.beginPath(); x.moveTo(hub.x,hub.y); x.lineTo(px,py); x.stroke();
        if(i===victim&&phase==='attack'){ for(let f=0;f<7;f++){ const ft=((t*0.03)+f/7)%1;
          x.fillStyle='#ff8a9a'; x.beginPath(); x.arc(w-16+(px-(w-16))*ft,14+(py-14)*ft,2.4,0,7); x.fill(); } }
        const tr=trust[i], col=tr>70?'#9defc9':tr>40?'#ffd98a':'#ff8a9a';
        x.strokeStyle=col; x.lineWidth=3;
        x.beginPath(); x.arc(px,py,15,-Math.PI/2,-Math.PI/2+Math.PI*2*tr/100); x.stroke();
        x.fillStyle='#cbc3e8'; x.font='600 9px JetBrains Mono'; x.textAlign='center';
        x.fillText(d+' '+Math.round(tr),px,py+29); });
      x.fillStyle='#8fd8ff'; x.beginPath(); x.arc(hub.x,hub.y,7,0,7); x.fill();
      /* window strip */
      const wy=h-20, cells=Math.floor((w-24)/14);
      for(let c=0;c<cells;c++){ const bad=phase!=='calm'&&!contained&&c>cells-((t-140)/16);
        x.fillStyle=bad?'#ff8a9a':(contained&&c>cells-8?'#ff8a9a':'rgba(143,216,255,.22)');
        x.fillRect(12+c*14,wy,10,10); }
      x.font='700 10px JetBrains Mono'; x.textAlign='left';
      x.fillStyle=phase==='attack'&&!contained?'#ff8a9a':phase==='ok'?'#9defc9':'#cbc3e8';
      x.fillText(phase==='calm'?'ALL TRUSTED':phase==='attack'?'⚠ DEAUTH-FLOOD p=0.97 → quarantine cam':'CONTAINED ✓',12,16);
    });
  }
};
const MACHINE_META={
  gmrt:['the listening river','GMRT — make the telescope breathe'],
  pulsar:['the listening river','NCRA — find the pulsar'],
  f1:['the atelier · machine 01','F1 Tyre Lab'],
  oracle:['the atelier · machine 02','Omniscience Console'],
  aro:['the atelier · machine 03','ARO Table'],
  wifi:['the atelier · machine 04','WiFi-Guard Post (C-DAC)']
};

/* ---------------- twin chat (TwinBrain socket) ---------------- */
const LocalBrain={
  ready:true, kind:'local-corpus',
  answer(q){
    q=(q||'').toLowerCase();
    let best=null,score=0;
    for(const item of CORPUS){
      let s=0; for(const p of item.p) if(q.includes(p)) s+=p.length;
      if(s>score){ score=s; best=item; }
    }
    return Promise.resolve(best?best.a:CORPUS_FALLBACK);
  }
};
/* future scope: replace with a WebLLM-backed brain. Contract:
   window.TwinBrain = { ready:boolean, kind:string, answer(question:string):Promise<string> }
   See twin-data.js to update the local corpus. */
window.TwinBrain = window.TwinBrain || LocalBrain;

/* ---- optional full brain: a small LLM in the visitor's browser ---- */
const brainBtn=document.getElementById('brainBtn'),
      brainBar=document.getElementById('brainBar'),
      brainFill=document.getElementById('brainFill'),
      brainMsg=document.getElementById('brainMsg'),
      brainKind=document.getElementById('brainKind');
let llmLoading=false;
async function loadFullBrain(){
  if(llmLoading || (window.TwinBrain && window.TwinBrain.kind==='smollm2-360m' && window.TwinBrain.ready)) return;
  llmLoading=true;
  brainBar.classList.add('show');
  try{
    const mod=await import('../brain/llm-brain.js');
    const llm=mod.createLLMBrain({
      corpus:CORPUS, fallback:LocalBrain,
      onProgress:(pct)=>{ brainFill.style.width=pct+'%'; brainMsg.textContent='downloading the full brain · '+pct+'%'; },
      onStatus:(st)=>{ brainMsg.textContent=st; }
    });
    const ok=await llm.load();
    if(ok){
      window.TwinBrain=llm;
      brainBtn.classList.add('on'); brainBtn.textContent='✦ full brain active';
      brainKind.textContent='digital twin · SmolLM2-360M in your browser';
      brainBar.classList.remove('show');
      try{ localStorage.setItem('wander-llm','1'); }catch(e){}
      addMsg('twin','My full brain is awake — a real 360M-parameter model running right here in your browser, grounded in his story. Ask away. ✧');
    }else{
      brainBar.classList.remove('show');
      addMsg('twin',"I couldn't wake the full brain here (it needs a network + WebGPU or WASM). No matter — my local mind knows everything important.");
    }
  }catch(e){
    brainBar.classList.remove('show');
    addMsg('twin',"The full brain didn't load this time — my local mind continues, and it never gets his numbers wrong.");
  }
  llmLoading=false;
}
if(brainBtn) brainBtn.addEventListener('click',()=>{ toggleChat(true); loadFullBrain(); });
try{ if(localStorage.getItem('wander-llm')==='1') setTimeout(loadFullBrain, 4000); }catch(e){}

const chatEl=document.getElementById('chat'), chatLog=document.getElementById('chatLog'),
      chatQ=document.getElementById('chatQ'), chatGo=document.getElementById('chatGo');
let chatOpen=false, greeted=false;
function toggleChat(force){
  chatOpen = force!=null?force:!chatOpen;
  chatEl.classList.toggle('open',chatOpen);
  if(chatOpen){ sfx('trill'); chatQ.focus();
    if(!greeted){ greeted=true; addMsg('twin',FAIRY.chatGreeting); } }
}
function addMsg(who,txt){
  const m=document.createElement('div'); m.className='m '+who; m.innerHTML=txt;
  chatLog.appendChild(m); chatLog.scrollTop=1e6;
}
async function ask(){
  const q=chatQ.value.trim(); if(!q) return;
  chatQ.value=''; addMsg('you',q); sfx('click');
  const a=await window.TwinBrain.answer(q);
  /* typed reveal */
  const m=document.createElement('div'); m.className='m twin'; chatLog.appendChild(m);
  let k=0; const iv=setInterval(()=>{ k+=3; m.textContent=a.slice(0,k); chatLog.scrollTop=1e6;
    if(k%9===0) sfx('type');
    if(k>=a.length){ clearInterval(iv); m.textContent=a; } },18);
}
chatGo.addEventListener('click',ask);
chatQ.addEventListener('keydown',e=>{
  if(e.key==='Enter'){ ask(); }
  else if(e.key==='Escape'){ toggleChat(false); chatQ.blur(); }
  e.stopPropagation();
});
addEventListener('keydown',e=>{ if((e.key==='t'||e.key==='T')&&document.activeElement!==chatQ) toggleChat(); });
addEventListener('keydown',e=>{
  if(e.key!=='Escape') return;
  if(conEl.classList.contains('up')){ closeConsole(); return; }
  if(chatOpen){ toggleChat(false); return; }
  if(activeDomain && !transitioning && !resting) exitDomain();
});
/* tap the fairy */
const ray=new THREE.Raycaster(), mouse=new THREE.Vector2();
canvas_click();
function canvas_click(){
  renderer.domElement.addEventListener('pointerdown',e=>{
    mouse.x=(e.clientX/innerWidth)*2-1; mouse.y=-(e.clientY/innerHeight)*2+1;
    ray.setFromCamera(mouse,camera);
    const hits=ray.intersectObjects(fairy.g.children,true);
    if(hits.length) toggleChat(true);
  });
}
document.getElementById('bubble').style.pointerEvents='auto';
document.getElementById('bubble').addEventListener('click',()=>toggleChat(true));
const chatFab=document.getElementById('chatFab');
if(chatFab) chatFab.addEventListener('click',()=>toggleChat());

/* ---------------- arrival moments: chapters announce themselves ---------------- */
let announce=null;   /* {door, t, dur} while an arrival moment plays */
function getAnnounce(){
  if(!announce) return null;
  const k=announce.t/announce.dur;
  return { p:announce.door.g.position, w:Math.sin(Math.PI*Math.min(1,k))*0.85 };
}

/* ---------------- per-frame: overworld doors ---------------- */
let near=null;
function overworldTick(dt,ms){
  near=null;
  const cp=wanderer.g.position;
  if(announce){ announce.t+=dt; if(announce.t>=announce.dur) announce=null; }
  /* roam the shared halo to the nearest door */
  let nd=null, ndd=1;
  for(const d of doors){ const dt2=Math.abs(state.t-d.t); if(dt2<ndd){ ndd=dt2; nd=d; } }
  if(nd && ndd<0.08){
    doorHalo.visible=true;
    doorHalo.position.set(nd.g.position.x, nd.g.position.y+2.6, nd.g.position.z);
    doorHalo.color.set(nd.col);
    const cpx=cp.x-nd.g.position.x, cpz=cp.z-nd.g.position.z;
    const closeUp=(cpx*cpx+cpz*cpz)<70;
    const tgt=(announce&&announce.door===nd)?14+Math.sin(ms*0.02)*6:(closeUp?12:5);
    doorHalo.intensity += (tgt-doorHalo.intensity)*Math.min(1,dt*4);
  } else doorHalo.visible=false;
  for(const d of doors){
    const dx=cp.x-d.g.position.x, dz=cp.z-d.g.position.z, dy=cp.y-d.g.position.y;
    const dd=dx*dx+dz*dz+dy*dy;
    const isNear=dd<70;
    d.veil.material.opacity += ((isNear?0.75:0.35)-d.veil.material.opacity)*Math.min(1,dt*4);
    d.veil.rotation.z=Math.sin(ms*0.001+d.t*40)*0.06;
    /* first sight: announce the chapter */
    if(!d.announced && dd<1150 && Math.abs(state.t-d.t)<0.04){
      d.announced=true;
      if(!REDUCED) announce={door:d, t:0, dur:2.6};
      sfx('chime');
      const DD=DOMAINS[d.id];
      fairySay('Look — '+DD.door+'. '+DD.name+' waits inside. ✧', 5200);
    }
    if(isNear) near=d;
  }
  if(near && !transitioning){
    setPrompt('press <b>▲</b> to enter <b>'+DOMAINS[near.id].name+'</b>');
    if(input.up){ input.up=false; enterDomain(near.id); }
  } else if(!transitioning) setPrompt(null);
}
function nearDoor(){ return !!near; }

/* ---------------- per-frame: inside a domain ---------------- */
const _look=new THREE.Vector3(), _camT=new THREE.Vector3(), _fairT=new THREE.Vector3();
function domainTick(dt,ms){
  if(transitioning){ renderer.render(interiors[activeDomain].scene,camera); return; }
  const IN=interiors[activeDomain];
  const D=DOMAINS[activeDomain];
  /* --- resting: the goodnight timeline --- */
  if(resting){
    restT+=dt;
    const bed=IN.scene.userData.bed;
    /* character settles onto the bed, lying down */
    const k=Math.min(1,restT/1.8);
    wanderer.g.position.lerp(new THREE.Vector3(bed.x,1.02,bed.z), Math.min(1,dt*2.2));
    wanderer.g.rotation.x += ((-Math.PI/2)*k - wanderer.g.rotation.x)*Math.min(1,dt*2);
    wanderer.g.rotation.y += (0-wanderer.g.rotation.y)*Math.min(1,dt*2);
    /* fairy tucks in on the bedside table, wings slowing */
    fairy.g.position.lerp(bed.fairyPerch, Math.min(1,dt*1.6));
    const slow=Math.max(0.15,1-restT*0.28);
    const fl=0.6+Math.abs(Math.sin(ms*0.012*slow))*0.5*slow;
    fairy.w1.scale.set(0.9*fl,0.5,1); fairy.w2.scale.set(0.9*fl,0.5,1);
    /* camera drifts back for the last shot */
    state.camPos.lerp(new THREE.Vector3(bed.x-5.4,3.6,bed.z-6.5),Math.min(1,dt*1.2));
    camera.position.copy(state.camPos);
    state.camLook.lerp(new THREE.Vector3(bed.x,1.1,bed.z),Math.min(1,dt*1.6));
    camera.lookAt(state.camLook);
    if(restT>1.2 && !domainTick._night){
      domainTick._night=true;
      document.getElementById('night').classList.add('on');
      try{
        if(window.WANDER_AMB) window.WANDER_AMB.play('rain');
        else SFX.startRain && SFX.startRain();
      }catch(e){}
    }
    if(restT>6 && !domainTick._card){
      domainTick._card=true;
      document.getElementById('endcard').classList.add('show');
      sfx('chime');
    }
    renderer.render(IN.scene,camera);
    return;
  }
  /* move along z */
  let tgt=0;
  if(input.right) tgt=5.2; if(input.left) tgt=-5.2;   /* original domain speed, per user */
  uvel+=(tgt-uvel)*Math.min(1,dt*6);
  u=Math.max(-3.4,Math.min(IN.len, u+uvel*dt));
  const moving=Math.abs(uvel)>0.3;
  const bob=moving?Math.abs(Math.sin(ms*0.012))*0.12:0;
  let faceY;
  if(IN.path){
    const pp=IN.path(u,ms);
    wanderer.g.position.set(pp.x, pp.y+bob, pp.z);
    faceY=pp.ry+(uvel<-0.3?Math.PI:0);
  } else {
    wanderer.g.position.set(Math.sin(u*0.35)*1.4, bob, u);
    faceY=uvel>=0?Math.atan2(Math.cos(u*0.35)*0.5,1):Math.PI+Math.atan2(-Math.cos(u*0.35)*0.5,1);
  }
  wanderer.g.rotation.y += (faceY-wanderer.g.rotation.y)*Math.min(1,dt*6);
  wanderer.cape.rotation.z=Math.sin(ms*0.01)*0.07;
  if(moving && Math.floor(ms/280)!==Math.floor((ms-dt*1000)/280)) sfx('step');
  /* fairy */
  fairy.g.position.lerp(new THREE.Vector3(wanderer.g.position.x+1.4,
    wanderer.g.position.y+2.5+Math.sin(ms*0.003)*0.25, wanderer.g.position.z-1.2), Math.min(1,dt*3));
  const flap=0.6+Math.abs(Math.sin(ms*0.012))*0.5;
  fairy.w1.scale.set(0.9*flap,0.5,1); fairy.w2.scale.set(0.9*flap,0.5,1);
  /* camera: gentle 3/4 follow — or first person */
  if(state.pov==='first'){
    const dir=uvel>=-0.05?1:-1;
    const camT=new THREE.Vector3(wanderer.g.position.x,
      wanderer.g.position.y+1.85+(moving?Math.sin(ms*0.02)*0.05:0), u+0.3*dir);
    state.camPos.lerp(camT,Math.min(1,dt*8)); camera.position.copy(state.camPos);
    _look.set(wanderer.g.position.x,1.6,u+4*dir);
  } else if(activeDomain==='meadow'){
    _camT.set(-2.4, 3.2, u-5.4);
    state.camPos.lerp(_camT,Math.min(1,dt*2.4)); camera.position.copy(state.camPos);
    _look.set(wanderer.g.position.x*0.5, 1.3, u+2.2);
  } else {
    _camT.set(wanderer.g.position.x-4.6, 4.4, u-7.5);
    state.camPos.lerp(_camT,Math.min(1,dt*2.4)); camera.position.copy(state.camPos);
    _look.set(wanderer.g.position.x,1.5,u+2.5);
  }
  state.camLook.lerp(_look,Math.min(1,dt*3)); camera.lookAt(state.camLook);
  /* stations */
  let ns=-1,best=14;
  IN.stations.forEach((s,i)=>{
    s.gem.rotation.y=ms*0.001+i;
    s.gem.position.y=(s.gem.userData.by||1.4)+Math.sin(ms*0.002+i)*0.12;
    const d=Math.abs(u-s.z);
    if(d<best){ best=d; if(d<4.4) ns=i; }
  });
  if(ns!==activeStation){
    activeStation=ns;
    if(ns>=0){ showPlate(activeDomain, IN.stations[ns].data); sfx('chime'); }
    else plateEl.classList.remove('show');
  }
  /* prompts + interactions */
  const bedD=IN.scene.userData.bed;
  if(bedD && Math.abs(u-bedD.z)<3 && !resting){
    setPrompt('press <b>▲</b> to rest for the night');
    if(input.up){ input.up=false; resting=true; restT=0;
      fairySay(FAIRY.rest,5200);
      plateEl.classList.remove('show');
      setPrompt(null);
      try{ SFX.stopAmbient&&SFX.stopAmbient(); SFX.stopBrook&&SFX.stopBrook(); SFX.stopWind&&SFX.stopWind(); }catch(e){}
    }
    renderer.render(IN.scene,camera); return;
  }
  if(u<-2){
    setPrompt('press <b>▲</b> to step back outside');
    if(input.up){ input.up=false; exitDomain(); return; }
  } else if(ns>=0 && IN.stations[ns].data.demo){
    setPrompt('press <b>▲</b> to run <b>'+IN.stations[ns].data.t+'</b>');
    if(input.up){ input.up=false;
      const key=IN.stations[ns].data.demo, meta=MACHINE_META[key];
      openConsole(meta[0],meta[1],MACHINES[key]); }
  } else setPrompt(null);
  renderer.render(IN.scene,camera);
}

const restartBtn=document.getElementById('restartBtn');
if(restartBtn) restartBtn.addEventListener('click',()=>location.reload());

window.__domainU=function(v){ if(activeDomain!=null) u=v; };

return {
  overworldTick, getAnnounce,
  tick: domainTick,
  nearDoor,
  __enter: enterDomain, __exit: exitDomain,
  __openMachine:(k)=>openConsole(MACHINE_META[k][0],MACHINE_META[k][1],MACHINES[k])
};
}
