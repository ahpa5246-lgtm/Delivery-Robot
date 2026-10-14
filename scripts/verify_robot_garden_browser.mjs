import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errs=[];page.on('pageerror',e=>errs.push(e.message));
 const r=await page.goto('http://127.0.0.1:8765/robot-garden',{waitUntil:'domcontentloaded'});
 assert.equal(r.status(),200);
 assert.equal(await page.locator('iframe').count(),0);
 assert.equal(await page.locator('#splat-file').count(),1);
 assert.equal(await page.locator('#panel-toggle').isVisible(),true);
 await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('UPLOAD ORIGINAL 3DGS ZIP TO CODESPACES'));
 assert.ok((await page.locator('#provenance').innerText()).includes('NO GARDEN MODEL LOADED'));
 await page.locator('#panel-toggle').click();
 assert.equal(await page.locator('#lab-options').isVisible(),true);
 const source='https://developer.playcanvas.com/assets/toy-cat.sog';
 await page.locator('#splat-url').fill(source);
 await page.locator('#load-url').click();
 try {
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('PICK LAWN'),{timeout:65000});
 }catch(e){
  console.error('3DGS LOAD STATUS',await page.locator('#status').innerText());
  console.error('BROWSER ERRORS',errs);
  throw e;
 }
 assert.equal(await page.locator('#lab-options').isVisible(),true);
 assert.equal(await page.locator('#viewer-quick-controls').isVisible(),true);
 assert.equal(await page.locator('#robot-controls').isVisible(),true);
 assert.ok((await page.locator('#provenance').innerText()).includes('GARDEN COLLISION NOT VERIFIED'));
 assert.ok(await page.locator('#viewer canvas').count()>0);
 await page.locator('#origin-x').fill('1.5');
 await page.locator('#origin-x').dispatchEvent('change');
 await page.locator('#quick-focus').click();
 assert.equal(await page.locator('#ground-pick-layer').isVisible(),true);
 assert.equal(await page.locator('#quick-ground').isEnabled(),true);
 // The robot must not float until a visual floor anchor has been selected.
 assert.equal(await page.locator('#status').innerText(),
 'CLICK A PATCH OF GRASS OR PAVING TO PLACE ROBOT');
 assert.ok(await page.locator('#viewer canvas').count()>0);
 assert.equal(await page.locator('#floor-y').inputValue(),'-2');
 // Explicit manual anchor is required: camera-only placement is no proof
 // of ground contact. Export is demonstrably labeled unverified.
 await page.locator('#place').click();
 const dlPromise=page.waitForEvent('download');
 await page.locator('#export-garden-calibration').click();
 const download=await dlPromise;
 assert.equal(download.suggestedFilename(),'garden-calibration.json');
 const exported=JSON.parse(await readFile(await download.path(),'utf8'));
 assert.equal(exported.schema,'cdr-garden-calibration-v1');
 assert.equal(exported.terrain_collision_verified,false);
 assert.equal(exported.source_sha256.length,64);
 // Browser fixture for API contract only: actual dynamics are covered
 // separately by Gazebo Harmonic workflow, not by this mocked response.
 await page.route('**/api/garden-gazebo-run',route=>route.fulfill({
   contentType:'application/json',status:200,body:JSON.stringify({
    schema:'cdr-garden-gazebo-replay-v1',
    source:'recorded_gazebo_harmonic_odometry',
    physics_world:'flat_contact_proxy_not_real_garden_terrain',
    contact_mesh_validated:false,
    garden_source_sha256:exported.source_sha256,
    samples:3,
    frames:[{time_s:0,x_m:0,y_m:0,yaw_rad:0},
            {time_s:1,x_m:.12,y_m:0,yaw_rad:0},
            {time_s:2,x_m:.25,y_m:0,yaw_rad:0}]
   })
 }));
 await page.locator('#load-garden-gazebo').click();
 try {
  await page.waitForFunction(()=>
   document.querySelector('#pose-readout')?.textContent?.includes('RECORDED GAZEBO FLAT CONTACT PROXY'),
   {timeout:15000});
 } catch (e) {
  console.error('GAZEBO_REPLAY_STATUS',await page.locator('#status').innerText());
  console.error('GAZEBO_POSE_READOUT',await page.locator('#pose-readout').innerText());
  throw e;
 }
 assert.ok((await page.locator('#provenance').innerText()).includes('NO GARDEN PHYSICS'));
 assert.equal(await page.locator('#play').isEnabled(),true);
 await page.locator('#play').click();
 await page.waitForFunction(()=>{
   const m=document.querySelector('#pose-readout')?.textContent?.match(/· ([0-9.]+)s ·/);
   return m && Number(m[1])>=0.3;
 },{timeout:8000});
 await page.locator('#pause').click();
 const paused=await page.locator('#pose-readout').innerText();
 await page.waitForTimeout(250);
 assert.equal(await page.locator('#pose-readout').innerText(),paused,'Pause must freeze replay');
 const pausedTime=Number(paused.match(/· ([0-9.]+)s ·/)[1]);
 await page.locator('#play').click();
 await page.waitForFunction((t)=>{
   const m=document.querySelector('#pose-readout')?.textContent?.match(/· ([0-9.]+)s ·/);
   return m && Number(m[1])>=t+0.25;
 },pausedTime,{timeout:8000});
 assert.match(await page.locator('#pose-readout').innerText(),/m path/);
 await page.locator('#reset').click();
 assert.match(await page.locator('#pose-readout').innerText(),/RESET/);
 console.log('GARDEN_CALIBRATION_EXPORT_AND_SOURCE_LABELED_REPLAY_CONTRACT_OK');
 console.log('SPLAT_SCENE_LOAD_OK_GROUND_PICK_REQUIRED');
 console.log('ROBOT_AND_SPLAT_SCENE_VALIDATED_IN_BROWSER');
 if(errs.length)console.log('BROWSER_WARNINGS',JSON.stringify(errs.slice(0,5)));
 await page.close();
}finally{await browser.close();}
