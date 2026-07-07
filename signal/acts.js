/* ==========================================================================
   THE SIGNAL — acts.js
   Eight playable modules. Each act is an instrument that simulates the real
   work; resume facts are earned as stamps + mission-log entries, never modals.
   Contract: build(stage, api) where api = {
     done(logLine)            -> mark act complete (sequencer shows CONTINUE)
     stamp(host, icon, text, delayMs)
     sfx(name) / engine helpers via window.SFX
     onFrame(fn)              -> managed rAF (auto-cleaned on act exit)
     reduced                  -> prefers-reduced-motion
     el(tag, cls, html)       -> element helper
   }
   ========================================================================== */
(function(){
'use strict';

function el(tag, cls, html){
  var e=document.createElement(tag);
  if(cls) e.className=cls;
  if(html!=null) e.innerHTML=html;
  return e;
}
function setupCanvas(cv, cssH){
  var dpr=Math.min(devicePixelRatio||1,2);
  var w=cv.clientWidth||600;
  cv.height=cssH*dpr; cv.width=w*dpr;
  cv.style.height=cssH+'px';
  var x=cv.getContext('2d');
  x.setTransform(dpr,0,0,dpr,0,0);
  return { x:x, w:w, h:cssH };
}

/* =========================================================================
   ACT 0 — CALIBRATION (hero)
   ========================================================================= */
function act0(stage, api){
  stage.appendChild(el('div','a-head',
    '<div class="a-act">act 0 · calibration</div>'+
    '<h1 class="a-title">Every career is a signal buried in noise.</h1>'+
    '<p class="a-story">This one starts in Kolkata, 2019, and is still transmitting. '+
    'You are the operator tonight. <b>Turn the gain until the noise confesses.</b></p>'));

  var rig=el('div','rig');
  rig.appendChild(el('div','rig-cap','<span>osc·01 — raw feed</span><span class="st" id="a0st">NO CARRIER</span>'));
  var cv=el('canvas'); rig.appendChild(cv);
  var ctl=el('div','ctl');
  ctl.appendChild(el('span','readout','GAIN<br><b id="a0g">0%</b>'));
  var slider=el('input','slider'); slider.type='range'; slider.min=0; slider.max=100; slider.value=0;
  slider.setAttribute('aria-label','Signal gain');
  ctl.appendChild(slider);
  rig.appendChild(ctl);
  stage.appendChild(rig);
  var stamps=el('div','stamps'); stage.appendChild(stamps);

  var C=setupCanvas(cv,240);
  var g=0, t=0, lockT=0, locked=false;
  var gEl=rig.querySelector('#a0g'), stEl=rig.querySelector('#a0st');

  slider.addEventListener('input',function(){
    g=slider.value/100;
    gEl.textContent=Math.round(g*100)+'%';
    if(Math.random()<0.3) api.sfx('tick');
  });

  api.onFrame(function(){
    t+=0.05;
    var x=C.x,w=C.w,h=C.h,mid=h/2;
    /* phosphor persistence: fade instead of clear for CRT afterglow */
    x.fillStyle='rgba(2,8,14,0.32)';
    x.fillRect(0,0,w,h);
    x.strokeStyle='rgba(141,227,255,0.06)';
    for(var gy=0;gy<h;gy+=24){x.beginPath();x.moveTo(0,gy);x.lineTo(w,gy);x.stroke();}
    x.beginPath();
    for(var px=0;px<=w;px+=2){
      var noise=(Math.random()-0.5)*110*(1-g*0.96);
      var carrier=Math.sin(px*0.05+t*2)*34*g + Math.sin(px*0.013-t)*12*g;
      var y=mid+noise+carrier;
      px===0?x.moveTo(px,y):x.lineTo(px,y);
    }
    x.strokeStyle='rgba(141,227,255,'+(0.45+g*0.55)+')';
    x.lineWidth=1.6; x.shadowColor='rgba(141,227,255,.8)'; x.shadowBlur=6+g*14;
    x.stroke(); x.shadowBlur=0;
    /* name resolves out of the noise */
    if(g>0.35){
      x.globalAlpha=Math.min(1,(g-0.35)/0.5);
      x.fillStyle='#fff';
      x.font='800 '+Math.min(54,w*0.075)+'px Inter, sans-serif';
      x.textAlign='center'; x.textBaseline='middle';
      x.shadowColor='rgba(141,227,255,.9)'; x.shadowBlur=28*g;
      x.fillText('SAPTARSHI NAG', w/2, mid-4);
      x.font='500 '+Math.min(15,w*0.02)+'px "JetBrains Mono", monospace';
      x.fillText('A I  /  M L   E N G I N E E R', w/2, mid+34);
      x.shadowBlur=0; x.globalAlpha=1;
    }
    if(g>0.95 && !locked){
      lockT++;
      stEl.textContent='LOCKING '+Math.min(100,Math.round(lockT/40*100))+'%';
      if(lockT>40){
        locked=true;
        stEl.textContent='CARRIER LOCKED';
        api.sfx('lock');
        api.stamp(stamps,'fa-tower-broadcast','carrier acquired — Kolkata, 2019 → present',0);
        api.stamp(stamps,'fa-hand-pointer','you operate everything from here',350);
        api.done('calibration complete — carrier locked');
      }
    } else if(g<=0.95){ lockT=0; if(!locked) stEl.textContent=g>0.5?'SIGNAL EMERGING…':'NO CARRIER'; }
  });

  if(api.reduced){
    var auto=el('button','btn ghost','auto-calibrate');
    ctl.appendChild(auto);
    auto.addEventListener('click',function(){
      slider.value=100; g=1; gEl.textContent='100%'; auto.remove();
    });
  }
}

/* =========================================================================
   ACT 1 — FOUNDATIONS (education as a compiler)
   ========================================================================= */
function act1(stage, api){
  stage.appendChild(el('div','a-head',
    '<div class="a-act">act 1 · foundations</div>'+
    '<h1 class="a-title">Compiling the engineer.</h1>'+
    '<p class="a-story">Before the signal could be found, the receiver had to be built. '+
    '<b>Link the three sources</b> and watch the build log.</p>'));

  var rig=el('div','rig');
  rig.appendChild(el('div','rig-cap','<span>buildsys — saptarshi v1.0</span><span class="st" id="a1st">3 SOURCES UNLINKED</span>'));

  var wrap=el('div','',''); wrap.style.cssText='display:flex;gap:16px;flex-wrap:wrap';
  var tray=el('div'); tray.style.cssText='flex:1;min-width:220px;display:flex;flex-direction:column;gap:9px';
  var logBox=el('div'); logBox.style.cssText='flex:1.4;min-width:260px;height:230px;overflow-y:auto;'+
    'background:rgba(2,8,14,.8);border:1px solid rgba(141,227,255,.15);border-radius:10px;'+
    "padding:12px 14px;font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.7;color:#9fd8c8";
  logBox.innerHTML='<span style="color:#5a6b7d">$ make engineer<br>waiting for sources…</span><br>';
  wrap.appendChild(tray); wrap.appendChild(logBox);
  rig.appendChild(wrap);
  stage.appendChild(rig);
  var stamps=el('div','stamps'); stage.appendChild(stamps);

  var SRC=[
    { name:'btech.c', label:'B.Tech · CSE', log:[
      'cc btech.c  — Academy of Technology, Kolkata',
      '  » 2019–2023 · CGPA <b style="color:#ffd27f">9.44/10.0</b>',
      '  » foundations: C, algorithms, systems  ✓'] },
    { name:'gate.h', label:'GATE 2024', log:[
      'linking gate.h — national aptitude header',
      '  » rank <b style="color:#ffd27f">1790</b> · Data Science &amp; AI · <b style="color:#ffd27f">top 5%</b>  ✓'] },
    { name:'mtech_ai.cu', label:'M.Tech · AI (DIAT, DRDO)', log:[
      'nvcc mtech_ai.cu — Defence Institute of Advanced Technology',
      '  » 2023–2025 · CGPA <b style="color:#ffd27f">8.64/10.0</b>',
      '  » specialised: deep learning, HPC, defence AI  ✓'] }
  ];
  var linked=0, stEl=rig.querySelector('#a1st');
  function logLines(lines,cb){
    var i=0;
    (function next(){
      if(i>=lines.length){ if(cb)cb(); return; }
      logBox.innerHTML+=lines[i]+'<br>';
      logBox.scrollTop=1e6;
      api.sfx('type'); i++;
      setTimeout(next, api.reduced?30:210);
    })();
  }
  SRC.forEach(function(s,i){
    var b=el('button','',
      '<i class="fa-solid fa-file-code" style="margin-right:9px"></i>'+s.label+
      '<span style="float:right;opacity:.55">'+s.name+'</span>');
    b.style.cssText="text-align:left;font-family:'JetBrains Mono',monospace;font-size:12px;"+
      'color:#cfe9ff;background:rgba(141,227,255,.06);border:1px solid rgba(141,227,255,.25);'+
      'border-radius:10px;padding:13px 14px;cursor:pointer;transition:.2s';
    b.addEventListener('mouseenter',function(){ api.sfx('hover'); });
    b.addEventListener('click',function(){
      if(b.disabled) return;
      b.disabled=true;
      b.style.opacity=.45; b.style.borderStyle='dashed';
      api.sfx('click');
      logLines(s.log,function(){
        linked++;
        stEl.textContent=(3-linked)+' SOURCES UNLINKED';
        if(linked===3){
          logLines(['','<b style="color:#7dffb2">BUILD SUCCEEDED</b> — engineer v1.0 ready',
            'artifact: <b style="color:#8de3ff">saptarshi</b> (portable, GPU-capable)'],function(){
            stEl.textContent='BUILD OK';
            api.sfx('success');
            api.stamp(stamps,'fa-graduation-cap','B.Tech 9.44 · Academy of Technology, Kolkata',0);
            api.stamp(stamps,'fa-award','GATE 2024 · rank 1790 · top 5%',250);
            api.stamp(stamps,'fa-shield','M.Tech AI 8.64 · DIAT (DRDO), Pune',500);
            api.done('engineer v1.0 compiled — three sources linked');
          });
        }
      });
    });
    tray.appendChild(b);
  });
}

/* =========================================================================
   ACT 2 — THE ARRAY (GMRT: parallelize the pipeline)
   ========================================================================= */
function act2(stage, api){
  stage.appendChild(el('div','a-head',
    '<div class="a-act">act 2 · the array — GMRT, winter 2023</div>'+
    '<h1 class="a-title">The telescope is drowning in its own data.</h1>'+
    '<p class="a-story">One of the world\'s largest radio telescope arrays — and its filter '+
    'pipeline runs on <b>one core</b> while three sit idle. Do what he did: '+
    '<b>spread the load.</b></p>'));

  var rig=el('div','rig');
  rig.appendChild(el('div','rig-cap','<span>gmrt · signal-filter pipeline</span><span class="st" id="a2lat">LATENCY 240 ms</span>'));
  var cv=el('canvas'); rig.appendChild(cv);
  var ctl=el('div','ctl');
  var hint=el('span','readout','tap a <b>queued task</b><br>to move it to an idle core');
  ctl.appendChild(hint);
  rig.appendChild(ctl);
  stage.appendChild(rig);
  var stamps=el('div','stamps'); stage.appendChild(stamps);

  var C=setupCanvas(cv,290);
  var latEl=rig.querySelector('#a2lat');
  /* 6 tasks all on core 0; player moves 3 highlighted movable ones */
  var cores=[[0,1,2,3,4,5],[],[],[]];
  var movable=[1,3,5], moved=0, t=0, done=false;
  var lat=240;

  function coreRects(){
    var w=C.w, cw=(w-70)/4;
    return [0,1,2,3].map(function(i){ return {x:20+i*(cw+10), y:170, w:cw, h:86, i:i}; });
  }
  function taskPos(){
    var out=[], rects=coreRects();
    cores.forEach(function(list,ci){
      list.forEach(function(id,k){
        var r=rects[ci];
        out.push({id:id, ci:ci, x:r.x+14+(k%3)*((r.w-28)/3)+((r.w-28)/6), y:r.y+24+Math.floor(k/3)*30});
      });
    });
    return out;
  }
  cv.style.cursor='pointer';
  cv.addEventListener('click',function(e){
    if(done) return;
    var rect=cv.getBoundingClientRect();
    var mx=e.clientX-rect.left, my=e.clientY-rect.top;
    var hit=taskPos().find(function(p){ return movable.indexOf(p.id)>=0 && p.ci===0 &&
      Math.abs(mx-p.x)<20 && Math.abs(my-p.y)<16; });
    if(!hit) return;
    /* move to the emptiest idle core */
    var target=1; for(var c2=2;c2<4;c2++) if(cores[c2].length<cores[target].length) target=c2;
    cores[0]=cores[0].filter(function(id){return id!==hit.id;});
    cores[target].push(hit.id);
    moved++;
    api.sfx('upshift');
    lat=240-moved*40;
    latEl.textContent='LATENCY '+lat+' ms';
    if(moved===3){
      done=true; lat=120;
      latEl.textContent='LATENCY 120 ms  (−50%)';
      api.sfx('success');
      api.stamp(stamps,'fa-satellite-dish','GMRT · NCRA-TIFR · winter intern, Dec 2023–Jan 2024',0);
      api.stamp(stamps,'fa-microchip','legacy CPU pipeline → multicore refactor',260);
      api.stamp(stamps,'fa-gauge-high','latency −50% · real-time telescope streams unblocked',520);
      api.done('pipeline parallelized — latency halved, exactly as he did');
    }
  });

  api.onFrame(function(){
    t+=0.03;
    var x=C.x,w=C.w,h=C.h;
    x.clearRect(0,0,w,h);
    /* dishes silhouette */
    for(var d=0;d<5;d++){
      var dx=40+d*(w-80)/4, dy=64, s=14;
      x.strokeStyle=done?'rgba(125,255,178,.8)':'rgba(141,227,255,.4)';
      x.lineWidth=2;
      x.beginPath(); x.arc(dx,dy,s,Math.PI*0.15,Math.PI*0.85,true); x.stroke();
      x.beginPath(); x.moveTo(dx,dy+2); x.lineTo(dx,dy+22); x.stroke();
      if(done){ x.strokeStyle='rgba(125,255,178,'+(0.4+0.3*Math.sin(t*4+d))+')';
        x.beginPath(); x.arc(dx,dy-6,s+7+3*Math.sin(t*3+d),Math.PI*0.3,Math.PI*0.7,true); x.stroke(); }
    }
    /* stream from dishes to cores */
    x.fillStyle='rgba(141,227,255,.5)';
    for(var p=0;p<14;p++){
      var pp=(t*0.7+p/14)%1;
      x.fillRect(w/2-1, 92+pp*60, 2.5, 7);
    }
    /* cores */
    var rects=coreRects();
    rects.forEach(function(r,i){
      var load=cores[i].length/6;
      x.strokeStyle=i===0&&!done?'rgba(255,92,106,.8)':'rgba(141,227,255,.35)';
      x.lineWidth=1.4;
      x.strokeRect(r.x,r.y,r.w,r.h);
      x.fillStyle='rgba(141,227,255,.08)';
      x.fillRect(r.x,r.y,r.w,r.h);
      /* load bar */
      var lb=load*(r.h-6);
      x.fillStyle=load>0.7?'rgba(255,92,106,.7)':'rgba(125,255,178,.55)';
      x.fillRect(r.x+3,r.y+r.h-3-lb,6,lb);
      x.fillStyle='rgba(234,244,251,.75)';
      x.font='600 10px "JetBrains Mono",monospace'; x.textAlign='left';
      x.fillText('CORE '+i+(cores[i].length===0?' · idle':''), r.x+16, r.y+14);
    });
    /* task chips */
    taskPos().forEach(function(p){
      var mv=movable.indexOf(p.id)>=0 && p.ci===0 && !done;
      var pulse=mv?(0.6+0.4*Math.sin(t*5)):1;
      x.fillStyle=mv?'rgba(255,210,127,'+pulse+')':'rgba(141,227,255,.7)';
      x.beginPath(); x.roundRect(p.x-18,p.y-11,36,22,5); x.fill();
      x.fillStyle='#04121c'; x.font='700 9px "JetBrains Mono",monospace'; x.textAlign='center';
      x.fillText('T'+p.id, p.x, p.y+3);
    });
    /* latency meter */
    x.fillStyle='rgba(234,244,251,.6)'; x.font='600 10px "JetBrains Mono",monospace'; x.textAlign='left';
    x.fillText('PIPELINE LATENCY', 20, 24);
    var mw=w-160;
    x.strokeStyle='rgba(141,227,255,.3)'; x.strokeRect(20,30,mw,10);
    var frac=lat/240;
    x.fillStyle=frac>0.7?'rgba(255,92,106,.8)':'rgba(125,255,178,.8)';
    x.fillRect(20,30,mw*frac,10);
    x.fillStyle='#fff'; x.textAlign='left';
    x.fillText(lat+' ms', 26+mw, 39);
  });

  if(api.reduced){
    var auto=el('button','btn ghost','auto-balance (watch)');
    rig.querySelector('.ctl').appendChild(auto);
    auto.addEventListener('click',function(){
      movable.slice().forEach(function(id,k){
        setTimeout(function(){ cv.dispatchEvent(new MouseEvent('click',{clientX:0,clientY:0})); },k*300);
      });
      /* direct move for reliability in reduced mode */
      var ids=movable.slice(); ids.forEach(function(id,k){
        setTimeout(function(){
          if(cores[0].indexOf(id)<0) return;
          cores[0]=cores[0].filter(function(q){return q!==id;});
          cores[1+k%3].push(id);
          moved++; lat=240-moved*40; latEl.textContent='LATENCY '+lat+' ms';
          if(moved===3 && !done){
            done=true; lat=120; latEl.textContent='LATENCY 120 ms  (−50%)';
            api.stamp(stamps,'fa-satellite-dish','GMRT · NCRA-TIFR · winter intern, Dec 2023–Jan 2024',0);
            api.stamp(stamps,'fa-microchip','legacy CPU pipeline → multicore refactor',200);
            api.stamp(stamps,'fa-gauge-high','latency −50% · real-time streams unblocked',400);
            api.done('pipeline parallelized — latency halved');
          }
        }, 200+k*320);
      });
      auto.remove();
    });
  }
}

/* =========================================================================
   ACT 3 — THE PULSAR HUNT (NCRA: real epoch folding)
   ========================================================================= */
function act3(stage, api){
  stage.appendChild(el('div','a-head',
    '<div class="a-act">act 3 · the pulsar hunt — NCRA-TIFR, 2024–25</div>'+
    '<h1 class="a-title">There is a dead star ticking in this noise.</h1>'+
    '<p class="a-story">Below is a real technique: <b>epoch folding</b>. A pulsar\'s pulse is '+
    'far too faint to see — unless you guess its period and stack thousands of turns on top of '+
    'each other. <b>Sweep the period. When you\'re right, the star appears.</b></p>'));

  var rig=el('div','rig');
  rig.appendChild(el('div','rig-cap','<span>fold·console — 70M-sample feed</span><span class="st" id="a3snr">FOLDED SNR 0.0</span>'));
  var cv=el('canvas'); rig.appendChild(cv);
  var ctl=el('div','ctl');
  ctl.appendChild(el('span','readout','FOLD PERIOD<br><b id="a3p">0.5000 s</b>'));
  var slider=el('input','slider'); slider.type='range';
  slider.min=5000; slider.max=10000; slider.value=5000;   /* 0.5000–1.0000 s in 0.1 ms steps */
  slider.setAttribute('aria-label','Folding period');
  ctl.appendChild(slider);
  var auto=el('button','btn ghost','let his model do it');
  ctl.appendChild(auto);
  rig.appendChild(ctl);
  stage.appendChild(rig);
  var stamps=el('div','stamps'); stage.appendChild(stamps);

  var C=setupCanvas(cv,300);
  /* synthetic observation: PHASE-BINNED. True period P0. */
  var P0=0.7168;
  var NP=120;                 /* pulses observed */
  var BIN=96;                 /* phase bins */
  /* pre-generate pulse arrival jitter/noise as per-sample stream approximated:
     we fold analytically: for trial period P, phase offset per pulse k is
     phi_k = ((k*P0) mod P)/P. Pulse profile: gaussian at phase .5, width .02. */
  var noiseSeed=[];
  for(var k=0;k<NP;k++){ noiseSeed.push([]); for(var b2=0;b2<BIN;b2++) noiseSeed[k].push((Math.random()-0.5)); }

  function fold(P){
    var prof=new Float32Array(BIN);
    for(var k2=0;k2<NP;k2++){
      var shift=((k2*P0)%P)/P;             /* where the true pulse lands in trial phase */
      for(var b3=0;b3<BIN;b3++){
        var ph=b3/BIN;
        var d=ph-shift; d-=Math.round(d);   /* wrap */
        prof[b3]+=Math.exp(-(d*d)/(2*0.03*0.03))*0.30 + noiseSeed[k2][b3];
      }
    }
    /* off-pulse SNR — the real pulsar-astronomy metric: noise estimated away from the peak */
    var mxi=0; for(var bb=1;bb<BIN;bb++) if(prof[bb]>prof[mxi]) mxi=bb;
    var off=[], mean=0;
    for(var b4=0;b4<BIN;b4++){ var dd=Math.abs(b4-mxi); dd=Math.min(dd,BIN-dd); if(dd>10) off.push(prof[b4]); }
    for(var oi=0;oi<off.length;oi++) mean+=off[oi]/off.length;
    var vr=0; for(var oj=0;oj<off.length;oj++){ var v=off[oj]-mean; vr+=v*v/off.length; }
    return { prof:prof, mean:mean, snr:(prof[mxi]-mean)/Math.sqrt(vr+1e-9) };
  }

  var P=0.5, res=fold(P), t=0, locked=false;
  var pEl=rig.querySelector('#a3p'), snrEl=rig.querySelector('#a3snr');
  var pulsarTimer=null;

  function setP(v){
    P=v; res=fold(P);
    pEl.textContent=P.toFixed(4)+' s';
    snrEl.textContent='FOLDED SNR '+res.snr.toFixed(1)+(res.snr>4?'  ▲ warmer':'');
    if(!locked && res.snr>8.0){
      locked=true;
      api.sfx('lock'); api.sfx('success');
      snrEl.textContent='PULSAR DETECTED · SNR '+res.snr.toFixed(1);
      /* let them hear it: the pulsar's actual rhythm */
      var beats=0;
      pulsarTimer=setInterval(function(){
        api.sfx('pulse'); beats++;
        if(beats>14) clearInterval(pulsarTimer);
      }, P0*1000);
      api.stamp(stamps,'fa-star','PSR-lock at 0.7168 s — you just did real epoch folding',0);
      api.stamp(stamps,'fa-brain','his ResNet1D + SE-attention did this across 70M+ samples',300);
      api.stamp(stamps,'fa-bullseye','99.8% F1 at low SNR · adaptive noise thresholds',600);
      api.stamp(stamps,'fa-user','M.Tech project · run end-to-end, alone',900);
      api.done('pulsar folded out of the noise — 99.8% F1, 70M samples');
    }
  }
  slider.addEventListener('input',function(){
    setP(slider.value/10000);
    if(Math.random()<0.4) api.sfx('static');
  });
  auto.addEventListener('click',function(){
    auto.disabled=true;
    var start=P, target=P0, i=0, steps=api.reduced?8:46;
    var iv=setInterval(function(){
      i++;
      var v=start+(target-start)*(i/steps);
      slider.value=Math.round(v*10000);
      setP(v);
      if(i>=steps) clearInterval(iv);
    }, 42);
  });

  api.onFrame(function(){
    t+=0.02;
    var x=C.x,w=C.w,h=C.h;
    x.clearRect(0,0,w,h);
    var half=h*0.52;
    /* top: phase-time waterfall of the folded stack (rows = pulse groups) */
    var rows=26, cols=BIN;
    var cw=(w-40)/cols, ch=(half-34)/rows;
    for(var r=0;r<rows;r++){
      var kk=Math.floor(r*NP/rows);
      var shift=((kk*P0)%P)/P;
      for(var c=0;c<cols;c++){
        var ph=c/cols, d=ph-shift; d-=Math.round(d);
        var sig=Math.exp(-(d*d)/(2*0.03*0.03))*0.9;
        var n=Math.abs(noiseSeed[kk][c])*0.55;
        var v=Math.min(1,n+sig*(0.35+0.65));
        var a=0.06+v*0.5;
        x.fillStyle=sig>0.25?'rgba(255,210,127,'+a+')':'rgba(141,227,255,'+(a*0.6)+')';
        x.fillRect(20+c*cw, 26+r*ch, cw+0.5, ch+0.5);
      }
    }
    x.fillStyle='rgba(234,244,251,.6)'; x.font='600 9.5px "JetBrains Mono",monospace'; x.textAlign='left';
    x.fillText('PULSE STACK  (each row = one turn of the star, folded at your period)', 20, 16);
    /* bottom: folded profile */
    var py0=half+18, ph2=h-py0-14;
    x.fillText('FOLDED PROFILE — '+NP+' pulses stacked', 20, py0-4);
    x.strokeStyle='rgba(141,227,255,.15)'; x.strokeRect(20,py0,w-40,ph2);
    x.beginPath();
    var mean=res.mean;
    for(var b6=0;b6<BIN;b6++){
      var vx=20+(b6/(BIN-1))*(w-40);
      var vv=(res.prof[b6]-mean)/ (NP*0.30);       /* scale */
      var vy=py0+ph2*0.82 - vv*ph2*2.4;
      b6===0?x.moveTo(vx,vy):x.lineTo(vx,vy);
    }
    x.strokeStyle=locked?'rgba(255,210,127,.95)':'rgba(141,227,255,.8)';
    x.lineWidth=2; x.shadowColor=locked?'rgba(255,210,127,.9)':'rgba(141,227,255,.6)';
    x.shadowBlur=locked?16:6; x.stroke(); x.shadowBlur=0;
    if(locked){
      /* starburst rings pulsing at the pulsar's own period */
      var beat=(t*0.02*50 % (P0*3))/(P0*3);
      var mxb=0; for(var mb=1;mb<BIN;mb++) if(res.prof[mb]>res.prof[mxb]) mxb=mb;
      var sx2=20+(mxb/(BIN-1))*(w-40);
      for(var ring=0;ring<3;ring++){
        var rr=((t*40+ring*30)%90);
        x.strokeStyle='rgba(255,210,127,'+Math.max(0,0.6-rr/90*0.6)+')';
        x.lineWidth=1.5;
        x.beginPath(); x.arc(sx2, py0+ph2*0.35, rr, 0, 7); x.stroke();
      }
      x.fillStyle='rgba(255,210,127,'+(0.5+0.5*Math.sin(t*8))+')';
      x.font='700 11px "JetBrains Mono",monospace'; x.textAlign='center';
      x.fillText('♥ the star\'s heartbeat — every '+P0+' s', w/2, py0+14);
    }
  });
  setP(0.5);
}

/* =========================================================================
   ACT 4 — THE INTRUSION (C-DAC: playable zero-trust incident)
   ========================================================================= */
function act4(stage, api){
  stage.appendChild(el('div','a-head',
    '<div class="a-act">act 4 · the intrusion — C-DAC, now</div>'+
    '<h1 class="a-title">Something just joined the network.</h1>'+
    '<p class="a-story">His day job: a real-time <b>Zero-Trust framework</b> watching WiFi, BLE, '+
    'Zigbee and LoRa at once. An attack is about to start. The window-model will flag it — '+
    '<b>you make the call.</b></p>'));

  var rig=el('div','rig');
  rig.appendChild(el('div','rig-cap','<span>zt·watch — 7-pillar trust engine</span><span class="st" id="a4st">ALL DEVICES TRUSTED</span>'));
  var cv=el('canvas'); rig.appendChild(cv);
  var ctl=el('div','ctl');
  var qbtn=el('button','btn warn','quarantine flagged device'); qbtn.disabled=true;
  ctl.appendChild(qbtn);
  rig.appendChild(ctl);
  stage.appendChild(rig);
  var stamps=el('div','stamps'); stage.appendChild(stamps);

  var C=setupCanvas(cv,310);
  var stEl=rig.querySelector('#a4st');
  var DEV=[
    {n:'cam-01', icon:'▣', proto:'WiFi'},{n:'lock-02', icon:'▲', proto:'BLE'},
    {n:'therm-03', icon:'●', proto:'Zigbee'},{n:'gw-04', icon:'◆', proto:'LoRa'},
    {n:'plug-05', icon:'■', proto:'WiFi'},{n:'sense-06', icon:'✚', proto:'Zigbee'}
  ];
  var trust=DEV.map(function(){return 100;});
  var t=0, phase='calm', attackAt=180, victim=0, windows=[], contained=false, failedClicks=0;

  function devPos(i){
    var a=(i/DEV.length)*Math.PI*2 - Math.PI/2;
    return { x:C.w/2+Math.cos(a)*Math.min(C.w*0.34,190), y:150+Math.sin(a)*98 };
  }
  cv.style.cursor='pointer';
  function tryQuarantine(i){
    if(phase!=='attack'||contained) return;
    if(i===victim){
      contained=true; phase='contained'; rig.classList.remove('alarm');
      api.sfx('lock'); api.sfx('success');
      stEl.textContent='THREAT CONTAINED · cam-01 ISOLATED';
      qbtn.disabled=true; qbtn.textContent='contained ✓';
      api.stamp(stamps,'fa-shield-halved','deauth-flood contained · window model p=0.97',0);
      api.stamp(stamps,'fa-crosshairs','flow/RF 96.97% acc · window ensemble 90.86% / 86.78% F1',280);
      api.stamp(stamps,'fa-network-wired','63 features from raw PCAPs · Scapy/PyShark · SMOTE+Optuna',560);
      api.stamp(stamps,'fa-key','SPIFFE/SPIRE identity · mTLS · OTP 2FA',840);
      api.stamp(stamps,'fa-book','cited: 2 papers @ IoTaIS 2025, Bali (monitoring + Zero-Trust survey)',1120);
      api.done('intrusion contained — the detector flagged, you executed');
    } else {
      failedClicks++;
      api.sfx('error');
      stEl.textContent='WRONG DEVICE — trust the flags';
    }
  }
  cv.addEventListener('click',function(e){
    var r=cv.getBoundingClientRect();
    var mx=e.clientX-r.left,my=e.clientY-r.top;
    for(var i=0;i<DEV.length;i++){
      var p=devPos(i);
      if((mx-p.x)*(mx-p.x)+(my-p.y)*(my-p.y)<34*34){ tryQuarantine(i); return; }
    }
  });
  qbtn.addEventListener('click',function(){ tryQuarantine(victim); });

  api.onFrame(function(){
    t++;
    var x=C.x,w=C.w,h=C.h;
    x.clearRect(0,0,w,h);
    var hub={x:w/2,y:150};
    if(phase==='calm'&&t>attackAt){ phase='attack'; stEl.textContent='⚠ ANOMALY — deauth storm on cam-01'; api.sfx('error'); qbtn.disabled=false; rig.classList.add('alarm'); }
    if(phase==='attack'&&!contained&&t%52===0){ api.sfx('beep'); }
    if(phase==='attack'&&!contained){ trust[victim]=Math.max(8,trust[victim]-0.35); }
    if(phase==='contained'){ trust[victim]=Math.min(100,trust[victim]+0.8); }
    /* edges + packets */
    DEV.forEach(function(d,i){
      var p=devPos(i);
      x.strokeStyle= i===victim&&phase!=='calm' ? (contained?'rgba(125,255,178,.5)':'rgba(255,92,106,.6)') : 'rgba(141,227,255,.22)';
      x.lineWidth=1.2;
      x.beginPath(); x.moveTo(hub.x,hub.y); x.lineTo(p.x,p.y); x.stroke();
      for(var pk=0;pk<3;pk++){
        var pt=((t*0.012)+pk/3+i*0.13)%1;
        var px2=hub.x+(p.x-hub.x)*pt, py2=hub.y+(p.y-hub.y)*pt;
        x.fillStyle='rgba(141,227,255,.7)';
        x.beginPath(); x.arc(px2,py2,2,0,7); x.fill();
      }
    });
    /* attacker flood */
    if(phase==='attack'&&!contained){
      var vp=devPos(victim), src={x:w-30,y:24};
      x.strokeStyle='rgba(255,92,106,.35)';
      x.beginPath(); x.moveTo(src.x,src.y); x.lineTo(vp.x,vp.y); x.stroke();
      for(var f=0;f<10;f++){
        var ft=((t*0.03)+f/10)%1;
        x.fillStyle='rgba(255,92,106,.9)';
        x.beginPath(); x.arc(src.x+(vp.x-src.x)*ft, src.y+(vp.y-src.y)*ft, 2.6,0,7); x.fill();
      }
      x.fillStyle='rgba(255,92,106,.9)'; x.font='700 10px "JetBrains Mono",monospace'; x.textAlign='right';
      x.fillText('☠ deauth ×'+(t-attackAt), src.x, src.y-8);
    }
    if(phase==='contained'){
      var vp2=devPos(victim);
      x.strokeStyle='rgba(125,255,178,.8)'; x.lineWidth=2;
      x.beginPath(); x.arc(vp2.x,vp2.y,40+2*Math.sin(t*0.1),0,7); x.stroke();
    }
    /* hub */
    x.fillStyle='rgba(141,227,255,.9)';
    x.beginPath(); x.arc(hub.x,hub.y,10,0,7); x.fill();
    x.fillStyle='rgba(234,244,251,.7)'; x.font='600 9px "JetBrains Mono",monospace'; x.textAlign='center';
    x.fillText('ZT-HUB',hub.x,hub.y-16);
    /* devices + trust rings */
    DEV.forEach(function(d,i){
      var p=devPos(i);
      var tr=trust[i], col= tr>70?'125,255,178' : tr>40?'255,210,127' : '255,92,106';
      x.strokeStyle='rgba('+col+',.9)'; x.lineWidth=3;
      x.beginPath(); x.arc(p.x,p.y,22,-Math.PI/2,-Math.PI/2+Math.PI*2*(tr/100)); x.stroke();
      x.strokeStyle='rgba(255,255,255,.1)';
      x.beginPath(); x.arc(p.x,p.y,22,0,7); x.stroke();
      x.fillStyle='rgba(10,20,32,.9)';
      x.beginPath(); x.arc(p.x,p.y,17,0,7); x.fill();
      x.fillStyle= i===victim&&phase==='attack'&&!contained ? '#ff5c6a' : '#cfe9ff';
      x.font='12px sans-serif'; x.textAlign='center'; x.textBaseline='middle';
      x.fillText(d.icon,p.x,p.y);
      x.textBaseline='alphabetic';
      x.fillStyle='rgba(234,244,251,.7)'; x.font='600 8.5px "JetBrains Mono",monospace';
      x.fillText(d.n+' · '+d.proto, p.x, p.y+36);
      x.fillText(Math.round(trust[i])+'', p.x, p.y-28);
    });
    /* 1-second window strip */
    var wy=h-38;
    x.fillStyle='rgba(234,244,251,.6)'; x.font='600 9px "JetBrains Mono",monospace'; x.textAlign='left';
    x.fillText('WINDOW MODEL — 1 s slices · 7 attack classes', 20, wy-6);
    var cells=Math.floor((w-40)/16);
    for(var cix=0;cix<cells;cix++){
      var age=cells-cix;
      var isBad = phase!=='calm' && !contained && age<((t-attackAt)/18) && age>0;
      var wasBad = contained && cix>cells-9 && cix<cells-2;
      x.fillStyle= isBad||wasBad ? 'rgba(255,92,106,.85)' : 'rgba(141,227,255,.2)';
      x.fillRect(20+cix*16, wy, 12, 14);
    }
    if(phase==='attack'&&!contained){
      x.fillStyle='rgba(255,92,106,1)'; x.textAlign='right';
      x.fillText('DEAUTH-FLOOD p=0.97 → QUARANTINE cam-01', w-20, wy-6);
    }
  });

  if(api.reduced){
    /* quarantine button already provides the non-pointer path */
    stEl.textContent='observe mode — attack begins shortly';
  }
}

/* =========================================================================
   ACT 5 — THE PIT WALL (F1 project: call the stop)
   ========================================================================= */
function act5(stage, api){
  stage.appendChild(el('div','a-head',
    '<div class="a-act">act 5 · the pit wall — his own build</div>'+
    '<h1 class="a-title">The tyres are dying. When do you box?</h1>'+
    '<p class="a-story">His physics-informed model splits degradation into <b>thermal</b> and '+
    '<b>mechanical</b> — and predicts the perfect stop. The race is live. '+
    '<b>Beat the model if you can.</b></p>'));

  var rig=el('div','rig');
  rig.appendChild(el('div','rig-cap','<span>strategy·deck — 10 Hz telemetry</span><span class="st" id="a5st">LAP 1 / 24</span>'));
  var cv=el('canvas'); rig.appendChild(cv);
  var ctl=el('div','ctl');
  var box=el('button','btn warn','█ BOX BOX BOX');
  ctl.appendChild(box);
  rig.appendChild(ctl);
  stage.appendChild(rig);
  var stamps=el('div','stamps'); stage.appendChild(stamps);

  var C=setupCanvas(cv,280);
  var stEl=rig.querySelector('#a5st');
  var LAPS=24, OPT=15;
  var lap=1, ff=0, over=false, boxed=0;
  function thermal(l){ return Math.min(1, Math.pow(l/LAPS,1.6)*1.15 ); }
  function mech(l){ return Math.min(1, l/LAPS*0.75 + (l>18?(l-18)*0.06:0) ); }
  function grip(l){ return Math.max(0, 1-(thermal(l)*0.55+mech(l)*0.45)); }
  function delta(l){ return Math.abs(l-OPT)*0.8 + (l>20?(l-20)*1.2:0); }

  function finish(){
    over=true;
    var d=delta(boxed);
    var verdict = d<0.01 ? 'PERFECT — you matched the model.' :
                  '+'+d.toFixed(1)+'s vs the model\'s lap '+OPT+' call.';
    stEl.textContent='RESULT: '+verdict;
    api.sfx(d<1?'success':'radio');
    api.stamp(stamps,'fa-flag-checkered','you boxed lap '+boxed+' · model window: laps 14–16',0);
    api.stamp(stamps,'fa-fire','PINN loss splits thermal vs mechanical wear — the curves you watched',280);
    api.stamp(stamps,'fa-bolt','custom CUDA/CuPy kernels · 4.1× training speedup',560);
    api.stamp(stamps,'fa-chart-line','hybrid LSTM-XGBoost on 10 Hz telemetry',840);
    api.done('pit call made — '+(d<1?'you matched':'the model beat you by '+d.toFixed(1)+'s'));
  }
  box.addEventListener('click',function(){
    if(over||boxed) return;
    boxed=lap;
    box.disabled=true; box.textContent='boxed lap '+lap;
    api.sfx('upshift'); api.sfx('whoosh');
    setTimeout(finish, 900);
  });
  try{ window.SFX && SFX.startEngine && SFX.startEngine(); }catch(e){}

  api.onFrame(function(){
    if(!over && !boxed){
      ff++;
      if(ff%(api.reduced?26:52)===0 && lap<LAPS){
        lap++;
        stEl.textContent='LAP '+lap+' / '+LAPS;
        try{ window.SFX && SFX.setThrottle && SFX.setThrottle(0.25+grip(lap)*0.3); }catch(e){}
        if(lap>=LAPS){ boxed=LAPS; box.disabled=true; box.textContent='tyre cliff — too late'; setTimeout(finish,700); }
      }
    }
    var x=C.x,w=C.w,h=C.h;
    x.clearRect(0,0,w,h);
    var gx=46,gy=18,gw=w-70,gh=h-64;
    /* axes */
    x.strokeStyle='rgba(141,227,255,.2)'; x.strokeRect(gx,gy,gw,gh);
    x.fillStyle='rgba(234,244,251,.5)'; x.font='600 9px "JetBrains Mono",monospace';
    x.textAlign='right'; x.fillText('100%',gx-5,gy+8); x.fillText('0%',gx-5,gy+gh);
    /* model window shading (revealed from lap 9) */
    if(lap>=9){
      var wx1=gx+((14-1)/(LAPS-1))*gw, wx2=gx+((16-1)/(LAPS-1))*gw;
      x.fillStyle='rgba(125,255,178,.12)';
      x.fillRect(wx1,gy,wx2-wx1,gh);
      x.fillStyle='rgba(125,255,178,.85)'; x.textAlign='center';
      x.fillText('PINN WINDOW',(wx1+wx2)/2,gy+12);
    }
    /* curves up to current lap */
    function curve(fn,col){
      x.beginPath();
      for(var l=1;l<=lap;l++){
        var cx2=gx+((l-1)/(LAPS-1))*gw;
        var cy2=gy+gh-fn(l)*gh;
        l===1?x.moveTo(cx2,cy2):x.lineTo(cx2,cy2);
      }
      x.strokeStyle=col;x.lineWidth=2;x.stroke();
    }
    curve(thermal,'rgba(255,92,106,.9)');
    curve(mech,'rgba(255,210,127,.9)');
    curve(grip,'rgba(141,227,255,.95)');
    /* legend */
    x.textAlign='left';
    x.fillStyle='rgba(255,92,106,.9)'; x.fillText('— thermal deg',gx+8,gy+16);
    x.fillStyle='rgba(255,210,127,.9)'; x.fillText('— mechanical deg',gx+8,gy+30);
    x.fillStyle='rgba(141,227,255,.95)'; x.fillText('— grip',gx+8,gy+44);
    /* lap cursor */
    var lx=gx+((lap-1)/(LAPS-1))*gw;
    x.strokeStyle='rgba(255,255,255,.5)';
    x.setLineDash([4,4]); x.beginPath(); x.moveTo(lx,gy); x.lineTo(lx,gy+gh); x.stroke(); x.setLineDash([]);
    /* boxed marker */
    if(boxed){
      var bx=gx+((boxed-1)/(LAPS-1))*gw;
      x.fillStyle='rgba(255,210,127,1)'; x.textAlign='center';
      x.fillText('▼ YOU',bx,gy-4);
    }
    /* grip readout */
    x.fillStyle='rgba(234,244,251,.75)'; x.font='700 12px "JetBrains Mono",monospace'; x.textAlign='left';
    x.fillText('GRIP '+Math.round(grip(lap)*100)+'%',gx,h-16);
    if(lap>=13&&lap<=17&&!boxed){
      x.fillStyle='rgba(125,255,178,'+(0.5+0.5*Math.sin(ff*0.2))+')';
      x.fillText('← model says: NOW', gx+110, h-16);
    }
  });
}

/* =========================================================================
   ACT 6 — THE ORACLE (RAG/LLM: the pipeline as an instrument)
   ========================================================================= */
function act6(stage, api){
  stage.appendChild(el('div','a-head',
    '<div class="a-act">act 6 · the oracle — three builds, one machine</div>'+
    '<h1 class="a-title">Ask the work itself.</h1>'+
    '<p class="a-story">Omniscience Pro (local RAG) retrieves, ARO\'s agents orchestrate, a '+
    '4-bit Llama answers. <b>Pick a question and watch the real pipeline run.</b> Answer two '+
    'and the oracle opens the way.</p>'));

  var rig=el('div','rig');
  rig.appendChild(el('div','rig-cap','<span>oracle — retrieval-augmented console</span><span class="st" id="a6st">0 / 2 ANSWERED</span>'));
  var wrap=el('div'); wrap.style.cssText='display:flex;gap:14px;flex-wrap:wrap';
  var left=el('div'); left.style.cssText='flex:1;min-width:200px;display:flex;flex-direction:column;gap:8px';
  var right=el('div'); right.style.cssText='flex:1.5;min-width:260px';
  var cv=el('canvas'); right.appendChild(cv);
  var out=el('div'); out.style.cssText="height:92px;overflow-y:auto;margin-top:10px;background:rgba(2,8,14,.8);"+
    "border:1px solid rgba(141,227,255,.15);border-radius:10px;padding:10px 13px;"+
    "font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.65;color:#bfe9d9";
  out.innerHTML='<span style="color:#5a6b7d">oracle idle — select a query…</span>';
  right.appendChild(out);
  wrap.appendChild(left); wrap.appendChild(right);
  rig.appendChild(wrap);
  stage.appendChild(rig);
  var stamps=el('div','stamps'); stage.appendChild(stamps);

  var C=setupCanvas(cv,170);
  var stEl=rig.querySelector('#a6st');
  var QS=[
    { q:'How fast is your retrieval?', a:'Vector search over the local index answers in <b style="color:#ffd27f">&lt;50 ms</b> (HNSW), first token in <b style="color:#ffd27f">&lt;500 ms</b> — all on consumer hardware, fully offline. <span style="color:#8de3ff">[omniscience-pro]</span>' },
    { q:'What did the adversarial audit find?', a:'A post-build red-team pass on ARO found and fixed <b style="color:#ffd27f">16 vulnerabilities</b> — auth, SSRF, input validation, CORS — with SQLAlchemy audit trails. <span style="color:#8de3ff">[aro]</span>' },
    { q:'How was Llama made to fit?', a:'Llama 3.2 (1B/3B) fine-tuned on <b style="color:#ffd27f">21.5k interactions</b>, then <b style="color:#ffd27f">4-bit quantised</b> with Unsloth — no meaningful quality drop, runs on consumer GPUs. <span style="color:#8de3ff">[llama-3.2]</span>' },
    { q:'What connects all three?', a:'One belief: <b>intelligence should run where the data lives</b> — private, local, fast. RAG retrieves, agents orchestrate (NetworkX graphs + SSE), the compressed model answers. <span style="color:#8de3ff">[all]</span>' }
  ];
  /* embedding scatter: 60 chunk dots */
  var chunks=[]; for(var i=0;i<60;i++) chunks.push({x:Math.random(),y:Math.random(),hot:0});
  var query=null, answered=0, busy=false, t=0;

  QS.forEach(function(item,qi){
    var b=el('button','', '<i class="fa-solid fa-terminal" style="margin-right:8px;opacity:.6"></i>'+item.q);
    b.style.cssText="text-align:left;font-family:'JetBrains Mono',monospace;font-size:11px;color:#cfe9ff;"+
      'background:rgba(141,227,255,.06);border:1px solid rgba(141,227,255,.25);border-radius:10px;'+
      'padding:11px 12px;cursor:pointer;transition:.2s';
    b.addEventListener('mouseenter',function(){ api.sfx('hover'); });
    b.addEventListener('click',function(){
      if(busy||b.disabled) return;
      busy=true; b.disabled=true; b.style.opacity=.45;
      api.sfx('click');
      query={x:0.15+Math.random()*0.7, y:0.15+Math.random()*0.7, born:t};
      /* mark 3 nearest chunks hot */
      var byD=chunks.map(function(c,idx){ return {idx:idx, d:(c.x-query.x)*(c.x-query.x)+(c.y-query.y)*(c.y-query.y)}; })
        .sort(function(a,b2){return a.d-b2.d;}).slice(0,3);
      out.innerHTML='<span style="color:#8de3ff">» '+item.q+'</span><br><span style="color:#5a6b7d">embedding… searching index…</span>';
      setTimeout(function(){
        byD.forEach(function(o){ chunks[o.idx].hot=1; });
        api.sfx('sonar');
        out.innerHTML+='<br><span style="color:#7dffb2">3 chunks retrieved · 43 ms (&lt;50 ms budget)</span><br>';
        var full=item.a, k=0;
        var iv=setInterval(function(){
          k+=api.reduced?24:3;
          out.innerHTML='<span style="color:#8de3ff">» '+item.q+'</span><br>'+
            '<span style="color:#7dffb2">3 chunks · 43 ms</span><br>'+full.slice(0,k);
          out.scrollTop=1e6;
          if(k%9===0) api.sfx('type');
          if(k>=full.length){
            clearInterval(iv);
            out.innerHTML='<span style="color:#8de3ff">» '+item.q+'</span><br>'+
              '<span style="color:#7dffb2">3 chunks · 43 ms</span><br>'+full;
            busy=false; answered++;
            stEl.textContent=Math.min(answered,2)+' / 2 ANSWERED';
            chunks.forEach(function(c){c.hot=0;}); query=null;
            if(answered===2){
              api.sfx('success');
              api.stamp(stamps,'fa-database','Omniscience Pro — local RAG · <50 ms search · <500 ms first token',0);
              api.stamp(stamps,'fa-diagram-project','ARO — agent graphs (NetworkX) · SSE streaming · 16 vulns fixed',280);
              api.stamp(stamps,'fa-compress','Llama 3.2 — 21.5k-example fine-tune · 4-bit Unsloth quant',560);
              api.done('the oracle answered — retrieval, agents, and a 4-bit model, all his');
            }
          }
        },18);
      }, api.reduced?200:700);
    });
    left.appendChild(b);
  });

  api.onFrame(function(){
    t+=0.016;
    var x=C.x,w=C.w,h=C.h;
    x.clearRect(0,0,w,h);
    x.fillStyle='rgba(234,244,251,.5)'; x.font='600 9px "JetBrains Mono",monospace'; x.textAlign='left';
    x.fillText('EMBEDDING SPACE — 60 chunks · cosine neighbourhood',8,12);
    chunks.forEach(function(c){
      var cx2=14+c.x*(w-28), cy2=24+c.y*(h-38);
      if(c.hot){
        x.fillStyle='rgba(255,210,127,.95)';
        x.beginPath(); x.arc(cx2,cy2,4.5+Math.sin(t*8)*1.4,0,7); x.fill();
        if(query){
          var qx=14+query.x*(w-28), qy=24+query.y*(h-38);
          x.strokeStyle='rgba(255,210,127,.5)';
          x.beginPath(); x.moveTo(qx,qy); x.lineTo(cx2,cy2); x.stroke();
        }
      } else {
        x.fillStyle='rgba(141,227,255,.4)';
        x.beginPath(); x.arc(cx2,cy2,2.2,0,7); x.fill();
      }
    });
    if(query){
      var qx2=14+query.x*(w-28), qy2=24+query.y*(h-38);
      x.fillStyle='rgba(255,255,255,.95)';
      x.beginPath(); x.arc(qx2,qy2,5,0,7); x.fill();
      x.strokeStyle='rgba(255,255,255,.4)';
      x.beginPath(); x.arc(qx2,qy2,10+5*Math.sin(t*5),0,7); x.stroke();
    }
  });
}

/* =========================================================================
   ACT 7 — TRANSMISSION (mission report + contact)
   ========================================================================= */
function act7(stage, api){
  stage.appendChild(el('div','a-head',
    '<div class="a-act">act 7 · transmission</div>'+
    '<h1 class="a-title">Signal strength: 100%.</h1>'+
    '<p class="a-story">You didn\'t read a résumé tonight. <b>You ran one.</b> '+
    'Here is your mission report — and the frequency to reach the man himself.</p>'));

  var rig=el('div','rig');
  rig.appendChild(el('div','rig-cap','<span>mission report — operator: you</span><span class="st">TX READY</span>'));
  var rep=el('div','report');
  var LINES=[
    '<span class="c">▸</span> you <b>calibrated the carrier</b> — Kolkata 2019 → present',
    '<span class="c">▸</span> you <b>compiled the engineer</b> — B.Tech <span class="y">9.44</span> · GATE <span class="y">top 5%</span> · M.Tech AI @ DIAT (DRDO) <span class="y">8.64</span>',
    '<span class="c">▸</span> you <b>parallelized a radio telescope</b> — GMRT latency <span class="y">−50%</span>, real-time unblocked',
    '<span class="c">▸</span> you <b>folded a pulsar out of noise</b> — his model: <span class="y">99.8% F1</span> across <span class="y">70M+ samples</span> (NCRA-TIFR)',
    '<span class="c">▸</span> you <b>contained a live intrusion</b> — Zero-Trust @ C-DAC · <span class="y">96.97%</span> detection · 63 PCAP features · 2× IoTaIS\'25',
    '<span class="c">▸</span> you <b>called a pit stop against a PINN</b> — thermal/mechanical split · <span class="y">4.1×</span> CUDA speedup',
    '<span class="c">▸</span> you <b>queried the oracle</b> — local RAG <span class="y">&lt;50 ms</span> · agent graphs · 4-bit Llama',
    '<span class="c">▸</span> conclusion: <b>one operator behind all of it — Saptarshi Nag, AI/ML Engineer.</b>'
  ];
  LINES.forEach(function(l){ rep.appendChild(el('div','rline',l)); });
  rig.appendChild(rep);
  var links=el('div','tx-links',
    '<a href="mailto:saptarshinag18@gmail.com"><i class="fa-solid fa-envelope"></i>saptarshinag18@gmail.com</a>'+
    '<a href="https://www.linkedin.com/in/saptarshi18" target="_blank" rel="noopener"><i class="fa-brands fa-linkedin"></i>/in/saptarshi18</a>'+
    '<a href="https://github.com/Saptarshi-Nag189" target="_blank" rel="noopener"><i class="fa-brands fa-github"></i>Saptarshi-Nag189</a>'+
    '<a href="../saptarshi_resume_linkedin_2026.pdf" target="_blank" rel="noopener"><i class="fa-solid fa-file-arrow-down"></i>the flat version (CV)</a>'+
    '<a href="#" id="replay"><i class="fa-solid fa-rotate-left"></i>run it again</a>');
  rig.appendChild(links);
  stage.appendChild(rig);

  links.querySelector('#replay').addEventListener('click',function(e){
    e.preventDefault(); location.reload();
  });

  var lines=rep.querySelectorAll('.rline');
  lines.forEach(function(l,i){
    setTimeout(function(){ l.classList.add('on'); api.sfx(i===lines.length-1?'success':'tick'); },
      api.reduced? 60*i : 420*i);
  });
  setTimeout(function(){ api.sfx('chime'); api.done('transmission complete — over to you'); },
    api.reduced? 600 : 420*LINES.length+400);
}

window.ACTS=[
  { id:'calibration', title:'Calibration', build:act0 },
  { id:'foundations', title:'Foundations', build:act1 },
  { id:'array',       title:'The Array',   build:act2 },
  { id:'pulsar',      title:'Pulsar Hunt', build:act3 },
  { id:'intrusion',   title:'Intrusion',   build:act4 },
  { id:'pitwall',     title:'Pit Wall',    build:act5 },
  { id:'oracle',      title:'Oracle',      build:act6 },
  { id:'transmission',title:'Transmission',build:act7 }
];
})();
