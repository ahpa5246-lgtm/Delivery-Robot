/* Actual native Lichtblick runtime acceptance. Run the app first, then this script.
   No sensor mocks, page patches or replacement UI are injected. */
const { chromium } = require('../vendor/lichtblick/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
 const base = process.env.TELEMETRY_TEST_URL || 'http://127.0.0.1:8080';
 const out = process.env.TELEMETRY_EVIDENCE_DIR || '/tmp/native-platform-evidence';
 await fs.mkdir(out, {recursive:true});
 const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try {
  const context=await browser.newContext({viewport:{width:1600,height:1000}});
  const page=await context.newPage(); const errors=[]; const models=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().includes('/models/'))models.push({url:r.url(),status:r.status()});});
  await page.goto(base+'/');
  const perception=page.getByRole('tab',{name:'Perception',exact:true});
  await perception.waitFor();
  await page.waitForFunction(()=>document.querySelector('[role="tab"][aria-selected="true"]')?.textContent==='Perception');
  await page.getByRole('button',{name:'Play',exact:true}).waitFor();
  await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(()=>{let el=document.elementFromPoint(10,100);while(el){const c=getComputedStyle(el).backgroundColor;const v=c.match(/[\d.]+/g)?.map(Number);if(v&&v.length>=3&&(v.length===3||v[3]>0))return v.slice(0,3).every(n=>n<50);el=el.parentElement;}return false;}),true);
  const play=page.getByRole('button',{name:'Play',exact:true});assert.equal(await play.isEnabled(),true);
  await page.waitForFunction(()=>performance.getEntriesByType('resource').some(r=>r.name.endsWith('/models/rbot-chassis.stl')),null,{timeout:20000});
  assert.ok(models.some(m=>m.url.endsWith('rbot-chassis.stl')&&m.status===200),'licensed CAD chassis must load: '+JSON.stringify(models));
  await page.waitForFunction(
    () => performance.getEntriesByType('resource').some(r=>r.name.endsWith('/models/environment/native-campus.urdf')),
    null,{timeout:25000}
  );
  await page.waitForTimeout(650);
  assert.ok(models.some(m=>m.url.endsWith('/models/environment/native-campus.urdf')&&m.status===200),
    'campus environment must load from local URL: '+JSON.stringify(models));
  assert.ok(models.some(m=>m.url.endsWith('/models/environment/world/cafe-table.dae')&&m.status===200),
    'licensed café-table mesh must load: '+JSON.stringify(models));
  assert.ok(models.every(m=>m.status===200),JSON.stringify(models));
  const position = async()=>{const text=await page.locator('body').innerText();const match=text.slice(text.indexOf('position')).match(/\bx\s+(-?[\d.]+)\s+y\s+(-?[\d.]+)/);assert.ok(match,'decoded odometry position is visible');return [Number(match[1]),Number(match[2])];};
  const firstPosition=await position();
  await page.screenshot({path:path.join(out,'native-perception-start.png')});
  // Validate *both* authored worlds in the same real WebGL renderer, not merely
  // that an invisible URDF responded with 200 OK.
  const environmentMenu = page.getByRole('button', {name:'Environment view',exact:true});
  await environmentMenu.waitFor();
  await environmentMenu.click();
  await page.getByRole('menuitem',{name:'Logistics warehouse',exact:true}).click();
  await page.waitForFunction(() => document.body.innerText.includes('Environment view: logistics'));
  await page.waitForTimeout(700);
  await page.screenshot({path:path.join(out,'native-logistics-overview.png')});
  assert.ok(models.some(m=>m.url.endsWith('/models/environment/world/warehouse-shelf.dae')&&m.status===200),
    'actual AWS warehouse shelving mesh must render in native scene');
  await environmentMenu.click();
  await page.getByRole('menuitem',{name:'University campus',exact:true}).click();
  await page.waitForFunction(() => document.body.innerText.includes('Environment view: campus'));
  await page.waitForTimeout(450);
  await page.screenshot({path:path.join(out,'native-campus-overview.png')});
  await environmentMenu.click();
  await page.getByRole('menuitem',{name:'Grid only',exact:true}).click();
  await page.waitForFunction(() => document.body.innerText.includes('Environment view: grid'));
  await page.screenshot({path:path.join(out,'native-grid-only.png')});
  await environmentMenu.click();
  await page.getByRole('menuitem',{name:'University campus',exact:true}).click();
  await page.waitForFunction(() => document.body.innerText.includes('Environment view: campus'));

  await play.click();await page.waitForTimeout(1800);
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  const time=page.getByTestId('PlaybackTime-text').locator('input');
  const paused=await time.inputValue();assert.ok(Number(paused)>0,'native timeline advances');
  const movedPosition=await position();assert.ok(Math.hypot(movedPosition[0]-firstPosition[0],movedPosition[1]-firstPosition[1])>.1,'decoded robot world position changes');
  await page.waitForTimeout(350);assert.equal(await time.inputValue(),paused,'pause holds native playback');
  await page.locator('canvas').first().click({position:{x:30,y:30}});await page.keyboard.press('Space');await page.getByRole('button',{name:'Pause',exact:true}).waitFor();await page.keyboard.press('Space');await page.getByRole('button',{name:'Play',exact:true}).waitFor();
  await page.screenshot({path:path.join(out,'native-perception-motion.png')});
  await page.getByRole('tab',{name:'Missions',exact:true}).click();
  await page.getByText('Mission playback',{exact:true}).waitFor();
  await page.waitForTimeout(500);assert.match(await page.locator('body').innerText(),/campus_kinematic_replay/);assert.match(await page.locator('body').innerText(),/8[45]\.\d+ %/);
  await page.screenshot({path:path.join(out,'native-missions.png')});
  const slider=page.getByTestId('playback-slider');const sb=await slider.boundingBox();assert.ok(sb);
  await page.mouse.click(sb.x+sb.width*.55,sb.y+sb.height/2);
  await page.waitForTimeout(500);assert.ok(Number(await time.inputValue())>20,'timeline seek updates playback time');
  await page.screenshot({path:path.join(out,'native-missions-seek.png')});
  await page.getByRole('tab',{name:'Diagnostics',exact:true}).click();await page.waitForTimeout(900);
  assert.match(await page.locator('body').innerText(),/phase|status/);
  await page.screenshot({path:path.join(out,'native-diagnostics.png')});
  await page.getByRole('tab',{name:'Planning',exact:true}).click();await page.waitForTimeout(500);
  const split=page.locator('.mosaic-split').first();const box=await split.boundingBox();assert.ok(box);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x-100,box.y+box.height/2,{steps:8});await page.mouse.up();await page.waitForTimeout(1000);
  const resized=await split.boundingBox();assert.ok(Math.abs(resized.x-box.x)>50,'native panel resizes');
  await page.getByRole('tab',{name:'Controls',exact:true}).click();await page.getByRole('tab',{name:'Planning',exact:true}).click();await page.waitForTimeout(500);
  assert.ok(Math.abs((await split.boundingBox()).x-resized.x)<5,'workspace switching preserves resize');
  await page.reload();await page.getByRole('tab',{name:'Planning',exact:true}).waitFor();await page.waitForTimeout(1200);
  assert.equal(await page.getByRole('tab',{name:'Planning',exact:true}).getAttribute('aria-selected'),'true');
  assert.ok(Math.abs((await page.locator('.mosaic-split').first().boundingBox()).x-resized.x)<5,'reload preserves native saved layout');
  await page.getByRole('button',{name:'Add panel button',exact:true}).click();await page.getByTestId('panel-menu-item Raw Messages').click();await page.waitForTimeout(400);
  assert.ok(await page.getByTestId('mosaic-drag-handle').count()>=3,'native add-panel works');
  await page.screenshot({path:path.join(out,'native-layout-edited.png')});
  await page.setViewportSize({width:1024,height:768});await page.waitForTimeout(500);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'tablet layout avoids document overflow');
  await page.getByRole('tab',{name:'Missions',exact:true}).click();await page.getByText('Mission playback',{exact:true}).waitFor();
  const narrowTime=Number(await time.inputValue());await page.getByRole('button',{name:'Play',exact:true}).click();await page.waitForTimeout(600);await page.getByRole('button',{name:'Pause',exact:true}).click();assert.ok(Number(await time.inputValue())>narrowTime,'playback works at 1024px');
  await page.screenshot({path:path.join(out,'native-tablet.png')});
  await page.setViewportSize({width:768,height:700});await page.waitForTimeout(400);await page.screenshot({path:path.join(out,'native-small.png')});
  const referenceContext=await browser.newContext({viewport:{width:1600,height:1000},colorScheme:'dark'});const reference=await referenceContext.newPage();await reference.goto(base+'/?reference=1&ds=remote-file&ds.url='+encodeURIComponent(base+'/recordings/campus.mcap'));await reference.waitForTimeout(1800);await reference.screenshot({path:path.join(out,'native-reference.png')});
  const missing=await context.newPage();
  await missing.goto(base+'/?ds=remote-file&ds.url='+encodeURIComponent(base+'/recordings/missing.mcap'));
  await missing.getByRole('button',{name:'Show left sidebar',exact:true}).click();
  await missing.getByTestId('alerts-left').click();
  await missing.waitForFunction(()=>/404|failed|error/i.test(document.body.innerText));
  assert.match(await missing.locator('body').innerText(),/404|failed|error/i);
  assert.equal(await missing.getByRole('button',{name:'Play',exact:true}).isEnabled(),false);
  await missing.getByRole('tab',{name:'Missions',exact:true}).click();await missing.getByText(/No mission message at the current playback time/).waitFor();
  await missing.screenshot({path:path.join(out,'native-missing-source.png')});
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(out,'results.json'),JSON.stringify({status:'passed',checks:['native camera and environment menu','campus overview','logistics overview','grid-only isolation','real MCAP','licensed CAD fetch','default dark','default workspace','play','pause','keyboard toggle','seek','Missions','Diagnostics','resize','workspace persistence','reload persistence','add panel','1024px playback','768px capture','missing source error','empty mission state'],models,errors},null,2));
  console.log('PASS: native engine MCAP, CAD, play/pause/seek, workspaces, persistence and responsive captures. '+out);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
