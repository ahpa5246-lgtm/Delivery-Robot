/* Visual-only campus enrichment, never alters Gazebo, physics or occupancy.
 * All geometry is authored here; CAD from licensed sources stays in cad-enhancement.js.
 * Batch instanced geometry for low GPU draw-call count.
 */
(() => {
  'use strict';
  const T=window.THREE,api=window.CDR3D;
  if(!T||!api)return;
  const world=api.environment,scene=api.scene;
  const mat=(c,opts={})=>new T.MeshStandardMaterial({color:c,roughness:.85,metalness:.03,...opts});
  const palette={
    grass:mat(0x3c6752),path:mat(0x868f88),kerb:mat(0xc7c7ad),
    asphalt:mat(0x52616a),marking:mat(0xe7e4d8),copper:mat(0xaf8567),
    steel:mat(0x516775,{metalness:.54,roughness:.42}),foliage:mat(0x40775d),
    olive:mat(0x678763),mint:mat(0x76a68a),soil:mat(0x473d34),
    brick:mat(0x7c6c5e),wood:mat(0x9f7a52),cream:mat(0xe1ceb0),
    glow:mat(0xd9f4f0,{emissive:0x4d9482,emissiveIntensity:.52})
  };
  const reusable={box:new T.BoxGeometry(1,1,1),cyl:new T.CylinderGeometry(1,1,1,10),
    cone:new T.ConeGeometry(1,1,7),sphere:new T.IcosahedronGeometry(1,1)};
  let visualRoot=null,lastMode=null,themeMode='clear',clockMode='day',decorCount=0;
  const mx=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3(),worldUp=new T.Vector3(0,1,0);
  const seedRandom=(seed)=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  function batch(group,geom,material,entries){
    if(!entries.length)return;
    const mesh=new T.InstancedMesh(geom,material,entries.length);
    entries.forEach((e,i)=>{
      const [x,y,z,sx,sy,sz,rot=0]=e;
      p.set(x,y,z);q.setFromAxisAngle(worldUp,rot);
      scale.set(sx,sy,sz);mx.compose(p,q,scale);mesh.setMatrixAt(i,mx);
    });
    mesh.instanceMatrix.needsUpdate=true;
    mesh.castShadow=false;mesh.receiveShadow=true;mesh.frustumCulled=false;
    mesh.userData.visualOnly=true;group.add(mesh);decorCount+=entries.length;
  }
  function texturedPavement(){
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
    const c=canvas.getContext('2d');c.fillStyle='#868c87';c.fillRect(0,0,256,256);
    // Pattern is a subtle material, not fake simulated pavement data.
    const rnd=seedRandom(709);
    for(let y=0;y<256;y+=32)for(let x=0;x<256;x+=64){
      const offset=(y/32)%2?32:0;
      const b=Math.floor(rnd()*22);
      c.fillStyle='rgb('+(125+b)+','+(135+b)+','+(130+b)+')';
      c.fillRect(x+offset+1,y+1,62,30);
    }
    const texture=new T.CanvasTexture(canvas);
    texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(8,5);
    texture.anisotropy=2;
    return mat(0xffffff,{map:texture,roughness:.96});
  }
  function build(data,theme){
    if(visualRoot){
      world.remove(visualRoot);
      visualRoot.traverse(o=>{if(o.isInstancedMesh)o.dispose?.()});
    }
    visualRoot=new T.Group();visualRoot.name='VISUAL_ONLY_CAMPUS_DETAILS';
    world.add(visualRoot);decorCount=0;lastMode=theme;
    const warehouse=theme==='warehouse';
    const paths=[],curbs=[],crosswalk=[],guides=[],planter=[],bushes=[],bush2=[],
      trees=[],crowns=[],crowns2=[],fenceposts=[],rails=[],benches=[],seats=[],
      lights=[],signs=[],solar=[],bikes=[],shelves=[],boxes=[],stripes=[];
    // Printed paving texture on actual walkways, kerb seams along walkways.
    const paving=texturedPavement();
    const strips=[];
    for(const y of [7,14])strips.push([16,.044,-y,32,0.06,1.66]);
    for(const x of [6.5,16,26])strips.push([x,.047,-10,1.57,.06,20]);
    batch(visualRoot,reusable.box,paving,strips);
    for(const y of [7,14]){
      for(const offset of [-.95,.95])curbs.push([16,.085,-y+offset,32,.12,.07]);
      for(let x=1;x<31;x+=2.8){
        crosswalk.push([x,.083,-y,0.6,.008,.08]);
      }
    }
    for(const x of [6.5,16,26]){
      for(const off of [-.9,.9])curbs.push([x+off,.083,-10,.07,.12,20]);
    }
    if(!warehouse){
      // Landscaped boundary along the perimeter, away from actual robot route.
      for(const x of [1.0,3.1,5.2,8.2,10.3,12.4,14.5,18,20.2,22.4,24.6,28.1,30.4]){
        for(const y of [0.65,19.2]){
          planter.push([x,.14,-y,1.05,.24,.54]);
          for(let j=0;j<3;j++){
            bushes.push([x+(j-1)*.26,.36,-y,0.27,.32,.26]);
          }
        }
      }
      // Trees in planters and organic canopies, no primitive sphere foliage.
      const places=[[2.1,2.1],[4.6,17.8],[9.1,18.8],[13.1,1.2],[19.1,18.5],
        [23.4,1.3],[29.8,2.8],[29.4,17.8],[2.3,11.8],[18.6,4.4]];
      places.forEach(([x,y],i)=>{
        const z=-y;
        trees.push([x,.83,z,.11,1.67,.11]);
        crowns.push([x,1.80,z,.72,.88,.73,0]);
        crowns2.push([x+.31,2.06,z-.21,.53,.64,.54,i*.6]);
        crowns2.push([x-.30,1.80,z+.24,.51,.62,.48,i*.9]);
        planter.push([x,.12,z,1.38,.22,1.38]);
      });
      // Soft tree trunk under cone leaves and irregular clumps.
      const lampSites=[[1,1],[1,10],[1,18.7],[31,1],[31,10],[31,19],
        [9.9,1],[21.3,1],[9.9,18.8],[21.3,18.8]];
      lampSites.forEach(([x,y])=>{
        lights.push([x,1.24,-y,.065,2.48,.065]);
        signs.push([x,2.52,-y,.42,.12,.24]);
      });
      for(const [x,y] of [[3.8,5.1],[12.7,17.3],[20.2,15.5],[28.9,12.4]]){
        benches.push([x,.47,-y,1.45,.12,.40]);
        seats.push([x,.74,-y-.22,1.45,.43,.12]);
      }
      // Accessible entrance markings; appearance does not assert compliance.
      for(let x=2.0;x<5.5;x+=.35)stripes.push([x,.085,-2.6,.12,.01,.8]);
      // Cycle parking stands made from steel posts and rails.
      for(let i=0;i<4;i++){
        const x=17.7+i*.48; bikes.push([x,.34,-2,.06,.68,.06]);
      }
      for(const x of [0.35,31.65])for(let y=.9;y<20;y+=1.25){
        fenceposts.push([x,.49,-y,.05,.97,.05]);
      }
      for(const y of [-.35,-19.65])for(let x=0.7;x<32;x+=1.3)
        fenceposts.push([x,.49,y,.05,.97,.05]);
      rails.push([.35,.72,-10,.05,.05,19.1],[31.65,.72,-10,.05,.05,19.1],
        [16,.72,-.35,30.8,.05,.05],[16,.72,-19.65,30.8,.05,.05]);
      // CAD façades remain; rooftop solar detail gives each building individuality.
      for(const b of data.buildings.slice(0,3)){
        const [x0,y0,x1,y1]=b,x=(x0+x1)/2,z=-(y0+y1)/2;
        solar.push([x,3.68,z,Math.max(.6,x1-x0-1.25),.06,1.2]);
      }
    }else{
      // Shipment/loading architecture without copying old Gazebo Classic scripts.
      for(const y of [2,18])for(const x of [3,7,11,19,23,27]){
        boxes.push([x,.48,-y,.88,.96,.89]);
        boxes.push([x+.7,.27,-y,.56,.54,.57]);
      }
      for(let x=2;x<32;x+=3.0){
        shelves.push([x,1.05,-3.2,1.5,2,.40]);
        shelves.push([x,1.05,-17.1,1.5,2,.40]);
      }
    }
    batch(visualRoot,reusable.box,palette.kerb,curbs);
    batch(visualRoot,reusable.box,palette.marking,crosswalk);
    batch(visualRoot,reusable.box,palette.brick,planter);
    batch(visualRoot,reusable.box,palette.wood,benches);
    batch(visualRoot,reusable.box,palette.steel,seats);
    batch(visualRoot,reusable.box,palette.steel,lights);
    batch(visualRoot,reusable.box,palette.glow,signs);
    batch(visualRoot,reusable.box,palette.steel,fenceposts);
    batch(visualRoot,reusable.box,palette.steel,rails);
    batch(visualRoot,reusable.box,palette.marking,stripes);
    batch(visualRoot,reusable.box,palette.steel,bikes);
    batch(visualRoot,reusable.box,mat(0x28627b,{metalness:.35,roughness:.25}),solar);
    batch(visualRoot,reusable.cyl,palette.wood,trees);
    batch(visualRoot,reusable.sphere,palette.foliage,crowns);
    batch(visualRoot,reusable.sphere,palette.olive,crowns2);
    batch(visualRoot,reusable.sphere,palette.mint,bushes);
    batch(visualRoot,reusable.box,palette.copper,boxes);
    batch(visualRoot,reusable.box,palette.steel,shelves);
    visualRoot.userData={visualOnly:true,decorativeInstances:decorCount};
    document.getElementById('scene-detail-count').textContent=decorCount.toLocaleString();
    document.getElementById('scene-detail-mode').textContent=warehouse?'Logistics detail':'Campus landscape';
  }
  function setLighting(value){
    clockMode=value;
    const sceneLight=scene.children.filter(o=>o.isHemisphereLight||o.isDirectionalLight);
    const hemi=sceneLight.find(o=>o.isHemisphereLight),sun=sceneLight.find(o=>o.isDirectionalLight);
    const presets={
      day:{back:0x142b3b,fog:0x142b3b,h:1.0,s:1.5,dir:[12,33,8]},
      golden:{back:0x443c43,fog:0x443c43,h:.65,s:2.15,dir:[-17,12,-7]},
      night:{back:0x0b1526,fog:0x0b1526,h:.34,s:.38,dir:[-9,14,-14]}
    };
    const p=presets[value]||presets.day;
    scene.background.setHex(p.back);if(scene.fog)scene.fog.color.setHex(p.fog);
    if(hemi)hemi.intensity=p.h;
    if(sun){sun.intensity=p.s;sun.position.set(...p.dir);}
    document.getElementById('lighting-caption').textContent=
      value==='night'?'Night — visualization':value==='golden'?'Evening — visualization':'Day — visualization';
  }
  const select=document.getElementById('lighting-preset');
  select?.addEventListener('change',e=>setLighting(e.target.value));
  window.addEventListener('cdr:environment',e=>build(e.detail.map,e.detail.theme));
  const current=window.__cdrReplayState?.map;
  if(current)build(current,document.getElementById('world-preset').value);
  setLighting(select?.value||'day');
})();
