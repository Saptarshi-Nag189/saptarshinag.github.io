/* ==========================================================================
   THE SIGNAL — app.js  (act sequencer, rail, managed rAF, log, score)
   ========================================================================== */
(function(){
'use strict';
var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
try{ window.SFX && SFX.init({ accent:'#8de3ff', ambient:true, ambientFreq:55 }); }catch(e){}

/* ---------- starfield backdrop ---------- */
(function(){
  var cv=document.getElementById('stars'), x=cv.getContext('2d');
  var W,H,DPR=Math.min(devicePixelRatio||1,2),ss=[];
  function rs(){ W=innerWidth;H=innerHeight;
    cv.width=W*DPR;cv.height=H*DPR;cv.style.width=W+'px';cv.style.height=H+'px';
    x.setTransform(DPR,0,0,DPR,0,0);
    ss=[]; for(var i=0;i<130;i++) ss.push({x:Math.random(),y:Math.random(),a:0.1+Math.random()*0.5,p:Math.random()*7,r:Math.random()<0.1?1.5:1});
  }
  rs(); addEventListener('resize',rs);
  var t=0;
  (function loop(){
    requestAnimationFrame(loop);
    if(document.hidden) return;
    t+=0.016;
    x.clearRect(0,0,W,H);
    var g=x.createRadialGradient(W/2,H*0.4,50,W/2,H*0.4,H);
    g.addColorStop(0,'rgba(10,26,44,.55)'); g.addColorStop(1,'rgba(1,5,12,0)');
    x.fillStyle=g; x.fillRect(0,0,W,H);
    for(var i=0;i<ss.length;i++){ var s=ss[i];
      x.globalAlpha=s.a*(REDUCED?1:(0.65+0.35*Math.sin(t*1.3+s.p)));
      x.fillStyle='#cfe4ff'; x.fillRect(s.x*W,s.y*H,s.r,s.r);
    }
    x.globalAlpha=1;
  })();
})();

/* ---------- sequencer ---------- */
var stageEl=document.getElementById('stage');
var railEl=document.getElementById('rail');
var toastEl=document.getElementById('logToast');
var skipBtn=document.getElementById('skip');
var ACTS=window.ACTS||[];
var cur=-1, curSection=null, frameFns=[], missionLog=[];

/* rail */
ACTS.forEach(function(a,i){
  var d=document.createElement('div');
  d.className='rnode'; d.title=a.title;
  railEl.appendChild(d);
});
var pctEl=document.createElement('div');
pctEl.id='railPct'; pctEl.textContent='0%';
railEl.appendChild(pctEl);
function paintRail(){
  [].slice.call(railEl.querySelectorAll('.rnode')).forEach(function(d,i){
    d.classList.toggle('done', i<cur || (i===cur && actDone));
    d.classList.toggle('now', i===cur && !actDone);
  });
  var doneCount=cur+(actDone?1:0);
  pctEl.textContent=Math.round(doneCount/ACTS.length*100)+'%';
}

/* managed rAF: acts register, we clean on transition */
(function loop(){
  requestAnimationFrame(loop);
  if(document.hidden) return;
  for(var i=0;i<frameFns.length;i++){ try{ frameFns[i](); }catch(e){} }
})();

function toast(msg){
  var d=document.createElement('div');
  d.className='logline';
  d.innerHTML='<i class="fa-solid fa-check" style="margin-right:6px"></i>'+msg;
  toastEl.appendChild(d);
  requestAnimationFrame(function(){ d.classList.add('on'); });
  setTimeout(function(){ d.classList.remove('on'); setTimeout(function(){ d.remove(); },500); }, 5200);
}

var actDone=false, nextBtn=null;
function makeApi(section){
  return {
    reduced: REDUCED,
    el: function(t,c,h){ var e=document.createElement(t); if(c)e.className=c; if(h!=null)e.innerHTML=h; return e; },
    sfx: function(n){ try{ window.SFX && SFX.play(n); }catch(e){} },
    onFrame: function(fn){ frameFns.push(fn); },
    stamp: function(host,icon,text,delay){
      var s=document.createElement('span');
      s.className='stamp';
      s.innerHTML='<i class="fa-solid '+icon+'"></i>'+text;
      host.appendChild(s);
      setTimeout(function(){ s.classList.add('on');
        try{ window.SFX && SFX.play('coin'); }catch(e){} }, (delay||0)+(REDUCED?0:120));
    },
    done: function(logLine){
      if(actDone) return;
      actDone=true;
      missionLog.push(logLine);
      toast(logLine);
      paintRail();
      if(cur<ACTS.length-1){
        nextBtn=document.createElement('button');
        nextBtn.className='btn';
        nextBtn.style.cssText='margin-top:20px';
        nextBtn.innerHTML='continue <i class="fa-solid fa-angles-right" style="margin-left:8px"></i>';
        nextBtn.addEventListener('click',function(){ go(cur+1); });
        section.appendChild(nextBtn);
        nextBtn.focus({preventScroll:true});
      }
    }
  };
}

function go(i){
  if(i>=ACTS.length) return;
  try{ window.SFX && SFX.play('whoosh'); }catch(e){}
  /* retire old */
  frameFns=[];
  actDone=false; nextBtn=null;
  var old=curSection;
  if(old){
    old.classList.add('bye'); old.classList.remove('live');
    setTimeout(function(){ old.remove(); }, 750);
  }
  cur=i;
  var section=document.createElement('section');
  section.className='act';
  stageEl.appendChild(section);
  curSection=section;
  var api=makeApi(section);
  try{
    ACTS[i].build(section, api);
  }catch(e){
    /* an act must never hard-kill the journey */
    section.appendChild(api.el('p','a-story','this instrument failed to boot ('+e.message+') — skipping ahead.'));
    api.done(ACTS[i].title+' skipped (boot failure)');
  }
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ section.classList.add('live'); }); });
  skipBtn.style.display = i===ACTS.length-1 ? 'none' : '';
  paintRail();
}

skipBtn.addEventListener('click',function(){
  if(cur>=ACTS.length-1) return;
  missionLog.push(ACTS[cur].title+' — skipped');
  go(cur+1);
});
addEventListener('keydown',function(e){
  if(e.key==='Enter' && actDone && nextBtn){ nextBtn.click(); }
});

window.__signal=function(){ return { act:cur, done:actDone, total:ACTS.length, log:missionLog.slice() }; };
go(0);
})();
