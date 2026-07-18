/* ==========================================================================
   THE WANDER — game.js  (engine + overworld)
   One spline through seven biomes. A cloaked wanderer walks, sails, flies.
   Everything lerps — nothing cuts. Domains live in domains.js.
   ========================================================================== */
import * as THREE from './lib/three.module.js';
import { FAIRY } from './twin-data.js';
import { initDomains } from './domains.js';
import { createAmbience } from './ambience.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sfx = n => { try{ window.SFX && SFX.play(n); }catch(e){} };
try{ window.SFX && SFX.init({ accent:'#ff9ecb', ambient:false }); }catch(e){}

/* ---------------- renderer / scene ---------------- */
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffd9ec, 40, 170);
const camera = new THREE.PerspectiveCamera(58, innerWidth/innerHeight, 0.1, 600);

const hemi = new THREE.HemisphereLight(0xfff2fa, 0xd7b8ff, 1.15); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 1.6); sun.position.set(40, 70, 20); scene.add(sun);

/* ---------------- the path ---------------- */
/* biome ranges over t 0..1 */
export const BIOMES = [
  { id:'glade',  t0:0.00, t1:0.075, name:'Dawn Glade',        subtitle:'where it begins',
    sky:0xffd9ec, fog:0xffd9ec, ground:0xa8e6b8, far:170 },
  { id:'forest', t0:0.075,t1:0.235, name:'Grove of Foundations', subtitle:'education',
    sky:0xcfeecf, fog:0xd8f2d8, ground:0x8fd89a, far:150 },
  { id:'river',  t0:0.235,t1:0.40,  name:'The Listening River', subtitle:'research years · GMRT & NCRA',
    sky:0xbfeef2, fog:0xc9f0f2, ground:0x9adfc9, far:170 },
  { id:'desert', t0:0.40, t1:0.535, name:'Oasis of Craft',     subtitle:'skills',
    sky:0xffe2b8, fog:0xffe6c2, ground:0xf2cf9a, far:190 },
  { id:'snow',   t0:0.535,t1:0.625, name:'The Quiet Archive',  subtitle:'publications',
    sky:0xe6e9ff, fog:0xeceeff, ground:0xf4f4ff, far:150 },
  { id:'sky',    t0:0.625,t1:0.845, name:"The Dreamer's Sky",  subtitle:'about him · fly',
    sky:0xffc9d9, fog:0xffd4e2, ground:0xffffff, far:260 },
  { id:'city',   t0:0.845,t1:0.945, name:'The Atelier',        subtitle:'projects & c-dac',
    sky:0x141126, fog:0x1c1733, ground:0x181430, far:180 },
  { id:'meadow', t0:0.945,t1:1.00,  name:"Journey's End",      subtitle:'contact',
    sky:0x3d4e78, fog:0x46578a, ground:0x4f7a5e, far:150 }
];

const PTS = [
  [0,2,0],[24,2,-8],[46,2,6],[70,2.5,-10],           /* glade → forest winding */
  [96,3,4],[120,2,14],[142,1,2],
  [164,0.4,-12],[188,0.4,-4],[212,0.4,10],[234,0.4,2],/* river at water level  */
  [258,3,-10],[282,6,-2],[306,5,10],[328,7,0],        /* desert climbs dunes    */
  [350,10,-10],[372,13,-2],[394,12,8],                /* snow high路            */
  [416,18,0],[436,30,-10],[456,44,4],[476,56,-6],[496,62,4], /* ascend to sky   */
  [520,66,-10],[544,58,8],[566,64,-4],[588,54,6],[608,60,-8], /* long sky drift  */
  [630,38,-4],[648,18,6],[664,7,-5],[680,4,2],        /* glide lands BEFORE the city */
  [700,3.5,-5],[720,3,3],[746,3,0]                    /* flat city → meadow (night)  */
];
const curve = new THREE.CatmullRomCurve3(PTS.map(p=>new THREE.Vector3(p[0],p[1],p[2])), false, 'catmullrom', 0.5);
const CURVE_LEN = curve.getLength();

const RIVER_B=BIOMES.find(b=>b.id==='river');
const BOARD_T=RIVER_B.t0+0.012, ALIGHT_T=RIVER_B.t1-0.012;   /* the sailed stretch */

export function biomeAt(t){
  for(const b of BIOMES) if(t>=b.t0 && t<=b.t1) return b;
  return BIOMES[BIOMES.length-1];
}
/* smooth palette sample: blend biome colours near boundaries (no jitter) */
const _cA=new THREE.Color(), _cB=new THREE.Color();
function blendAttr(t, attr){
  const b = biomeAt(t);
  const i = BIOMES.indexOf(b);
  const BLEND = 0.028;
  _cA.set(b[attr]);
  if(i<BIOMES.length-1 && b.t1-t < BLEND){
    _cB.set(BIOMES[i+1][attr]);
    _cA.lerp(_cB, 1-(b.t1-t)/BLEND*0.5-0.5+0.5); /* 0→0.5 into boundary */
    _cA.lerp(_cB, 0); /* noop guard */
    const k=(1-(b.t1-t)/BLEND)*0.5; _cA.set(b[attr]).lerp(_cB,k);
  } else if(i>0 && t-b.t0 < BLEND){
    _cB.set(BIOMES[i-1][attr]);
    const k=(1-(t-b.t0)/BLEND)*0.5; _cA.set(b[attr]).lerp(_cB,k);
  }
  return _cA;
}

/* ---------------- terrain ribbon ---------------- */
(function buildRibbon(){
  const SEG=560, W=30;
  const pos=[], col=[], idx=[];
  const p=new THREE.Vector3(), tan=new THREE.Vector3(), nrm=new THREE.Vector3(), up=new THREE.Vector3(0,1,0);
  for(let i=0;i<=SEG;i++){
    const t=i/SEG;
    curve.getPointAt(t,p); curve.getTangentAt(t,tan);
    nrm.crossVectors(tan,up).normalize();
    const c = blendAttr(t,'ground').clone();
    for(const s of [-1,1]){
      pos.push(p.x+nrm.x*W/2*s, p.y-0.55, p.z+nrm.z*W/2*s);
      col.push(c.r,c.g,c.b);
    }
    /* no road faces in the sky (you fly) or on the sailed river stretch (you boat) */
    const mid=(i+0.5)/SEG;
    const sail = mid>BOARD_T+0.004 && mid<ALIGHT_T-0.004;
    if(i<SEG && !sail && biomeAt(i/SEG).id!=='sky' && biomeAt((i+1)/SEG).id!=='sky'){
      const a=i*2; idx.push(a,a+1,a+2, a+1,a+3,a+2);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col,3));
  g.setIndex(idx); g.computeVertexNormals();
  const m=new THREE.MeshLambertMaterial({ vertexColors:true });
  scene.add(new THREE.Mesh(g,m));
  /* cliff skirts: drop both edges to the ground so elevated stretches read as a plateau */
  const sp=[], scol=[], sidx=[];
  for(let i=0;i<=SEG;i++){
    const bi=i*6;
    for(const off of [0,3]){                 /* left edge vtx, right edge vtx */
      const x=pos[bi+off], y=pos[bi+off+1], z=pos[bi+off+2];
      const cr=col[bi+off]*0.72, cg=col[bi+off+1]*0.72, cb=col[bi+off+2]*0.72;
      sp.push(x,y,z, x,-1.9,z);
      scol.push(cr,cg,cb, cr*0.8,cg*0.8,cb*0.8);
    }
    const smid=(i+0.5)/SEG;
    const ssail = smid>BOARD_T+0.004 && smid<ALIGHT_T-0.004;
    if(i<SEG && !ssail && biomeAt(i/SEG).id!=='sky' && biomeAt((i+1)/SEG).id!=='sky'){
      const a=i*4;
      sidx.push(a,a+1,a+4, a+1,a+5,a+4);      /* left wall  */
      sidx.push(a+2,a+6,a+3, a+3,a+6,a+7);    /* right wall */
    }
  }
  const sg=new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp,3));
  sg.setAttribute('color', new THREE.Float32BufferAttribute(scol,3));
  sg.setIndex(sidx); sg.computeVertexNormals();
  scene.add(new THREE.Mesh(sg,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide})));
})();

