/* Mission intelligence: readings exclusively derived from offline Python replay frames.
 * No fictitious sensor feeds, unmeasured torques, fake battery currents or GPS positions. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const energy=$('energy-chart'),course=$('course-chart');
 if(!energy||!course)return;
 let run=null,runFrames=[],headings=[],lastPaint=0,lastFrame=null,currentTime=0;
 const fmt=(n,k=2)=>Number.isFinite(n)?n.toFixed(k):'—';
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function findIndex(time){
   let lo=0,hi=runFrames.length-1;
   if(!runFrames.length)return -1;
   while(lo<hi){
     const mid=Math.ceil((lo+hi)/2);
     if(runFrames[mid].time_s<=time)lo=mid;else hi=mid-1;
   }
   return lo;
 }
 function makeHeadings(frames){
   const arr=[];let last=0;
   for(let i=0;i<frames.length;i++){
     if(i>0) {
       const dx=frames[i].x_m-frames[i-1].x_m;
       const dy=frames[i].y_m-frames[i-1].y_m;
       if(Math.hypot(dx,dy)>.002)last=((Math.atan2(dy,dx)*180/Math.PI)+360)%360;
     }
     arr.push(last);
   }
   return arr;
 }
 function canvasSetup(canvas) {
   const bounds=canvas.getBoundingClientRect(),w=Math.max(bounds.width,200),h=Math.max(bounds.height,120);
   const dpi=Math.min(window.devicePixelRatio||1,2);
   const rw=Math.round(w*dpi),rh=Math.round(h*dpi);
   if(canvas.width!==rw||canvas.height!==rh){canvas.width=rw;canvas.height=rh;}
   const ctx=canvas.getContext('2d');
   ctx.setTransform(dpi,0,0,dpi,0,0);
   ctx.clearRect(0,0,w,h);
   ctx.fillStyle='#0b1928';ctx.fillRect(0,0,w,h);
   return {ctx,w,h};
 }
 function plot(canvas,series,limitTime,axes){
   const {ctx,w,h}=canvasSetup(canvas);
   const small=w<520;
   const box={left:small?40:52,right:w-(small?29:46),top:20,bottom:h-30};
   const frameTime=Math.max(.001,run?.duration_sim_s||1);
   const px=t=>box.left+(box.right-box.left)*clamp(t/frameTime,0,1);
   const py=(v,min,max)=>box.bottom-(box.bottom-box.top)*clamp((v-min)/Math.max(1e-8,max-min),0,1);
   ctx.font=(small?9:11)+'px system-ui';ctx.lineWidth=1;
   for(let i=0;i<=4;i++){
     const y=box.top+(box.bottom-box.top)*i/4;
     ctx.beginPath();ctx.moveTo(box.left,y);ctx.lineTo(box.right,y);
     ctx.strokeStyle='#243b4e';ctx.stroke();
     const primary=axes.max-(axes.max-axes.min)*i/4;
     ctx.textAlign='right';ctx.fillStyle='#92acbf';ctx.fillText(fmt(primary,axes.decimals??1),box.left-6,y+3);
     if(axes.rightMax!==undefined){
       ctx.textAlign='left';ctx.fillText(fmt(axes.rightMax*(1-i/4),0),box.right+6,y+3);
     }
   }
   for(let i=0;i<=4;i++){
     const x=box.left+(box.right-box.left)*i/4;
     ctx.beginPath();ctx.moveTo(x,box.top);ctx.lineTo(x,box.bottom);
     ctx.strokeStyle='#1e3646';ctx.stroke();
     ctx.textAlign='center';ctx.fillStyle='#92a5b4';
     ctx.fillText(Math.round(frameTime*i/4)+'s',x,box.bottom+17);
   }
   for(const entry of series){
     const range=entry.range,draw=(limit,color,opacity,thickness)=>{
       ctx.beginPath();let started=false;
       for(let i=0;i<runFrames.length;i++){
         const f=runFrames[i];
         if(f.time_s>limit)break;
         const v=entry.values[i];
         if(!Number.isFinite(v))continue;
         const x=px(f.time_s),y=py(v,range[0],range[1]);
         if(!started){ctx.moveTo(x,y);started=true;} else ctx.lineTo(x,y);
       }
       if(started){ctx.strokeStyle=color;ctx.globalAlpha=opacity;ctx.lineWidth=thickness;ctx.lineJoin='round';ctx.stroke();ctx.globalAlpha=1;}
     };
     draw(frameTime,entry.color,.24,small?1.2:1.6);
     draw(limitTime,entry.color,1,small?1.9:2.8);
   }
   const x=px(limitTime);
   ctx.beginPath();ctx.moveTo(x,box.top);ctx.lineTo(x,box.bottom);
   ctx.strokeStyle='#e3fcf6a8';ctx.setLineDash([5,5]);ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);
 }
 function renderPhaseDistribution(){
   if(!runFrames.length)return;
   const counts=new Map();
   for(const f of runFrames)counts.set(f.phase,(counts.get(f.phase)||0)+1);
   const box=$('phase-distribution');if(!box)return;
   const rows=[...counts].sort((a,b)=>b[1]-a[1]);
   box.replaceChildren();
   for(const [phase,n] of rows.slice(0,7)){
     const span=document.createElement('span');
     span.textContent=phase.replaceAll('_',' ')+' · '+Math.round(100*n/runFrames.length)+'%';
     box.append(span);
   }
 }
 function render(time){
   if(!run||!runFrames.length)return;
   const end=run.duration_sim_s||0,index=findIndex(time),frame=runFrames[index];
   if(!frame)return;
   const traveled=Math.max(0,frame.distance_m||0);
   const elapsed=Math.max(0,frame.time_s||0);
   $('current-speed').textContent=fmt(frame.speed_mps,2);
   $('average-speed').textContent=fmt(elapsed>0?traveled/elapsed:0,2);
   let maximum=0;
   for(let i=0;i<=index;i++)maximum=Math.max(maximum,runFrames[i].speed_mps||0);
   $('peak-speed').textContent=fmt(maximum,2);
   $('course-heading').textContent=fmt(headings[index],0)+'°';
   $('mission-progress').textContent=fmt(end>0?100*time/end:0,0)+'%';
   $('sim-remaining').textContent=fmt(Math.max(0,end-time),1);
   const maxEnergy=Math.max(.1,...runFrames.map(f=>f.energy_estimated_wh||0))*1.15;
   const maxDistance=Math.max(1,run.distance_m||0)*1.1;
   plot(energy,[
    {values:runFrames.map(f=>f.energy_estimated_wh),range:[0,maxEnergy],color:'#64baf9'},
    {values:runFrames.map(f=>f.distance_m),range:[0,maxDistance],color:'#f2b963'}
   ],time,{min:0,max:maxEnergy,rightMax:maxDistance,decimals:1});
   plot(course,[{values:headings,range:[0,360],color:'#7ce8be'}],time,{min:0,max:360,decimals:0});
 }
 function rebuild(r){
   if(!r||!Array.isArray(r.frames))return;
   run=r;runFrames=r.frames;headings=makeHeadings(runFrames);
   renderPhaseDistribution();lastPaint=0;
 }
 function update(ev) {
   const detail=ev.detail||{};
   if(detail.run!==run)rebuild(detail.run);
   if(!run)return;
   currentTime=clamp(Number(detail.time)||0,0,run.duration_sim_s||0);
   const now=performance.now();
   if(now-lastPaint>=160||currentTime===0||currentTime===run.duration_sim_s){
     lastPaint=now;render(currentTime);
   }
 }
 window.addEventListener('cdr:replay',update);
 window.addEventListener('cdr:frame',update);
 window.addEventListener('resize',()=>{if(run)render(currentTime);});
 const btn=$('export-csv');
 if(btn)btn.addEventListener('click',()=>{
   if(!run||!runFrames.length){btn.textContent='START SIMULATION FIRST';return;}
   const columns=['time_s','x_m','y_m','distance_m','speed_mps','soc','energy_estimated_wh','phase'];
   const esc=v=>'"'+String(v??'').replaceAll('"','""')+'"';
   const lines=[columns.join(','),...runFrames.map(f=>columns.map(k=>esc(f[k])).join(','))];
   const url=URL.createObjectURL(new Blob([lines.join('\r\n')+'\r\n'],{type:'text/csv;charset=utf-8'}));
   const link=document.createElement('a');link.href=url;
   link.download='CDR-01-'+run.scenario+'-seed-'+run.seed+'-kinematic-replay.csv';
   document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),4000);
 });
 const initial=window.__cdrReplayState;
 if(initial?.run)update({detail:{run:initial.run,time:initial.time||0}});
})();
