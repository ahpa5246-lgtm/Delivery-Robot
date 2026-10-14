/* One-scene Gaussian splat + real engine-entity robot, without any iframe.
   All pose playback is explicitly labeled and unregistered until surveyed. */
import { createViewer } from '@playcanvas/supersplat-viewer/viewer';
import { defaultSettings } from '@playcanvas/supersplat-viewer/settings';
import { Entity, Color, StandardMaterial } from 'playcanvas';

const $=id=>document.getElementById(id);
let viewer=null,robot=null,sourceUrl=null,trajectory=null,timer=0,playing=false,startAt=0;
let manualPose={x:0,z:0,yaw:0};
const quickIds=['quick-forward','quick-left','quick-right','quick-back'];
const baseIds=['drive-forward','drive-left','drive-right','drive-back'];
quickIds.forEach((id,i)=>$(id)?.addEventListener('click',()=>$(baseIds[i])?.click()));
const panelToggle=$('panel-toggle'), optionsPanel=$('lab-options');
panelToggle?.addEventListener('click',()=>{
  optionsPanel.hidden=!optionsPanel.hidden;
  panelToggle.setAttribute('aria-expanded',String(!optionsPanel.hidden));
});
function placeNearView(){
 if(!robot||!viewer)return;
 // The default splat origin is not guaranteed to be on the Garden floor.
 // Place the mesh where a person can see it, in the same camera coordinate
 // frame. This is visual preview placement, NOT registered physical contact.
 const camera=viewer.app.root.findByName('camera');
 if(!camera){status('CAMERA NOT FOUND · CHECK COORDINATES IN SETTINGS');return;}
 const world=camera.getPosition().clone().add(camera.forward.clone().mulScalar(3.5));
 $('origin-x').value=world.x.toFixed(3);
 $('origin-y').value=(world.y-0.35).toFixed(3);
 $('origin-z').value=world.z.toFixed(3);
 manualPose={x:0,z:0,yaw:0};
 applyPose(0,0,0);
 $('pose-readout').textContent='ROBOT IN CAMERA VIEW · GROUND NOT REGISTERED';
 provenance('REAL GARDEN SPLAT + CDR-01 MESH IN ONE RENDERER · CAMERA PREVIEW POSITION / PHYSICS NOT VALIDATED');
 status('ROBOT IN GARDEN VIEW · VISUAL PREVIEW');
}
$('quick-focus')?.addEventListener('click',placeNearView);
$('place-camera')?.addEventListener('click',placeNearView);
const GARDEN_META_URL='/garden-assets/lod-meta.json';
const GARDEN_META_NAME='lod-meta.json';
const poseInputs=['origin-x','origin-y','origin-z','robot-scale','robot-yaw'];
const val=id=>Number($(id).value);
function status(msg){$('status').textContent=msg}
function provenance(msg){$('provenance').textContent=msg}
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
function initialPlacement(){
 manualPose={x:0,z:0,yaw:0};
 applyPose(0,0,0);
}
function applyPose(x,z,heading){
 if(!robot)return;
 const scale=Math.max(.01,Math.min(5,val('robot-scale')));
 const angle=val('robot-yaw')*Math.PI/180,cs=Math.cos(angle),sn=Math.sin(angle);
 robot.setPosition(val('origin-x')+scale*(x*cs-z*sn),
                   val('origin-y'),val('origin-z')+scale*(x*sn+z*cs));
 robot.setLocalScale(scale,scale,scale);
 robot.setEulerAngles(0,val('robot-yaw')+heading*180/Math.PI,0);
 viewer.app.renderNextFrame=true;
}
for(const id of poseInputs)$(id).addEventListener('change',()=>{
 if(!robot)return; applyPose(manualPose.x,manualPose.z,manualPose.yaw);
});
$('place').addEventListener('click',()=>{if(robot){trajectory=null;stop();manualPose={x:0,z:0,yaw:0};initialPlacement();$('pose-readout').textContent='MANUAL ROBOT PLACEMENT · NO PHYSICS';}});
for(const [id,dx,dz,dyaw] of [['drive-forward',.15,0,0],['drive-back',-.15,0,0],['drive-left',0,0,-.15],['drive-right',0,0,.15]]){
 $(id).addEventListener('click',()=>{
  stop();trajectory=null;
  manualPose.x+=Math.cos(manualPose.yaw)*dx;
  manualPose.z+=Math.sin(manualPose.yaw)*dx;
  manualPose.yaw+=dyaw;
  applyPose(manualPose.x,manualPose.z,manualPose.yaw);
  $('pose-readout').textContent='MANUAL CONTROL · NOT AUTONOMOUS GAZEBO';
 });
}
function stop(){playing=false;cancelAnimationFrame(timer);$('play').disabled=!trajectory;$('pause').disabled=true;}
async function load(source,filename){
 stop();status('LOADING GAUSSIAN SCENE…');
 $('robot-controls').hidden=true;$('playback-controls').hidden=true;
 $('viewer-quick-controls').hidden=true;
 if(viewer){viewer.destroy();viewer=null;robot=null;}
 try{
  viewer=await createViewer({container:$('viewer'),settings:defaultSettings(),
    contentUrl:source,contentFilename:filename,renderer:'webgl',ui:false,aa:true});
  viewer.events.on('progress:changed',p=>status('LOADING 3DGS '+p+'%'));
  const ready=()=>{
    robot=buildRobot(viewer.app);initialPlacement();
    placeNearView();
    $('viewer-quick-controls').hidden=false;
    $('robot-controls').hidden=false;$('playback-controls').hidden=false;
    status('ROBOT IN GARDEN VIEW · VISUAL PREVIEW');
    provenance('REAL 3DGS + CDR ROBOT IN SAME PLAYCANVAS ENGINE · SPATIAL REGISTRATION / GARDEN COLLISION NOT VERIFIED');
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
 if(!Array.isArray(frames)||frames.length<2||frames.some(f=>!
   [f.time_s,f.x_m,f.y_m].every(Number.isFinite))) {
  status('INVALID TRAJECTORY: time_s, x_m, y_m required');return;
 }
 frames.sort((a,b)=>a.time_s-b.time_s);
 if(frames.some((f,i)=>i>0&&f.time_s<=frames[i-1].time_s)){status('INVALID NON-MONOTONIC TIMESTAMPS');return;}
 stop();trajectory={frames,label};
 $('play').disabled=false;$('reset').disabled=false;
 const f=frames[0];manualPose={x:0,z:0,yaw:0};applyPose(0,0,0);
 $('pose-readout').textContent=label+' · '+frames.length+' frames · START READY';
 provenance('3DGS CO-RENDERING + '+label+' · NOT METRICALLY ALIGNED TO GARDEN · NO GARDEN PHYSICS');
}
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
 importFrames(frames,'IMPORTED GAZEBO ODOMETRY (UNVERIFIED)');
});
function sample(t){
 const a=trajectory.frames;
 const first=a[0],last=a[a.length-1],time=Math.min(t+first.time_s,last.time_s);
 let lo=0,hi=a.length-1;
 while(lo+1<hi){const k=(lo+hi)>>1;if(a[k].time_s<=time)lo=k;else hi=k;}
 const p=a[lo],q=a[Math.min(lo+1,a.length-1)];
 const u=p===q?0:Math.max(0,Math.min(1,(time-p.time_s)/(q.time_s-p.time_s)));
 return {x:p.x_m+(q.x_m-p.x_m)*u-first.x_m,
 z:p.y_m+(q.y_m-p.y_m)*u-first.y_m,
 heading:Number.isFinite(p.yaw_rad)?p.yaw_rad:Math.atan2(q.y_m-p.y_m,q.x_m-p.x_m)};
}
function tick(now){
 if(!playing||!trajectory)return;
 const t=(now-startAt)/1000;
 const f=sample(t);
 manualPose={x:f.x,z:f.z,yaw:f.heading};
 applyPose(f.x,f.z,f.heading);
 $('pose-readout').textContent=trajectory.label+' · '+t.toFixed(1)+'s · X '+f.x.toFixed(2)+'m Z '+f.z.toFixed(2)+'m (unregistered)';
 if(t>=trajectory.frames.at(-1).time_s-trajectory.frames[0].time_s){stop();return;}
 timer=requestAnimationFrame(tick);
}
$('play').addEventListener('click',()=>{if(!trajectory)return;stop();playing=true;startAt=performance.now();$('pause').disabled=false;timer=requestAnimationFrame(tick);});
$('pause').addEventListener('click',stop);
$('reset').addEventListener('click',()=>{stop();if(trajectory){manualPose={x:0,z:0,yaw:0};applyPose(0,0,0);$('pose-readout').textContent=trajectory.label+' · RESET';}});

/* Load the already-received original LOD ZIP from Codespaces automatically.
   No file can be guessed from a public iframe. Serving tiles is handled by
   the Python ZIP resource endpoint, including its strict asset allowlist. */
async function loadInstalledGarden(){
 try{
  const response=await fetch('/api/garden-asset',{cache:'no-store'});
  if(!response.ok)throw new Error('Garden manifest request failed');
  const data=await response.json();
  if(data.installed){
   status('ORIGINAL GARDEN DETECTED · LOADING '+data.lod_levels+' LOD LEVELS…');
   await load(GARDEN_META_URL,GARDEN_META_NAME);
  }else{
   status('UPLOAD ORIGINAL 3DGS ZIP TO CODESPACES');
  }
 }catch(e){status('GARDEN ARCHIVE CHECK FAILED: '+e.message);}
}
loadInstalledGarden();
