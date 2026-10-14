// Inspects public 3DGS resource requests without saving the heavy scene.
// Run in GitHub Actions; URLs with signed query credentials are not logged.
import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true,args:['--disable-gpu']});
const page=await browser.newPage();
const records=new Map();
page.on('response',r=>{
 try {
 const u=new URL(r.url());
 if(!/superspl\.at$|playcanvas\.com$|\.superspl\.at$|\.playcanvas\.com$/.test(u.hostname))return;
 const ext=u.pathname.toLowerCase();
 if(!/\.(sog|ply|spz|splat|json|wasm)(\/|$)|\/api\//.test(ext))return;
 const k=u.origin+u.pathname;
 records.set(k,{urlWithoutQuery:k,status:r.status(),contentType:r.headers()['content-type']||'',length:r.headers()['content-length']||'',queryParams:[...u.searchParams.keys()]});
 }catch{}
});
try {
 await page.goto('https://superspl.at/scene/bc0906cd?aa',{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForTimeout(25000);
 console.log('PUBLIC_GARDEN_RESOURCES='+JSON.stringify([...records.values()].slice(0,60),null,2));
 console.log('IFRAMES='+JSON.stringify(await page.locator('iframe').evaluateAll(a=>a.map(x=>x.src))));
 console.log('FRAMES='+JSON.stringify(page.frames().map(f=>({url:f.url(),name:f.name()}))));
 for (const f of page.frames()) { try { console.log('FRAME_BODY='+JSON.stringify({url:f.url(),body:(await f.locator('body').innerText({timeout:4000})).slice(0,1200)})); } catch(e) {console.log('FRAME_ERROR',e.message)} }
 console.log('DOWNLOAD_LINKS='+JSON.stringify(await page.locator('a').evaluateAll(a=>a.filter(x=>/download/i.test(x.textContent)).map(x=>({text:x.textContent?.trim(),url:x.href.slice(0,200)})))));
}catch(e){console.error('DISCOVERY_FAILURE',e.message);process.exitCode=1}
finally{await browser.close();}
