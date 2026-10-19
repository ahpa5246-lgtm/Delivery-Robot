/* Real WebGL renderer smoke test. Synthetic planar Gaussians are generated here;
   this does not validate the missing original Garden or collision geometry.
   Run dashboard on :8765, then node tests/garden-browser.cjs. */
const {chromium}=require('../vendor/lichtblick/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {promisify}=require('node:util');
const execFile=promisify(require('node:child_process').execFile);
(async()=>{
 const output=process.env.GARDEN_EVIDENCE_DIR||'/tmp/garden-evidence';await fs.mkdir(output,{recursive:true});
 const props=['x','y','z','nx','ny','nz','f_dc_0','f_dc_1','f_dc_2','opacity','scale_0','scale_1','scale_2','rot_0','rot_1','rot_2','rot_3'];
 const rows=[];for(let x=-15;x<=15;x++)for(let z=-15;z<=15;z++)rows.push([x*.2,2,z*.2,0,0,0,-.3,.3,-.3,4,-1.8,-3,-1.8,1,0,0,0]);
 const header=Buffer.from('ply\nformat binary_little_endian 1.0\nelement vertex '+rows.length+'\n'+props.map(p=>'property float '+p+'\n').join('')+'end_header\n');
 const data=Buffer.alloc(rows.length*68);rows.flat().forEach((n,i)=>data.writeFloatLE(n,i*4));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Chromium does not inherit the host proxy trust store. curl verifies TLS using
 // the configured host CA bundle; no TLS or package verification is disabled.
 await page.route('https://cdn.jsdelivr.net/**',async route=>{
  const {stdout}=await execFile('curl',['-fsSL',route.request().url()],{encoding:'buffer',maxBuffer:30000000});
  await route.fulfill({body:stdout,contentType:route.request().url().endsWith('.css')?'text/css':'text/javascript'});
 });
 await page.goto(process.env.GARDEN_TEST_URL||'http://localhost:8765/robot-garden');
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('UPLOAD ORIGINAL'));
 await page.locator('#panel-toggle').click();
 await page.locator('#splat-file').setInputFiles({name:'SYNTHETIC-TEST-PLANE.ply',mimeType:'application/octet-stream',buffer:Buffer.concat([header,data])});
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('SCENE READY'),null,{timeout:60000});
 assert.equal(await page.locator('canvas').count(),1);
 await page.locator('#place').click();await page.locator('#camera-follow').check();
 await page.locator('#export-garden-calibration').click();assert.match(await page.locator('#status').textContent(),/REQUIRES THE ORIGINAL/);
 await page.locator('#odom-file').setInputFiles({name:'synthetic-motion.csv',mimeType:'text/csv',buffer:Buffer.from('time_s,x_m,y_m,yaw_rad\n0,0,0,0\n3,1,0,0\n')});
 await page.locator('#panel-toggle').click();await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(500);
 await page.screenshot({path:output+'/synthetic-start.png',fullPage:true});
 await page.locator('#panel-toggle').click();await page.locator('#play').click();await page.waitForTimeout(700);await page.locator('#pause').click();
 const paused=await page.locator('#pose-readout').textContent();await page.waitForTimeout(300);assert.equal(await page.locator('#pose-readout').textContent(),paused);
 await page.locator('#play').click();await page.waitForFunction(()=>document.querySelector('#pose-readout').textContent.includes('X 1.00m'));
 assert.match(await page.locator('#pose-readout').textContent(),/1.00m path/);
 await page.locator('#panel-toggle').click();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:output+'/synthetic-end.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.screenshot({path:output+'/synthetic-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.locator('#quick-forward').click();
 assert.equal(await page.locator('#play').isDisabled(),true);
 assert.match(await page.locator('.viewer-quick-controls span').textContent(),/MANUAL CONTROL/);
 assert.deepEqual(errors,[]);console.log('PASS: actual Gaussian renderer, anchored robot, follow, replay, pause/resume, provenance guard, narrow layout. Evidence: '+output);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
