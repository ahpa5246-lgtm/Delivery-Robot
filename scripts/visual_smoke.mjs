/**
 * Real-browser verification, not a replacement for human visual inspection.
 * Screenshots at desktop, tablet, and mobile widths are saved as CI artifacts.
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:8765';
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 820, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];
await mkdir('experiments/ui_visual', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  // Early mobile layout gate: diagnose overflow before the expensive 3-viewport
  // full integration suite, so a regression fails quickly and identifies causes.
  const mobileProbe = await browser.newPage({viewport:{width:390,height:844}});
  await mobileProbe.goto(base+'/?view=campus', {waitUntil:'domcontentloaded',timeout:30000});
  const mobileWidth = await mobileProbe.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    offenders: Array.from(document.body.querySelectorAll('*')).filter(el => {
      const rect=el.getBoundingClientRect();
      return rect.right > innerWidth + 1 && rect.width > 0;
    }).slice(0,10).map(el=>({
      tag:el.tagName,id:el.id,css:el.className?.toString().slice(0,80),
      width:Math.round(el.getBoundingClientRect().width),
      right:Math.round(el.getBoundingClientRect().right)
    }))
  }));
  await mobileProbe.close();
  assert.ok(mobileWidth.document <= mobileWidth.viewport+1,
    'Early mobile horizontal overflow: '+JSON.stringify(mobileWidth));
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.error('PAGE ERROR:', e.message); });
    page.on('console', message => {
      if (message.type() === 'error') { errors.push(message.text()); console.error('CONSOLE ERROR:', message.text()); }
    });
    page.on('response', response => {
      if (response.status() >= 400)
        errors.push('HTTP '+response.status()+' '+response.url());
    });
    const response = await page.goto(base+'/?view=campus', { waitUntil: 'domcontentloaded', timeout: 30000 });
    assert.equal(response.status(), 200);
    await page.waitForFunction(() => (
      document.querySelector('#gazebo-samples')?.textContent !== '—'
      && document.querySelector('#total')?.textContent !== '00:00'
    ), { timeout: 15000 });
    assert.equal(await page.locator('#gazebo-samples').innerText(), '397');
    assert.equal(await page.locator('#gazebo-displacement').innerText(), '4.399');
    assert.equal(await page.locator('#gazebo-speed').innerText(), '0.250');
    const canvasIsDrawn = await page.locator('#map').evaluate(canvas => {
      const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      let changes = 0;
      for (let i = 0; i < data.length; i += 2000) {
        if (data[i] !== 0 || data[i + 1] !== 0 || data[i + 2] !== 0) changes++;
      }
      return changes > 50;
    });
    assert.ok(canvasIsDrawn, 'Campus canvas must render non-empty map');
    await page.waitForFunction(() => (
      document.querySelector('#scene3d canvas')
      && document.querySelector('#scene-status').textContent.includes('INTERACTIVE 3D')
    ), { timeout: 15000 });
    assert.equal(await page.locator('#view3d').getAttribute('aria-pressed'), 'true');
    await page.screenshot({path:'experiments/ui_visual/'+viewport.name+'-initial.png',fullPage:true});
    console.log('VISUAL ENVIRONMENT STATUS',await page.locator('#scene-detail-count').innerText());
    await page.waitForFunction(() => Number(document.querySelector('#scene-detail-count')?.textContent.replaceAll(',', '')) > 100);
    assert.match(await page.locator('#scene-detail-mode').innerText(), /Campus collision world/);
    assert.equal(await page.locator('#lighting-caption').innerText(), 'Day — visualization');
    await page.locator('#lighting-preset').selectOption('golden');
    assert.equal(await page.locator('#lighting-caption').innerText(), 'Evening — visualization');
    await page.locator('#lighting-preset').selectOption('night');
    assert.equal(await page.locator('#lighting-caption').innerText(), 'Night — visualization');
    await page.locator('#lighting-preset').selectOption('day');
    await page.locator('#world-preset').selectOption('warehouse');
    await page.waitForFunction(() => window.__cdrReplayState?.map?.world==='warehouse'
      && window.__cdrReplayState?.run?.world==='warehouse');
    assert.ok((await page.locator('#debug-world').innerText()).includes('Logistics'));
    await page.waitForFunction(() => document.querySelector('#scene-detail-mode').textContent === 'Logistics collisions');
    await page.locator('#world-preset').selectOption('campus');
    await page.waitForFunction(() => window.__cdrReplayState?.map?.world==='campus'
      && window.__cdrReplayState?.run?.world==='campus');
    await page.waitForFunction(() => document.querySelector('#scene-detail-mode').textContent === 'Campus collision world');
    assert.equal(await page.locator('#robot-profile option').count(), 9);
    await page.waitForFunction(() => document.querySelector('#debug-path-valid').textContent.includes('PASS'));
    assert.equal(await page.locator('#debug-violations').innerText(),'0');
    assert.ok(Number(await page.locator('#debug-obstacles').innerText()) > 10);
    await page.waitForFunction(() => document.querySelector('#debug-blocked').textContent.includes(' / '));
    const occupancyResponse=await page.request.get(base+'/api/occupancy?world=campus');
    assert.equal(occupancyResponse.status(),200);
    const occupancy=await occupancyResponse.json();
    assert.equal(occupancy.geometry_schema,'cdr-shared-collision-world-v4');
    assert.ok(occupancy.blocked_cells.length>100);
    await page.locator('#debug-collision').check();
    await page.waitForFunction(()=>window.CDR3D.scene.getObjectByName('AUTHORITATIVE_COLLISION_PROXIES')?.visible===true);
    await page.locator('#debug-occupancy').check();
    await page.waitForFunction(()=>window.CDR3D.scene.getObjectByName('ROBOT_INFLATED_OCCUPANCY')?.visible===true);
    await page.locator('#debug-occupancy').uncheck();
    await page.locator('#debug-collision').uncheck();
    await page.waitForFunction(() => (
      document.querySelector('#mesh-provenance')?.textContent.includes('ORIGINAL CAD')
    ), { timeout: 30000 });
    assert.ok((await page.locator('#mesh-provenance').innerText()).includes('CAD'));
    await page.waitForFunction(() => {
      const robot=window.CDR3D?.getRobot();
      const original=robot?.getObjectByName('primitive-chassis-body');
      return original?.visible===false && robot.children.some(m =>
        m.isMesh && m.geometry?.getAttribute('position')?.count > 45000);
    }, {timeout: 30000});
    assert.equal(await page.locator('#mesh-provenance').count(),1);
    await page.waitForFunction(() => (
      !!window.CDR3D?.environment?.getObjectByName('licensed-office')
    ), { timeout: 30000 });
    assert.equal(await page.locator('.cad-status-bar').count(),1);
    assert.equal(await page.locator('#energy-chart').count(),1);
    assert.equal(await page.locator('#course-chart').count(),1);
    assert.equal(await page.locator('#current-speed').count(),1);
    assert.equal(await page.locator('#export-csv').count(),1);
    const referenceResponse=await page.request.get(base+'/assets/robot/rbot-wheel.stl');
    assert.equal(referenceResponse.status(),200);
    assert.ok((await referenceResponse.body()).length > 100000);
    const maliciousPath=await page.request.get(base+'/assets/../../README.md');
    assert.equal(maliciousPath.status(),404);
    assert.equal(await page.locator('#integration-list .ref-card').count(), 10);
    await page.locator('#robot-profile').selectOption('six');
    assert.ok((await page.locator('#profile-source').getAttribute('href')).includes('Delivery-Robot-ROS'));
    await page.locator('#robot-profile').selectOption('cdr');
    const size = await page.evaluate(() => ({
      screen: window.innerWidth,
      page: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    assert.ok(size.page <= size.screen + 1, 'Unexpected horizontal overflow: ' + JSON.stringify(size));
    assert.ok(size.body <= size.screen + 1, 'Body exceeds viewport: ' + JSON.stringify(size));
    await page.locator('#timeline').evaluate(input => {
      input.value = '75';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const distance = Number(await page.locator('#distance').innerText());
    assert.ok(distance > 1, 'Modeled distance should update during replay');
    await page.waitForFunction(() => document.querySelector('#audit-integrity').textContent === 'CONSISTENT');
    assert.ok(Number((await page.locator('#audit-position').innerText()).split('/')[0]) >= 0);
    assert.ok(Number(await page.locator('#audit-route').innerText()) > 1);
    assert.ok(Number(await page.locator('#audit-efficiency').innerText()) > 0);
    assert.ok((await page.locator('#phase-ribbon > div').count()) > 1);
    const auditKeys=['audit-accel','audit-turnrate','audit-power','audit-goal','audit-duty'];
    for(const key of auditKeys){
      assert.ok((await page.locator('#'+key).innerText()).length>0, key+' should show a derived reading');
    }
    const chartRendered = await page.locator('#trace').evaluate(c => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      return d.some((n, i) => i % 4 !== 3 && n > 70);
    });
    assert.ok(chartRendered, 'Telemetry chart should render actual frame values');
    await page.screenshot({ path: 'experiments/ui_visual/' + viewport.name + '.png', fullPage: true });
    if (viewport.name === 'desktop') {
      await page.locator('[data-camera=follow]').click();
      await page.waitForTimeout(1250);
      const visibleRobot = await page.evaluate(() => {
        const robot = window.CDR3D.getRobot(), camera = window.CDR3D.getCamera();
        robot.updateWorldMatrix(true, false);
        camera.updateWorldMatrix(true, false);
        const projection = new THREE.Vector3().setFromMatrixPosition(robot.matrixWorld).project(camera);
        return {x:projection.x,y:projection.y,z:projection.z};
      });
      assert.ok(Math.abs(visibleRobot.x)<.68 && Math.abs(visibleRobot.y)<.68
        && visibleRobot.z>-1 && visibleRobot.z<1,
        'Follow camera should keep robot in view: '+JSON.stringify(visibleRobot));
      await page.screenshot({ path: 'experiments/ui_visual/desktop-follow-robot.png', fullPage: true });
      await page.locator('[data-camera=orbit]').click();
    }
    await page.locator('#scenario').selectOption('estop');
    const freshRun = page.waitForResponse(r => r.url().includes('/api/run?') && r.url().includes('scenario=estop'));
    await page.locator('#run').click();
    const estopResponse = await freshRun;
    assert.equal(estopResponse.status(), 200);
    await page.waitForFunction(() => {
      const parts = document.querySelector('#total').textContent.split(':').map(Number);
      return parts.length === 2 && (parts[0] * 60 + parts[1]) > 0
        && (parts[0] * 60 + parts[1]) < 15;
    });
    await page.locator('#timeline').evaluate(input => {
      input.value = '100';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    assert.equal(await page.locator('#status').innerText(), 'PAUSED SAFE');
    assert.ok((await page.locator('#reason').innerText()).includes('ESTOP_LATCHED'));
    // Redirect to a same-origin PlayCanvas scene, never third-party iframe.
    assert.equal(await page.locator('#garden-frame').count(),0);
    await page.locator('#view-garden').click();
    await page.waitForURL('**/robot-garden',{timeout:30000});
    assert.equal(await page.locator('iframe').count(),0);
    assert.equal(await page.locator('#viewer').count(),1);
    assert.equal(await page.locator('#lab-options').isVisible(),false);
    await page.screenshot({path:'experiments/ui_visual/'+viewport.name+'-robot-garden.png',fullPage:true});
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForURL('**/robot-garden',{timeout:30000});
    assert.equal(await page.locator('iframe').count(),0);
    await page.goto(base+'/?view=campus',{waitUntil:'domcontentloaded',timeout:30000});
    assert.equal(await page.locator('#scene3d').isVisible(),true);
    assert.deepEqual(errors, [], 'Unexpected browser errors');
    console.log(JSON.stringify({ viewport: viewport.name, canvas: 'rendered', horizontalOverflow: false, gazeboOdomDistanceM: 4.399, gazebosSamples: 397, estop: 'PAUSED_SAFE', jsErrors: errors.length }));
    await page.close();
  }
} finally {
  await browser.close();
}