/* wide ground ribbon for horizon fill — follows the path, blends colours at
   boundaries exactly like the road, so biomes can never bleed into each other */
(function groundRibbon(){
  const SEG=200, W=380;
  const pos=[], col=[], idx=[];
  const p=new THREE.Vector3(), tan=new THREE.Vector3(), nrm=new THREE.Vector3(), up=new THREE.Vector3(0,1,0);
  for(let i=0;i<=SEG;i++){
    const t=i/SEG;
    curve.getPointAt(t,p); curve.getTangentAt(t,tan);
    nrm.crossVectors(tan,up).normalize();
    const c=blendAttr(t,'ground').clone().multiplyScalar(0.93);
    for(const s of [-1,1]){
      pos.push(p.x+nrm.x*W/2*s, -0.85 - t*0.6, p.z+nrm.z*W/2*s);
      col.push(c.r,c.g,c.b);
    }
    if(i<SEG && biomeAt(i/SEG).id!=='sky' && biomeAt((i+1)/SEG).id!=='sky'){
      const a=i*2; idx.push(a,a+1,a+2, a+1,a+3,a+2);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col,3));
  g.setIndex(idx); g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true}));
  mesh.updateMatrix(); mesh.matrixAutoUpdate=false;
  scene.add(mesh);
})();

/* ---------------- water: a ribbon along the river's own curve ----------------
   level (y=-0.35) everywhere, tapered ends — it can never climb into a shore */
