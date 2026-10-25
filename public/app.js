(async function(){
'use strict';
const {easternToday,validateRequest,fileError,requestText,deliveryLinks}=await import('/request.mjs');
const $=(id)=>document.getElementById(id);
const menu=$('menu-toggle'),mobile=$('mobile-menu');
menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close menu':'Open menu');mobile.hidden=!open;});
mobile.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{mobile.hidden=true;menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open menu');}));
const form=$('booking-form'),review=$('request-review'); let files=[],objectUrls=[],prepared='',preparedData=null,requestId=null,onlineConnected=false;
fetch('/api/workspace',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(c=>{onlineConnected=c?.connected===true;}).catch(()=>{});
$('preferred-date').min=easternToday();form.elements.year.max=Number(easternToday().slice(0,4))+2;
document.querySelectorAll('[data-service]').forEach(link=>link.addEventListener('click',()=>{form.hidden=false;review.hidden=true;$('service').value=link.dataset.service;}));
const showError=(id,msg)=>{const el=$(id);el.textContent=msg;el.hidden=!msg;};
function renderFiles(){
 objectUrls.forEach(u=>URL.revokeObjectURL(u));objectUrls=[];$('file-previews').replaceChildren();
 files.forEach((file,i)=>{const card=document.createElement('div');card.className='file-preview';
 const remove=document.createElement('button');remove.type='button';remove.className='remove-file';remove.textContent='×';remove.setAttribute('aria-label','Remove '+file.name);remove.addEventListener('click',()=>{files.splice(i,1);renderFiles();showError('media-error','');});
 if(/^image\/(jpeg|png|webp)$/.test(file.type)){const img=document.createElement('img');const url=URL.createObjectURL(file);objectUrls.push(url);img.src=url;img.alt='Selected photo: '+file.name;card.append(img);}else{const badge=document.createElement('span');badge.className='file-type';badge.textContent=file.type.startsWith('video/')?'▷ VIDEO':'PHOTO';card.append(badge);}
 const caption=document.createElement('p');caption.textContent=file.name+' · '+(file.size/1024/1024).toFixed(1)+' MB';card.append(remove,caption);$('file-previews').append(card);});
 $('media-hint').textContent=files.length?`${files.length} file(s) selected on your device. Review your request next to see sharing options. Nothing has been uploaded.`:'Your files stay on your device until you choose a sharing app and send them. No background uploads.';
}
for(const id of ['media-picker','photo-capture','video-capture'])$(id).addEventListener('change',e=>{const additions=Array.from(e.target.files||[]);const err=fileError(files,additions);if(err)showError('media-error',err);else{files.push(...additions);renderFiles();showError('media-error','');}e.target.value='';});
form.addEventListener('submit',e=>{e.preventDefault();const d=Object.fromEntries(new FormData(form));d.consent=!!d.consent;const err=validateRequest(d);showError('form-error',err);if(err)return;
 if(JSON.stringify(preparedData)!==JSON.stringify(d)){requestId=crypto.randomUUID?.()||null;}preparedData=d;prepared=requestText(d,files);$('submit-online').hidden=!onlineConnected||!requestId;$('request-summary').textContent=prepared;const links=deliveryLinks(prepared);$('send-whatsapp').href=links.whatsapp;$('send-email').href=links.email;
 const ios=/iPhone|iPad|iPod/.test(navigator.userAgent);$('send-sms').href=ios?links.sms.replace('?body=','&body='):links.sms;
 let canShare=false;try{canShare=files.length>0&&!!navigator.canShare&&navigator.canShare({files});}catch{}
 $('share-files').hidden=!canShare;$('review-attachment-note').textContent=files.length?(canShare?`${files.length} file(s) are ready. “Share photos & request” lets you choose WhatsApp or another app and then Josh. Opening a message link alone will not attach them.`:`${files.length} file(s) are selected locally. This browser cannot share files directly. Open WhatsApp, text, or email, then attach those files in that app before sending.`):'No files selected. Your vehicle, work, location, and preferred date are included in the prepared message.';
 $('share-status').textContent='';form.hidden=true;review.hidden=false;review.focus({preventScroll:true});review.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
});
$('submit-online').addEventListener('click',async()=>{
 const button=$('submit-online');if(!onlineConnected||!preparedData||!requestId)return;
 if(files.reduce((sum,f)=>sum+f.size,0)>2500000){$('share-status').textContent='These files are too large for private online intake (2.5 MB total). Use the direct sharing options below instead; no files were uploaded.';return;}
 button.disabled=true;$('share-status').textContent='Sending the request to Josh’s private workspace…';
 try{
  const payloadFiles=await Promise.all(files.map(f=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Could not read selected file'));reader.onload=()=>resolve({name:f.name,type:f.type,base64:String(reader.result).split(',')[1]});reader.readAsDataURL(f);}))); 
  const r=await fetch('/api/booking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,details:preparedData,files:payloadFiles})});
  const result=await r.json();if(!r.ok||!result.ok)throw new Error(result.error||'The request could not be confirmed.');
  $('share-status').textContent='Your request was saved for Josh. Reference: '+result.id+'. This is not a confirmed appointment. '+(result.notificationSent?'Josh was notified by email.':'Please also contact Josh directly; the email notification could not be confirmed.');
  button.textContent='Request saved — awaiting Josh’s confirmation';
 }catch(err){$('share-status').textContent=String(err.message||'We could not confirm your submission. Please contact Josh directly.');button.disabled=false;}
});
$('edit-request').addEventListener('click',()=>{review.hidden=true;form.hidden=false;$('service').focus();});
$('copy-request').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(prepared);$('share-status').textContent='Request copied. Paste it into your conversation with Josh.';}catch{$('share-status').textContent='Automatic copying is unavailable. Select and copy the request text above.';}});
$('download-request').addEventListener('click',()=>{const u=URL.createObjectURL(new Blob([prepared],{type:'text/plain'}));const a=document.createElement('a');a.href=u;a.download='josh-mobile-service-request.txt';a.click();setTimeout(()=>URL.revokeObjectURL(u),5000);$('share-status').textContent='Request saved to your device. It has not been sent to Josh.';});
$('share-files').addEventListener('click',async()=>{try{if(!navigator.share||!navigator.canShare?.({files}))throw new Error('unsupported');await navigator.share({files,title:'Josh Mobile service request',text:prepared});$('share-status').textContent='Sharing completed in your chosen app. Please check that you sent the files to Josh; this website cannot verify delivery.';}catch(err){$('share-status').textContent=err.name==='AbortError'?'Sharing cancelled. Nothing was confirmed as sent.':'Sharing did not complete. Open WhatsApp, text, or email and attach the files there.';}});
window.addEventListener('pagehide',()=>objectUrls.forEach(u=>URL.revokeObjectURL(u)));
})();
