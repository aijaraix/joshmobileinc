// Manual browser acceptance harness. Run with PLAYWRIGHT_MODULE set to a trusted Playwright install.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,normalize,extname} from 'node:path';

const modulePath=process.env.PLAYWRIGHT_MODULE;
if(!modulePath)throw new Error('Set PLAYWRIGHT_MODULE to the path of an installed Playwright package.');
const {chromium}=createRequire(import.meta.url)(modulePath);
const root=resolve(new URL('..',import.meta.url).pathname);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const requestId='11111111-1111-4111-8111-111111111111';
const server=createServer(async(req,res)=>{
 const url=new URL(req.url||'/',`http://${req.headers.host}`);
 if(url.pathname==='/api/workspace')return res.end(JSON.stringify({connected:true,bookingMode:'private'}));
 if(url.pathname==='/api/availability')return res.end(JSON.stringify({enabled:false,slots:[]}));
 if(url.pathname==='/api/booking')return res.end(JSON.stringify({ok:true,id:requestId,reference:'JM-K7P4D2Q9',uploadToken:'',attachmentStatus:{expected:0,received:0,failed:[]},receivedIndices:[]}));
 const relative=url.pathname==='/'?'public/index.html':normalize('public'+url.pathname).replace(/^\.\.(?:\/|\\|$)/,'');
 try{const file=resolve(root,relative);assert(file.startsWith(root));res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port,browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})}),results=[];
try{
 for(const [width,height,label] of [[1440,1000,'desktop'],[390,844,'mobile']]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'networkidle'});
  assert.equal(await page.locator('.service-card').count(),6);assert(await page.evaluate('document.documentElement.scrollWidth<=innerWidth'));
  await page.locator('[data-service="brakes"]').click();await page.locator('input[name=year]').fill('2018');await page.locator('input[name=make]').fill('Honda');await page.locator('input[name=model]').fill('Accord');await page.locator('textarea[name=description]').fill('Synthetic browser check: brake noise while slowing down.');await page.locator('#preferred-date').fill('2026-11-03');await page.locator('select[name=time]').selectOption('Morning');await page.locator('input[name=city]').fill('North Broward');await page.locator('input[name=address]').fill('123 Synthetic Test Street');await page.locator('input[name=vin]').fill('1HGCM82633A004352');await page.locator('input[name=name]').fill('QA Browser Customer');await page.locator('input[name=phone]').fill('2025550142');await page.locator('input[name=consent]').check();
  await page.locator('#media-picker').setInputFiles(resolve(root,'public/assets/josh-mobile-social.jpg'));assert.equal(await page.locator('.file-preview').count(),1);await page.locator('.remove-file').click();assert.equal(await page.locator('.file-preview').count(),0);
  await page.locator('#submit-request').click();await page.locator('#request-review').waitFor();const receipt=await page.locator('#request-review').innerText();assert.match(receipt,/JM-K7P4D2Q9/);assert(!receipt.includes('1HGCM82633A004352'));assert((await page.locator('#send-sms').getAttribute('href')).startsWith('sms:+16467967322'));assert((await page.locator('#send-whatsapp').getAttribute('href')).startsWith('https://wa.me/16467967322?text='));assert.equal(errors.length,0,errors.join('\n'));results.push(`${label}: six services, responsive intake, file preview/remove, save-first receipt, and short messaging links`);await page.close();
 }
 console.log(JSON.stringify({results,note:'Synthetic local browser UI test; API persistence and Blob upload are mocked here and require deployed verification.'},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
