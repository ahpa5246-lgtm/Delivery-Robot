/* CDR-01 offline campus console. All displayed telemetry is simulated. */
'use strict';
const $ = (id) => document.getElementById(id);
const canvas = $('map'), ctx = canvas.getContext('2d');
const traceCanvas = $('trace'), traceCtx = traceCanvas.getContext('2d');
const state = { map: null, run: null, playing: true, simTime: 0, lastWallTime: 0 };
const W = canvas.width, H = canvas.height;
const inset = {x: 38, y: 28, w: W-76, h: H-56};
const px = (x) => inset.x + x / state.map.width_m * inset.w;
const py = (y) => inset.y + (1 - y / state.map.height_m) * inset.h;
const number = (n, digits = 1) => Number(n).toFixed(digits);
function mins(seconds) { const n = Math.floor(seconds || 0); return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0'); }
function roundRect(x,y,w,h,r,fill) { ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill(); }
function marker(x,y,name,isRobot=false) {
  const cx=px(x), cy=py(y);
  if(isRobot) {
    ctx.beginPath();ctx.arc(cx,cy,24,0,Math.PI*2);ctx.fillStyle='#79efbd24';ctx.fill();
    ctx.beginPath();ctx.arc(cx,cy,12,0,Math.PI*2);ctx.fillStyle='#8efbd1';ctx.fill();
    ctx.beginPath();ctx.arc(cx,cy,5,0,Math.PI*2);ctx.fillStyle='#153e3b';ctx.fill();
    return;
  }
  ctx.beginPath();ctx.arc(cx,cy,7,0,Math.PI*2);ctx.fillStyle=name==='depot'?'#f3ba7a':'#d8ecf3';ctx.fill();
  ctx.beginPath();ctx.arc(cx,cy,12,0,Math.PI*2);ctx.strokeStyle='#9ec2d080';ctx.lineWidth=1.5;ctx.stroke();
  ctx.textAlign='center';ctx.font='600 16px system-ui';ctx.fillStyle='#c1d1db';
  ctx.fillText(name.replaceAll('_',' ').toUpperCase(),cx,cy-23);
}
function draw() {
  if(!state.map) return;
  const map=state.map;
  ctx.fillStyle='#102030';ctx.fillRect(0,0,W,H);
  // Coordinate grid with alternating broad pedestrian corridors.
  ctx.strokeStyle='#6e8e9a15';ctx.lineWidth=1;
  for(let x=0;x<=map.width_m;x+=1){ctx.beginPath();ctx.moveTo(px(x),py(0));ctx.lineTo(px(x),py(map.height_m));ctx.stroke();}
  for(let y=0;y<=map.height_m;y+=1){ctx.beginPath();ctx.moveTo(px(0),py(y));ctx.lineTo(px(map.width_m),py(y));ctx.stroke();}
  ctx.setLineDash([10,14]);ctx.strokeStyle='#587c8d49';ctx.lineWidth=2;
  for(const y of [7,14]){ctx.beginPath();ctx.moveTo(px(0),py(y));ctx.lineTo(px(map.width_m),py(y));ctx.stroke();}
  for(const x of [6.5,16,26]){ctx.beginPath();ctx.moveTo(px(x),py(0));ctx.lineTo(px(x),py(map.height_m));ctx.stroke();}
  ctx.setLineDash([]);
  ctx.strokeStyle='#7997a330';ctx.strokeRect(inset.x,inset.y,inset.w,inset.h);
  for(let i=0;i<map.buildings.length;i++){
    const [x0,y0,x1,y1]=map.buildings[i];
    const sx=px(x0),sy=py(y1),sw=px(x1)-sx,sh=py(y0)-sy;
    roundRect(sx+4,sy+6,sw,sh,7,'#071220');
    roundRect(sx,sy,sw,sh,6,'#293f50');
    ctx.strokeStyle='#507388';ctx.lineWidth=2;ctx.strokeRect(sx+4,sy+4,sw-8,sh-8);
    ctx.fillStyle='#8caabd';ctx.font='700 12px system-ui';ctx.textAlign='center';ctx.fillText(['WEST WING','NORTH WING','EAST WING','GARDEN'][i]||'BUILDING',sx+sw/2,sy+sh/2+4);
  }
  if(state.run){
    // Previously issued plans stay visible as low-opacity dashed paths.
    const activeRouteIndex = state.run.routes.reduce((active, route, index) => route.time_s <= state.simTime ? index : active, -1);
    for(let n=0;n<state.run.routes.length;n++){
      const route=state.run.routes[n];
      if(route.time_s>state.simTime || route.points.length<2)continue;
      ctx.beginPath();ctx.setLineDash(n===activeRouteIndex?[]:[5,11]);
      route.points.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));
      ctx.strokeStyle=n===activeRouteIndex?'#88f3c8ba':'#779da366';
      ctx.lineWidth=n===activeRouteIndex?5:3;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();
    }
    ctx.setLineDash([]);
    if(state.run.closure_cells.length && state.run.events.some(e=>e.state==='REPLANNING'&&e.time_s<=state.simTime)){
      ctx.fillStyle='#ecaa6c55';
      for(const [i,j] of state.run.closure_cells){
        const side=map.resolution_m,xa=px(i*side),yb=py((j+1)*side);
        ctx.fillRect(xa,yb,px(side)-px(0),py(0)-py(side));
      }
    }
    const poses=state.run.frames.filter(f=>f.time_s<=state.simTime);
    if(poses.length>0){
      ctx.beginPath();poses.forEach((f,i)=>i?ctx.lineTo(px(f.x_m),py(f.y_m)):ctx.moveTo(px(f.x_m),py(f.y_m)));
      ctx.strokeStyle='#ffffffb0';ctx.lineWidth=3;ctx.lineCap='round';ctx.stroke();
      const pose=poses.at(-1);marker(pose.x_m,pose.y_m,'robot',true);
    }
  }
  for(const [name,coord] of Object.entries(map.stops))marker(coord[0],coord[1],name);
  const point=map.stops[$('destination').value];
  if(point){ctx.beginPath();ctx.arc(px(point[0]),py(point[1]),18,0,Math.PI*2);ctx.strokeStyle='#87f7c1';ctx.lineWidth=2;ctx.stroke();}
}
function drawTraces() {
  if (!state.run) return;
  const rect=traceCanvas.getBoundingClientRect();
  if(rect.width<10||rect.height<10)return;
  const dpi=Math.min(window.devicePixelRatio||1,2);
  const width=Math.round(rect.width*dpi),height=Math.round(rect.height*dpi);
  if(traceCanvas.width!==width||traceCanvas.height!==height){
    traceCanvas.width=width;traceCanvas.height=height;
  }
  const c=traceCtx,w=rect.width,h=rect.height,compact=w<440;
  c.setTransform(dpi,0,0,dpi,0,0);
  const left=compact?32:41,right=w-(compact?28:40),top=14,bottom=h-25;
  const duration=Math.max(1,state.run.duration_sim_s),speedScale=0.8;
  const x=t=>left+(right-left)*t/duration;
  c.clearRect(0,0,w,h);
  c.fillStyle='#0d1b29';c.fillRect(0,0,w,h);
  c.lineWidth=1;c.font=(compact?'9':'10')+'px system-ui';
  c.textBaseline='middle';
  for(let i=0;i<=4;i++){
    const y=top+(bottom-top)*i/4;
    c.strokeStyle='#284050';c.beginPath();c.moveTo(left,y);c.lineTo(right,y);c.stroke();
    c.textAlign='right';c.fillStyle='#9ab0be';c.fillText(number(speedScale*(1-i/4),2),left-5,y);
    c.textAlign='left';c.fillText(number(100*(1-i/4),0)+'%',right+5,y);
  }
  const tickCount=compact?2:4;
  for(let i=0;i<=tickCount;i++){
    const xx=left+(right-left)*i/tickCount;
    c.strokeStyle='#223344';c.beginPath();c.moveTo(xx,top);c.lineTo(xx,bottom);c.stroke();
    c.textAlign='center';c.fillStyle='#9ab0be';c.fillText(mins(duration*i/tickCount),xx,bottom+14);
  }
  const frames=state.run.frames;
  function line(color,key,convert,alpha,limit) {
    c.beginPath();let count=0;
    for(const frame of frames){
      if(frame.time_s>limit)break;
      const val=convert(frame[key]);
      const y=bottom-Math.max(0,Math.min(1,val))*(bottom-top);
      if(count++===0)c.moveTo(x(frame.time_s),y);
      else c.lineTo(x(frame.time_s),y);
    }
    c.strokeStyle=color;c.globalAlpha=alpha;c.lineWidth=compact?1.6:2.3;c.lineJoin='round';c.stroke();c.globalAlpha=1;
  }
  for(const [color,key,fn] of [['#83f4c5','speed_mps',v=>v/speedScale],
                                 ['#f2ba76','soc',v=>v]]) {
    line(color,key,fn,.23,duration);
    line(color,key,fn,1,state.simTime);
  }
  const head=x(state.simTime);
  c.strokeStyle='#e6f8ff77';c.lineWidth=1;c.setLineDash([4,4]);
  c.beginPath();c.moveTo(head,top);c.lineTo(head,bottom);c.stroke();c.setLineDash([]);
}
function updateReadout() {
  if(!state.run)return;
  const run=state.run, frame=run.frames.filter(f=>f.time_s<=state.simTime).at(-1)||run.frames[0];
  const done=state.simTime>=run.duration_sim_s;
  $('elapsed').textContent=mins(state.simTime);$('clock').textContent='SIM — '+mins(state.simTime);
  $('timeline').value=run.duration_sim_s?String(100*state.simTime/run.duration_sim_s):'0';
  $('distance').textContent=number(frame.distance_m ?? (done ? run.distance_m : 0));
  $('energy').textContent=done?number(run.energy_estimated_wh,2):number(frame.energy_estimated_wh,2);
  $('battery').textContent=number(frame.soc*100,1)+'%';
  $('replans').textContent=String(run.events.filter(e=>e.state==='REPLANNING'&&e.time_s<=state.simTime).length);
  $('phase').textContent=frame.phase.replaceAll('_',' ');
  $('status').textContent=done?run.status.replaceAll('_',' '):'IN PROGRESS';
  $('reason').textContent=done?(run.reason||'Simulated mission replay completed.'):'Running deterministic campus navigation model.';
  document.body.classList.toggle('error',done&&run.status!=='COMPLETED');
  $('status-dot').style.background=done&&run.status!=='COMPLETED'?'#ee8d82':'#7befc5';
  const feed=$('events');feed.replaceChildren();
  const entries=run.events.filter(e=>e.time_s<=state.simTime);
  $('event-count').textContent=entries.length+' EVENTS';
  drawTraces();
  for(const e of [...entries].reverse()){
    const item=document.createElement('div');item.className='event'+(/SAFE|REPLAN|REJECT/.test(e.state)?' warning':'');
    const title=document.createElement('strong');title.textContent=e.state.replaceAll('_',' ');
    const time=document.createElement('time');time.textContent=mins(e.time_s);
    const description=document.createElement('p');description.textContent=e.detail;
    item.append(time,title,description);feed.append(item);
  }
}
async function loadGazeboEvidence() {
  try {
    const response = await fetch('/api/gazebo-evidence');
    if (!response.ok) throw Error('Gazebo evidence unavailable');
    const d = await response.json();
    if (d.evidence_type !== 'ACTUAL_GAZEBO_HARMONIC_SIMULATION_TELEMETRY_NOT_HARDWARE'
        || !Number.isFinite(d.displacement_reported_by_odometry_m)
        || !Number.isFinite(d.max_odometry_linear_velocity_mps)
        || !Number.isInteger(d.samples) || d.samples < 2) {
      throw Error('Invalid evidence provenance');
    }
    $('gazebo-displacement').textContent = number(d.displacement_reported_by_odometry_m, 3);
    $('gazebo-speed').textContent = number(d.max_odometry_linear_velocity_mps, 3);
    $('gazebo-samples').textContent = String(d.samples);
  } catch (err) {
    $('gazebo-provenance').textContent = 'Archived Gazebo evidence unavailable: ' + err.message;
  }
}
async function fetchRun() {
  $('run').disabled=true;$('run').textContent='LOADING…';
  try{
    const params=new URLSearchParams({destination:$('destination').value,scenario:$('scenario').value,seed:$('seed').value});
    const response=await fetch('/api/run?'+params);
    const run=await response.json();
    if(!response.ok)throw new Error(run.error||'Simulation failed');
    state.run=run;state.simTime=0;state.playing=true;state.lastWallTime=0;
    $('play').textContent='Ⅱ';$('total').textContent=mins(run.duration_sim_s);
    updateReadout();draw();
  }catch(err){
    $('status').textContent='ERROR';$('reason').textContent=err.message;
    document.body.classList.add('error');
  }finally{$('run').disabled=false;$('run').innerHTML='<span>▶</span> RUN SIMULATION';}
}
function tick(wallTime){
  if(state.run&&state.playing&&state.lastWallTime){
    state.simTime=Math.min(state.run.duration_sim_s,state.simTime+Math.min(.1,(wallTime-state.lastWallTime)/1000)*Number($('speed').value));
    if(state.simTime>=state.run.duration_sim_s){state.playing=false;$('play').textContent='▶';}
    updateReadout();draw();
  }
  state.lastWallTime=wallTime;requestAnimationFrame(tick);
}
$('run').addEventListener('click',fetchRun);
$('play').addEventListener('click',()=>{
  if(!state.run)return;
  if(state.simTime>=state.run.duration_sim_s)state.simTime=0;
  state.playing=!state.playing;$('play').textContent=state.playing?'Ⅱ':'▶';
});
$('timeline').addEventListener('input',()=>{
  if(!state.run)return;
  state.simTime=state.run.duration_sim_s*Number($('timeline').value)/100;
  updateReadout();draw();
});
canvas.addEventListener('click',(e)=>{
  if(!state.map)return;
  const rect=canvas.getBoundingClientRect(),x=e.offsetX*W/rect.width,y=e.offsetY*H/rect.height;
  const near=Object.entries(state.map.stops).filter(([k])=>k!=='depot')
    .map(([name,[sx,sy]])=>({name,d:Math.hypot(px(sx)-x,py(sy)-y)})).sort((a,b)=>a.d-b.d)[0];
  if(near&&near.d<45){$('destination').value=near.name;fetchRun();}
});
(async()=>{
  try{
    const response=await fetch('/api/map');if(!response.ok)throw Error('Map API unavailable');
    state.map=await response.json();await loadGazeboEvidence();await fetchRun();requestAnimationFrame(tick);
  }catch(err){$('status').textContent='OFFLINE';$('reason').textContent=err.message;}
})();
