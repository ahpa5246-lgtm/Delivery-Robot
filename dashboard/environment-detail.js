/* V4: one authoritative fixture list from /api/map. Every solid at robot height
 * corresponds to a planner-inflated AABB. Facade decorations/treetops and
 * ground paving are nonblocking render-only geometry. Do not create arbitrary
 * scenery independent of the collision map.
 */
(() => {
  'use strict';
  const T=window.THREE, API=window.CDR3D;
  if(!T||!API)return;
  const world=API.environment, scene=API.scene;
  const mat=(color,props={})=>new T.MeshStandardMaterial({color,roughness:.83,metalness:.07,...props});
  const materials={
    wood:mat(0x8f7558), metal:mat(0x637378,{metalness:.32}),
    foliage:mat(0x607b56),leaf:mat(0x84956d),
    roof:mat(0x9aabb0),glass:mat(0x89c0ce,{metalness:.25,roughness:.27}),
    ochre:mat(0xbb9470),ground:mat(0x9c9585),
    detail:mat(0x3d5d63), glow:mat(0xe6f8c1,{emissive:0x3a7971,emissiveIntensity:.35})
  };
  const shared={
    box:new T.BoxGeometry(1,1,1),
    cyl:new T.CylinderGeometry(.5,.5,1,12),
    canopy:new T.IcosahedronGeometry(.5,1)
  };
  const mtx=new T.Matrix4(),pos=new T.Vector3(),quat=new T.Quaternion(),size=new T.Vector3();
  const up=new T.Vector3(0,1,0);
  let root=null,detailCount=0;
  function batch(kind, material, objects) {
    if(!objects.length)return;
    const mesh=new T.InstancedMesh(shared[kind],material,objects.length);
    objects.forEach((o,i)=>{
      const [x,y,z,sx,sy,sz,rot=0]=o;
      pos.set(x,y,z);quat.setFromAxisAngle(up,rot);size.set(sx,sy,sz);
      mtx.compose(pos,quat,size);mesh.setMatrixAt(i,mtx);
    });
    mesh.instanceMatrix.needsUpdate=true;
    mesh.receiveShadow=true;mesh.castShadow=false;
    mesh.userData={visualOnly:false,collisionReference:'world/campus_layout.json'};
    root.add(mesh);detailCount+=objects.length;
  }
  function build(map,theme){
    if(root){world.remove(root);root.traverse(o=>{if(o.isInstancedMesh)o.dispose?.()});}
    root=new T.Group();root.name='AUTHORITATIVE_WORLD_FIXTURES_V4';world.add(root);
    detailCount=0;
    const group={};
    function add(g,x,y,z,sx,sy,sz,rot=0){
      (group[g]??=[]).push([x,y,z,sx,sy,sz,rot]);
    }
    const fixtures=map.fixtures||[];
    for(const f of fixtures){
      const [x0,y0,x1,y1]=f.footprint_m;
      const cx=(x0+x1)/2,cy=(y0+y1)/2, w=x1-x0,d=y1-y0,z=-cy;
      if(f.kind==='tree'){
        add('trunk',cx,.71,z,.17,1.42,.17);
        // Foliage starts safely above the vehicle's modeled cargo roof.
        for(let i=0;i<7;i++){
          const a=2*Math.PI*i/7;
          add('leaves',cx+.31*Math.cos(a),1.90+(i%2)*.20,z+.31*Math.sin(a),
            .90,.94,.90);
        }
      }else if(f.kind==='bench'){
        for(const x of [x0+.16,x1-.16])add('metal',x,.28,z,.06,.56,d*.72);
        for(let k=0;k<5;k++)add('wood',cx,.55,-y0-.14-k*.055,w*.89,.09,.047);
        for(let k=0;k<3;k++)add('wood',cx,.76+k*.16,-y1-.04,w*.88,.105,.06);
      }else if(f.kind==='table'){
        add('wood',cx,.76,z,w*.91,.085,d*.91);
        for(const x of [x0+.16,x1-.16])for(const y of [y0+.16,y1-.16])
          add('metal',x,.37,-y,.055,.74,.055);
        for(let k=0;k<4;k++){
          const a=k*Math.PI/2;
          add('metal',cx+Math.cos(a)*w*.43,.40,z+Math.sin(a)*d*.43,
            .20,.05,.20);
        }
      }else if(f.kind==='light'){
        add('metal',cx,1.40,z,.08,2.80,.08);
        add('glass',cx,2.83,z,.28,.09,.26);
        add('glow',cx,2.77,z,.24,.035,.23);
      }else if(f.kind==='bike_rack'){
        for(let i=0;i<5;i++){
          const x=x0+.15+i*(w-.30)/4;
          add('metal',x,.31,z,.055,.63,.055);
          add('metal',x,.62,z,.09,.055,d*.65);
        }
      }else if(f.kind==='shelf'){
        for(const x of [x0+.05,x1-.05])for(const y of [y0+.05,y1-.05])
          add('metal',x,1.06,-y,.08,2.12,.08);
        for(const h of [.30,1.10,1.95])
          add('wood',cx,h,z,w,.08,d);
        for(let i=0;i<3;i++)add('ochre',x0+.26+i*(w-.52)/3,.66,z,.23,.43,d*.55);
      }else if(f.kind==='cargo'){
        add('ochre',cx,.40,z,w,.8,d);
        add('wood',cx,.85,z,w*.87,.09,d*.86);
        for(const x of [x0+.16,x1-.16])add('metal',x,.50,z,.025,.5,d*.80);
      }
    }
    const materialFor={trunk:materials.wood,leaves:materials.foliage,
      wood:materials.wood,metal:materials.metal,glass:materials.glass,
      glow:materials.glow,ochre:materials.ochre};
    for(const [kind,objects] of Object.entries(group)){
      batch(kind==='trunk'?'cyl':kind==='leaves'?'canopy':'box',materialFor[kind],objects);
    }
    // Pedestrian markings and terrain are visually flat and don't create an
    // upright collision obstacle; registered obstacles above remain authoritative.
    const backdrop=new T.Mesh(new T.PlaneGeometry(180,180),
      new T.MeshBasicMaterial({color:theme==='warehouse'?0x36444a:0x4a6251,fog:true}));
    backdrop.rotation.x=-Math.PI/2;backdrop.position.set(16,-.374,-10);
    backdrop.receiveShadow=true;backdrop.userData.visualOnly=true;root.add(backdrop);
    const panel=document.getElementById('scene-detail-count');
    if(panel)panel.textContent=detailCount.toLocaleString();
    document.getElementById('scene-detail-mode').textContent=
      theme==='warehouse'?'Logistics collisions':'Campus collision world';
    root.userData={collisionObjects:map.collision_objects,theme,visualInstances:detailCount};
  }
  function setLighting(value){
    const presets={
      day:{sky:0x405765,hemisphere:1.04,sun:1.65,pos:[12,33,8]},
      golden:{sky:0x6f5d53,hemisphere:.85,sun:1.85,pos:[-17,12,-7]},
      night:{sky:0x1c2733,hemisphere:.42,sun:.55,pos:[-9,14,-14]}
    };
    const v=presets[value]||presets.day;
    scene.background.setHex(v.sky);if(scene.fog)scene.fog.color.setHex(v.sky);
    const hemi=scene.children.find(o=>o.isHemisphereLight),
          sun=scene.children.find(o=>o.isDirectionalLight);
    if(hemi)hemi.intensity=v.hemisphere;
    if(sun){sun.intensity=v.sun;sun.position.set(...v.pos);}
    document.getElementById('lighting-caption').textContent=
      value==='night'?'Night — visualization':value==='golden'?'Evening — visualization':'Day — visualization';
  }
  document.getElementById('lighting-preset')?.addEventListener('change',e=>setLighting(e.target.value));
  window.addEventListener('cdr:environment',e=>build(e.detail.map,e.detail.theme));
  if(window.__cdrReplayState?.map)build(window.__cdrReplayState.map,API.getWorld());
  setLighting(document.getElementById('lighting-preset')?.value||'day');
})();
