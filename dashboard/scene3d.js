/* Interactive 3D visualization of a deterministic 2D replay.
   Three.js r147 © Three.js authors (MIT), vendored locally.
   Robot profiles are ORIGINAL geometric approximations inspired by named open-source
   architectures, never upstream meshes or certified kinematics.
   The 3D scene does not send commands to ROS/Gazebo. */
'use strict';
(() => {
  const T = window.THREE;
  const root = document.getElementById('scene3d');
  const status = document.getElementById('scene-status');
  const modelSelect = document.getElementById('robot-profile');
  const worldSelect = document.getElementById('world-preset');
  const sourceLink = document.getElementById('profile-source');
  const stage = document.getElementById('stage-viewport');
  const view3d = document.getElementById('view3d');
  const view2d = document.getElementById('view2d');
  const canvas2d = document.getElementById('map');
  const nav = {
    cdr: ['CDR-01 delivery concept', 'https://github.com/ahpa5246-lgtm/Delivery-Robot'],
    six: ['6-wheel delivery concept', 'https://github.com/Pouya-Mansournia/Delivery-Robot-ROS'],
    mecanum: ['Mecanum indoor concept', 'https://github.com/mohmedatwa/delivery_robot'],
    rbot: ['Jazzy AMR concept', 'https://github.com/rlxai/rbot'],
    lino: ['4WD modular concept', 'https://github.com/linorobot/linorobot2'],
    clearpath: ['Outdoor rover concept', 'https://github.com/clearpathrobotics/clearpath_simulator'],
    tb4: ['Compact TurtleBot4 concept', 'https://github.com/turtlebot/turtlebot4_simulator'],
    palash: ['Warehouse AMR concept', 'https://github.com/PalashMendhe/robotics-amr-ws'],
    tb3: ['TurtleBot3 concept', 'https://github.com/ROBOTIS-GIT/turtlebot3_simulations']
  };
  function updateProfileLink() {
    const choice = nav[modelSelect.value] || nav.cdr;
    sourceLink.href = choice[1];
    sourceLink.textContent = choice[0] + ' ↗';
  }
  if (!root || !T) {
    if (status) status.textContent = '3D renderer unavailable; 2D map is still usable.';
    if (root) root.hidden = true;
    return;
  }
  let renderer;
  try {
    renderer = new T.WebGLRenderer({antialias:true, alpha:false, powerPreference:'high-performance'});
  } catch (err) {
    status.textContent = 'WebGL is unavailable: ' + err.message + ' — switch to 2D.';
    root.hidden = true;
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.setSize(Math.max(300, root.clientWidth), Math.max(240, root.clientHeight), false);
  renderer.setClearColor(0x132c3c);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.70;
  root.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', 'Interactive three-dimensional campus and robot replay');
  const scene = new T.Scene();
  const previewScene = new T.Scene();
  previewScene.background = new T.Color(0x17323b);
  previewScene.add(new T.HemisphereLight(0xd9f4ff,0x28404b,1.7));
  const previewLight = new T.DirectionalLight(0xffe5bf,2.2);
  previewLight.position.set(3,6,4);previewScene.add(previewLight);
  const previewCamera = new T.PerspectiveCamera(44,1,0.1,30);
  previewCamera.position.set(1.95,1.85,2.4);
  previewCamera.lookAt(0,.45,0);
  let previewRobot=null;
  scene.background = new T.Color(0x142b3b);
  scene.fog = new T.Fog(0x142b3b, 26, 85);
  const camera = new T.PerspectiveCamera(48, 1, 0.1, 170);
  const target = new T.Vector3(16,0,-10);
  let orbitAz = Math.PI*0.28, orbitElevation=0.95, orbitRadius=47;
  let cameraMode = 'orbit', dragging=false, oldX=0, oldY=0;
  function setPose() {
    const horizontal = orbitRadius*Math.cos(orbitElevation);
    camera.position.set(target.x+Math.cos(orbitAz)*horizontal,
      target.y+orbitRadius*Math.sin(orbitElevation),
      target.z+Math.sin(orbitAz)*horizontal);
    camera.lookAt(target);
  }
  camera.position.set(39,30,19);setPose();
  const hemi = new T.HemisphereLight(0xcdeafa,0x243b45,0.90);scene.add(hemi);
  const sun = new T.DirectionalLight(0xffe6bb,1.55);
  sun.position.set(12,33,8);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.left=-30;sun.shadow.camera.right=30;
  sun.shadow.camera.top=30;sun.shadow.camera.bottom=-30;
  sun.shadow.bias=-0.0007;scene.add(sun);
  const mat = (c, extra={})=>new T.MeshStandardMaterial({color:c, roughness:0.78, metalness:0.08, ...extra});
  const grass=mat(0x315646), road=mat(0x3e515b), pavers=mat(0x7c8981),
        pavement=mat(0x828c90), dark=mat(0x27323e), rubber=mat(0x141c23),
        cyan=mat(0x68f0c7,{emissive:0x0b5b4a,emissiveIntensity:0.5}),
        amber=mat(0xfacb83,{emissive:0x775621,emissiveIntensity:0.2}),
        glass=mat(0x87c0ce,{roughness:0.2,metalness:0.22,transparent:true,opacity:0.72});
  const environment = new T.Group();scene.add(environment);
  const pathGroup=new T.Group();scene.add(pathGroup);
  let robot=null, map=null, lastRun=null, playbackTime=0;
  let lastAnim=performance.now(), lastX=2,lastY=2;
  const cube=(parent,w,h,d,color,x,y,z,shadow=true)=>{
    const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),color);
    mesh.position.set(x,y,z);mesh.castShadow=shadow;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  const cyl=(parent,r1,r2,height,color,x,y,z,axis=null)=>{
    const m=new T.Mesh(new T.CylinderGeometry(r1,r2,height,12),color);
    m.position.set(x,y,z);if(axis)m.rotation.set(...axis);
    m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  };
  const sphere=(parent,r,color,x,y,z)=>{
    const m=new T.Mesh(new T.SphereGeometry(r,10,8),color);
    m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;
  };
  const line=(parent,points,color,linewidth=1)=>{
    if(points.length<2)return null;
    const geom=new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(p[0],p[1],p[2])));
    const o=new T.Line(geom,new T.LineBasicMaterial({color,linewidth}));
    parent.add(o);return o;
  };
  function signText(parent,label,x,y,z,w=2){
    const c=document.createElement('canvas');c.width=512;c.height=128;
    const g=c.getContext('2d');g.clearRect(0,0,512,128);
    g.fillStyle='rgba(12,31,42,.88)';g.fillRect(0,0,512,128);
    g.strokeStyle='#7ecbbb';g.lineWidth=6;g.strokeRect(5,5,502,118);
    g.textAlign='center';g.textBaseline='middle';g.fillStyle='#e9f5ed';
    g.font='bold 49px system-ui';g.fillText(label,256,64,494);
    const texture=new T.CanvasTexture(c);texture.encoding=T.sRGBEncoding;
    const plane=new T.Mesh(new T.PlaneGeometry(w,w/4),new T.MeshBasicMaterial({map:texture,transparent:true,side:T.DoubleSide}));
    plane.position.set(x,y,z);plane.rotation.x=-Math.PI/2;parent.add(plane);
    return plane;
  }
  function treeAt(x,z,i){
    const r=0.65+(i%3)*0.10;
    cyl(environment,0.10,0.14,1.25,mat(0x5b4833),x,0.62,z);
    sphere(environment,r,mat((i%2)?0x4d8556:0x377665),x,1.65,z);
    sphere(environment,r*.65,mat(0x66a475),x+0.28,2.00,z-0.12);
  }
  function lampAt(x,z){
    cyl(environment,.055,.065,3.4,mat(0x667783),x,1.7,z);
    cube(environment,.52,.14,.30,dark,x,3.39,z,false);
    cube(environment,.40,.05,.23,mat(0xffe6b4,{emissive:0xffca76,emissiveIntensity:.7}),x,3.30,z,false);
  }
  function benchAt(x,z,rotate=false){
    const g=new T.Group();g.position.set(x,0,z);if(rotate)g.rotation.y=Math.PI/2;
    cube(g,1.2,.14,.4,mat(0x937054),0,.48,0);
    cube(g,1.2,.47,.10,mat(0x906c55),0,.79,-.23);
    for(const s of [-.43,.43])cube(g,.07,.38,.37,dark,s,.22,0);
    environment.add(g);
  }
  function building(i,[x0,y0,x1,y1],theme){
    const w=x1-x0,d=y1-y0, cx=(x0+x1)/2,cz=-(y0+y1)/2;
    const height=(i===3?1.6:3.0+i*.4);
    const base=mat([0x88acaa,0xa89178,0x6993a9,0x79a18b][i]);
    cube(environment,w,height,d,base,cx,height/2,cz);
    cube(environment,w+.2,.18,d+.2,mat(0x304450),cx,height+.08,cz);
    // Small accessible glass entrance (purely visual; collisions not changed).
    const dx=cx,front=-y0-.018;
    cube(environment,1.28,1.75,.035,glass,dx,.89,front);
    cube(environment,1.45,.16,.2,dark,dx,1.78,front);
    const stories=Math.max(1,Math.floor(height/1.1));
    for(let s=0;s<stories;s++){
      for(let a=0;a<Math.min(4,Math.floor(w/1.5));a++){
        const xx=x0+(a+1)*w/(Math.min(4,Math.floor(w/1.5))+1);
        cube(environment,.55,.54,.024,glass,xx,.95+s*1.02,-y1-.022);
        cube(environment,.55,.54,.024,glass,xx,.95+s*1.02,front);
      }
    }
    signText(environment,theme==='warehouse'?['LOADING A','STORAGE B','SORTING','GARDEN'][i]:
      ['WEST WING','NORTH WING','EAST WING','GREENHOUSE'][i],cx,height+.24,cz,Math.min(w*1.12,3.0));
  }
  function addStop(name,p){
    cyl(environment,.32,.32,.035,mat(name==='depot'?0xeebd7d:0x62d9bb,{emissive:0x093e36}),p[0],.045,-p[1]);
    cyl(environment,.21,.21,.045,mat(0x193946),p[0],.065,-p[1]);
    const words={depot:'DOCK',engineering:'ENGINEERING',library:'LIBRARY',student_center:'STUDENT CENTER'};
    signText(environment,words[name]||name,p[0],.11,-p[1]-.7,2.0);
  }
  function constructEnvironment(data){
    map=data;
    environment.clear();
    const warehouse=worldSelect.value==='warehouse';
    const base=cube(environment,35,.36,23,warehouse?mat(0x5b6066):grass,16,-.18,-10);
    base.castShadow=false;
    for(const y of [7,14]) {
      cube(environment,32,.035,1.75,warehouse?pavement:pavers,16,.018,-y,false);
    }
    for(const x of [6.5,16,26]) {
      cube(environment,1.65,.037,20,warehouse?pavement:pavers,x,.022,-10,false);
    }
    // Subtle square parking and loading bay
    cube(environment,5,.035,3.1,road,3.5,.02,-2.5,false);
    data.buildings.forEach((b,i)=>{
      const start=environment.children.length;
      building(i,b,worldSelect.value);
      for(const item of environment.children.slice(start))item.userData.buildingIndex=i;
    });
    if(!warehouse){
      let idx=0;
      const sites=[[1.1,7.3],[2.0,13.9],[16.7,2.0],[17,18.2],[29.8,10],
                   [23.6,2.1],[30,18.7],[1.5,17.6],[14,4.3],[13.9,17.9],
                   [7.1,2.2],[25.2,19.1]];
      for(const [x,y] of sites)treeAt(x,-y,idx++);
      [[6.5,7],[16,7],[26,7],[16,14],[26,14]].forEach(p=>lampAt(p[0],-p[1]));
      [[17.6,5.3],[25.6,16.6],[4.6,12.2]].forEach((p,i)=>benchAt(p[0],-p[1],i%2===0));
      for(const [x,y] of [[19,2],[21,2],[24,2]])sphere(environment,.35,mat(0x6ba874),x,.22,-y);
    }else {
      for(const x of [5,10,18,25,29]){
        for(const y of [5,17]){
          const xx=x+.1,zz=-y;
          cube(environment,1.15,1.1,.75,mat(0xb79b6f),xx,.55,zz);
          cube(environment,1.1,.08,.7,mat(0x685647),xx,1.13,zz);
        }
      }
      for(const x of [3,28])lampAt(x,-10);
    }
    Object.entries(data.stops).forEach(([name,p])=>addStop(name,p));
    status.textContent='INTERACTIVE 3D — KINEMATIC REPLAY / NOT GAZEBO';
    window.dispatchEvent(new CustomEvent('cdr:environment',{detail:{environment,theme:worldSelect.value,map:data}}));
  }
  function makeRobot(profile){
    if(robot){scene.remove(robot);robot.traverse(o=>{if(o.isMesh&&!o.userData.sharedCad){o.geometry.dispose();}});}
    const g=new T.Group(),compact=profile==='tb3'||profile==='tb4';
    const six=profile==='six',mec=profile==='mecanum',rover=profile==='clearpath',low=profile==='palash';
    const basecolor=mat(profile==='six'?0xefa85e:rover?0xcaae77:compact?0x2d697e:0x62c9bb,
      {metalness:.35,roughness:.45});
    const bodyW=compact?.56:(rover?1.25:1.00),bodyD=compact?.48:(rover?.83:.68);
    const height=compact?.25:low?.23:.36;
    if(compact){
      cyl(g,.35,.35,.19,basecolor,0,.26,0);
      cyl(g,.27,.27,.07,dark,0,.4,0);
      cyl(g,.17,.17,.06,cyan,0,.46,0);
    }else{
      cube(g,bodyW,.12,bodyD,dark,0,.28,0);
      cube(g,bodyW*.94,height,bodyD*.92,basecolor,0,.38+height*.4,0);
      cube(g,bodyW*.68,.19,bodyD*.78,dark,-.02,.38+height+.05,0);
      cube(g,bodyW*.63,.21,bodyD*.72,mat(0xe7edf0),-.02,.53+height,0);
      cube(g,.05,.16,.38,glass,bodyW*.47,.48+height,0);
      // Visible service hatch
      cube(g,.24,.02,.18,mat(0x608695),-.2,.65+height,0);
      for(const z of [-bodyD*.32,bodyD*.32]) {
        cube(g,.12,.08,.10,cyan,bodyW*.48,.44,z);
      }
    }
    const wxs=six?[-.35,0,.35]:[-.32,.32];
    for(const x of wxs){
      for(const side of [-1,1]){
        const z=side*(bodyD*.5+.045);
        const wheel=cyl(g,compact?.115:rover?.23:.17,compact?.115:rover?.23:.17,.10,rubber,
          x,.19,z,[Math.PI/2,0,0]);
        cyl(g,.055,.055,.115,mat(0x95a9ab),x,.19,z,[Math.PI/2,0,0]);
        if(mec) for(let i=0;i<7;i++) {
          const angle=2*Math.PI*i/7;
          sphere(g,.043,mat(0x9a9da5),x+.17*Math.cos(angle),.19+.17*Math.sin(angle),z);
        }
        wheel.name='wheel';
      }
    }
    if(compact){
      cyl(g,.03,.03,.42,mat(0xaac8ce),0,.64,0);
      cyl(g,.16,.16,.055,dark,0,.88,0);
    }else{
      cyl(g,.035,.04,.19,dark,-.30,.83+height,0);
      cyl(g,.16,.16,.07,mat(0x202d36),-.30,.96+height,0);
      cyl(g,.12,.12,.022,cyan,-.30,1.01+height,0);
      cube(g,.14,.13,.17,glass,bodyW*.32,.76+height,0);
    }
    // This is a visual silhouette only. Physics in recorded trace is always CDR-01.
    scene.add(g);robot=g;robot.position.set(lastX,0,-lastY);
    if(previewRobot)previewScene.remove(previewRobot);
    previewRobot=g.clone(true);
    previewRobot.position.set(0,0,0);
    previewScene.add(previewRobot);
    const label=document.getElementById('inspector-model');
    if(label)label.textContent=(nav[profile]||nav.cdr)[0].replace(' concept','');
    window.dispatchEvent(new CustomEvent('cdr:robot-model',{detail:{profile,robot:g,preview:previewRobot}}));
  }
  function trajectory(run,time){
    if(!run||!run.frames?.length)return null;
    const frames=run.frames;
    if(time<=frames[0].time_s)return {p:frames[0],next:frames[Math.min(1,frames.length-1)]};
    if(time>=frames[frames.length-1].time_s)return {p:frames[frames.length-1],next:null};
    let lo=0,hi=frames.length-1;
    while(lo+1<hi){const md=(lo+hi)>>1;if(frames[md].time_s<=time)lo=md;else hi=md;}
    const a=frames[lo],b=frames[hi],dt=b.time_s-a.time_s,amount=dt>0?Math.max(0,Math.min(1,(time-a.time_s)/dt)):0;
    return {p:{x_m:a.x_m+(b.x_m-a.x_m)*amount,y_m:a.y_m+(b.y_m-a.y_m)*amount},next:b};
  }
  let lastPathTime=-1, lastPathRun=null;
  function updateRoutes(){
    if(lastPathRun===lastRun && Math.abs(lastPathTime-playbackTime)<0.35)return;
    lastPathRun=lastRun;lastPathTime=playbackTime;
    pathGroup.traverse(item=>{
      if(item.isMesh || item.isLine){
        item.geometry?.dispose();
        if(Array.isArray(item.material))item.material.forEach(m=>m.dispose());
        else item.material?.dispose();
      }
    });
    pathGroup.clear();
    if(!lastRun)return;
    for(let i=0;i<lastRun.routes.length;i++){
      const r=lastRun.routes[i];
      if(r.time_s>playbackTime)continue;
      const pts=r.points.map(p=>[p[0],.08+i*.002,-p[1]]);
      const old=i!==lastRun.routes.length-1 && lastRun.routes.some((q,j)=>j>i&&q.time_s<=playbackTime);
      line(pathGroup,pts,old?0x6b8f9b:0x57f4bc);
    }
    const trail=lastRun.frames.filter(f=>f.time_s<=playbackTime).map(f=>[f.x_m,.10,-f.y_m]);
    if(trail.length>1)line(pathGroup,trail,0xf8e2ac);
    if(lastRun.events.some(e=>e.state==='REPLANNING'&&e.time_s<=playbackTime)){
      for(const [i,j] of lastRun.closure_cells){
        cube(pathGroup,.48,.09,.48,mat(0xe5a16d,{transparent:true,opacity:.72}),
          i*.5+.25,.12,-(j*.5+.25),false);
      }
    }
  }
  function syncReplay(event) {
    if(event?.detail?.run)lastRun=event.detail.run;
    if(event?.detail?.time!==undefined)playbackTime=event.detail.time;
    const o=trajectory(lastRun,playbackTime);
    if(o&&robot){
      const x=o.p.x_m,z=-o.p.y_m;let dx=x-lastX,dy=o.p.y_m-lastY;
      if(Math.hypot(dx,dy)>.006)robot.rotation.y=Math.atan2(dy,dx);
      robot.position.set(x,0,z);
      lastX=x;lastY=o.p.y_m;
    }
    updateRoutes();
  }
  let sceneReady=false;
  function finish3d() {
    const data=window.__cdrReplayState?.map;
    if(!data){setTimeout(finish3d,80);return;}
    constructEnvironment(data);makeRobot(modelSelect.value);
    syncReplay({detail:{run:window.__cdrReplayState.run,time:window.__cdrReplayState.time}});
    sceneReady=true;setPose();refreshSize();
  }
  function refreshSize(){
    const w=Math.max(root.clientWidth,1),h=Math.max(root.clientHeight,1);
    if(w<10||h<10)return;
    const aspect=w/h;
    if(Math.abs(camera.aspect-aspect)>.002||renderer.domElement.width<2){
      camera.aspect=aspect;camera.updateProjectionMatrix();
    }
    renderer.setSize(w,h,false);
  }
  let lastGpuFrame=0;
  function render(timestamp) {
    requestAnimationFrame(render);
    if(!sceneReady||root.hidden)return;
    // Cap GPU work to ~30 fps. Browser screenshots and low-end devices must not
    // burn CPU on unlimited shadowed render passes.
    if(timestamp-lastGpuFrame<32)return;
    lastGpuFrame=timestamp;
    refreshSize();
    if(cameraMode==='follow'&&robot)target.lerp(new T.Vector3(robot.position.x,.45,robot.position.z),.08);
    else if(cameraMode==='orbit')target.lerp(new T.Vector3(16,0,-10),.02);
    if(cameraMode!=='top')setPose();
    renderer.setViewport(0,0,root.clientWidth,root.clientHeight);
    renderer.render(scene,camera);
    // Dedicated robot model inspector: the robot remains visible independently
    // of whether buildings would occlude the main world camera.
    if(previewRobot) {
      previewRobot.rotation.y=timestamp*.00026;
      const w=root.clientWidth,h=root.clientHeight;
      const side=Math.min(w<490?120:164,Math.floor(w*.32),Math.floor(h*.44));
      const gap=12;
      const x=w-side-gap,y=h-side-gap;
      previewCamera.aspect=1;previewCamera.updateProjectionMatrix();
      renderer.setScissorTest(true);
      renderer.setViewport(x,y,side,side);
      renderer.setScissor(x,y,side,side);
      renderer.render(previewScene,previewCamera);
      renderer.setScissorTest(false);
      renderer.setViewport(0,0,w,h);
    }
  }
  renderer.domElement.addEventListener('pointerdown',e=>{
    dragging=true;oldX=e.clientX;oldY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener('pointermove',e=>{
    if(!dragging)return;
    const dx=e.clientX-oldX,dy=e.clientY-oldY;oldX=e.clientX;oldY=e.clientY;
    orbitAz-=dx*.007;orbitElevation=Math.max(.18,Math.min(1.43,orbitElevation+dy*.005));
    if(cameraMode==='top')cameraMode='orbit';
  });
  renderer.domElement.addEventListener('pointerup',()=>dragging=false);
  renderer.domElement.addEventListener('wheel',e=>{
    e.preventDefault();orbitRadius=Math.max(9,Math.min(75,orbitRadius+e.deltaY*.036));
  },{passive:false});
  for(const btn of document.querySelectorAll('[data-camera]')){
    btn.addEventListener('click',()=>{
      const mode=btn.dataset.camera;
      cameraMode=mode;
      if(mode==='top'){
        target.set(16,0,-10);camera.position.set(16,45,-10.01);camera.lookAt(target);
      }else if(mode==='follow'){orbitRadius=9;orbitElevation=1.14;orbitAz=.55;}
      else{orbitRadius=47;orbitElevation=.95;orbitAz=.82;target.set(16,0,-10);}
      for(const b of document.querySelectorAll('[data-camera]'))b.classList.toggle('active',b===btn);
    });
  }
  function show3d(value){
    root.hidden=!value;canvas2d.hidden=value;
    view3d.setAttribute('aria-pressed',String(value));
    view2d.setAttribute('aria-pressed',String(!value));
    stage.classList.toggle('show3d',value);
    if(value)refreshSize();
  }
  view3d.addEventListener('click',()=>show3d(true));
  view2d.addEventListener('click',()=>show3d(false));
  modelSelect.addEventListener('change',()=>{
    updateProfileLink();makeRobot(modelSelect.value);syncReplay();
  });
  worldSelect.addEventListener('change',()=>{
    if(map)constructEnvironment(map);syncReplay();
  });
  window.addEventListener('cdr:replay',syncReplay);
  window.addEventListener('cdr:frame',syncReplay);
  window.addEventListener('resize',refreshSize);
  window.CDR3D=Object.freeze({THREE:T,scene,environment,renderer,getRobot:()=>robot,getPreview:()=>previewRobot,getModel:()=>modelSelect.value,getWorld:()=>worldSelect.value});
  updateProfileLink();finish3d();requestAnimationFrame(render);
  show3d(true);
})();
