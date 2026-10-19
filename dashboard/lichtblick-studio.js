'use strict';
const el=id=>document.getElementById(id);
const state={frames:[],events:[],playing:false,t:0,duration:0,kind:'',timer:0};
const fmt=t=>{const n=Math.max(0,Math.floor(t));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')};
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const num=(n,d=2)=>finite(n)?n.toFixed(d):'—';
function normalize(data,kind){
 if(kind==='gazebo'){
  if(data.schema!=='cdr-garden-gazebo-replay-v1'||data.source!=='recorded_gazebo_harmonic_odometry'||data.contact_mesh_validated!==false||data.physics_world!=='flat_contact_proxy_not_real_garden_terrain')throw Error('Unsupported Gazebo provenance');
 }
 if(!Array.isArray(data.frames)||data.frames.length<2||data.frames.length>200000)throw Error('Invalid replay frames');
 const frames=[];
 for(const raw of data.frames){
  if(!finite(raw.time_s)||!finite(raw.x_m)||!finite(raw.y_m)||raw.time_s<0)throw Error('Invalid timestamps or position values');
  const prev=frames.at(-1);
  if(prev&&raw.time_s<prev.time_s)throw Error('Out-of-order timestamps');
  // Planar replay records position and speed, not yaw. Infer a DISPLAY-ONLY
  // heading from position deltas; never label it measured orientation.
  const dx=prev?raw.x_m-prev.x_m:0,dy=prev?raw.y_m-prev.y_m:0;
  const heading=finite(raw.yaw_rad)?raw.yaw_rad:(dx||dy?Math.atan2(dy,dx):prev?.yaw_rad??0);
  if(!finite(heading))throw Error('Invalid orientation');
  const frame={time_s:raw.time_s,x_m:raw.x_m,y_m:raw.y_m,yaw_rad:heading};
  if(prev&&raw.time_s===prev.time_s){frames[frames.length-1]=frame;continue}
  frames.push(frame);
 }
 if(frames.length<2)throw Error('Not enough distinct timestamps');
 const events=kind==='planar'&&Array.isArray(data.events)?data.events.filter(e=>finite(e.time_s)&&typeof e.state==='string').slice(0,300):[];
 return {frames,events};
}
function currentIndex(){let lo=0,hi=state.frames.length-1;while(lo<hi){const m=Math.ceil((lo+hi)/2);if(state.frames[m].time_s<=state.t)lo=m;else hi=m-1}return lo}
function drawChart(canvas,series,position){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 ctx.fillStyle='#111622';ctx.fillRect(0,0,w,h);if(!state.frames.length)return;
 const left=46,right=w-20,top=25,bottom=h-34;
 ctx.strokeStyle='#2d3446';ctx.lineWidth=1;
 for(let k=0;k<=5;k++){const x=left+(right-left)*k/5;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke()}
 for(let k=0;k<=4;k++){const y=top+(bottom-top)*k/4;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke()}
 ctx.font='12px system-ui';ctx.fillStyle='#9ba2b8';
 const xVal=(v,min,max)=>left+(right-left)*(v-min)/(max-min||1);
 const yVal=(v,min,max)=>bottom-(bottom-top)*(v-min)/(max-min||1);
 if(position){
  const xs=state.frames.map(f=>f.x_m),ys=state.frames.map(f=>f.y_m);
  const minX=xs.reduce((a,b)=>Math.min(a,b),Infinity),maxX=xs.reduce((a,b)=>Math.max(a,b),-Infinity),minY=ys.reduce((a,b)=>Math.min(a,b),Infinity),maxY=ys.reduce((a,b)=>Math.max(a,b),-Infinity);
  const span=Math.max(maxX-minX,maxY-minY,1),midX=(maxX+minX)/2,midY=(maxY+minY)/2;
  const coords=f=>[xVal(f.x_m,midX-span/2,midX+span/2),yVal(f.y_m,midY-span/2,midY+span/2)];
  ctx.strokeStyle='#a68cff';ctx.lineWidth=3;ctx.beginPath();
  state.frames.forEach((f,i)=>{const [x,y]=coords(f);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();
  const [x,y]=coords(state.frames[currentIndex()]);ctx.fillStyle='#69e4ce';ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#d9d9e8';ctx.fillText('RECORDED XY · METRES',left+12,top+20);
 }else{
  const vals=series.flatMap(s=>s.values.filter(finite)),min=vals.reduce((a,b)=>Math.min(a,b),Infinity),max=vals.reduce((a,b)=>Math.max(a,b),-Infinity);
  for(const s of series){ctx.strokeStyle=s.color;ctx.lineWidth=2;ctx.beginPath();let started=false;
   s.values.forEach((v,i)=>{if(!finite(v))return;const x=xVal(state.frames[i].time_s,state.frames[0].time_s,state.duration),y=yVal(v,min,max);started?ctx.lineTo(x,y):ctx.moveTo(x,y);started=true});ctx.stroke()}
  const x=xVal(state.t,state.frames[0].time_s,state.duration);ctx.strokeStyle='#fff8';ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();
  ctx.fillText(num(min)+' — '+num(max),left+12,top+20);
 }
}
function render(){
 if(!state.frames.length)return;
 const i=currentIndex(),f=state.frames[i],prev=state.frames[Math.max(0,i-1)],dt=f.time_s-prev.time_s;
 const speed=i&&dt>0?Math.hypot(f.x_m-prev.x_m,f.y_m-prev.y_m)/dt:0;
 el('x').textContent=num(f.x_m);el('y').textContent=num(f.y_m);el('yaw').textContent=num(f.yaw_rad*180/Math.PI,1);el('speed').textContent=num(speed);el('samples').textContent=String(state.frames.length);
 el('time').textContent=fmt(state.t)+' / '+fmt(state.duration);el('seek').value=String(Math.round(1000*state.t/(state.duration||1)));
 drawChart(el('trajectory'),[],true);
 const speeds=state.frames.map((p,j)=>j?Math.hypot(p.x_m-state.frames[j-1].x_m,p.y_m-state.frames[j-1].y_m)/(p.time_s-state.frames[j-1].time_s):0);
 drawChart(el('plot'),[{values:state.frames.map(f=>f.x_m),color:'#a58bff'},{values:state.frames.map(f=>f.y_m),color:'#4ecbc7'},{values:speeds,color:'#f6ad62'}],false);
}
function events(){
 const target=el('events');target.replaceChildren();
 if(!state.events.length){const p=document.createElement('p');p.className='muted';p.textContent='No discrete mission events in this recording. Gazebo odometry only provides poses.';target.append(p);return}
 for(const e of state.events){const div=document.createElement('div'),t=document.createElement('time'),label=document.createElement('span');div.className='event';t.textContent=fmt(e.time_s);label.textContent=e.state;div.append(t,label);target.append(div)}
}
async function load(){
 state.playing=false;el('play').textContent='▶ Play';el('load').disabled=true;el('connection').textContent='● LOADING';
 try{
  const kind=el('source').value;
  const params=new URLSearchParams({destination:el('destination').value,scenario:el('scenario').value,seed:el('seed').value});
  const url=kind==='gazebo'?'/api/garden-gazebo-run':'/api/run?'+params;
  const response=await fetch(url,{cache:'no-store'});const data=await response.json();
  if(!response.ok)throw Error(data.error||'Replay unavailable');
  const result=normalize(data,kind);state.frames=result.frames;state.events=result.events;state.kind=kind;
  state.t=state.frames[0].time_s;state.duration=state.frames.at(-1).time_s;
  el('source-label').textContent=kind==='gazebo'?'RECORDED GAZEBO · FLAT PROXY':'SCRIPTED PLANAR SIMULATOR';
  el('source-description').textContent=kind==='gazebo'?'Recorded physics-engine odometry. Garden terrain collisions not validated.':'Deterministic Python surrogate; not Gazebo, Nav2 or physical telemetry.';
  el('frame-label').textContent=kind==='gazebo'?'GAZEBO ODOM FRAME':'PLANAR XY · HEADING INFERRED';
  el('connection').textContent='● REPLAY READY';el('limitations').textContent=kind==='gazebo'?'Flat-contact Gazebo proxy. No real Garden collision model, LiDAR or hardware measurements.':'Scripted planar simulation. No live robot, ROS 2 navigation, or measured hardware telemetry.';
  events();render();
 }catch(err){el('connection').textContent='● REPLAY ERROR';el('source-description').textContent=err.message;state.frames=[];el('events').textContent='Could not load replay: '+err.message}
 finally{el('load').disabled=false}
}
el('load').addEventListener('click',load);
el('source').addEventListener('change',()=>{const gaz=el('source').value==='gazebo';for(const id of ['destination','scenario','seed'])el(id).disabled=gaz});
el('play').addEventListener('click',()=>{if(!state.frames.length)return;state.playing=!state.playing;if(state.t>=state.duration)state.t=state.frames[0].time_s;el('play').textContent=state.playing?'Ⅱ Pause':'▶ Play'});
el('seek').addEventListener('input',()=>{if(!state.frames.length)return;state.t=state.frames[0].time_s+(state.duration-state.frames[0].time_s)*Number(el('seek').value)/1000;render()});
let previous=performance.now();function tick(now){const dt=Math.min(.1,(now-previous)/1000);previous=now;if(state.playing&&state.frames.length){state.t=Math.min(state.duration,state.t+dt);if(state.t>=state.duration){state.playing=false;el('play').textContent='▶ Play'}render()}requestAnimationFrame(tick)}requestAnimationFrame(tick);load();
