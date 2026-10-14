/* Garden is now one component of the FULL robotics dashboard.
   This same-origin frame owns the real PlayCanvas splat and robot, while the
   surrounding panels retain their existing, separately labeled Python model.
   No external provider website, false Gazebo telemetry or redirect. */
'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const frame=$('garden-engine'), shell=$('garden-splat'), stage=$('stage-viewport');
 const gardenButton=$('view-garden'), view3d=$('view3d'), view2d=$('view2d');
 const note=$('garden-dashboard-note'), disclosure=$('garden-disclosure');
 if(![frame,shell,stage,gardenButton,view3d,view2d,note,disclosure].every(Boolean)) return;
 function exitGarden(){
  stage.classList.remove('garden-active');
  shell.hidden=true;note.hidden=true;disclosure.hidden=true;
  gardenButton.setAttribute('aria-pressed','false');
  frame.contentWindow?.postMessage({type:'cdr:garden-visibility',visible:false},location.origin);
 }
 function showGarden(){
  if(!frame.getAttribute('src')) frame.setAttribute('src',frame.dataset.src);
  shell.hidden=false;stage.classList.add('garden-active','show3d');
  $('scene3d').hidden=true;$('map').hidden=true;
  note.hidden=false;disclosure.hidden=false;
  gardenButton.setAttribute('aria-pressed','true');
  view3d.setAttribute('aria-pressed','false');view2d.setAttribute('aria-pressed','false');
  frame.contentWindow?.postMessage({type:'cdr:garden-visibility',visible:true},location.origin);
 }
 gardenButton.addEventListener('click',showGarden);
 view3d.addEventListener('click',exitGarden);
 view2d.addEventListener('click',exitGarden);
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
  const d=event.data;
  if(!d||d.type!=='cdr:garden-pose'||!['manual','scripted','imported'].includes(d.source))return;
  if(![d.x,d.y,d.z,d.yaw,d.distance].every(Number.isFinite))return;
  $('garden-pose-xz').textContent=d.x.toFixed(2)+' / '+d.z.toFixed(2);
  $('garden-pose-yaw').textContent=d.yaw.toFixed(1)+'°';
  $('garden-travel').textContent=d.distance.toFixed(2)+' units';
  $('garden-ground-mode').textContent=
    d.source==='imported'?'GAZEBO REPLAY · FLAT':d.anchor?'VISUAL PLANE':'NOT SET';
  $('garden-calibration').textContent=
    d.source==='imported'?'Gazebo odometry replay on flat contact pad; Garden terrain collisions NOT modeled.':
    d.anchor?'Robot anchored to visual Y-plane '+d.y.toFixed(2)+'; Gazebo terrain not calibrated.':
    'Choose a visible ground patch for the robot.';
 });
 const view=new URLSearchParams(location.search).get('view');
 if(view==='map')view2d.click();
 else if(view!=='campus')showGarden();
})();