let waterMesh=null;
(function water(){
  const SEG=90, W=64;
  const t0=RIVER_B.t0-0.002, t1=RIVER_B.t1+0.002;
  const pos=[], idx=[];
  const p=new THREE.Vector3(), tan=new THREE.Vector3(), nrm=new THREE.Vector3(), up=new THREE.Vector3(0,1,0);
  for(let i=0;i<=SEG;i++){
    const k=i/SEG, t=t0+(t1-t0)*k;
    curve.getPointAt(t,p); curve.getTangentAt(t,tan);
    nrm.crossVectors(tan,up).normalize();
    const taper=Math.min(1, Math.min(k,1-k)*10);       /* soft narrowing ends */
    const w=W/2*(0.2+0.8*taper);
    for(const sd of [-1,1]) pos.push(p.x+nrm.x*w*sd, -0.35, p.z+nrm.z*w*sd);
    if(i<SEG){ const a=i*2; idx.push(a,a+1,a+2, a+1,a+3,a+2); }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setIndex(idx); g.computeVertexNormals();
  waterMesh=new THREE.Mesh(g,new THREE.MeshLambertMaterial({color:0x6fd8e8,transparent:true,opacity:0.82}));
  scene.add(waterMesh);
})();

/* ---------------- props ---------------- */
const rand=(a,b)=>a+Math.random()*(b-a);
/* per-biome prop groups: anything beyond the fog window is culled wholesale */
const biomeGroups={};
BIOMES.forEach(b=>{ const g=new THREE.Group(); g.userData={t0:b.t0,t1:b.t1}; biomeGroups[b.id]=g; scene.add(g); });
function groupFor(t){ return biomeGroups[biomeAt(t).id]; }
function freeze(o){ o.traverse(n=>{ n.updateMatrix(); n.matrixAutoUpdate=false; }); }
/* dense path sampling so no prop can sit on ANY bend of the road */
const PATH_SAMPLES=(function(){ const arr=[]; const v=new THREE.Vector3();
  for(let i=0;i<=700;i++){ curve.getPointAt(i/700,v); arr.push(v.x,v.z); } return arr; })();
function clearOfPath(x,z,min){
  const m2=min*min;
  for(let i=0;i<PATH_SAMPLES.length;i+=2){
    const dx=x-PATH_SAMPLES[i], dz=z-PATH_SAMPLES[i+1];
    if(dx*dx+dz*dz<m2) return false;
  }
  return true;
}
function scatter(t0,t1,count,builder){
  const p=new THREE.Vector3(), tan=new THREE.Vector3(), nrm=new THREE.Vector3(), up=new THREE.Vector3(0,1,0);
  for(let i=0;i<count;i++){
    let placed=false;
    for(let tries=0;tries<14 && !placed;tries++){
      const t=rand(t0,t1);
      curve.getPointAt(t,p); curve.getTangentAt(t,tan);
      nrm.crossVectors(tan,up).normalize();
      const side=Math.random()<0.5?-1:1, d=rand(13.5,28)*side;
      const x=p.x+nrm.x*d, z=p.z+nrm.z*d;
      if(!clearOfPath(x,z,9)) continue;
      const o=builder(i);
      /* near the road: stand on the plateau ledge; farther out: on the ground plane */
      const base = Math.abs(d)<15.5 ? p.y-0.55 : -0.55;
      o.position.set(x, base + (o.userData.dy||0), z);
      o.rotation.y=Math.random()*Math.PI*2;
      scene.add(o); placed=true;
    }
  }
}
/* geometry+material pools: one GPU buffer per prop KIND, variety via per-prop
   transforms and a few size variants — visually equivalent, ~10x fewer buffers */
const GP={
  trunk:new THREE.CylinderGeometry(0.26,0.34,2.1,6),
  crowns:[new THREE.IcosahedronGeometry(1.25,0),new THREE.IcosahedronGeometry(1.7,0),new THREE.IcosahedronGeometry(2.15,0)],
  cone:new THREE.ConeGeometry(1,1,7),
  coneSharp:new THREE.ConeGeometry(1,1,5),
  sphere:new THREE.SphereGeometry(1,8,6),
  ico:new THREE.IcosahedronGeometry(1,0),
  capsule:new THREE.CapsuleGeometry(0.3,1.5,4,8),
  capsuleArm:new THREE.CapsuleGeometry(0.18,0.7,4,8),
  box:new THREE.BoxGeometry(1,1,1),
  cyl:new THREE.CylinderGeometry(1,1,1,6)
};
const _matCache={};
function ML(color,opts){
  const key=color+'|'+JSON.stringify(opts||{});
  if(!_matCache[key]) _matCache[key]=new THREE.MeshLambertMaterial(Object.assign({color},opts||{}));
  return _matCache[key];
}
function MB(color){
  const key='B'+color;
  if(!_matCache[key]) _matCache[key]=new THREE.MeshBasicMaterial({color});
  return _matCache[key];
}
function tree(c1,c2){
  const g=new THREE.Group();
  const tr=new THREE.Mesh(GP.trunk, ML(0xb08a6a));
  tr.position.y=1.05; g.add(tr);
  const crown=new THREE.Mesh(GP.crowns[Math.floor(Math.random()*3)],
    ML(Math.random()<0.34?c2:c1,{flatShading:true}));
  crown.position.y=3.0; g.add(crown);
  g.scale.setScalar(rand(0.85,1.55));
  return g;
}
const gladeT=BIOMES[0], forestT=BIOMES[1], riverT=BIOMES[2], desertT=BIOMES[3],
      snowT=BIOMES[4], skyT=BIOMES[5], cityT=BIOMES[6], meadowT=BIOMES[7];
scatter(gladeT.t0,gladeT.t1,40,()=>tree(0x8fd89a,0xffb0cf));
scatter(forestT.t0,forestT.t1,155,()=>tree(0x6fca7f,0xff9ecb));
scatter(riverT.t0,riverT.t1,34,()=>{ /* reeds + stones */
  if(Math.random()<0.5){
    const r=new THREE.Mesh(GP.coneSharp, ML(0x7fcf9f));
    const h=rand(1,1.9); r.scale.set(0.09,h,0.09); r.position.y=h/2;
    const g=new THREE.Group(); g.add(r); return g;
  }
  const st=new THREE.Mesh(GP.ico, ML(0xcfd8dc,{flatShading:true}));
  st.scale.setScalar(rand(0.4,1)); return st;
});
scatter(desertT.t0,desertT.t1,85,()=>{
  if(Math.random()<0.55){ /* cactus */
    const g=new THREE.Group();
    const m=new THREE.MeshLambertMaterial({color:0x7fbf7f});
    const b1=new THREE.Mesh(new THREE.CapsuleGeometry(0.3,rand(1,2),4,8),m); b1.position.y=1; g.add(b1);
    const arm=new THREE.Mesh(new THREE.CapsuleGeometry(0.18,0.7,4,8),m);
    arm.position.set(0.45,1.3,0); arm.rotation.z=-0.7; g.add(arm);
    return g;
  }
  const dune=new THREE.Mesh(new THREE.SphereGeometry(rand(2,5),8,6), new THREE.MeshLambertMaterial({color:0xf2d4a0}));
  dune.scale.y=0.28; dune.userData.dy=-0.3; return dune;
});
scatter(snowT.t0,snowT.t1,95,()=>{
  const g=new THREE.Group();
  /* snowy mound so no tree ever floats */
  const drift=new THREE.Mesh(GP.sphere, ML(0xf7f9ff));
  const dr=rand(1.8,3); drift.scale.set(dr,dr*0.45,dr); drift.position.y=0.1; g.add(drift);
  const c=new THREE.Mesh(GP.cone, ML(Math.random()<0.4?0xdfe8f4:0xa8d8c8,{flatShading:true}));
  const cw=rand(0.7,1.4), chh=rand(2,3.6);
  c.scale.set(cw,chh,cw); c.position.y=0.1+chh/2+0.3; g.add(c);
  const cap=new THREE.Mesh(GP.cone, ML(0xffffff));
  cap.scale.set(0.5,0.8,0.5); cap.position.y=0.1+chh+0.3; g.add(cap);
  return g;
});
/* sky islands + clouds */
(function skyProps(){
  const p=new THREE.Vector3();
  for(let i=0;i<62;i++){
    const t=rand(skyT.t0,skyT.t1);
    curve.getPointAt(t,p);
    const cl=new THREE.Mesh(GP.sphere, ML(0xffffff,{transparent:true,opacity:0.85}));
    const cr=rand(2.5,7); cl.scale.set(cr,cr*0.42,cr);
    cl.position.set(p.x+rand(-40,40), p.y+rand(-16,10), p.z+rand(-40,40));
    biomeGroups.sky.add(cl); freeze(cl);
  }
  for(let i=0;i<6;i++){
    const t=rand(skyT.t0+0.02,skyT.t1-0.02);
    curve.getPointAt(t,p);
    const isle=new THREE.Group();
    const top=new THREE.Mesh(new THREE.CylinderGeometry(rand(3,5),1.2,2.4,7),
      ML(0x9fd8a8,{flatShading:true}));
    isle.add(top);
    const t2=tree(0x8fd89a,0xffb0cf); t2.position.y=1.2; isle.add(t2);
    isle.position.set(p.x+rand(-26,26), p.y+rand(-10,8), p.z+rand(-26,26));
    biomeGroups.sky.add(isle); freeze(isle);
  }
})();
/* sky life: bird flocks + the manta (Sky:CotL homage) */
const skyLife={flocks:[],manta:null};
(function skyCreatures(){
  const center=curve.getPointAt((skyT.t0+skyT.t1)/2);
  for(let f=0;f<3;f++){
    const flock={birds:[],cx:center.x+rand(-90,90),cy:center.y+rand(-8,14),cz:center.z+rand(-40,40),
      r:rand(14,26),spd:rand(0.25,0.45)*(Math.random()<0.5?1:-1),ph:Math.random()*7};
    for(let i=0;i<7;i++){
      const bird=new THREE.Group();
      const wm=new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide});
      const w1=new THREE.Mesh(new THREE.ConeGeometry(0.34,0.9,3),wm); w1.rotation.z=Math.PI/2; w1.position.x=-0.4;
      const w2=w1.clone(); w2.rotation.z=-Math.PI/2; w2.position.x=0.4;
      bird.add(w1); bird.add(w2);
      bird.userData={off:i*0.8,w1,w2};
      scene.add(bird); flock.birds.push(bird);
    }
    skyLife.flocks.push(flock);
  }
  /* the manta */
  const manta=new THREE.Group();
  const bodyM=new THREE.MeshLambertMaterial({color:0xffe4ef,flatShading:true,transparent:true,opacity:0.96});
  const body=new THREE.Mesh(new THREE.SphereGeometry(2.4,10,8),bodyM);
  body.scale.set(1.1,0.42,1.7); manta.add(body);
  const wingM=new THREE.MeshLambertMaterial({color:0xffd0e4,side:THREE.DoubleSide,transparent:true,opacity:0.9});
  const mwL=new THREE.Mesh(new THREE.ConeGeometry(2.4,6.5,3),wingM);
  mwL.rotation.z=Math.PI/2; mwL.position.x=-4; mwL.scale.set(1,1,0.22); manta.add(mwL);
  const mwR=mwL.clone(); mwR.rotation.z=-Math.PI/2; mwR.position.x=4; manta.add(mwR);
  const tail=new THREE.Mesh(new THREE.ConeGeometry(0.5,3.4,5),bodyM);
  tail.rotation.x=Math.PI/2; tail.position.z=-4; manta.add(tail);
  const mglow=new THREE.PointLight(0xffc9ec,8,26); manta.add(mglow);
  manta.userData={mwL,mwR,seen:false};
  scene.add(manta);
  skyLife.manta=manta;
  skyLife.center=center;
})();

