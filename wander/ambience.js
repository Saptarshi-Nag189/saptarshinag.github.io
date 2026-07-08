/* ==========================================================================
   ambience.js — real-recording ambience player with synth fallback.
   Drop audio files into wander/audio/ (see audio/README.md for the list).
   For each biome it tries audio/<id>.ogg then audio/<id>.mp3; if neither
   exists, it calls the synth fallback so the world is never silent.
   Obeys the shared mute button (localStorage 'exp-sfx-muted').
   ========================================================================== */
export function createAmbience(synthFallback, stopSynth){
  const TRACKS={};              /* id -> {el,ok} */
  let current=null, fadeTimer=null, muted=localStorage.getItem('exp-sfx-muted')==='1';
  const VOL={ glade:0.5, forest:0.55, river:0.65, desert:0.5, snow:0.45,
              sky:0.55, city:0.5, meadow:0.55, rain:0.7 };

  setInterval(()=>{ /* follow the shared mute button */
    const m=localStorage.getItem('exp-sfx-muted')==='1';
    if(m!==muted){ muted=m;
      Object.values(TRACKS).forEach(t=>{ if(t.el && !t.el.paused) t.el.volume=m?0:(t.target||0.5); });
      if(m) stopSynth && stopSynth();
    }
  },800);

  function load(id){
    if(TRACKS[id]) return TRACKS[id];
    const t={el:null, ok:null, target:VOL[id]||0.5};
    TRACKS[id]=t;
    const tryExt=exts=>{
      if(!exts.length){ t.ok=false; return; }
      const el=new Audio('audio/'+id+'.'+exts[0]);
      el.loop=true; el.preload='auto'; el.volume=0;
      el.addEventListener('canplaythrough',()=>{ if(t.ok===null){ t.ok=true; t.el=el; } },{once:true});
      el.addEventListener('error',()=>{ if(t.ok===null) tryExt(exts.slice(1)); },{once:true});
    };
    tryExt(['ogg','mp3']);
    return t;
  }

  function fadeTo(el,target,ms){
    const step=(target-el.volume)/(ms/50);
    clearInterval(el._fade);
    el._fade=setInterval(()=>{
      el.volume=Math.max(0,Math.min(1,el.volume+step));
      if((step>0&&el.volume>=target)||(step<0&&el.volume<=Math.max(0,target))){
        el.volume=Math.max(0,target); clearInterval(el._fade);
        if(target===0) el.pause();
      }
    },50);
  }

  function stopCurrent(){
    if(current && current.el && !current.el.paused) fadeTo(current.el,0,900);
    current=null;
  }

  return {
    play(id){
      stopSynth && stopSynth();
      stopCurrent();
      const t=load(id);
      clearTimeout(fadeTimer);
      const attempt=tries=>{
        if(t.ok===true){
          current=t;
          stopSynth && stopSynth();
          t.el.volume=0;
          t.el.play().then(()=>fadeTo(t.el, muted?0:t.target, 1400))
                     .catch(()=>{ synthFallback && synthFallback(id); });
        } else if(t.ok===false){
          synthFallback && synthFallback(id);      /* no file — the synth world sings */
        } else if(tries>0){
          fadeTimer=setTimeout(()=>attempt(tries-1),300);  /* still probing the file */
        } else synthFallback && synthFallback(id);
      };
      attempt(8);
    },
    stop(){ stopCurrent(); stopSynth && stopSynth(); }
  };
}
