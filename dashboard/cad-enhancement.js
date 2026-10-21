/* Genuine source CAD / Collada geometry, separate from the CDR-01 replay engine.
 * Assets are locally vendored with upstream license and attribution in assets/SOURCES.md.
 * The visual models do not change kinematics, collision, Nav2, Gazebo or measurements. */
(() => {
 'use strict';
 const THREE=window.THREE, CAD=window.CDR3D;
 const status=document.getElementById('mesh-provenance');
 if(!THREE||!CAD||!THREE.STLLoader||!THREE.ColladaLoader){
   if(status)status.textContent='3D CAD assets unavailable — simple scene retained';
   return;
 }
 const stl=new THREE.STLLoader(),dae=new THREE.ColladaLoader();
 const assets={
  wheel:'/assets/robot/rbot-wheel.stl',
  chassis:'/assets/robot/rbot-chassis.stl',
  mecanumChassis:'/assets/robot/mecanum-chassis.stl',
  camera:'/assets/robot/rbot-camera.stl',
  delivery:'/assets/robot/delivery-cad-part.stl',
  shelf:'/assets/world/warehouse-shelf.dae',
  lamp:'/assets/world/warehouse-lamp.dae',
  cargo:'/assets/world/warehouse-cargo.dae',
  roof:'/assets/world/warehouse-roof.dae',
  table:'/assets/world/cafe-table.dae',
  office:'/assets/world/clearpath-office.dae'
 };
 const meshCache=new Map();
 const loaded=new Set();
 const loadCad=(name)=>{
  if(meshCache.has(name))return meshCache.get(name);
  const promise=(async()=>{
    const response=await fetch(assets[name],{cache:'force-cache'});
    if(!response.ok)throw Error('Missing CAD asset '+name);
    if(assets[name].endsWith('.stl')){
      const geom=stl.parse(await response.arrayBuffer());
      geom.computeBoundingBox();geom.computeVertexNormals();
      geom.center();
      return {type:'stl',geometry:geom};
    }
    // ColladaLoader resolves original source material references relative to the DAE URL.
    if(name==='office') {
      // Clearpath's office references external large texture JPGs. Preserve the
      // licensed original geometry while substituting neutral material pixels
      // so the locally-hosted viewer does not make broken image requests.
      const xml=await response.text();
      const pixel='Maple.jpg';
      const sanitized=xml.replace(/<library_images>[\s\S]*?<\/library_images>/,section=>
        section.replace(/<init_from>[^<]*\.(?:jpg|png)[^<]*<\/init_from>/gi,'<init_from>'+pixel+'</init_from>'));
      const collada=dae.parse(sanitized,'/assets/world/');
      collada.scene.traverse(o=>{
        if(o.isMesh) {
          const label=(o.name||'').toLowerCase();
          const tone=label.includes('glass')?0x729fb0:label.includes('floor')?0x8f9c9b:0xb3c3bf;
          o.material=new THREE.MeshStandardMaterial({color:tone,roughness:.7,metalness:.12,side:THREE.DoubleSide});
        }
      });
      return {type:'dae',scene:collada.scene};
    }
    const collada=await new Promise((resolve,reject)=>
      dae.load(assets[name],resolve,undefined,reject));
    return {type:'dae',scene:collada.scene};
  })();
  meshCache.set(name,promise);
  return promise;
 };
 const cadMaterial=(tone)=>new THREE.MeshStandardMaterial({color:tone,metalness:.47,roughness:.42,side:THREE.DoubleSide});
 const COLORS={wheel:0x222a34,camera:0x1b5c76,delivery:0xe6a86a,chassis:0x78a3a8,mecanumChassis:0xc9ad83};
 function meshFor(type, target, dimension, position, rotation=[0,0,0]){
   const m=new THREE.Mesh(target.geometry,cadMaterial(COLORS[type]||0x759fb0));
   const box=target.geometry.boundingBox;
   const bounds=box.getSize(new THREE.Vector3());
   const factor=dimension/Math.max(.0001,bounds.x,bounds.y,bounds.z);
   m.scale.setScalar(factor);
   m.position.set(...position);m.rotation.set(...rotation);
   m.castShadow=true;m.receiveShadow=true;
   m.userData.sharedCad=true;
   return m;
 }
 let robotGeneration=0,worldGeneration=0;
 async function onRobot(e){
    const token=++robotGeneration, {profile,robot,preview}=e.detail;
    const shell=(profile==='mecanum'?'mecanumChassis':(['cdr','rbot','lino'].includes(profile)?'chassis':null));
    const meshNames=['wheel','camera',...(shell?[shell]:[]),...(profile==='six'?['delivery']:[])];
    const results=await Promise.allSettled(meshNames.map(loadCad));
    if(token!==robotGeneration||!robot||!robot.parent)return;
    const found={};
    for(let i=0;i<results.length;i++)if(results[i].status==='fulfilled')found[meshNames[i]]=results[i].value;
    if(shell && found[shell]){
      const pos=[0,.50,0],geom=found[shell];
      const body=meshFor(shell,geom,profile==='mecanum'?.95:1.05,pos,[0,0,0]);
      robot.add(body);
      const placeholder=robot.getObjectByName('primitive-chassis-body');
      if(placeholder)placeholder.visible=false;
      if(preview){
        preview.add(meshFor(shell,geom,profile==='mecanum'?.95:1.05,pos));
        const previewPlaceholder=preview.getObjectByName('primitive-chassis-body');
        if(previewPlaceholder)previewPlaceholder.visible=false;
      }
      loaded.add(shell);
    }
    if(found.wheel){
      const positions=(profile==='six'?[ -.36,0,.36 ]:[-.35,.35]);
      const radius=profile==='clearpath'?.39:profile==='tb3'||profile==='tb4'?.20:.32;
      // Imported wheel has its original triangulated CAD profile. We retain the
      // underlying simple wheel as fallback in case asset decoding fails.
      for(const x of positions)for(const side of [-1,1]){
        const pos=[x,.20,side*(profile==='clearpath'?.43:.385)];
        const detail=meshFor('wheel',found.wheel,radius,pos,[0,Math.PI/2,0]);
        robot.add(detail);
        // Also include genuine mesh in the independent inspection viewport.
        if(preview)preview.add(meshFor('wheel',found.wheel,radius,pos,[0,Math.PI/2,0]));
      }
      loaded.add('wheel');
    }
    if(found.camera){
      const pos=[.25,.88,0];
      robot.add(meshFor('camera',found.camera,.19,pos));
      if(preview)preview.add(meshFor('camera',found.camera,.19,pos));
      loaded.add('camera');
    }
    if(found.delivery){
      const pos=[0,.56,.11];
      robot.add(meshFor('delivery',found.delivery,.29,pos));
      if(preview)preview.add(meshFor('delivery',found.delivery,.29,pos));
      loaded.add('delivery');
    }
    showStatus();
 }
 function fitObject(original,maxDimension,at,rotationY=0){
   const g=new THREE.Group(),content=original.clone(true);
   // Using material and texture references from the upstream mesh, not recreating its shape.
   g.add(content);
   const bounds=new THREE.Box3().setFromObject(content);
   if(bounds.isEmpty())return null;
   const size=bounds.getSize(new THREE.Vector3());
   const center=bounds.getCenter(new THREE.Vector3());
   content.position.sub(center);
   const scale=maxDimension/Math.max(size.x,size.y,size.z,.001);
   g.scale.setScalar(scale);
   g.position.set(at[0],at[1]+size.y*scale*.50,at[2]);
   g.rotation.y=rotationY;
   g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.userData.sharedCad=true;}});
   return g;
 }
 // CAD placement is never authored independently from the collision world.
 // All furniture locations and their robot-safe proxy bounds come from /api/map.
 async function onWorld(e){
   const token=++worldGeneration,{environment,theme,map}=e.detail;
   const names=theme==='warehouse'?['shelf','cargo','roof']:['office','table'];
   const data=await Promise.allSettled(names.map(loadCad));
   if(token!==worldGeneration||environment!==CAD.environment)return;
   const loadedAssets={};
   for(let i=0;i<names.length;i++)if(data[i].status==='fulfilled'){
     loadedAssets[names[i]]=data[i].value;
     loaded.add(names[i]);
   }
   // Warehouse uses a different collision map with only two wall boxes.
   // Never read a campus east-wing rectangle in the logistics theme.
   if(theme==='campus' && map.buildings?.[2] && loadedAssets.office?.type==='dae'){
     const east=map.buildings[2];
     const eastCenter=[(east[0]+east[2])/2,3.25,-(east[1]+east[3])/2];
     const office=fitObject(loadedAssets.office.scene,2.9,eastCenter);
     if(office){office.name='licensed-office';environment.add(office);}
   }
   if(theme==='warehouse'&&loadedAssets.roof?.type==='dae'){
     const roof=fitObject(loadedAssets.roof.scene,2.4,[10,3.35,-3.0]);
     if(roof){roof.name='licensed-roof';environment.add(roof);}
   }
   for(const fixture of map.fixtures||[]){
     const key=fixture.cad_asset;
     const asset=loadedAssets[key];
     if(!asset||asset.type!=='dae'||!['table','shelf','cargo'].includes(key))continue;
     const [x0,y0,x1,y1]=fixture.footprint_m;
     const center=[(x0+x1)/2,0,-(y0+y1)/2];
     const obj=fitObject(asset.scene,Math.min(x1-x0,y1-y0)*.82,center);
     if(!obj)continue;
     // Keep the decorative mesh within the physical footprint that the planner
     // inflates. Fail closed if a complex upstream file cannot be fitted.
     const bb=new THREE.Box3().setFromObject(obj);
     const tolerance=.055;
     if(bb.min.x<x0-tolerance||bb.max.x>x1+tolerance||
        bb.min.z< -y1-tolerance||bb.max.z> -y0+tolerance){
       continue;
     }
     obj.name='licensed-'+key;
     obj.userData.collisionFixtureId=fixture.id;
     environment.add(obj);
   }
   showStatus();
 }
 function showStatus(){
   if(status)status.textContent=loaded.size
     ? loaded.size+' ORIGINAL CAD / COLLADA ASSETS LOADED · UPSTREAM ATTRIBUTED'
     : 'LOADING ORIGINAL CAD MODELS…';
 }
 window.addEventListener('cdr:robot-model',onRobot);
 window.addEventListener('cdr:environment',onWorld);
 showStatus();
 // Scene may have initialized before this optional enrichment module loaded.
 if(CAD.getRobot())onRobot({detail:{profile:CAD.getModel(),robot:CAD.getRobot(),preview:CAD.getPreview()}});
 if(CAD.environment?.children?.length)onWorld({detail:{environment:CAD.environment,theme:CAD.getWorld()}});
})();