/* city towers */
scatter(cityT.t0,cityT.t1,72,()=>{  /* dark city: near-black towers, loud neon */
  const h=rand(4,18);
  const tower=new THREE.Mesh(new THREE.BoxGeometry(rand(1.6,3.4),h,rand(1.6,3.4)),
    new THREE.MeshLambertMaterial({color:[0x1c1830,0x241d3d,0x191526][Math.floor(Math.random()*3)]}));
  tower.userData.dy=h/2;
  const neon=[0xff2d78,0x36e0ff,0xb14dff,0x2dff9e][Math.floor(Math.random()*4)];
  const glow=new THREE.Mesh(new THREE.BoxGeometry(0.4,h*0.72,0.12),
    new THREE.MeshBasicMaterial({color:neon}));
  glow.position.set(0,h*0.1,tower.geometry.parameters.depth/2+0.07);
  tower.add(glow);
  const glow2=new THREE.Mesh(new THREE.BoxGeometry(tower.geometry.parameters.width+0.1,0.16,0.12),
    new THREE.MeshBasicMaterial({color:neon}));
  glow2.position.set(0,h*0.42,tower.geometry.parameters.depth/2+0.07);
  tower.add(glow2);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(0.16,6,5),new THREE.MeshBasicMaterial({color:neon}));
  cap.position.y=h/2+0.2; tower.add(cap);
  return tower;
});
scatter(meadowT.t0,meadowT.t1,60,()=>{
  const f=new THREE.Mesh(GP.sphere, MB([0xff9ecb,0xffd98a,0x9defc9,0x8fd8ff][Math.floor(Math.random()*4)]));
  f.scale.setScalar(0.16);
  const g=new THREE.Group();
  const st=new THREE.Mesh(GP.cyl, ML(0x7fcf8f));
  st.scale.set(0.03,0.5,0.03); st.position.y=0.25; f.position.y=0.55;
  g.add(st); g.add(f);
  return g;
});
/* fireflies (meadow + glade sparkle) */
const flies=(function(){
  const N=140, pos=new Float32Array(N*3), ph=new Float32Array(N);
  const p=new THREE.Vector3();
  for(let i=0;i<N;i++){
    const t=Math.random()<0.5?rand(meadowT.t0,meadowT.t1):rand(0,0.06);
    curve.getPointAt(t,p);
    pos[i*3]=p.x+rand(-20,20); pos[i*3+1]=p.y+rand(0.5,4); pos[i*3+2]=p.z+rand(-20,20);
    ph[i]=Math.random()*7;
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  const m=new THREE.PointsMaterial({color:0xffe9a8,size:0.34,transparent:true,opacity:0.9,sizeAttenuation:true});
  const pts=new THREE.Points(g,m); scene.add(pts);
  return {pts,ph};
})();

/* ---------------- path-side juice: the world reacts to you ---------------- */
const juice=[];
(function buildJuice(){
  const p=new THREE.Vector3(), tan=new THREE.Vector3(), nrm=new THREE.Vector3(), up=new THREE.Vector3(0,1,0);
  function place(t,side,d){
    curve.getPointAt(t,p); curve.getTangentAt(t,tan);
    nrm.crossVectors(tan,up).normalize();
    return {x:p.x+nrm.x*d*side, y:p.y, z:p.z+nrm.z*d*side};
  }
  /* ground birds (glade, forest, river banks): flutter away as you pass */
  for(let i=0;i<26;i++){
    const t=[rand(0.01,0.07),rand(0.08,0.23),rand(0.24,0.39)][i%3];
    const pos=place(t, Math.random()<0.5?-1:1, rand(3.4,7));
    const bird=new THREE.Group();
    const bm=ML([0xffffff,0xffd9ec,0x8fd8ff][i%3],{side:THREE.DoubleSide});
    const w1=new THREE.Mesh(GP.coneSharp,bm); w1.scale.set(0.22,0.55,0.22); w1.rotation.z=Math.PI/2; w1.position.x=-0.24;
    const w2=w1.clone(); w2.rotation.z=-Math.PI/2; w2.position.x=0.24;
    bird.add(w1,w2);
    bird.position.set(pos.x,0.25,pos.z);
    bird.userData={w1,w2};
    scene.add(bird);
    juice.push({t,kind:'bird',obj:bird,home:{...pos},state:'idle',a:0,dir:Math.random()*7});
  }
  /* chime flowers (glade, desert, meadow): ring softly as you brush past */
  for(let i=0;i<24;i++){
    const t=[rand(0.01,0.07),rand(0.41,0.53),rand(0.946,0.99)][i%3];
    const pos=place(t, Math.random()<0.5?-1:1, rand(2.6,4.6));
    const fg=new THREE.Group();
    const stem=new THREE.Mesh(GP.cyl, ML(0x7fcf8f));
    stem.scale.set(0.045,0.7,0.045); stem.position.y=0.35; fg.add(stem);
    const bell=new THREE.Mesh(GP.sphere, MB([0xffd98a,0xff9ecb,0x9defc9,0x8fd8ff][i%4]));
    bell.scale.setScalar(0.2);
    bell.position.y=0.78; fg.add(bell);
    fg.position.set(pos.x,-0.05,pos.z);
    fg.userData={bell};
    scene.add(fg);
    juice.push({t,kind:'flower',obj:fg,state:'idle',a:0});
  }
  /* snow poffs: bushes shrug off their snow as you pass */
  for(let i=0;i<12;i++){
    const t=rand(0.54,0.62);
    const pos=place(t, Math.random()<0.5?-1:1, rand(3,5.5));
    const bush=new THREE.Group();
    const body=new THREE.Mesh(GP.ico, ML(0x9fc9b8,{flatShading:true}));
    body.scale.setScalar(0.55); body.position.y=0.4; bush.add(body);
    const cap=new THREE.Mesh(GP.sphere, ML(0xffffff));
    cap.scale.set(0.42,0.21,0.42); cap.position.y=0.85; bush.add(cap);
    bush.position.set(pos.x,-0.05,pos.z);
    bush.userData={cap};
    scene.add(bush);
    juice.push({t,kind:'poff',obj:bush,state:'idle',a:0});
  }
})();
let juiceCount=0;
function juiceTick(dt,ms){
  const cp=wanderer.g.position;
  for(const j of juice){
    if(j.state==='idle'){
      if(Math.abs(j.t-state.t)>0.02) continue;
      const dx=cp.x-j.obj.position.x, dz=cp.z-j.obj.position.z;
      if(dx*dx+dz*dz<(j.kind==='bird'?30:9)){
        j.state='go'; j.a=0; juiceCount++;
        if(j.kind==='bird') sfx('chirp');
        else if(j.kind==='flower') sfx('chime');
        else sfx('step');
      }
    } else if(j.state==='go'){
      j.a+=dt;
      if(j.kind==='bird'){
        j.obj.position.y=0.25+j.a*j.a*6;
        j.obj.position.x+=Math.cos(j.dir)*dt*7;
        j.obj.position.z+=Math.sin(j.dir)*dt*7;
        const f=Math.sin(ms*0.03)*0.9;
        j.obj.userData.w1.rotation.y=f; j.obj.userData.w2.rotation.y=-f;
        if(j.a>2.2){ j.obj.visible=false; j.state='gone'; j.a=0; }
      } else if(j.kind==='flower'){
        const k=Math.min(1,j.a/0.5);
        j.obj.userData.bell.scale.setScalar(0.2*(1+Math.sin(k*Math.PI)*0.7));
        j.obj.rotation.z=Math.sin(j.a*14)*0.14*(1-k);
        if(j.a>0.9){ j.state='rest'; j.a=0; }
      } else {
        j.obj.userData.cap.scale.y=Math.max(0.01,0.21-j.a*0.34);
        j.obj.userData.cap.position.y=0.85-j.a*0.5;
        if(j.a>0.7){ j.obj.userData.cap.visible=false; j.state='rest'; j.a=0; }
      }
    } else if(j.state==='gone' || j.state==='rest'){
      j.a+=dt;
      if(j.a>24){ /* the world quietly resets behind you */
        j.state='idle'; j.a=0;
        if(j.kind==='bird'){ j.obj.visible=true; j.obj.position.set(j.home.x,0.25,j.home.z); }
        if(j.kind==='poff'){ j.obj.userData.cap.visible=true; j.obj.userData.cap.scale.y=0.21; j.obj.userData.cap.position.y=0.85; }
      }
    }
  }
}

/* ---------------- character ---------------- */
export const wanderer=(function(){
  const g=new THREE.Group();
  const cape=new THREE.Mesh(new THREE.ConeGeometry(0.62,1.5,9,1,true),
    new THREE.MeshLambertMaterial({color:0xff9ecb,side:THREE.DoubleSide,flatShading:true}));
  cape.position.y=0.85; g.add(cape);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.34,12,10),
    new THREE.MeshLambertMaterial({color:0xfff2e2}));
  head.position.y=1.78; g.add(head);
  const hood=new THREE.Mesh(new THREE.SphereGeometry(0.4,10,8,0,Math.PI*2,0,Math.PI*0.62),
    new THREE.MeshLambertMaterial({color:0xe75f9c,flatShading:true}));
  hood.position.y=1.86; g.add(hood);
  const glow=new THREE.PointLight(0xffd98a,6,7); glow.position.y=1.2; g.add(glow);
  /* wings (hidden until sky) */
  const wingM=new THREE.MeshLambertMaterial({color:0xffd0e4,transparent:true,opacity:0.85,side:THREE.DoubleSide});
  const wL=new THREE.Mesh(new THREE.ConeGeometry(0.5,1.6,3),wingM);
  wL.rotation.z=Math.PI/2; wL.position.set(-0.75,1.25,0); wL.scale.set(1,1,0.24); wL.visible=false;
  const wR=wL.clone(); wR.rotation.z=-Math.PI/2; wR.position.x=0.75; g.add(wL); g.add(wR);
  scene.add(g);
  return {g,cape,head,hood,wL,wR,glow};
})();

