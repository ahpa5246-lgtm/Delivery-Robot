import assert from 'node:assert/strict';
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
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('ROBOT IN GARDEN VIEW'),{timeout:65000});
 }catch(e){
  console.error('3DGS LOAD STATUS',await page.locator('#status').innerText());
  console.error('BROWSER ERRORS',errs);
  throw e;
 }
 assert.equal(await page.locator('#lab-options').isVisible(),false);
 assert.equal(await page.locator('#viewer-quick-controls').isVisible(),true);
 assert.equal(await page.locator('#robot-controls').isVisible(),true);
 assert.ok((await page.locator('#provenance').innerText()).includes('GARDEN COLLISION NOT VERIFIED'));
 assert.ok(await page.locator('#viewer canvas').count()>0);
 await page.locator('#origin-x').fill('1.5');
 await page.locator('#origin-x').dispatchEvent('change');
 await page.locator('#quick-focus').click();
 assert.ok((await page.locator('#pose-readout').innerText()).includes('CAMERA VIEW'));
 await page.locator('#quick-forward').click();
 assert.ok((await page.locator('#pose-readout').innerText()).includes('MANUAL CONTROL'));
 console.log('ROBOT_AND_SPLAT_SCENE_VALIDATED_IN_BROWSER');
 if(errs.length)console.log('BROWSER_WARNINGS',JSON.stringify(errs.slice(0,5)));
 await page.close();
}finally{await browser.close();}
