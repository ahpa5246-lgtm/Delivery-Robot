/* One-scene Gaussian splat + real engine-entity robot, without any iframe.
   All pose playback is explicitly labeled and unregistered until surveyed. */
import { createViewer } from '@playcanvas/supersplat-viewer/viewer';
import { defaultSettings } from '@playcanvas/supersplat-viewer/settings';
import { Entity, Color, StandardMaterial, Vec3 } from 'playcanvas';
import { scenePose, sceneTrajectory } from './garden-pose.js';
let trajectoryVertices=[];
let sceneIdentity='USER-PROVIDED GAUSSIAN SCENE',verifiedGarden=false,followRobot=false;
const cameraView=()=>$('camera-view')?.value||'chase';
function updateFollow(){
 if(!followRobot||!robot||!viewer)return;
 const camera=viewer.app.root.findByName('camera');if(!camera)return;
 const p=robot.getPosition(),size=Number($('robot-scale').value)||1;
 const offsets={chase:[-2.6,1.7,2.6],side:[0,1,3.4],top:[.01,4,.01]};
 const o=offsets[cameraView()];
 camera.setPosition(p.x+o[0]*size,p.y+o[1]*size,p.z+o[2]*size);
 camera.lookAt(p.x,p.y+.3*size,p.z);camera.camera.nearClip=.01;camera.camera.farClip=1000;viewer.app.renderNextFrame=true;
}
function refreshTrajectory(){
 if(!trajectory){trajectoryVertices=[];return;}
 trajectoryVertices=sceneTrajectory(trajectory.frames,{originX:val('origin-x'),originY:val('origin-y'),originZ:val('origin-z'),yawDegrees:val('robot-yaw'),metersPerUnit:val('scene-to-meters'),visualScale:val('robot-scale')});
}
function drawTrajectory(){
 if(!trajectory||!viewer||!trajectoryVertices.length)return;
 const past=[],future=[];
 for(let i=1;i<trajectoryVertices.length;i++){
  const a=trajectoryVertices[i-1],b=trajectoryVertices[i];
  const list=b.time<=playbackSeconds?past:future;
  list.push(new Vec3(a.x,a.y+.025,a.z),new Vec3(b.x,b.y+.025,b.z));
 }
 if(future.length)viewer.app.drawLines(future,new Color(.35,.38,.42),true);
 if(past.length)viewer.app.drawLines(past,new Color(.95,.65,.25),true);
}
function focusRobot(){
 if(!robot||!viewer)return;
 viewer.events.fire('pick',robot.getPosition().clone());
 status('CAMERA TARGET SET TO ROBOT · ENABLE FOLLOW FOR CLOSE TRACKING');
}

