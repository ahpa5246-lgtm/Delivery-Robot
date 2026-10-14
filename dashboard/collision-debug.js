/* Real offline occupancy/proxy diagnostics sourced from the same world manifest
 * as Python A*, not an independently drawn visual approximation.
 * No live Gazebo, LiDAR, or hardware accuracy is implied.
 */
(() => {
  'use strict';
  const T=window.THREE,api=window.CDR3D;
  if(!T||!api)return;
  const $=id=>document.getElementById(id);
  const scene=api.scene;
  let model=null,grid=null,ring=null,map=null,currentRun=null;
  let markerVisible=false,lastSample=-1,requestId=0;
  const busyColor=0xd9a568,validColor=0x63e6bd;
  const boxes=new T.Group();
  boxes.name='AUTHORITATIVE_COLLISION_PROXIES';
  scene.add(boxes);
  const gridGroup=new T.Group();
  gridGroup.name='ROBOT_INFLATED_OCCUPANCY';
  scene.add(gridGroup);
  function clear(group){
    for(const obj of [...group.children]){
      group.remove(obj);
      obj.geometry?.dispose();
      obj.material?.dispose();
    }
  }
  function fixtureBounds(){
    if(!map)return [];
    const built=(map.buildings||[]).map((rect,i)=>({id:'building_'+i,rect}));
    const placed=(map.fixtures||[]).map(x=>({id:x.id,rect:x.footprint_m}));
    return [...built,...placed];
  }
  function createProxies(){
    clear(boxes);
    for(const {id,rect} of fixtureBounds()){
      const [x0,y0,x1,y1]=rect;
      const geometry=new T.EdgesGeometry(new T.BoxGeometry(x1-x0,.09,y1-y0));
      const wire=new T.LineSegments(geometry,
        new T.LineBasicMaterial({color:busyColor,transparent:true,opacity:.80}));
      wire.position.set((x0+x1)/2,.105,-(y0+y1)/2);
      wire.userData.sourceFixture=id;
      boxes.add(wire);
    }
    boxes.visible=$('debug-collision').checked;
    $('debug-obstacles').textContent=String(fixtureBounds().length);
  }
  async function fetchOccupancy(){
    const serial=++requestId,theme=map.world;
    const response=await fetch('/api/occupancy?'+new URLSearchParams({world:theme}));
    if(!response.ok)throw Error('occupancy grid unavailable');
    const data=await response.json();
    if(serial!==requestId||!map||data.world!==map.world)return;
    if(data.geometry_schema!==map.geometry_schema)throw Error('occupancy provenance mismatch');
    clear(gridGroup);
    const points=data.blocked_cells;
    const geometry=new T.BoxGeometry(data.resolution_m,.028,data.resolution_m);
    const material=new T.MeshBasicMaterial({color:0xf0a66f,transparent:true,opacity:.19,
      depthWrite:false});
    const inst=new T.InstancedMesh(geometry,material,points.length);
    const mtx=new T.Matrix4();
    points.forEach(([x,y],i)=>{
      mtx.makeTranslation((x+.5)*data.resolution_m,.16,-(y+.5)*data.resolution_m);
      inst.setMatrixAt(i,mtx);
    });
    inst.instanceMatrix.needsUpdate=true;
    gridGroup.add(inst);
    gridGroup.visible=$('debug-occupancy').checked;
    $('debug-blocked').textContent=String(points.length)+' / '+String(data.width*data.height);
  }
  function distanceToRect(x,y,b){
    const [x0,y0,x1,y1]=b;
    return Math.hypot(Math.max(0,x0-x,x-x1),Math.max(0,y0-y,y-y1));
  }
  function segmentHitsRect(a,b,rect,pad){
    let lo=0,hi=1;
    for(const [origin,d,lower,upper] of [
      [a.x_m,b.x_m-a.x_m,rect[0]-pad,rect[2]+pad],
      [a.y_m,b.y_m-a.y_m,rect[1]-pad,rect[3]+pad]
    ]){
      if(Math.abs(d)<1e-12){if(origin<lower||origin>upper)return false;}
      else{
        let t0=(lower-origin)/d,t1=(upper-origin)/d;
        if(t0>t1)[t0,t1]=[t1,t0];
        lo=Math.max(lo,t0);hi=Math.min(hi,t1);
        if(lo>hi)return false;
      }
    }
    return true;
  }
  function audit(run){
    currentRun=run;
    if(!run||!map)return;
    if(run.geometry_schema!==map.geometry_schema||run.world!==map.world){
      $('debug-path-valid').textContent='WORLD MISMATCH';
      $('debug-path-valid').classList.add('invalid');return;
    }
    const boxes=fixtureBounds(),padding=map.robot_radius_m+map.safety_margin_m;
    let breaches=0;
    for(let i=1;i<run.frames.length;i++){
      const a=run.frames[i-1],b=run.frames[i];
      if(boxes.some(o=>segmentHitsRect(a,b,o.rect,padding)))breaches++;
    }
    const pass=breaches===0 && run.collision_checked===true;
    $('debug-path-valid').textContent=pass?'PASS · KNOWN STATIC WORLD':'STOP · COLLISION RISK';
    $('debug-path-valid').classList.toggle('invalid',!pass);
    $('debug-violations').textContent=String(breaches);
    $('debug-world').textContent=map.world==='warehouse'?'Logistics':'Campus';
    $('debug-clearance-source').textContent='From XY fixture bounds · radius '+
      map.robot_radius_m.toFixed(2)+' m + '+map.safety_margin_m.toFixed(2)+' m margin';
  }
  function updateFrame(time){
    if(!map||!currentRun)return;
    const frames=currentRun.frames;
    let left=0,right=frames.length-1;
    while(left<right){
      const middle=Math.ceil((left+right)/2);
      if(frames[middle].time_s<=time)left=middle;else right=middle-1;
    }
    if(left===lastSample)return;
    lastSample=left;
    const pose=frames[left];
    let meters=Infinity;
    for(const o of fixtureBounds())meters=Math.min(meters,
      distanceToRect(pose.x_m,pose.y_m,o.rect));
    const clearance=meters-map.robot_radius_m;
    $('debug-clearance').textContent=Number.isFinite(clearance)?clearance.toFixed(2)+' m':'—';
    $('debug-clearance').classList.toggle('invalid',clearance<map.safety_margin_m-.001);
    if(ring){
      ring.position.set(pose.x_m,.20,-pose.y_m);
      ring.visible=$('debug-footprint').checked;
    }
  }
  function setupRing(){
    if(ring){scene.remove(ring);ring.geometry.dispose();ring.material.dispose();}
    if(!map)return;
    const radius=map.robot_radius_m+map.safety_margin_m;
    ring=new T.Mesh(new T.RingGeometry(radius-.017,radius,48),
      new T.MeshBasicMaterial({color:validColor,transparent:true,opacity:.93,side:T.DoubleSide,
        depthWrite:false}));
    ring.rotation.x=-Math.PI/2;
    ring.userData.visualOnly=true;
    scene.add(ring);
    ring.visible=$('debug-footprint').checked;
  }
  function loadMap(newMap){
    map=newMap;currentRun=null;lastSample=-1;
    createProxies();setupRing();
    fetchOccupancy().catch(err=>{
      $('debug-blocked').textContent='Unavailable: '+err.message;
    });
  }
  function handleReplay(e){
    if(e?.detail?.run) {
      if(e.detail.run!==currentRun){lastSample=-1;audit(e.detail.run);}
    }
    updateFrame(e?.detail?.time??0);
  }
  for(const [input,group] of [['debug-collision',boxes],['debug-occupancy',gridGroup]]){
    $(input).addEventListener('change',()=>{group.visible=$(input).checked;});
  }
  $('debug-footprint').addEventListener('change',()=>{if(ring)ring.visible=$('debug-footprint').checked;});
  window.addEventListener('cdr:world-map',e=>loadMap(e.detail.map));
  window.addEventListener('cdr:replay',handleReplay);
  window.addEventListener('cdr:frame',handleReplay);
  if(window.__cdrReplayState?.map){
    loadMap(window.__cdrReplayState.map);
    if(window.__cdrReplayState.run)handleReplay({detail:{
      run:window.__cdrReplayState.run,time:window.__cdrReplayState.time}});
  }
})();
