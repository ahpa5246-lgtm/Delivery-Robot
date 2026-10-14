/* Five CAD robot instances driven by an independently certified offline fleet replay.
   Sensors shown below are geometric models, never connected ROS or hardware. */
(() => {
'use strict';
const $=id=>document.getElementById(id), T=window.THREE, api=window.CDR3D;
if(!api||!T||!$('fleet-section'))return;
let fleet=null,signature='',selected='R-01',time=0,sequence=0,models=[];
const fmt=(v,n=1)=>Number.isFinite(v)?v.toFixed(n):'—';
const mm=t=>String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0');
const name=s=>String(s||'—').replaceAll('_',' ');
const read=(robot,t)=>robot?.frames?.[Math.max(0,Math.min(robot.frames.length-1,Math.floor(t)))]||null;
function marker(id){
  const cv=document.createElement('canvas');cv.width=256;cv.height=96;
  const cx=cv.getContext('2d');cx.fillStyle='#1c2930';cx.fillRect(0,0,256,96);
  cx.font='600 49px system-ui';cx.textAlign='center';cx.fillStyle='#f1e9d8';cx.fillText(id,128,65);
  const sprite=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(cv),depthTest:false}));
  sprite.scale.set(1.3,.49,1);sprite.position.set(0,1.88,0);
  sprite.userData.fleetMarker=true;return sprite;
}
function clear(){
  for(const m of models){
    if(m!==api.getRobot())api.scene.remove(m);
    for(const c of [...m.children])if(c.userData.fleetMarker){
      m.remove(c);c.material.map.dispose();c.material.dispose();
    }
  }
  models=[];
}
function makeModels(){
  if(!fleet||!api.getRobot())return;
  clear();const base=api.getRobot();
  for(let i=0;i<5;i++){
    const g=i===0?base:base.clone(true);
    g.name='FLEET_'+fleet.robots[i].id;
    g.add(marker(fleet.robots[i].id));
    if(i)api.scene.add(g);
    models.push(g);
  }
  move(time);
}
function rangeDraw(frame){
  const cv=$('fleet-range'),ctx=cv.getContext('2d'),w=cv.width,h=cv.height;
  ctx.fillStyle='#152028';ctx.fillRect(0,0,w,h);
  const x=w/2,y=h*.54,R=84;
  ctx.strokeStyle='#46535b';ctx.lineWidth=1;
  for(const k of [.25,.50,.75,1]){ctx.beginPath();ctx.arc(x,y,R*k,0,Math.PI*2);ctx.stroke();}
  const ranges=frame?.range_scan_m||[];
  for(let i=0;i<16;i++){
    const theta=i*Math.PI/8-Math.PI/2;
    const r=(ranges[i]??8)/8;
    ctx.strokeStyle=ranges.length?'#92acb0':'#4b5962';
    ctx.beginPath();ctx.moveTo(x,y);
    ctx.lineTo(x+R*r*Math.cos(theta),y+R*r*Math.sin(theta));ctx.stroke();
    if(ranges.length){
      ctx.fillStyle='#c7aa80';ctx.beginPath();
      ctx.arc(x+R*r*Math.cos(theta),y+R*r*Math.sin(theta),2.6,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.fillStyle='#e7dfd0';ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();
  ctx.font='12px system-ui';ctx.fillStyle='#a8b7be';
  ctx.fillText('IDEAL 2D RAY MODEL · 8 M',12,19);
}
function draw(){
  if(!fleet)return;
  $('fleet-clock').textContent='SIM + '+mm(time);
  $('fleet-integrity').textContent=fleet.separation_checked?'INTER-ROBOT CLEARANCE VERIFIED':'UNVERIFIED';
  const list=$('fleet-robot-list');list.replaceChildren();
  const active=[],states=[];
  for(const robot of fleet.robots){
    const f=read(robot,time),status=f?.status||'STANDBY';
    states.push(status);
    const btn=document.createElement('button');
    btn.type='button';btn.className='fleet-unit'+(robot.id===selected?' selected':'');
    btn.setAttribute('aria-pressed',String(robot.id===selected));
    const id=document.createElement('b');id.textContent=robot.id;
    const core=document.createElement('span');core.className='fleet-unit-main';
    const target=document.createElement('strong');target.textContent=name(robot.destination);
    const subtitle=document.createElement('small');subtitle.textContent=name(status)+' · '+fmt(f?.speed_mps,2)+' m/s';
    core.append(target,subtitle);
    const battery=document.createElement('span');battery.className='fleet-battery';
    const soc=Math.round((f?.battery_soc_estimated||0)*100);
    battery.textContent=soc+'%';
    const bar=document.createElement('i'),fill=document.createElement('b');
    fill.style.width=soc+'%';bar.append(fill);battery.append(bar);
    const dot=document.createElement('span');dot.className='fleet-dot '+status.toLowerCase();
    btn.append(id,core,battery,dot);
    btn.addEventListener('click',()=>{
      selected=robot.id;$('fleet-selected').value=selected;draw();
    });
    list.append(btn);
  }
  const summary=$('fleet-summary');summary.replaceChildren();
  for(const pair of [[5,'SIMULATED UNITS'],
       [states.filter(x=>x==='MOVING').length,'IN TRANSIT'],
       [states.filter(x=>x==='YIELDING').length,'YIELDING'],
       [states.filter(x=>x==='DOCKED').length,'DOCKED']]){
    const cell=document.createElement('div');
    const strong=document.createElement('strong');strong.textContent=String(pair[0]);
    const span=document.createElement('span');span.textContent=pair[1];
    cell.append(strong,span);summary.append(cell);
  }
  const queue=$('fleet-queue');queue.replaceChildren();
  for(const r of fleet.robots){
    const tr=document.createElement('div');tr.className='fleet-job';
    for(const part of [r.id,'→ '+name(r.destination),name(read(r,time).status)]){
      const span=document.createElement('span');span.textContent=part;tr.append(span);
    }
    queue.append(tr);
  }
  const chosen=fleet.robots.find(r=>r.id===selected)||fleet.robots[0],current=read(chosen,time);
  const scan=read(chosen,Math.floor(time/2)*2),ranges=scan?.range_scan_m||[];
  rangeDraw(scan);
  const details=$('fleet-detail');details.replaceChildren();
  for(const item of [
    ['SPEED',fmt(current.speed_mps,2)+' m/s'],
    ['BATTERY ESTIMATE',fmt(current.battery_soc_estimated*100,0)+'%'],
    ['NEAREST RAY',ranges.length?fmt(Math.min(...ranges),2)+' m':'—'],
    ['STATIC CLEARANCE',fmt(current.nearest_static_clearance_m,2)+' m'],
    ['POSE',fmt(current.x_m,1)+' / '+fmt(current.y_m,1)+' m'],
    ['SENSOR SOURCE','GEOMETRY ONLY']]){
    const cell=document.createElement('div'),label=document.createElement('span');
    label.textContent=item[0];const value=document.createElement('strong');
    value.textContent=item[1];cell.append(label,value);details.append(cell);
  }
}
function move(t){
  if(!fleet)return;
  time=Math.max(0,Math.min(fleet.duration_sim_s,t));
  for(let i=0;i<models.length;i++){
    const pose=read(fleet.robots[i],time);
    models[i].position.set(pose.x_m,0,-pose.y_m);
    models[i].rotation.y=pose.heading_rad;models[i].visible=true;
  }
  draw();
}
async function load(force=false){
  const map=window.__cdrReplayState?.map;
  if(!map)return;
  const seed=Math.max(0,Math.min(1000000,Number($('seed').value)||7));
  const key=map.world+':'+seed;
  if(!force&&key===signature)return;
  signature=key;const token=++sequence;
  $('fleet-integrity').textContent='CALCULATING DISPATCH';
  try{
    const response=await fetch('/api/fleet?'+new URLSearchParams({world:map.world,seed:String(seed)}));
    const data=await response.json();if(token!==sequence)return;
    if(!response.ok)throw Error(data.error||'fleet unavailable');
    if(data.robot_count!==5||!data.separation_checked||data.world!==map.world)
      throw Error('fleet safety proof or provenance mismatch');
    fleet=data;makeModels();move(window.__cdrReplayState?.time||0);
  }catch(e){
    if(token!==sequence)return;
    fleet=null;signature='';clear();
    $('fleet-integrity').textContent='UNAVAILABLE · '+e.message;
  }
}
function onFrame(e){
  if(e.detail?.run)load();
  if(fleet && Number.isFinite(e.detail?.time)){
    const t=Math.floor(e.detail.time);
    if(t!==Math.floor(time))move(t);
  }
}
window.addEventListener('cdr:world-map',()=>{signature='';load(true);});
window.addEventListener('cdr:replay',onFrame);
window.addEventListener('cdr:frame',onFrame);
window.addEventListener('cdr:robot-model',()=>{if(fleet)makeModels();});
$('fleet-refresh').addEventListener('click',()=>load(true));
$('fleet-selected').addEventListener('change',e=>{selected=e.target.value;draw();});
const source=$('mesh-provenance');
if(source)new MutationObserver(()=>{
  if(fleet&&source.textContent.includes('ORIGINAL CAD'))makeModels();
}).observe(source,{childList:true,subtree:true,characterData:true});
window.CDRFleet=Object.freeze({getRobots:()=>models,getData:()=>fleet,
  getSelectedRobot:()=>models[Math.max(0,fleet?.robots.findIndex(r=>r.id===selected)||0)]||null});
if(window.__cdrReplayState?.map)load();
})();