const $=id=>document.getElementById(id);
let viewer=null,robot=null,sourceUrl=null,trajectory=null,timer=0,playing=false,startAt=0;
let manualPose={x:0,z:0,yaw:0};
let groundAnchor=false,manualDistance=0,lastWorld=null,motionSource='manual';
let needsPlacement=true;
let replayDistance=0,playbackSeconds=0;
const pickingOverlay=$('ground-pick-layer'),floorY=$('floor-y');
if(new URLSearchParams(location.search).get('embed')==='1')document.body.classList.add('embedded');
const quickIds=['quick-forward','quick-left','quick-right','quick-back','quick-ground','quick-focus'];
const baseIds=['drive-forward','drive-left','drive-right','drive-back'];
quickIds.slice(0,4).forEach((id,i)=>$(id)?.addEventListener('click',()=>$(baseIds[i])?.click()));
const panelToggle=$('panel-toggle'), optionsPanel=$('lab-options');
panelToggle?.addEventListener('click',()=>{
  optionsPanel.hidden=!optionsPanel.hidden;
  panelToggle.setAttribute('aria-expanded',String(!optionsPanel.hidden));
});
function publishPose(){
 if(!robot)return;
 const p=robot.getPosition(),now={x:p.x,y:p.y,z:p.z};
 if(lastWorld&&groundAnchor&&motionSource==='manual')
  manualDistance+=Math.hypot(now.x-lastWorld.x,now.z-lastWorld.z)*val('scene-to-meters');
 lastWorld=now;
 if(window.parent!==window)
  window.parent.postMessage({type:'cdr:garden-pose',source:motionSource,
   x:now.x,y:now.y,z:now.z,yaw:robot.getEulerAngles().y,
   distance:motionSource==='manual'?manualDistance:replayDistance,
   anchor:groundAnchor,distance_unit:'m',position_unit:'scene-unit'},location.origin);
}
function projectToGround(nx,ny){
 if(!robot||!viewer)return false;
 const cam=viewer.app.root.findByName('camera');
 if(!cam?.camera){status('3D CAMERA NOT READY');return false;}
 const eye=cam.getPosition(),device=viewer.app.graphicsDevice;
 const end=cam.camera.screenToWorld(nx*device.width,ny*device.height,1);
 const dir=end.clone().sub(eye);
 const y=Number(floorY.value),t=(y-eye.y)/dir.y;
 if(!Number.isFinite(t)||Math.abs(dir.y)<1e-5||t<=0||t>500){
  status('RAY MISSES GROUND PLANE · CHOOSE LOWER IMAGE OR CHANGE FLOOR Y');
  return false;
 }
 const p=eye.clone().add(dir.mulScalar(t));
 trajectory=null;stop();replayDistance=0;playbackSeconds=0;
 $('origin-x').value=p.x.toFixed(3);
 $('origin-y').value=y.toFixed(3);
 $('origin-z').value=p.z.toFixed(3);
 manualPose={x:0,z:0,yaw:0};
 groundAnchor=true;needsPlacement=false;lastWorld=null;manualDistance=0;motionSource='manual';
 robot.enabled=true;
 sourceLabel('CDR-01 · MANUAL CONTROL');
 applyPose(0,0,0);
 pickingOverlay.hidden=true;
 $('garden-floor-help').hidden=true;
 $('pose-readout').textContent='VISUAL GROUND ANCHOR: X '+p.x.toFixed(2)+' Z '+p.z.toFixed(2)+
  ' Y '+y.toFixed(2)+' · NOT GAZEBO';
 status('ROBOT GROUNDED TO SELECTED VISUAL Y PLANE · ADJUST IF NEEDED');
 provenance(sceneIdentity+' · MANUALLY SELECTED GROUND PLANE Y '+y.toFixed(2)+
  ' · NOT CALIBRATED COLLISION OR ROBOT PHYSICS');
 return true;
}
function startGroundPlacement(){
 if(!robot||!viewer)return;
 pickingOverlay.hidden=!pickingOverlay.hidden;
 status(pickingOverlay.hidden?'ROTATE THE CAMERA TO FIND THE LAWN THEN PLACE AGAIN':
  'CLICK A PATCH OF GRASS OR PAVING TO PLACE ROBOT');
}
$('quick-ground')?.addEventListener('click',startGroundPlacement);
$('quick-focus')?.addEventListener('click',focusRobot);
$('camera-follow')?.addEventListener('change',e=>{followRobot=e.target.checked;if(!followRobot)focusRobot();updateFollow();});
$('camera-view')?.addEventListener('change',updateFollow);
$('place-camera')?.addEventListener('click',startGroundPlacement);
pickingOverlay.addEventListener('click',e=>{
 const r=$('viewer').getBoundingClientRect();
 projectToGround((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);
});
pickingOverlay.addEventListener('keydown',e=>{
 if(e.key==='Escape'){pickingOverlay.hidden=true;e.preventDefault();}
 if(e.key==='Enter'){projectToGround(.5,.75);e.preventDefault();}
});
floorY.addEventListener('change',()=>{
 if(!groundAnchor)return;
 $('origin-y').value=String(floorY.value);
 lastWorld=null;applyPose(manualPose.x,manualPose.z,manualPose.yaw);
 try{refreshTrajectory();}catch(e){status(e.message);return;}
 provenance('VISUAL GROUND HEIGHT ADJUSTED TO '+floorY.value+' · NO PHYSICS');
});
window.addEventListener('message',e=>{
 if(e.origin!==location.origin||e.source!==window.parent)return;
 if(e.data?.type==='cdr:garden-start-gazebo-replay'){
  $('load-garden-gazebo')?.click();
  return;
 }
 if(e.data?.type==='cdr:garden-visibility'&&viewer?.app)viewer.app.renderNextFrame=true;
});
const ORIGINAL_GARDEN_SHA256='e2c82908d3c871c47dc4e6498529944afaebd7d01cf130b65aa0bf01202086c3';
const GARDEN_META_URL='/garden-assets/lod-meta.json';
const GARDEN_META_NAME='lod-meta.json';
const poseInputs=['origin-x','origin-y','origin-z','robot-scale','robot-yaw','scene-to-meters'];
const val=id=>Number($(id).value);
function status(msg){
 $('status').textContent=msg;
 if(window.parent!==window)window.parent.postMessage({type:'cdr:garden-status',text:String(msg)},location.origin);
}
function provenance(msg){$('provenance').textContent=msg}
function sourceLabel(text){document.querySelector('.viewer-quick-controls span').textContent=text;}
function material(rgb,metalness=0){
 const m=new StandardMaterial();m.diffuse=new Color(...rgb);
 m.metalness=metalness;m.useMetalness=true;m.update();return m;
}
function part(parent,name,type,position,scale,mat,rotation=null){
 const entity=new Entity(name);
 entity.addComponent('render',{type,material:mat});
 entity.setLocalPosition(...position);entity.setLocalScale(...scale);
 if(rotation)entity.setLocalEulerAngles(...rotation);
 parent.addChild(entity);return entity;
}
function buildRobot(app){
 const base=new Entity('CDR01_ROBOT_IN_THE_REAL_SPLAT');
 const shell=material([.84,.91,.92],.3),dark=material([.08,.14,.18]),accent=material([.12,.85,.63]),rubber=material([.11,.12,.13]);
 part(base,'body','box',[0,.26,0],[.75,.24,.49],shell);
 part(base,'cargo','box',[-.03,.45,0],[.52,.20,.40],dark);
 part(base,'cargo-light','box',[.32,.36,0],[.025,.06,.27],accent);
 part(base,'lid','box',[-.03,.56,0],[.55,.025,.43],shell);
 for(const x of [-.25,.25])for(const z of [-.285,.285]){
  part(base,'drive-wheel','cylinder',[x,.13,z],[.24,.095,.24],rubber,[90,0,0]);
 }
 part(base,'sensor-post','cylinder',[.23,.53,0],[.035,.17,.035],shell);
 part(base,'lidar','cylinder',[.23,.64,0],[.16,.075,.16],dark);
 part(base,'status-led','box',[.21,.665,0],[.06,.012,.11],accent);
 app.root.addChild(base);return base;
}
function applyPose(x,z,heading){
 if(!robot)return;
 let p;
 try{p=scenePose({x,z,heading,originX:val('origin-x'),originY:val('origin-y'),
  originZ:val('origin-z'),yawDegrees:val('robot-yaw'),metersPerUnit:val('scene-to-meters'),
  visualScale:val('robot-scale')});}catch(e){status('INVALID POSE: '+e.message);return;}
 robot.setPosition(p.x,p.y,p.z);
 robot.setLocalScale(p.scale,p.scale,p.scale);
 robot.setEulerAngles(0,p.yaw,0);
 updateFollow();
 viewer.app.renderNextFrame=true;
 publishPose();
}
for(const id of poseInputs)$(id).addEventListener('change',()=>{
 if(!robot)return; applyPose(manualPose.x,manualPose.z,manualPose.yaw);
 try{refreshTrajectory();}catch(e){status(e.message);}
});
$('place').addEventListener('click',()=>{if(robot){
 trajectory=null;stop();replayDistance=0;playbackSeconds=0;
  manualPose={x:0,z:0,yaw:0};groundAnchor=true;
 $('garden-floor-help').hidden=true;
 motionSource='manual';robot.enabled=true;lastWorld=null;applyPose(0,0,0);
 sourceLabel('CDR-01 · MANUAL CONTROL');status('ROBOT PLACED AT OPERATOR-SELECTED COORDINATES · NO COLLISION MODEL');
 $('pose-readout').textContent='MANUALLY SET Y-PLANE POSITION · NOT GAZEBO';
}});
for(const [id,dx,dz,dyaw] of [['drive-forward',.15,0,0],['drive-back',-.15,0,0],['drive-left',0,0,.15],['drive-right',0,0,-.15]]){
 $(id).addEventListener('click',()=>{
  if(!groundAnchor){startGroundPlacement();return;}
  trajectory=null;stop();motionSource='manual';replayDistance=0;playbackSeconds=0;
  sourceLabel('CDR-01 · MANUAL CONTROL');
  manualPose.x+=Math.cos(manualPose.yaw)*dx;
  manualPose.z+=Math.sin(manualPose.yaw)*dx;
  manualPose.yaw+=dyaw;
  applyPose(manualPose.x,manualPose.z,manualPose.yaw);
  $('pose-readout').textContent='MANUAL CONTROL · NOT AUTONOMOUS GAZEBO';
 });
}
function stop(){playing=false;cancelAnimationFrame(timer);$('play').disabled=!trajectory;$('pause').disabled=true;}
async function load(source,filename,originalGarden=false){
 verifiedGarden=originalGarden;sceneIdentity=originalGarden?'ORIGINAL GARDEN ARCHIVE':'USER-PROVIDED GAUSSIAN SCENE: '+filename;
 document.querySelector('h1').textContent=originalGarden?'Robot inside Garden':'Robot in user-provided Gaussian scene';
 stop();trajectory=null;replayDistance=0;playbackSeconds=0;
 status('LOADING GAUSSIAN SCENE…');
 $('robot-controls').hidden=true;$('playback-controls').hidden=true;
 for (const id of quickIds) $(id).disabled=true;
 pickingOverlay.hidden=true;groundAnchor=false;manualDistance=0;lastWorld=null;
 if(viewer){viewer.destroy();viewer=null;robot=null;}
 try{
  viewer=await createViewer({container:$('viewer'),settings:defaultSettings(),
    contentUrl:source,contentFilename:filename,renderer:'webgl',ui:false,aa:true});
  viewer.events.on('progress:changed',p=>status('LOADING 3DGS '+p+'%'));
  const ready=()=>{
    robot=buildRobot(viewer.app);
    viewer.app.on('update',()=>{updateFollow();drawTrajectory();});
    robot.enabled=false;groundAnchor=false;needsPlacement=true;manualDistance=0;lastWorld=null;
    // Await an explicit ground anchor; never substitute a floating preview.
    viewer.app.scene.ambientLight=new Color(.65,.65,.65);
    for(const id of quickIds)$(id).disabled=false;
    pickingOverlay.hidden=true;
    $('garden-floor-help').hidden=false;
    $('robot-controls').hidden=false;$('playback-controls').hidden=false;
    status('SCENE READY · SELECT GROUND ANCHOR TO DISPLAY ROBOT');
    provenance(sceneIdentity+' + CDR ROBOT IN SAME PLAYCANVAS ENGINE · SPATIAL REGISTRATION / GARDEN COLLISION NOT VERIFIED');
    viewer.app.renderNextFrame=true;
  };
  if(viewer.state.loaded)ready();else viewer.events.once('loaded:changed',ready);
 }catch(err){status('LOAD FAILED: '+err.message);provenance('No verified 3DGS loaded; no simulation claims.');}
}
$('splat-file').addEventListener('change',e=>{
 const file=e.target.files?.[0];if(!file)return;
 if(!/\.(sog|ply|spz|json)$/i.test(file.name)){status('Choose Gaussian .sog/.ply/.spz/.json');return;}
 if(sourceUrl)URL.revokeObjectURL(sourceUrl);
 sourceUrl=URL.createObjectURL(file);load(sourceUrl,file.name);
});
$('load-url').addEventListener('click',()=>{
 const s=$('splat-url').value.trim();
 try{const u=new URL(s);if(u.protocol!=='https:')throw Error('HTTPS only');
  if(!/\.(sog|ply|spz|json)$/i.test(u.pathname))throw Error('Use .sog, .ply, .spz or .json');
  load(s,u.pathname.split('/').pop());
 }catch(err){status('INVALID 3DGS URL: '+err.message)}
});
function importFrames(frames,label){
 if(!robot)return;
 if(!groundAnchor){status('SELECT LAWN GROUND ANCHOR BEFORE APPLYING A TRAJECTORY');return;}
 if(!Array.isArray(frames)||frames.length<2||frames.length>50000||
    frames.some(f=>!f||![f.time_s,f.x_m,f.y_m].every(Number.isFinite)||
      (f.yaw_rad!==undefined&&!Number.isFinite(f.yaw_rad)))){
  status('INVALID TRAJECTORY: finite time_s, x_m, y_m and optional yaw_rad required');return;
 }
 // Preserve the recorded message order instead of silently sorting corrupt data.
 if(frames.some((f,i)=>i>0&&f.time_s<=frames[i-1].time_s)){
  status('INVALID NON-MONOTONIC TIMESTAMPS');return;
 }
 const cumulative=[0];
 for(let i=1;i<frames.length;i++)
  cumulative.push(cumulative[i-1]+Math.hypot(frames[i].x_m-frames[i-1].x_m,
                                            frames[i].y_m-frames[i-1].y_m));
 stop();playbackSeconds=0;replayDistance=0;
 trajectory={frames,label,cumulative};
 refreshTrajectory();
 motionSource=(label.startsWith('IMPORTED')||label.startsWith('RECORDED GAZEBO'))?'imported':'scripted';
 sourceLabel('CDR-01 · '+(motionSource==='scripted'?'SCRIPTED REPLAY':'RECORDED / IMPORTED REPLAY'));
 $('play').disabled=false;$('reset').disabled=false;
 const firstPose=sample(0);manualPose={x:firstPose.x,z:firstPose.z,yaw:firstPose.heading};applyPose(firstPose.x,firstPose.z,firstPose.heading);
 $('pose-readout').textContent=label+' · '+frames.length+' frames · START READY';
 status('TRAJECTORY READY · '+label);
 provenance(sceneIdentity+' · 3DGS CO-RENDERING + '+label+' · NOT METRICALLY ALIGNED TO GARDEN · NO GARDEN PHYSICS');
}
$('load-garden-gazebo').addEventListener('click',async()=>{
 try{
  if(!groundAnchor)throw Error('Choose the lawn ground anchor before replay');
  const response=await fetch('/api/garden-gazebo-run',{cache:'no-store'});
  const record=await response.json();
  if(!response.ok)throw Error(record.error||'Gazebo recording unavailable');
  if(record.schema!=='cdr-garden-gazebo-replay-v1' ||
     record.source!=='recorded_gazebo_harmonic_odometry' ||
     record.contact_mesh_validated!==false ||
     record.physics_world!=='flat_contact_proxy_not_real_garden_terrain' ||
     record.garden_source_sha256!==ORIGINAL_GARDEN_SHA256 ||
     !Array.isArray(record.frames) || record.samples!==record.frames.length)
     throw Error('Invalid or misattributed Gazebo recording');
  importFrames(record.frames,'RECORDED GAZEBO FLAT CONTACT PROXY (NOT GARDEN COLLISIONS)');
  if(window.parent!==window && [record.duration_s,record.odometry_path_length_m].every(Number.isFinite))
   window.parent.postMessage({
    type:'cdr:garden-record-info',source:'recorded_gazebo_harmonic_odometry',
    samples:record.samples,duration_s:record.duration_s,
    odometry_path_length_m:record.odometry_path_length_m,
    stopped_at_end:record.stopped_at_end===true
   },location.origin);
  status(record.samples+' GAZEBO ODOMETRY SAMPLES · FLAT PROXY ONLY');
 }catch(e){status(e.message);}
});
$('export-garden-calibration').addEventListener('click',()=>{
 if(!robot||!groundAnchor){status('PLACE ROBOT ON LAWN BEFORE EXPORTING CALIBRATION');return;}
 if(!verifiedGarden){status('CALIBRATION EXPORT REQUIRES THE ORIGINAL GARDEN ARCHIVE');return;}
 const scale=Number($('scene-to-meters').value);
 if(!Number.isFinite(scale)||scale<.01||scale>10){status('INVALID SCALE: USE 0.01 TO 10');return;}
 const d={
  schema:'cdr-garden-calibration-v1',source_sha256:ORIGINAL_GARDEN_SHA256,
  origin_scene:{x:val('origin-x'),y:val('origin-y'),z:val('origin-z')},
  meters_per_scene_unit:scale,scene_yaw_deg:val('robot-yaw'),
  scene_y_axis:'up',flat_patch_size_m:8,terrain_collision_verified:false,
  calibration_status:'OPERATOR-ESTIMATED. NO VERIFIED GARDEN TERRAIN MESH',
  notes:'This defines an origin and orientation for a local flat Gazebo pad only.'
 };
 const b=new Blob([JSON.stringify(d,null,2),String.fromCharCode(10)],{type:'application/json'});
 const u=URL.createObjectURL(b);
 const a=document.createElement('a');a.href=u;a.download='garden-calibration.json';
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(u),1000);
 status('VISUAL CALIBRATION EXPORTED · UPLOAD JSON TO assets/ IN CODESPACES');
});
$('load-scripted').addEventListener('click',async()=>{
 try{const r=await fetch('/api/run?world=campus&scenario=clear&seed=7');
  if(!r.ok)throw Error('Replay API '+r.status);
  const data=await r.json();importFrames(data.frames,'SCRIPTED PYTHON CAMPUS REPLAY (NOT GAZEBO)');
 }catch(e){status(e.message);}
});
$('odom-file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 const lines=(await file.text()).trim().split(/\r?\n/).filter(Boolean);
 const cols=lines.shift().split(',').map(x=>x.trim());
 if(!['time_s','x_m','y_m','yaw_rad'].every(x=>cols.includes(x))){status('CSV MUST HAVE time_s,x_m,y_m,yaw_rad');return;}
 const frames=lines.map(line=>{
  const c=line.split(',');
  return Object.fromEntries(cols.map((name,i)=>[name,Number(c[i])]));
 });
 if(frames.some(f=>!Number.isFinite(f.yaw_rad))){status('INVALID GAZEBO YAW');return;}
 importFrames(frames,'IMPORTED ODOMETRY (UNVERIFIED SOURCE)');
});
function sample(t){
 const a=trajectory.frames,dist=trajectory.cumulative;
 const first=a[0],last=a[a.length-1],time=Math.min(t+first.time_s,last.time_s);
 let lo=0,hi=a.length-1;
 while(lo+1<hi){const k=(lo+hi)>>1;if(a[k].time_s<=time)lo=k;else hi=k;}
 const p=a[lo],q=a[Math.min(lo+1,a.length-1)];
 const u=p===q?0:Math.max(0,Math.min(1,(time-p.time_s)/(q.time_s-p.time_s)));
 const pYaw=Number.isFinite(p.yaw_rad)?p.yaw_rad:Math.atan2(q.y_m-p.y_m,q.x_m-p.x_m);
 const qYaw=Number.isFinite(q.yaw_rad)?q.yaw_rad:pYaw;
 // Preserve odometry frame orientation; scene yaw rotates both path and body.
 const delta=Math.atan2(Math.sin(qYaw-pYaw),Math.cos(qYaw-pYaw));
 return {x:p.x_m+(q.x_m-p.x_m)*u-first.x_m,
  z:p.y_m+(q.y_m-p.y_m)*u-first.y_m,
  heading:pYaw+u*delta,
  distance_m:dist[lo]+u*(dist[Math.min(lo+1,a.length-1)]-dist[lo])};
}
function tick(now){
 if(!playing||!trajectory)return;
 const end=trajectory.frames.at(-1).time_s-trajectory.frames[0].time_s;
 const t=Math.min(Math.max(0,(now-startAt)/1000),end);
 playbackSeconds=t;
 const f=sample(t);
 replayDistance=f.distance_m;
 manualPose={x:f.x,z:f.z,yaw:f.heading};
 applyPose(f.x,f.z,f.heading);
 $('pose-readout').textContent=trajectory.label+' · '+t.toFixed(1)+'s · X '+f.x.toFixed(2)+'m Z '+f.z.toFixed(2)+'m · '+replayDistance.toFixed(2)+'m path';
 if(t>=end){stop();playbackSeconds=end;status('REPLAY COMPLETE · '+trajectory.label);return;}
 timer=requestAnimationFrame(tick);
}
$('play').addEventListener('click',()=>{
 if(!trajectory)return;
 stop();playing=true;startAt=performance.now()-playbackSeconds*1000;
 $('pause').disabled=false;timer=requestAnimationFrame(tick);
});
$('pause').addEventListener('click',stop);
$('reset').addEventListener('click',()=>{
 stop();playbackSeconds=0;replayDistance=0;
 if(trajectory){const firstPose=sample(0);manualPose={x:firstPose.x,z:firstPose.z,yaw:firstPose.heading};applyPose(firstPose.x,firstPose.z,firstPose.heading);
  $('pose-readout').textContent=trajectory.label+' · RESET';}
});
/* Load the already-received original LOD ZIP from Codespaces automatically.
   No file can be guessed from a public iframe. Serving tiles is handled by
   the Python ZIP resource endpoint, including its strict asset allowlist. */
async function loadInstalledGarden(){
 try{
  const response=await fetch('/api/garden-asset',{cache:'no-store'});
  if(!response.ok)throw new Error('Garden manifest request failed');
  const data=await response.json();
  if(data.installed){
   if(!data.source_verified){status('GARDEN ARCHIVE CHECKSUM DOES NOT MATCH ORIGINAL · NOT LOADED');return;}
   status('ORIGINAL GARDEN VERIFIED · LOADING '+data.lod_levels+' LOD LEVELS…');
   await load(GARDEN_META_URL,GARDEN_META_NAME,true);
  }else{
   status('UPLOAD ORIGINAL 3DGS ZIP TO CODESPACES');
  }
 }catch(e){status('GARDEN ARCHIVE CHECK FAILED: '+e.message);}
}
loadInstalledGarden();
