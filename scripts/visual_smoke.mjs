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
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    const response = await page.goto(base, { waitUntil: 'networkidle' });
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
    await page.screenshot({ path: 'experiments/ui_visual/' + viewport.name + '.png', fullPage: true });
    await page.locator('#scenario').selectOption('estop');
    await page.locator('#run').click();
    await page.waitForFunction(() => document.querySelector('#reason').textContent.includes('Running deterministic'));
    await page.locator('#timeline').evaluate(input => {
      input.value = '100';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    assert.equal(await page.locator('#status').innerText(), 'PAUSED SAFE');
    assert.ok((await page.locator('#reason').innerText()).includes('ESTOP_LATCHED'));
    assert.deepEqual(errors, [], 'Unexpected browser errors');
    console.log(JSON.stringify({ viewport: viewport.name, canvas: 'rendered', horizontalOverflow: false, gazeboOdomDistanceM: 4.399, gazebosSamples: 397, estop: 'PAUSED_SAFE', jsErrors: errors.length }));
    await page.close();
  }
} finally {
  await browser.close();
}
