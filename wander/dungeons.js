/* ==========================================================================
   dungeons.js — six DISTINCT dungeon worlds + the night cabin.
   Each builder returns { scene, stations, len, path?, cam?, anim? }:
     stations : [{data, z, gem, done}]  — same contract domainTick expects
     path(u,ms) -> {x,y,z,ry}          — optional custom walk (spiral, etc.)
     cam(u,ms,char) -> {pos,look}      — optional camera targets (still lerped)
     anim(dt,ms,u)                     — per-frame life (petals, fish, aurora…)
   ========================================================================== */

export function buildDungeons(THREE, DOMAINS, DOOR_COLORS){
const rand=(a,b)=>a+Math.random()*(b-a);
const M=(c,o)=>new THREE.MeshLambertMaterial(Object.assign({color:c},o||{}));
const B=c=>new THREE.MeshBasicMaterial(typeof c==='object'?c:{color:c});
const mesh=(g,m,x,y,z)=>{ const e=new THREE.Mesh(g,m); if(x!=null)e.position.set(x,y,z); return e; };
const V3=(x,y,z)=>new THREE.Vector3(x,y,z);

function baseScene(bg, fogNear, fogFar, hemiI){
  const sc=new THREE.Scene();
  sc.background=new THREE.Color(bg);
  sc.fog=new THREE.Fog(bg, fogNear, fogFar);
  sc.add(new THREE.HemisphereLight(0xffffff, bg, hemiI));
  return sc;
}
function gemFor(sc,color,x,y,z){
  const gem=mesh(new THREE.OctahedronGeometry(0.55,0),
    M(color,{flatShading:true,emissive:color,emissiveIntensity:0.45}),x,y,z);
  sc.add(gem);
  const pl=new THREE.PointLight(color,4,7); pl.position.set(x,y+0.4,z); sc.add(pl);
  return gem;
}
function starPoints(sc,n,spread,y0,y1,size,color){
  const pos=new Float32Array(n*3);
  for(let i=0;i<n;i++){ pos[i*3]=rand(-spread,spread); pos[i*3+1]=rand(y0,y1); pos[i*3+2]=rand(-spread,spread+30); }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  const pts=new THREE.Points(g,new THREE.PointsMaterial({color,size,transparent:true,opacity:0.9,sizeAttenuation:true}));
  sc.add(pts); return pts;
}

/* ======================================================================
   1 · FOREST — THE ROOT ARCHIVE (vertical spiral around a colossal tree)
   ====================================================================== */
function rootArchive(){
  const sc=baseScene(0x2a4a35, 14, 70, 1.0);
  const dl=new THREE.DirectionalLight(0xd8ffe0,0.8); dl.position.set(8,30,6); sc.add(dl);
  /* ground */
  const fl=mesh(new THREE.CircleGeometry(34,36),M(0x35573f)); fl.rotation.x=-Math.PI/2; sc.add(fl);
  /* mossy path pavers along the walk */
  for(let z=-4;z<=32;z+=1.6)
    sc.add(mesh(new THREE.BoxGeometry(2.6,0.18,1.2),M(0x8a6a4a,{flatShading:true}),Math.sin(z*0.35)*1.4,-0.09,z));
  /* the colossal trunk beside the path */
  sc.add(mesh(new THREE.CylinderGeometry(3.2,4.6,30,12),M(0x6f4f38,{flatShading:true}),-10,14,16));
  const heart=new THREE.PointLight(0xffe9b8,10,30); heart.position.set(-6,8,16); sc.add(heart);
  /* great roots arching OVER the path */
  for(let i=0;i<4;i++){
    const z=2+i*8;
    const arch=mesh(new THREE.TorusGeometry(6.5,0.7,7,18,Math.PI),M(0x5f4330,{flatShading:true}));
    arch.position.set(-2,0,z); arch.rotation.y=0.25; sc.add(arch);
  }
  /* root tendrils on the far side */
  for(let i=0;i<8;i++){
    const r=mesh(new THREE.CylinderGeometry(0.4,1.1,rand(4,7),6),M(0x5f4330,{flatShading:true}),
      -10+rand(-3,5), 1.4, 16+rand(-9,9));
    r.rotation.z=rand(0.5,1.1); sc.add(r);
  }
  /* canopy far overhead + light wells */
  for(let i=0;i<10;i++)
    sc.add(mesh(new THREE.IcosahedronGeometry(rand(3.5,6),0),M(i%3?0x4f9f63:0xd881a8,{flatShading:true}),
      rand(-14,10), 22+rand(-2,5), rand(0,30)));
  for(let i=0;i<3;i++)
    sc.add(mesh(new THREE.ConeGeometry(2.4,20,10,1,true),
      B({color:0xfff8d8,transparent:true,opacity:0.09,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}),
      rand(-4,5),11,4+i*10));
  /* glowing mushrooms along the way */
  for(let i=0;i<16;i++){
    const z=rand(-2,32), sx=(Math.random()<0.5?-1:1)*rand(3.4,8);
    sc.add(mesh(new THREE.SphereGeometry(rand(0.2,0.5),8,6,0,7,0,1.4),
      B([0x9defc9,0xffb0cf,0x8fd8ff][i%3]), sx, 0.22, z));
  }
  const D=DOMAINS.forest;
  const stations=D.stations.map((data,i)=>{
    const z=7+i*9, sx=i%2?3.2:-3.2;
    const plat=mesh(new THREE.CylinderGeometry(1.5,1.8,0.5,10),M(0x9a7a55,{flatShading:true}),sx,0.25,z);
    sc.add(plat);
    const gem=gemFor(sc,DOOR_COLORS.forest,sx,1.9,z);
    return {data, z, gem, done:false};
  });
  /* falling petals */
  const petals=starPoints(sc,120,16,4,24,0.28,0xffb0cf);
  return { scene:sc, stations, len:D.stations.length*9+7,
    anim(dt,ms){
      const p=petals.geometry.attributes.position;
      for(let i=0;i<p.count;i++){
        p.array[i*3+1]-=dt*(0.8+(i%5)*0.2);
        p.array[i*3]+=Math.sin(ms*0.001+i)*dt*0.4;
        if(p.array[i*3+1]<0.4) p.array[i*3+1]=24;
      }
      p.needsUpdate=true;
    }
  };
}

/* ======================================================================
   2 · RIVER — THE SUNKEN OBSERVATORY (a glass dome beneath the water)
   ====================================================================== */
function sunkenObservatory(){
  const sc=baseScene(0x0c3244, 10, 52, 0.7);
  const dl=new THREE.DirectionalLight(0xbfeaff,0.8); dl.position.set(0,20,6); sc.add(dl);
  const fl=mesh(new THREE.CircleGeometry(24,36),M(0x1a5a70)); fl.rotation.x=-Math.PI/2; sc.add(fl);
  /* the glass dome */
  const dome=mesh(new THREE.SphereGeometry(23,24,14,0,Math.PI*2,0,Math.PI/2),
    M(0x8fd8ff,{transparent:true,opacity:0.16,side:THREE.BackSide})); dome.position.z=8; sc.add(dome);
  const ribs=new THREE.Group();
  for(let i=0;i<8;i++){ const a=i/8*Math.PI;
    const rib=mesh(new THREE.TorusGeometry(23,0.14,6,40,Math.PI),M(0x9adfd4));
    rib.rotation.z=Math.PI; rib.rotation.y=a; rib.position.z=8; ribs.add(rib); }
  sc.add(ribs);
  /* water surface above (seen through the glass) */
  const surf=mesh(new THREE.PlaneGeometry(120,120,24,24),
    M(0x2a7a9a,{transparent:true,opacity:0.5,side:THREE.DoubleSide}));
  surf.rotation.x=Math.PI/2; surf.position.set(0,24,8); sc.add(surf);
  surf.userData.base=surf.geometry.attributes.position.array.slice();
  /* godrays */
  for(let i=0;i<4;i++){
    sc.add(mesh(new THREE.ConeGeometry(rand(1.6,2.6),22,8,1,true),
      B({color:0xbfeaff,transparent:true,opacity:0.07,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}),
      rand(-10,10),12,rand(0,16)));
  }
  /* caustic rings on the floor */
  const rings=[];
  for(let i=0;i<7;i++){
    const r=mesh(new THREE.RingGeometry(0.7,0.9,26),
      B({color:0xbfeaff,transparent:true,opacity:0.25,side:THREE.DoubleSide}));
    r.rotation.x=-Math.PI/2; r.position.set(rand(-12,12),0.03,rand(-2,18));
    r.userData.ph=rand(0,7); sc.add(r); rings.push(r);
  }
  /* fish beyond the dome */
  const fish=[];
  for(let i=0;i<7;i++){
    const f=new THREE.Group();
    const body=mesh(new THREE.SphereGeometry(rand(0.5,1.1),8,6),M(0x0f2a3a)); body.scale.set(1.8,0.7,0.5); f.add(body);
    const tail=mesh(new THREE.ConeGeometry(0.4,0.9,4),M(0x0f2a3a)); tail.rotation.z=Math.PI/2; tail.position.x=-1.4; f.add(tail);
    f.userData={r:rand(26,34), sp:rand(0.1,0.25)*(i%2?1:-1), ph:rand(0,7), h:rand(4,14)};
    sc.add(f); fish.push(f);
  }
  /* rising bubbles */
  const bubbles=starPoints(sc,90,16,0,22,0.22,0xd8f4ff);
  const D=DOMAINS.river;
  const stations=D.stations.map((data,i)=>{
    const z=6+i*8;
    const pool=mesh(new THREE.CylinderGeometry(1.5,1.7,0.5,10),M(0x18455a),i%2?2.6:-2.6,0.25,z);
    sc.add(pool);
    const gem=gemFor(sc,DOOR_COLORS.river,pool.position.x,1.7,z);
    return {data,z,gem,done:false};
  });
  return { scene:sc, stations, len:20,
    cam(u,ms,ch){ return { pos:V3(ch.x-4.2+Math.sin(ms*0.0007)*0.7, 3.8+Math.sin(ms*0.0009)*0.35, u-6.8),
                           look:V3(ch.x,1.5,u+2.5) }; },
    anim(dt,ms){
      rings.forEach(r=>{ const k=((ms*0.0004+r.userData.ph)%1);
        r.scale.setScalar(0.5+k*3.2); r.material.opacity=0.3*(1-k); });
      fish.forEach(f=>{ const a=ms*0.001*f.userData.sp+f.userData.ph;
        f.position.set(Math.cos(a)*f.userData.r, f.userData.h+Math.sin(ms*0.001+f.userData.ph)*1.2, 8+Math.sin(a)*f.userData.r);
        f.rotation.y=-a+(f.userData.sp>0?Math.PI/2:-Math.PI/2); });
      const bp=bubbles.geometry.attributes.position;
      for(let i=0;i<bp.count;i++){ bp.array[i*3+1]+=dt*(1+(i%4)*0.4);
        if(bp.array[i*3+1]>22) bp.array[i*3+1]=0.3; }
      bp.needsUpdate=true;
      const sp=surf.geometry.attributes.position, sb=surf.userData.base;
      for(let i=0;i<sp.count;i++) sp.array[i*3+2]=sb[i*3+2]+Math.sin(ms*0.0016+sb[i*3]*0.2)*0.5;
      sp.needsUpdate=true;
    }
  };
}

/* ======================================================================
   3 · DESERT — THE MIRAGE BAZAAR (a night souk under the stars)
   ====================================================================== */
function mirageBazaar(){
  const sc=baseScene(0x1a1230, 14, 64, 0.5);
  starPoints(sc,220,40,10,30,0.3,0xfff2d8);
  const dl=new THREE.DirectionalLight(0xffd8a8,0.35); dl.position.set(4,14,-6); sc.add(dl);
  /* street */
  const fl=mesh(new THREE.PlaneGeometry(44,60),M(0x8a6f4f)); fl.rotation.x=-Math.PI/2; fl.position.z=12; sc.add(fl);
  const carpet=mesh(new THREE.PlaneGeometry(3.4,44),M(0xa83a4a)); carpet.rotation.x=-Math.PI/2; carpet.position.set(0,0.02,12); sc.add(carpet);
  for(let k=0;k<10;k++){ const band=mesh(new THREE.PlaneGeometry(3.4,0.5),M(0xe8b04a));
    band.rotation.x=-Math.PI/2; band.position.set(0,0.03,-6+k*4.4); sc.add(band); }
  const D=DOMAINS.desert;
  const lanternGroups=[], embers=[];
  const stations=D.stations.map((data,i)=>{
    const z=6+i*7, sx=i%2?4.6:-4.6;
    /* stall tent */
    const tent=new THREE.Group();
    const canopy=mesh(new THREE.ConeGeometry(3,1.8,4),M(i%2?0xc9556a:0x3a7a8f,{flatShading:true})); canopy.position.y=3.4; canopy.rotation.y=Math.PI/4; tent.add(canopy);
    for(const px of [-2,2]) for(const pz of [-2,2])
      tent.add(mesh(new THREE.CylinderGeometry(0.09,0.11,2.8,6),M(0x6f5238),px,1.4,pz));
    tent.add(mesh(new THREE.BoxGeometry(3.4,0.8,1.4),M(0x9a7a55),0,0.4,1.4));
    tent.position.set(sx,0,z); sc.add(tent);
    const gem=gemFor(sc,DOOR_COLORS.desert,sx,3.0,z);
    /* brazier + embers */
    const brz=mesh(new THREE.CylinderGeometry(0.4,0.3,0.7,8),M(0x4a3828),sx*0.4,0.35,z+2.6); sc.add(brz);
    const fire=new THREE.PointLight(0xff9a4a,7,9); fire.position.set(sx*0.4,1,z+2.6); sc.add(fire);
    const em=starPoints(sc,16,0.4,0.8,3,0.16,0xffb060);
    em.position.set(sx*0.4,0,z+2.6); embers.push(em);
    return {data,z,gem,done:false};
  });
  /* lantern strings overhead (catenaries across the street) */
  for(let k=0;k<5;k++){
    const g=new THREE.Group(), z=2+k*7;
    for(let i=0;i<=8;i++){
      const x=-6+i*1.5, y=4.6-Math.pow((i-4)/4,2)*-1* -1.1;   /* sag */
      const lam=mesh(new THREE.SphereGeometry(0.18,8,6),B([0xffd98a,0xff9ecb,0x9defc9,0x8fd8ff][i%4]),x,4.6-1.1*(1-Math.pow((i-4)/4,2)),z);
      g.add(lam);
      const pl=i===4?new THREE.PointLight(0xffd98a,4,8):null; if(pl){ pl.position.copy(lam.position); g.add(pl); }
    }
    g.userData.ph=k; sc.add(g); lanternGroups.push(g);
  }
  return { scene:sc, stations, len:D.stations.length*7+6,
    cam(u,ms,ch){ return { pos:V3(ch.x*0.3-2.2, 2.7, u-6), look:V3(ch.x*0.4,1.7,u+3) }; },
    anim(dt,ms){
      lanternGroups.forEach(g=>{ g.rotation.z=Math.sin(ms*0.0011+g.userData.ph)*0.045; });
      embers.forEach(em=>{ const p=em.geometry.attributes.position;
        for(let i=0;i<p.count;i++){ p.array[i*3+1]+=dt*1.4; if(p.array[i*3+1]>3) p.array[i*3+1]=0.8; }
        p.needsUpdate=true; });
    }
  };
}

/* ======================================================================
   4 · SNOW — THE FROZEN LIBRARY (inside a glacier, aurora overhead)
   ====================================================================== */
function frozenLibrary(){
  const sc=baseScene(0x11203d, 12, 58, 0.6);
  const dl=new THREE.DirectionalLight(0xcfe4ff,0.5); dl.position.set(-6,16,4); sc.add(dl);
  const fl=mesh(new THREE.PlaneGeometry(40,56),M(0xdfe9f7)); fl.rotation.x=-Math.PI/2; fl.position.z=11; sc.add(fl);
  const iceM=()=>M(0xa8c8f0,{transparent:true,opacity:0.55,flatShading:true});
  /* glacier walls + ceiling slabs */
  for(const sx of [-11,11]) for(let k=0;k<7;k++)
    sc.add(mesh(new THREE.BoxGeometry(2.5,rand(9,14),7.4),iceM(),sx+rand(-0.6,0.6),5.5,-4+k*7.6));
  for(let k=0;k<9;k++)
    sc.add(mesh(new THREE.BoxGeometry(22,1.6,rand(4,6.5)),iceM(),rand(-2,2),12.5,-4+k*6.4));
  /* library stacks: rows of translucent shelves */
  for(const sx of [-6.4,6.4]) for(let k=0;k<6;k++){
    const shelf=new THREE.Group();
    shelf.add(mesh(new THREE.BoxGeometry(1.4,7.5,3.2),M(0xc8ddf7,{transparent:true,opacity:0.7,flatShading:true}),0,3.75,0));
    for(let b=0;b<5;b++) shelf.add(mesh(new THREE.BoxGeometry(1.5,0.14,3.3),M(0x9ab8e0),0,1.2+b*1.35,0));
    shelf.position.set(sx,0,-2+k*5.2); sc.add(shelf);
  }
  /* aurora ribbon through the ice */
  const aurGeo=new THREE.PlaneGeometry(46,5,44,1);
  const aur=new THREE.Mesh(aurGeo,B({color:0x7dffb8,transparent:true,opacity:0.30,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  aur.position.set(0,13.6,10); aur.rotation.x=0.4; sc.add(aur);
  aur.userData.base=aurGeo.attributes.position.array.slice();
  /* ice-dust motes */
  const motes=starPoints(sc,120,14,1,12,0.14,0xe8f2ff);
  const D=DOMAINS.snow;
  const stations=D.stations.map((data,i)=>{
    const z=7+i*9, sx=i%2?3.2:-3.2;
    const tablet=mesh(new THREE.BoxGeometry(1.8,2.6,0.4),M(0xd8ecff,{transparent:true,opacity:0.85,emissive:0x8fb8e8,emissiveIntensity:0.25}),sx,1.6,z);
    tablet.rotation.y=i%2?-0.5:0.5; sc.add(tablet);
    const gem=gemFor(sc,DOOR_COLORS.snow,sx,3.4,z);
    return {data,z,gem,done:false};
  });
  return { scene:sc, stations, len:D.stations.length*9+7,
    cam(u,ms,ch){ return { pos:V3(ch.x-3.6, 3.9, u-6.6), look:V3(ch.x,1.6,u+2.6) }; },
    anim(dt,ms){
      const p=aurGeo.attributes.position, b=aur.userData.base;
      for(let i=0;i<p.count;i++) p.array[i*3+1]=b[i*3+1]+Math.sin(ms*0.0012+b[i*3]*0.32)*1.1;
      p.needsUpdate=true;
      const hue=(ms*0.00005)%1;
      aur.material.color.setHSL(0.35+0.25*Math.sin(ms*0.0004), 0.9, 0.62);
      const mp=motes.geometry.attributes.position;
      for(let i=0;i<mp.count;i++){ mp.array[i*3+1]-=dt*0.35; if(mp.array[i*3+1]<0.5) mp.array[i*3+1]=12; }
      mp.needsUpdate=true;
    }
  };
}

/* ======================================================================
   5 · SKY — THE STAR LOOM (no walls: a footstep-lit star bridge)
   ====================================================================== */
function starLoom(){
  const sc=baseScene(0x120f2e, 20, 120, 0.5);
  starPoints(sc,340,60,-6,40,0.3,0xfff2d8);
  const dl=new THREE.DirectionalLight(0xd8d8ff,0.5); dl.position.set(0,20,-10); sc.add(dl);
  /* cloud sea below */
  for(let i=0;i<26;i++){
    const c=mesh(new THREE.SphereGeometry(rand(2.5,6),8,6),M(0x3a3560,{transparent:true,opacity:0.85}),
      rand(-30,30),rand(-7,-4),rand(-10,40));
    c.scale.y=0.4; sc.add(c);
  }
  /* the star bridge: stones that light underfoot */
  const stones=[];
  for(let z=-3;z<=30;z+=2.1){
    const st=mesh(new THREE.CylinderGeometry(1.15,1.3,0.4,8),
      M(0x2c2752,{emissive:0x8f86ff,emissiveIntensity:0.06,flatShading:true}),
      Math.sin(z*0.4)*1.3,-0.2,z);
    sc.add(st); stones.push(st);
  }
  const D=DOMAINS.sky;
  const constellations=[];
  const stations=D.stations.map((data,i)=>{
    const z=8+i*10;
    const plinth=mesh(new THREE.CylinderGeometry(0.5,0.7,2.2,7),M(0x3a3468,{flatShading:true}),i%2?2.8:-2.8,1.1,z);
    sc.add(plinth);
    const gem=gemFor(sc,DOOR_COLORS.sky,plinth.position.x,2.9,z);
    /* a constellation that draws itself as you approach */
    const pts=[]; let px=plinth.position.x*2, py=6, pz=z-3;
    for(let k=0;k<6;k++){ pts.push(px,py,pz, px+=rand(-3,3), py+=rand(0.5,2.4), pz+=rand(-1,2)); }
    const cg=new THREE.BufferGeometry();
    cg.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
    const line=new THREE.LineSegments(cg,new THREE.LineBasicMaterial({color:0xffe9a8,transparent:true,opacity:0.85}));
    cg.setDrawRange(0,0); sc.add(line);
    constellations.push({line,z,total:pts.length/3});
    return {data,z,gem,done:false};
  });
  /* shooting star */
  const shoot=mesh(new THREE.CylinderGeometry(0.03,0.10,3.2,5),B(0xfff8d8),0,26,0);
  shoot.rotation.z=0.8; sc.add(shoot);
  let shootT=0;
  return { scene:sc, stations, len:30,
    cam(u,ms,ch){ const a=ms*0.00022;
      return { pos:V3(ch.x+Math.sin(a)*7.5, 4.6+Math.sin(ms*0.0006)*0.5, u-7+Math.cos(a)*1.4),
               look:V3(ch.x,1.6,u+2) }; },
    anim(dt,ms,u){
      stones.forEach(st=>{ const d=Math.abs(st.position.z-u);
        const target=d<2.2?0.9:0.06;
        st.material.emissiveIntensity+=(target-st.material.emissiveIntensity)*Math.min(1,dt*5); });
      constellations.forEach(c=>{ const prog=Math.max(0,Math.min(1,1-(c.z-u)/7));
        c.line.geometry.setDrawRange(0,Math.floor(prog*c.total)); });
      shootT+=dt;
      if(shootT>4){ shootT=0; shoot.position.set(rand(-24,24),rand(18,30),rand(0,30)); }
      shoot.position.x+=dt*22; shoot.position.y-=dt*9;
      shoot.material.opacity=Math.max(0,1-shootT*0.5);
      shoot.material.transparent=true;
    }
  };
}

/* ======================================================================
   6 · CITY — THE FOUNDRY FLOOR (neon industrial catwalk)
   ====================================================================== */
function foundryFloor(){
  const sc=baseScene(0x0d0a1c, 12, 60, 0.35);
  const dl=new THREE.DirectionalLight(0xbfa8ff,0.35); dl.position.set(-6,14,2); sc.add(dl);
  /* under-glow level */
  const glow=mesh(new THREE.PlaneGeometry(46,70),B(0x33104a)); glow.rotation.x=-Math.PI/2; glow.position.set(0,-2.4,14); sc.add(glow);
  const gl2=new THREE.PointLight(0xb14dff,9,30); gl2.position.set(0,-1.6,14); sc.add(gl2);
  /* grated catwalk */
  const walk=mesh(new THREE.BoxGeometry(7.5,0.35,46),M(0x241f38,{flatShading:true})); walk.position.set(0,-0.2,13); sc.add(walk);
  for(let z=-8;z<=34;z+=1.4) sc.add(mesh(new THREE.BoxGeometry(7.6,0.06,0.14),B(0x4a3f78),0,0.02,z));
  for(const sx of [-3.9,3.9]) for(let z=-8;z<=34;z+=3){
    sc.add(mesh(new THREE.CylinderGeometry(0.06,0.06,1.1,5),M(0x5a4f88),sx,0.55,z));
    sc.add(mesh(new THREE.BoxGeometry(0.08,0.08,3),M(0x5a4f88),sx,1.1,z+1.5));
  }
  /* conveyor of holographic project cores */
  const belt=mesh(new THREE.BoxGeometry(2.2,0.5,46),M(0x1a1530),-7.4,0.6,13); sc.add(belt);
  const cores=[];
  for(let i=0;i<6;i++){
    const core=mesh(new THREE.IcosahedronGeometry(0.55,0),
      B({color:[0xff2d78,0x36e0ff,0xb14dff,0x2dff9e][i%4],wireframe:true}), -7.4, 1.4, i*8-6);
    sc.add(core); cores.push(core);
  }
  /* steam vents */
  const vents=[];
  for(let i=0;i<3;i++){
    const v=starPoints(sc,20,0.5,0,3.4,0.3,0xcfc8ee);
    v.position.set(7.2,0,2+i*10); v.material.opacity=0.5; vents.push(v);
  }
  /* rotating gantry arm */
  const gantry=new THREE.Group();
  gantry.add(mesh(new THREE.CylinderGeometry(0.3,0.4,9,7),M(0x3a3160),0,4.5,0));
  const arm=mesh(new THREE.BoxGeometry(10,0.4,0.6),M(0x4a3f78),0,9,0); gantry.add(arm);
  arm.add(mesh(new THREE.SphereGeometry(0.3,8,6),B(0x36e0ff),4.6,-0.5,0));
  gantry.position.set(0,0,16); sc.add(gantry);
  const D=DOMAINS.city;
  const BAYC=[0xff2d78,0x36e0ff,0xb14dff,0x2dff9e];
  const stations=D.stations.map((data,i)=>{
    const z=6+i*7, sx=i%2?4.9:-4.9;
    const bay=new THREE.Group();
    bay.add(mesh(new THREE.BoxGeometry(0.5,4.4,0.5),M(0x241f3d),-1.6,2.2,0));
    bay.add(mesh(new THREE.BoxGeometry(0.5,4.4,0.5),M(0x241f3d),1.6,2.2,0));
    bay.add(mesh(new THREE.BoxGeometry(3.7,0.5,0.6),M(0x241f3d),0,4.4,0));
    bay.add(mesh(new THREE.PlaneGeometry(2.7,3.6),B({color:BAYC[i],transparent:true,opacity:0.22}),0,2.2,0));
    const strip=mesh(new THREE.BoxGeometry(3.7,0.14,0.14),B(BAYC[i]),0,4.75,0); bay.add(strip);
    bay.position.set(sx,0,z); bay.lookAt(0,0,z); sc.add(bay);
    const gem=gemFor(sc,BAYC[i],sx*0.7,1.6,z);
    return {data,z,gem,done:false};
  });
  return { scene:sc, stations, len:D.stations.length*7+6,
    cam(u,ms,ch){ return { pos:V3(ch.x-3.6, 3.3, u-6.4), look:V3(ch.x,1.7,u+2.8) }; },
    anim(dt,ms){
      cores.forEach(c=>{ c.position.z+=dt*1.8; c.rotation.y+=dt*2; c.rotation.x+=dt;
        if(c.position.z>34) c.position.z=-8; });
      vents.forEach((v,i)=>{ const p=v.geometry.attributes.position;
        const on=Math.sin(ms*0.001+i*2.1)>0.55;
        for(let k=0;k<p.count;k++){ p.array[k*3+1]+=dt*(on?2.6:0.4);
          if(p.array[k*3+1]>3.4) p.array[k*3+1]=0; }
        p.needsUpdate=true; v.material.opacity=on?0.5:0.18; });
      gantry.rotation.y=ms*0.0004;
    }
  };
}

/* ======================================================================
   7 · MEADOW — the night cabin (unchanged concept, kept as shipped)
   ====================================================================== */
function nightCabin(){
  const sc=baseScene(0x241a12, 14, 46, 0.55);
  sc.children[sc.children.length-1].color.set(0xffdcb0);          /* warm hemi */
  const dl=new THREE.DirectionalLight(0xffc9a0,0.35); dl.position.set(6,12,4); sc.add(dl);
  const wood=M(0x8a5f3d), woodD=M(0x6f4a2e);
  const fl=mesh(new THREE.BoxGeometry(13,0.4,36),wood,0,-0.2,11); sc.add(fl);
  for(let k=-5;k<=5;k+=2) sc.add(mesh(new THREE.BoxGeometry(0.06,0.42,36),woodD,k,-0.17,11));
  const wall=(w,h,d,x,y,z)=>sc.add(mesh(new THREE.BoxGeometry(w,h,d),woodD,x,y,z));
  wall(13,7,0.5,0,3.5,-7); wall(13,7,0.5,0,3.5,29);
  wall(0.5,7,36.5,-6.5,3.5,11); wall(0.5,7,36.5,6.5,3.5,11);
  sc.add(mesh(new THREE.BoxGeometry(13,0.5,36.5),woodD,0,7.2,11));
  const win=mesh(new THREE.PlaneGeometry(3.4,2.4),B(0x16233f),-6.2,3.4,9); win.rotation.y=Math.PI/2; sc.add(win);
  [[-4,0],[4,13]].forEach(pp=>{
    const post=mesh(new THREE.CylinderGeometry(0.06,0.08,1.8),M(0x8a6f57),pp[0],0.9,pp[1]); sc.add(post);
    const lamp=mesh(new THREE.SphereGeometry(0.2,8,6),B(0xffe9a8),pp[0],1.9,pp[1]); sc.add(lamp);
    const pl=new THREE.PointLight(0xffe9a8,3,5); pl.position.set(pp[0],1.9,pp[1]); sc.add(pl);
  });
  const hearth=new THREE.PointLight(0xffb070,16,18); hearth.position.set(4,1.8,4); sc.add(hearth);
  const desk=new THREE.Group();
  desk.add(mesh(new THREE.BoxGeometry(2.6,0.16,1.3),wood,0,1.05,0));
  [[-1.1,-0.5],[1.1,-0.5],[-1.1,0.5],[1.1,0.5]].forEach(l=>desk.add(mesh(new THREE.BoxGeometry(0.14,1.05,0.14),woodD,l[0],0.5,l[1])));
  const letter=mesh(new THREE.BoxGeometry(0.5,0.02,0.34),M(0xfff4e0),0.3,1.15,0); letter.rotation.y=0.4; desk.add(letter);
  desk.position.set(-3.2,0,6); desk.rotation.y=0.5; sc.add(desk);
  const bed=new THREE.Group();
  bed.add(mesh(new THREE.BoxGeometry(2.6,0.5,4.6),woodD,0,0.35,0));
  bed.add(mesh(new THREE.BoxGeometry(2.3,0.4,4.2),M(0xf4e6d8),0,0.75,0));
  bed.add(mesh(new THREE.BoxGeometry(2.32,0.18,2.6),M(0xc96f8a),0,0.92,0.7));
  bed.add(mesh(new THREE.BoxGeometry(1.5,0.26,0.8),M(0xfff8ee),0,0.98,-1.6));
  bed.add(mesh(new THREE.BoxGeometry(0.8,0.9,0.8),wood,1.9,0.45,-1.6));
  bed.position.set(3.2,0,17); sc.add(bed);
  const bedGlow=new THREE.PointLight(0xffc080,12,12); bedGlow.position.set(2.2,2.4,15.2); sc.add(bedGlow);
  sc.userData.bed={x:3.2,z:17,fairyPerch:new THREE.Vector3(5.1,1.25,15.4)};
  const D=DOMAINS.meadow;
  const stations=D.stations.map((data,i)=>{
    const z=6;
    const gem=gemFor(sc,DOOR_COLORS.meadow,-2.2,2.1,z);
    return {data,z,gem,done:false};
  });
  return { scene:sc, stations, len:22,
    cam(u,ms,ch){ return { pos:V3(-2.4,3.2,u-5.4), look:V3(ch.x*0.5,1.3,u+2.2) }; }
  };
}

return {
  forest: rootArchive(),
  river:  sunkenObservatory(),
  desert: mirageBazaar(),
  snow:   frozenLibrary(),
  sky:    starLoom(),
  city:   foundryFloor(),
  meadow: nightCabin()
};
}