/* ---------------- the boat: a real thing in the world ---------------- */
const boat=(function(){
  const b=new THREE.Group();
  const hull=new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.55,0.6,8,1),
    new THREE.MeshLambertMaterial({color:0xc78a5f,flatShading:true}));
  hull.scale.set(1.6,1,0.9); hull.position.y=0.28; b.add(hull);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(0.95,0.09,6,10),
    new THREE.MeshLambertMaterial({color:0xa86f47}));
  rim.rotation.x=Math.PI/2; rim.position.y=0.58; rim.scale.set(1.6,0.9,1); b.add(rim);
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(0.14,8,6),new THREE.MeshBasicMaterial({color:0xffd98a}));
  lamp.position.set(1.35,0.9,0); b.add(lamp);
  const ll=new THREE.PointLight(0xffd98a,3,6); ll.position.copy(lamp.position); b.add(ll);
  scene.add(b);
  /* jetties at both moorings */
  function jetty(t){
    const p=curve.getPointAt(t), tan=curve.getTangentAt(t);
    const j=new THREE.Group();
    for(let k=0;k<5;k++){
      const plank=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.12,2.6),
        new THREE.MeshLambertMaterial({color:0xa8815e}));
      plank.position.set((k-2)*0.95,0.05,0); j.add(plank);
    }
    for(const px of [-2.1,2.1]) for(const pz of [-1.1,1.1]){
      const post=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.11,1.2,6),
        new THREE.MeshLambertMaterial({color:0x8a6a4a}));
      post.position.set(px,-0.4,pz); j.add(post);
    }
    j.position.set(p.x,0.02,p.z);
    j.rotation.y=Math.atan2(tan.x,tan.z);
    scene.add(j);
  }
  jetty(BOARD_T); jetty(ALIGHT_T);
  const m0=curve.getPointAt(BOARD_T);
  b.position.set(m0.x,-0.12,m0.z);
  return {g:b, state:'moor0'};
})();

/* ---------------- fairy ---------------- */
const fairy=(function(){
  const g=new THREE.Group();
  const c=document.createElement('canvas'); c.width=c.height=64;
  const x=c.getContext('2d');
  const gr=x.createRadialGradient(32,32,2,32,32,32);
  gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.4,'rgba(255,220,250,.8)'); gr.addColorStop(1,'rgba(255,220,250,0)');
  x.fillStyle=gr; x.fillRect(0,0,64,64);
  const tex=new THREE.CanvasTexture(c);
  const body=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,color:0xffd0f0,transparent:true,depthWrite:false}));
  body.scale.setScalar(1.5); g.add(body);
  const wingMat=new THREE.SpriteMaterial({map:tex,color:0xbfe8ff,transparent:true,opacity:0.9,depthWrite:false});
  const w1=new THREE.Sprite(wingMat); w1.scale.set(0.9,0.5,1); w1.position.set(-0.5,0.15,0); g.add(w1);
  const w2=new THREE.Sprite(wingMat.clone()); w2.scale.set(0.9,0.5,1); w2.position.set(0.5,0.15,0); g.add(w2);
  const light=new THREE.PointLight(0xffc9ec,4,6); g.add(light);
  scene.add(g);
  return {g,w1,w2};
})();

