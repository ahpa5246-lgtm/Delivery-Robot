/* Download the creator-enabled CC BY 4.0 Garden asset from public scene-page
 * using documented Download dialog. This does NOT capture the iframe or video.
 * Binary asset is kept as a short-lived CI artifact, not committed into git.
 */
import {chromium} from 'playwright';
import {mkdir,stat,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
const browser=await chromium.launch({headless:true,acceptDownloads:true});
const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:900}});
const page=await ctx.newPage();
const root='assets/gaussian-garden-download';
await mkdir(root,{recursive:true});
page.on('console',msg=>{if(msg.type()==='error')console.log('PAGE_CONSOLE_ERROR',msg.text().slice(0,300))});
page.on('requestfailed',req=>{if(/superspl|playcanvas/.test(req.url())) console.log('FAILED_RESOURCE',new URL(req.url()).origin+new URL(req.url()).pathname,req.failure()?.errorText)});
try{
 const response=await page.goto('https://superspl.at/scene/bc0906cd',{waitUntil:'domcontentloaded',timeout:50000});
 console.log('HTTP_ENTRY',response?.status(),page.url());
 await page.waitForTimeout(5000);
 const html=await page.content();console.log('PAGE_SNAPSHOT',{length:html.length,head:html.slice(0,700),title:await page.title()});
 console.log('DOM_SUMMARY',JSON.stringify(await page.evaluate(()=>({
  title:document.title,bodyLength:document.body?.innerText?.length||0,
  buttons:[...document.querySelectorAll('button,[role="button"],a')].map(x=>({tag:x.tagName,text:x.textContent?.trim().slice(0,75),aria:x.getAttribute('aria-label'),href:x.getAttribute('href')})).filter(x=>/download|PLY|SOG|CC BY/i.test(JSON.stringify(x))).slice(0,30)
 }))));
 const choices=page.getByRole('button',{name:/download/i});const count=await choices.count();
 console.log('DOWNLOAD_BUTTON_COUNT',count);
 if(!count){console.log('DOWNLOAD_CONTROL_NOT_FOUND');process.exitCode=3}
 else{
  await choices.first().evaluate(el=>el.click());
  console.log('POST_BUTTON_CLICK_URL',page.url());
  await page.waitForTimeout(3500);
  console.log('POST_BUTTON_CLICK_URL_AFTER_WAIT',page.url());
  console.log('DOM_AFTER_CLICK',(await page.evaluate(()=>document.body?.innerText||'' )).slice(0,2000));
  console.log('DIALOG_CONTENT',(await page.locator('[role="dialog"],dialog').allTextContents()).map(x=>x.slice(0,2200)));
  const buttons=await page.locator('button,[role="button"],a').evaluateAll(xs=>xs.map(x=>({tag:x.tagName,text:x.textContent?.trim().slice(0,100),href:x.getAttribute('href')})).filter(x=>/PLY|SOG|Download|Original/i.test(x.text)).slice(0,30));
  console.log('DOWNLOAD_TARGETS',JSON.stringify(buttons));
  const target=page.getByRole('button',{name:/original.*(sog|ply)|\b(sog|ply)\b/i}).first();
  let clicked=false;
  const dlPromise=page.waitForEvent('download',{timeout:60000}).catch(()=>null);
  if(await target.count()){await target.click({timeout:12000});clicked=true;}
  else{
    const alt=page.getByRole('link',{name:/original.*(sog|ply)|\b(sog|ply)\b/i}).first();
    if(await alt.count()){await alt.click({timeout:12000});clicked=true;}
  }
  console.log('ATTEMPTED_FORMAT_CLICK',clicked);
  const dl=await dlPromise;
  if(dl){
   const name=dl.suggestedFilename().replace(/[^a-zA-Z0-9_.-]/g,'_');
   const dest=root+'/'+name;await dl.saveAs(dest);const details=await stat(dest);
   const hash=createHash('sha256');for await(const chunk of createReadStream(dest))hash.update(chunk);
   console.log('DOWNLOAD_SUCCESS',JSON.stringify({name,sizeBytes:details.size,sha256:hash.digest('hex')}));
  }else{
   console.log('NO_DIRECT_DOWNLOAD',JSON.stringify({title:await page.title(),text:(await page.locator('body').innerText({timeout:5000}).catch(()=>'' )).slice(0,1700)}));
   process.exitCode=4;
  }
 }
}catch(e){console.error('DOWNLOAD_ERROR',e.stack?.slice(0,2500));process.exitCode=2}
finally{console.log('FILES_SAVED',await readdir(root));await browser.close();}
