from playwright.sync_api import sync_playwright
from pathlib import Path
import json,datetime,re,base64,mimetypes
root=Path(__file__).resolve().parents[1];shots=root/'test-results';shots.mkdir(exist_ok=True)
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for w,h,label in [(1440,1000,'desktop'),(390,844,'mobile')]:
  ctx=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1)
  page=ctx.new_page(); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  html=(root/'public/index.html').read_text()
  css=(root/'public/styles.css').read_text()
  html=html.replace('<link rel="stylesheet" href="/styles.css">','<style>'+css+'</style>').replace('<script src="/app.js" defer></script>','')
  html=re.sub(r'<link rel="preload"[^>]+>','',html)
  for asset in (root/'public/assets').iterdir():
   mime=mimetypes.guess_type(asset.name)[0] or 'application/octet-stream'
   uri='data:'+mime+';base64,'+base64.b64encode(asset.read_bytes()).decode()
   html=html.replace('src="/assets/'+asset.name+'"','src="'+uri+'"')
  core=(root/'lib/request.mjs').read_text().replace('export ','')
  app=(root/'public/app.js').read_text()
  app=re.sub(r"const \{easternToday,validateRequest,fileError,receiptMessage,deliveryLinks\}=await import\('/request.mjs'\);",lambda m:core,app)
  fake_fetch="""<script>window.fetch=async function(input){var url=String(input);if(url.indexOf('/api/workspace')===0)return new Response(JSON.stringify({connected:true}),{status:200});if(url.indexOf('/api/availability')===0)return new Response(JSON.stringify({enabled:false,slots:[]}),{status:200});if(url.indexOf('/api/booking')===0)return new Response(JSON.stringify({ok:true,id:'11111111-1111-4111-8111-111111111111',reference:'JM-K7P4D2Q9',uploadToken:'',attachmentStatus:{expected:0,received:0,failed:[]},receivedIndices:[]}),{status:201});return new Response(JSON.stringify({error:'Unexpected test request'}),{status:404});};</script>"""
  html=html.replace('</body>',fake_fetch+'<script>'+app+'</script></body>')
  page.set_content(html,wait_until='load')
  page.screenshot(path=str(shots/f'{label}-home.png'),full_page=False)
  assert page.locator('h1').inner_text()=='Good car care.\nRight at your\ndoorstep.'
  assert page.locator('.service-card').count()==6
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), f'overflow {label}'
  for img in page.locator('img').all():
   img.scroll_into_view_if_needed()
   assert img.evaluate('(i)=>i.decode().then(()=>i.naturalWidth>0).catch(()=>false)'),img.get_attribute('alt')
  results.append(f'{label}: all images load, six services visible, no horizontal overflow')
  if label=='mobile':
   page.locator('#menu-toggle').click();assert page.locator('#mobile-menu').is_visible();page.locator('#mobile-menu a[href="#services"]').click();assert not page.locator('#mobile-menu').is_visible()
  page.locator('[data-service="brakes"]').click();assert page.locator('#service').input_value()=='brakes'
  page.locator('input[name=year]').fill('2018');page.locator('input[name=make]').fill('Honda');page.locator('input[name=model]').fill('Accord')
  page.locator('textarea[name=description]').fill('Synthetic test request only. Brake noise when slowing down.')
  page.locator('#preferred-date').fill('2026-10-28');page.locator('select[name=time]').select_option('Morning');page.locator('input[name=city]').fill('Northern Broward')
  page.locator('input[name=name]').fill('Synthetic Test');page.locator('input[name=phone]').fill('2025550142');page.locator('input[name=email]').fill('test@example.com');page.locator('input[name=consent]').check()
  page.locator('#media-picker').set_input_files(str(root/'public/assets/josh-mobile-social.jpg'))
  assert page.locator('.file-preview').count()==1
  page.locator('.remove-file').click();assert page.locator('.file-preview').count()==0
  page.locator('button[type=submit]').click();assert page.locator('#request-review').is_visible();assert 'JM-K7P4D2Q9' in page.locator('#request-review').inner_text()
  assert page.locator('#send-whatsapp').get_attribute('href').startswith('https://wa.me/16467967322?text=')
  assert page.locator('#send-sms').get_attribute('href').startswith('sms:+16467967322')
  assert 'VIN:' not in page.locator('#request-summary').inner_text()
  assert 'already saved' in page.locator('#request-review').inner_text()
  page.locator('#request-review').screenshot(path=str(shots/f'{label}-request.png'))
  assert page.locator('#edit-request').count()==1
  assert not errors,errors
  results.append(f'{label}: service selection, valid form, image preview/removal, save-first receipt, short message links and no JS errors passed')
  ctx.close()
 browser.close()
(root/'docs/browser-tests.json').write_text(json.dumps({'results':results,'note':'Synthetic browser tests. No messages sent to Josh. Logged-out local browser; live-domain tests follow deployment.'},indent=2))
print(json.dumps(results,indent=2))