/* ---------------- state ---------------- */
const state={
  t:0.012, vel:0, jumpV:0, jumpY:0,
  pov:'third', biome:null, mode:'overworld', run:false,
  camPos:new THREE.Vector3(), camLook:new THREE.Vector3(), started:false
};
function setRun(v){
  state.run=v;
  const b=document.getElementById('runBtn');
  if(b) b.innerHTML='<i class="fa-solid fa-person-'+(v?'running':'walking')+'"></i> '+(v?'run':'walk');
}
addEventListener('keydown',e=>{ if(e.key==='Shift' && !e.repeat){ setRun(!state.run); sfx('tick'); } });
const input={left:false,right:false,up:false};

/* keyboard */
addEventListener('keydown',e=>{
  if(e.key==='ArrowLeft'||e.key==='a') input.left=true;
  if(e.key==='ArrowRight'||e.key==='d') input.right=true;
  if(e.key==='ArrowUp'||e.key===' '||e.key==='w'){ input.up=true; e.preventDefault(); }
});
addEventListener('keyup',e=>{
  if(e.key==='ArrowLeft'||e.key==='a') input.left=false;
  if(e.key==='ArrowRight'||e.key==='d') input.right=false;
  if(e.key==='ArrowUp'||e.key===' '||e.key==='w') input.up=false;
});
/* on-screen pad */
function bindPad(id,key){
  const b=document.getElementById(id);
  const on=e=>{ e.preventDefault(); input[key]=true; b.classList.add('on'); };
  const off=()=>{ input[key]=false; b.classList.remove('on'); };
  b.addEventListener('pointerdown',on);
  addEventListener('pointerup',off);
  b.addEventListener('pointerleave',off);
}
bindPad('padL','left'); bindPad('padR','right'); bindPad('padU','up');

/* POV toggle */
const povBtn=document.getElementById('povBtn');
const runBtn=document.getElementById('runBtn');
if(runBtn) runBtn.addEventListener('click',()=>{ setRun(!state.run); sfx('select'); });
povBtn.addEventListener('click',()=>{
  state.pov = state.pov==='third' ? 'first' : 'third';
  povBtn.innerHTML='<i class="fa-solid fa-video"></i> '+(state.pov==='third'?'3rd person':'1st person');
  sfx('select');
});

/* ---------------- camera profiles (keyed, smoothly interpolated) ---------------- */
const CAMKEYS=[
  { t:0.03,  az: 0.55, dist:11, h:4.2, ahead:0.012 },   /* glade: over-shoulder */
  { t:0.15,  az: 1.45, dist:11.5, h:3.4, ahead:0.006 }, /* forest: side-on (Limbo, sunlit) */
  { t:0.31,  az: 0.25, dist:12, h:2.4, ahead:0.014 },   /* river: low chase behind boat */
  { t:0.47,  az:-0.85, dist:26, h:15,  ahead:0.02  },   /* desert: high crane */
  { t:0.60,  az: 1.2,  dist:15, h:4,   ahead:0.01  },   /* snow: side drift */
  { t:0.74,  az: 0.0,  dist:17, h:3.2, ahead:0.02  },   /* sky: behind, open */
  { t:0.79,  az:-2.2,  dist:19, h:6,   ahead:0.016 },   /* sky late: slow orbit feel */
  { t:0.828, az:-0.25, dist:15, h:8,   ahead:0.012 },   /* the dive: settle high behind */
  { t:0.86,  az:-0.5,  dist:12, h:5.5, ahead:0.012 },   /* touchdown: gentle behind     */
  { t:0.90,  az:-0.9,  dist:12, h:5,   ahead:0.012 },   /* city: 3/4 view */
  { t:0.97,  az: 0.5,  dist:10, h:3,   ahead:0.008 }    /* meadow: close & warm */
];
function camProfile(t){
  if(t<=CAMKEYS[0].t) return CAMKEYS[0];
  for(let i=0;i<CAMKEYS.length-1;i++){
    const a=CAMKEYS[i], b=CAMKEYS[i+1];
    if(t>=a.t && t<=b.t){
      const k=(t-a.t)/(b.t-a.t), s=k*k*(3-2*k);
      return { az:a.az+(b.az-a.az)*s, dist:a.dist+(b.dist-a.dist)*s,
               h:a.h+(b.h-a.h)*s, ahead:a.ahead+(b.ahead-a.ahead)*s };
    }
  }
  return CAMKEYS[CAMKEYS.length-1];
}

/* ---------------- HUD helpers ---------------- */
const toast=document.getElementById('toast');
function showToast(a,b){
  document.getElementById('toastT').textContent=a;
  document.getElementById('toastS').textContent=b;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t=setTimeout(()=>toast.classList.remove('show'), 3600);
}
const bubble=document.getElementById('bubble'), bubbleTx=document.getElementById('bubbleTx');
let bubbleTimer=null;
export function fairySay(msg,ms){
  bubbleTx.textContent=msg;
  bubble.classList.add('show');
  sfx('trill');
  clearTimeout(bubbleTimer);
  bubbleTimer=setTimeout(()=>bubble.classList.remove('show'), ms||5200);
}
const promptEl=document.getElementById('prompt');
export function setPrompt(html){
  if(html){ promptEl.innerHTML=html; promptEl.classList.add('show'); }
  else promptEl.classList.remove('show');
}

/* ---------------- ambient sound per biome ---------------- */
let sndBiome=null;
function stopSynthLoops(){
  try{ if(window.SFX) ['stopBrook','stopWind','stopAmbient','stopCrickets','stopHum'].forEach(f=>SFX[f]&&SFX[f]()); }catch(e){}
}
function synthBiome(id){
  try{
    if(!window.SFX) return;
    stopSynthLoops();
    if(id==='glade')       SFX.startAmbient(58);                       /* soft dawn pad     */
    else if(id==='forest') SFX.startWind({freq:760,gain:0.05,rate:0.3});/* leaves in breeze; birds chirp in tick */
    else if(id==='river')  SFX.startBrook(1);                          /* running water     */
    else if(id==='desert') SFX.startWind({freq:280,gain:0.14,rate:0.07});/* dry, wide wind   */
    else if(id==='snow')   SFX.startWind({freq:1050,gain:0.05,rate:0.16});/* thin hush       */
    else if(id==='sky')    SFX.startWind({freq:500,gain:0.12,rate:0.11}); /* open-air rush   */
    else if(id==='city')   SFX.startHum && SFX.startHum();             /* dark synth hum    */
    else if(id==='meadow') SFX.startCrickets && SFX.startCrickets();   /* night crickets    */
    else if(id==='rain')   SFX.startRain && SFX.startRain();            /* cabin goodnight   */
  }catch(e){}
}
const AMB=createAmbience(synthBiome, stopSynthLoops);
window.WANDER_AMB=AMB;
function biomeSound(id){
  if(id===sndBiome) return; sndBiome=id;
  AMB.play(id);
}
let chirpTimer=0;

