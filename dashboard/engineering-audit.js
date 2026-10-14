/* CDR-01 replay instrumentation. No LIDAR/IMU/motor measurements are invented.
 * All derived data comes from the SAME timed trajectory used by the 3D view.
 */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  if(!$('engineering-audit'))return;
  let run=null,frames=[],map=null,heading=[],movingTime=[],integrity=null,at=0,shown=-1;
  const numeric=(v,k=2)=>Number.isFinite(v)?v.toFixed(k):'—';
  const clamp=(v,a,b)=>Math.max(a,Math.min(v,b));
  const findFrame=t=>{
    let lo=0,hi=frames.length-1;
    while(lo<hi){const mid=Math.ceil((lo+hi)/2);
      if(frames[mid].time_s<=t)lo=mid;else hi=mid-1;}
    return lo;
  };
  const direction=(a,b)=>Math.atan2(b.y_m-a.y_m,b.x_m-a.x_m);
  const angleDifference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
  function validate(r){
    if(!r||!Array.isArray(r.frames)||r.frames.length<2)return 'No trajectory frames';
    const finiteKeys=['time_s','x_m','y_m','distance_m','energy_estimated_wh','speed_mps','soc'];
    const first=r.frames[0];
    for(let i=0;i<r.frames.length;i++){
      const f=r.frames[i];
      if(finiteKeys.some(k=>!Number.isFinite(f[k])))return 'Non-finite replay data';
      if(f.soc<0||f.soc>1||f.speed_mps<0||f.distance_m<0)return 'Invalid physical bounds';
      if(map&&(f.x_m<-.05||f.y_m<-.05||f.x_m>map.width_m+.05||f.y_m>map.height_m+.05))
        return 'Replay point outside campus bounds';
      if(i){
        const p=r.frames[i-1];
        if(f.time_s<p.time_s-1e-7)return 'Timestamps out of order';
        if(f.distance_m<p.distance_m-.003)return 'Distance is not monotonic';
        if(f.energy_estimated_wh<p.energy_estimated_wh-.002)return 'Modeled energy is not monotonic';
      }
    }
    if(Math.abs(r.frames.at(-1).distance_m-r.distance_m)>.01)return 'Total distance mismatch';
    if(Math.abs(r.frames.at(-1).time_s-r.duration_sim_s)>.011)return 'Duration mismatch';
    if(first.time_s<-.01)return 'Initial time invalid';
    return null;
  }
  function derivedFrames(){
    heading=[];movingTime=[];let theta=null,total=0;
    for(let i=0;i<frames.length;i++){
      if(i){
        const a=frames[i-1],b=frames[i],dt=Math.max(0,b.time_s-a.time_s);
        const dx=b.x_m-a.x_m,dy=b.y_m-a.y_m;
        if(Math.hypot(dx,dy)>.007)theta=direction(a,b);
        if(dt>0 && b.distance_m-a.distance_m>.005)total+=dt;
      }
      heading.push(theta);movingTime.push(total);
    }
  }
  function phaseTimeline(){
    const view=$('phase-ribbon'),legend=$('phase-legend');view.replaceChildren();legend.replaceChildren();
    const phases=[],total=Math.max(.001,run.duration_sim_s);
    for(let i=0;i<frames.length-1;i++){
      const d=Math.max(0,frames[i+1].time_s-frames[i].time_s);
      if(d===0)continue;
      const label=frames[i].phase;
      if(!phases.length||phases.at(-1).name!==label)phases.push({name:label,duration:d});
      else phases.at(-1).duration+=d;
    }
    const colors=['#7ce3c1','#78aef5','#f1be85','#a29de8','#83c4cf','#a6d18b','#d39cb6'];
    phases.forEach((phase,i)=>{
      const color=colors[i%colors.length];
      const block=document.createElement('div');
      block.style.flexGrow=String(phase.duration);
      block.style.background=color;
      block.title=phase.name.replaceAll('_',' ')+' · '+numeric(phase.duration,1)+' s';
      block.setAttribute('aria-label',block.title);block.setAttribute('role','img');
      view.append(block);
      const tag=document.createElement('span');
      const dot=document.createElement('i');dot.style.background=color;
      tag.append(dot,document.createTextNode(phase.name.replaceAll('_',' ')+' · '+numeric(100*phase.duration/total,0)+'%'));
      legend.append(tag);
    });
  }
  function routeLength(points) {
    if(!Array.isArray(points))return NaN;
    let length=0;
    for(let i=1;i<points.length;i++)length+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
    return length;
  }
  function refresh(time){
    if(!run||!frames.length||integrity)return;
    const index=findFrame(time),f=frames[index],p=frames[Math.max(0,index-1)];
    const dt=index>0?Math.max(0,f.time_s-p.time_s):0;
    const accel=dt>1e-6?(f.speed_mps-p.speed_mps)/dt:null;
    const theta=heading[index],theta0=heading[Math.max(0,index-1)];
    const omega=dt>1e-6&&theta!==null&&theta0!==null?
      angleDifference(theta,theta0)*180/Math.PI/dt:null;
    const power=dt>1e-6?Math.max(0,(f.energy_estimated_wh-p.energy_estimated_wh)*3600/dt):null;
    const returning=['RETURNING','DOCKED'].includes(f.phase);
    const stop=map?.stops?.[returning?'depot':run.destination];
    const direct=stop?Math.hypot(stop[0]-f.x_m,stop[1]-f.y_m):null;
    const routes=(run.routes||[]).filter(r=>r.time_s<=time);
    const length=routes.length?routeLength(routes.at(-1).points):null;
    const efficiency=f.distance_m>0.1?f.energy_estimated_wh*1000/f.distance_m:null;
    $('audit-position').textContent=numeric(f.x_m,2)+' / '+numeric(f.y_m,2);
    $('audit-accel').textContent=numeric(accel,3);
    $('audit-turnrate').textContent=numeric(omega,1);
    $('audit-power').textContent=numeric(power,1);
    $('audit-goal').textContent=numeric(direct,2);
    $('audit-efficiency').textContent=numeric(efficiency,1);
    $('audit-duty').textContent=numeric(f.time_s>0?100*movingTime[index]/f.time_s:0,0)+'%';
    $('audit-route').textContent=numeric(length,1);
    const integrityText=$('audit-integrity-note');
    integrityText.textContent='VALIDATED FRAME CONSISTENCY · '+frames.length+
       ' samples · '+(run.scenario||'default')+' scenario. Independent sensor verification: unavailable.';
  }
  function update(e){
    const d=e.detail||{};
    const next=d.run||window.__cdrReplayState?.run;
    if(!next)return;
    if(next!==run){
      run=next;frames=next.frames||[];map=window.__cdrReplayState?.map||map;
      integrity=validate(next);
      $('audit-integrity').textContent=integrity?'CHECK FAILED':'CONSISTENT';
      $('audit-integrity').classList.toggle('invalid',!!integrity);
      $('audit-integrity-note').textContent=integrity||'Validated internally against model output; NOT independent sensor truth.';
      if(integrity){$('phase-ribbon').replaceChildren();$('phase-legend').replaceChildren();return;}
      derivedFrames();phaseTimeline();shown=-1;
    }
    const t=clamp(Number(d.time)||0,0,run.duration_sim_s);
    at=t;
    const i=findFrame(t);
    if(i!==shown){shown=i;refresh(t);}
  }
  window.addEventListener('cdr:frame',update);
  window.addEventListener('cdr:replay',update);
  if(window.__cdrReplayState?.run)update({detail:{run:window.__cdrReplayState.run,time:window.__cdrReplayState.time}});
})();