/* ---------------- domains (doors, interiors) ---------------- */
const domains = initDomains({
  THREE, scene, curve, wanderer, fairy, camera, renderer, state, input,
  fairySay, setPrompt, sfx, REDUCED, biomeAt, showToast
});

/* ---------------- resize ---------------- */
addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

/* ---------------- start veil ---------------- */
const veil=document.getElementById('veil'), startBtn=document.getElementById('startBtn');
document.getElementById('veilMsg').textContent='a small world grew while you blinked';
startBtn.style.display='block';
startBtn.addEventListener('click',()=>{
  veil.classList.add('gone');
  state.started=true;
  biomeSound('glade');
  setTimeout(()=>fairySay(FAIRY.wake, 7000), 700);
  sfx('bloom');
});

/* ---------------- main loop ---------------- */
const _p=new THREE.Vector3(), _tan=new THREE.Vector3(), _n=new THREE.Vector3(), _up=new THREE.Vector3(0,1,0);
const _camTarget=new THREE.Vector3(), _look=new THREE.Vector3(), _fair=new THREE.Vector3();
let lastBiome=null, lastMs=0, idleMs=0, walkPhase=0;

function tick(ms){
  requestAnimationFrame(tick);
  if(document.hidden) return;
  const dt=Math.min(0.05,(ms-lastMs)/1000||0.016); lastMs=ms;

  if(state.mode!=='overworld'){ domains.tick(dt,ms); return; }

  /* --- move --- */
  const SPEED = state.run ? 0.030 : 0.0075;   /* walk = 25% of v1 · run = original */
  const bSpeed = b0 => b0.id==='sky' ? 0.8 : 1;   /* flying drifts even slower */
  let target=0;
  const bNow=biomeAt(state.t);
  if(state.started){
    if(input.right) target= SPEED*bSpeed(bNow);
    if(input.left)  target=-SPEED*bSpeed(bNow);
  }
  state.vel += (target-state.vel)*Math.min(1,dt*6);
  state.t = Math.max(0.005, Math.min(0.995, state.t + state.vel*dt));
  const moving=Math.abs(state.vel)>0.004;
  if(moving){ idleMs=0; } else idleMs+=dt*1000;

  const b=biomeAt(state.t);
  const riding = state.t>BOARD_T && state.t<ALIGHT_T;
  const onWater = riding;
  const flying  = b.id==='sky';
  /* boarding / alighting transitions */
  if(riding && boat.state!=='carry'){
    boat.state='carry'; state.jumpV=2.6; sfx('creak'); sfx('splash');
    fairySay('Steady… step aboard. The river does the walking now.',3800);
  } else if(!riding && boat.state==='carry'){
    boat.state = state.t>=ALIGHT_T ? 'moor1' : 'moor0';
    state.jumpV=2.6; sfx('splash'); sfx('step');
    const mp=curve.getPointAt(boat.state==='moor1'?ALIGHT_T:BOARD_T);
    boat.g.position.set(mp.x,-0.12,mp.z);
  }

  /* jump (small hop; disabled while flying/boating) */
  if(input.up && state.jumpY<=0.001 && !flying && !onWater && !domains.nearDoor()){
    state.jumpV=5.2; sfx('jump'); input.up=false;
  }
  state.jumpV-=16*dt; state.jumpY=Math.max(0,state.jumpY+state.jumpV*dt);
  if(state.jumpY===0) state.jumpV=0;

  /* --- place character --- */
  curve.getPointAt(state.t,_p); curve.getTangentAt(state.t,_tan);
  const baseY=onWater? 0.42 : 0;   /* standing on the boat deck */
  wanderer.g.position.set(_p.x, _p.y+baseY+state.jumpY+(flying?Math.sin(ms*0.002)*0.6:0), _p.z);
  const face=Math.atan2(_tan.x,_tan.z)+(state.vel<-0.001?Math.PI:0);
  wanderer.g.rotation.y += (face-wanderer.g.rotation.y)*Math.min(1,dt*7);
  /* walk bob + cape sway */
  walkPhase+=dt*(moving?9:2);
  wanderer.cape.rotation.z=Math.sin(walkPhase)*0.08*(moving?1:0.4);
  wanderer.cape.scale.x=1+Math.sin(walkPhase*0.7)*0.05;
  if(!moving){                       /* idle life: breathe + glance around */
    const br=1+Math.sin(ms*0.0016)*0.02;
    wanderer.cape.scale.y=br; wanderer.cape.scale.z=2-br;
    wanderer.head.rotation.y=Math.sin(ms*0.0006)*0.55;
    wanderer.hood.rotation.y=wanderer.head.rotation.y;
  } else { wanderer.cape.scale.y=1; wanderer.cape.scale.z=1;
    wanderer.head.rotation.y*=0.9; wanderer.hood.rotation.y*=0.9; }
  wanderer.g.position.y+=moving&&!onWater&&!flying?Math.abs(Math.sin(walkPhase))*0.12:0;
  /* modes */
  wanderer.wL.visible=wanderer.wR.visible=flying;
  if(boat.state==='carry'){
    boat.g.position.set(_p.x,-0.12+Math.sin(ms*0.0016)*0.04,_p.z);
    boat.g.rotation.y += ((Math.atan2(_tan.x,_tan.z))-boat.g.rotation.y)*Math.min(1,dt*5);
    boat.g.rotation.z=Math.sin(ms*0.0016)*0.05;
    boat.g.rotation.x=Math.sin(ms*0.0011)*0.04;
    if(moving && Math.random()<0.03) sfx('drip');
    if(Math.random()<0.004) sfx('creak');
  } else {
    boat.g.rotation.z=Math.sin(ms*0.0013)*0.03;   /* gentle bob at the jetty */
    boat.g.position.y=-0.12+Math.sin(ms*0.0014)*0.03;
  }
  if(flying){
    const flap=Math.sin(ms*0.008)*0.5;
    wanderer.wL.rotation.y=flap; wanderer.wR.rotation.y=-flap;
    wanderer.g.rotation.z=(state.vel>0?-1:1)*Math.min(0.3,Math.abs(state.vel)*8);
  } else wanderer.g.rotation.z*=0.9;
  /* footsteps */
  if(moving && !onWater && !flying && Math.floor(walkPhase/Math.PI)!==Math.floor((walkPhase-dt*9)/Math.PI)) sfx('step');
  if(b.id==='forest'){ chirpTimer-=dt; if(chirpTimer<=0){ chirpTimer=2+Math.random()*4; sfx('chirp'); } }

  /* --- fairy follows with spring lag --- */
  _n.crossVectors(_tan,_up).normalize();
  _fair.set(wanderer.g.position.x-_n.x*1.6-_tan.x*0.8,
            wanderer.g.position.y+2.5+Math.sin(ms*0.003)*0.25,
            wanderer.g.position.z-_n.z*1.6-_tan.z*0.8);
  fairy.g.position.lerp(_fair, Math.min(1,dt*3.2));
  const flap2=0.6+Math.abs(Math.sin(ms*0.012))*0.5;
  fairy.w1.scale.set(0.9*flap2,0.5,1); fairy.w2.scale.set(0.9*flap2,0.5,1);
  /* bubble follows fairy */
  if(bubble.classList.contains('show')){
    _look.copy(fairy.g.position); _look.project(camera);
    bubble.style.left=((_look.x*0.5+0.5)*innerWidth+14)+'px';
    bubble.style.top=((-_look.y*0.5+0.5)*innerHeight-30)+'px';
  }

  /* --- camera (all-lerped: never jitters) --- */
  const prof=camProfile(state.t);
  if(state.pov==='third'){
    const azWorld=Math.atan2(_tan.x,_tan.z)+prof.az;
    _camTarget.set(
      wanderer.g.position.x - Math.sin(azWorld)*prof.dist,
      wanderer.g.position.y + prof.h,
      wanderer.g.position.z - Math.cos(azWorld)*prof.dist);
  } else {
    _camTarget.set(
      wanderer.g.position.x+_tan.x*0.3,
      wanderer.g.position.y+1.85+(moving?Math.sin(walkPhase*2)*0.05:0),
      wanderer.g.position.z+_tan.z*0.3);
  }
  state.camPos.lerp(_camTarget, Math.min(1,dt*(REDUCED?12:2.6)));
  /* the camera may never sink below the world surface — flying or not */
  const minY = flying ? 0.6 : Math.max(_p.y+1.0, 0.2);
  if(state.camPos.y<minY) state.camPos.y=minY;
  camera.position.copy(state.camPos);
  const lookT=Math.min(0.995,state.t+prof.ahead);
  curve.getPointAt(state.pov==='third'?lookT:Math.min(0.995,state.t+0.02),_look);
  _look.y+= state.pov==='third'?1.2:1.7;
  const ann=domains.getAnnounce ? domains.getAnnounce() : null;
  if(ann){ _look.lerp(ann.p, ann.w); }                 /* the chapter announces itself */
  state.camLook.lerp(_look, Math.min(1,dt*3.4));
  if(state.camLook.y<-0.4) state.camLook.y=-0.4;
  camera.lookAt(state.camLook);

  /* --- environment blend (smooth, per-frame lerp) --- */
  scene.fog.color.lerp(blendAttr(state.t,'fog'), Math.min(1,dt*2));
  const skyC=blendAttr(state.t,'sky');
  if(!scene.background) scene.background=new THREE.Color(skyC);
  scene.background.lerp(skyC, Math.min(1,dt*2));
  scene.fog.far += ((b.far)-scene.fog.far)*Math.min(1,dt*1.5);

  /* --- biome culling: whole prop groups beyond the fog window skip the GPU --- */
  for(const id in biomeGroups){
    const gd=biomeGroups[id].userData;
    biomeGroups[id].visible = state.t > gd.t0-0.12 && state.t < gd.t1+0.12;
  }

  /* --- water ripple (only animated when the river can be seen) --- */
  if(waterMesh && Math.abs(state.t-0.317)<0.17){
    const pos=waterMesh.geometry.attributes.position;
    for(let i=0;i<pos.count;i++){
      const wx=pos.array[i*3], wz=pos.array[i*3+2];
      pos.array[i*3+1]=-0.35+Math.sin(ms*0.0016+wx*0.22+wz*0.18)*0.11;
    }
    pos.needsUpdate=true;
  }
  /* sky life animation (only when the sky biome is near) */
  if(skyLife.manta && Math.abs(state.t-0.735)<0.24){
    const c=skyLife.center, mt=ms*0.00008;
    const mx=c.x+Math.cos(mt*2*Math.PI)*95, mz=c.z+Math.sin(mt*2*Math.PI)*55;
    const my=c.y+Math.sin(ms*0.0006)*10+4;
    skyLife.manta.position.set(mx,my,mz);
    skyLife.manta.rotation.y=-mt*2*Math.PI+Math.PI/2;
    skyLife.manta.rotation.z=Math.sin(ms*0.0011)*0.18;
    const mf=Math.sin(ms*0.0028)*0.5;
    skyLife.manta.userData.mwL.rotation.y=mf; skyLife.manta.userData.mwR.rotation.y=-mf;
    if(flying && !skyLife.manta.userData.seen &&
       skyLife.manta.position.distanceTo(wanderer.g.position)<70){
      skyLife.manta.userData.seen=true;
      fairySay('Oh — look up. She only shows herself to gentle travellers. ✧',5200);
      sfx('whale');
    }
    for(const fl of skyLife.flocks){
      for(const bird of fl.birds){
        const a=ms*0.001*fl.spd+bird.userData.off+fl.ph;
        bird.position.set(fl.cx+Math.cos(a)*fl.r, fl.cy+Math.sin(a*1.7)*2.4, fl.cz+Math.sin(a)*fl.r);
        bird.rotation.y=-a+(fl.spd>0?Math.PI/2:-Math.PI/2);
        const bf=Math.sin(ms*0.012+bird.userData.off)*0.7;
        bird.userData.w1.rotation.y=bf; bird.userData.w2.rotation.y=-bf;
      }
    }
  }
  /* fireflies twinkle */
  flies.pts.material.opacity=0.55+0.4*Math.sin(ms*0.002);

  /* --- biome events --- */
  if(b!==lastBiome && state.started){
    lastBiome=b;
    showToast(b.name, b.subtitle);
    biomeSound(b.id);
    if(FAIRY.biomes[b.id]) fairySay(FAIRY.biomes[b.id], 6000);
  }
  state.biome=b.id;
  /* idle nudge */
  if(idleMs>16000 && state.started){
    idleMs=0;
    fairySay(FAIRY.idle[Math.floor(Math.random()*FAIRY.idle.length)],4500);
  }

  /* doors + path-side life */
  domains.overworldTick(dt,ms);
  juiceTick(dt,ms);

  renderer.render(scene,camera);
}
requestAnimationFrame(tick);

/* ---------------- test hooks ---------------- */
window.__wander=function(){ return {
  t:+state.t.toFixed(4), biome:state.biome, mode:state.mode, pov:state.pov,
  started:state.started, boat:boat.state, riding:boat.state==='carry', flying:state.biome==='sky'
};};
window.__teleport=function(t){ state.t=Math.max(0.005,Math.min(0.995,t)); };
window.__press=function(k,v){ input[k]=v; };
window.__juice=function(){ return juiceCount; };
window.__mem=function(){ return { geometries:renderer.info.memory.geometries, textures:renderer.info.memory.textures, programs:renderer.info.programs.length }; };
window.__start=function(){ if(!state.started){ startBtn.click(); } };
