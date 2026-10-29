(async function(){
'use strict';
const {easternToday,validateRequest,fileError,receiptMessage,deliveryLinks}=await import('/request.mjs');
const $=id=>document.getElementById(id);
const menu=$('menu-toggle'),mobile=$('mobile-menu');
menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close menu':'Open menu');mobile.hidden=!open;});
mobile.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{mobile.hidden=true;menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open menu');}));
const form=$('booking-form'),review=$('request-review');
const continuityKey='jm-intake-continuity-v1';
let files=[],objectUrls=[],preparedData=null,requestId='',continuationProof='',onlineConnected=null,fileSignature='',savedRequest=null,received=new Set();
const track=(event,detail={})=>{const payload={event,...detail};document.dispatchEvent(new CustomEvent('joshmobile:event',{detail:payload}));if(Array.isArray(window.dataLayer))window.dataLayer.push(payload);};
const random=()=>crypto.getRandomValues(new Uint8Array(32)).reduce((s,b)=>s+String.fromCharCode(b),'');
const makeProof=()=>btoa(random()).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const getContinuity=()=>{try{return JSON.parse(sessionStorage.getItem(continuityKey)||'null');}catch{return null;}};
const saveContinuity=reference=>{try{sessionStorage.setItem(continuityKey,JSON.stringify({requestId,continuationProof,reference}));}catch{}};
const previous=getContinuity();if(previous?.requestId&&previous?.continuationProof){requestId=previous.requestId;continuationProof=previous.continuationProof;$('resume-note').hidden=false;}
fetch('/api/workspace',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(c=>{onlineConnected=c?.connected===true;}).catch(()=>{});
$('preferred-date').min=easternToday();form.elements.year.max=Number(easternToday().slice(0,4))+2;
const timeSelect=$('preferred-time'),availabilityNote=$('availability-note');
let slots=null,availabilitySequence=0;
async function loadSlots(){
 const date=$('preferred-date').value,seq=++availabilitySequence;
 const previous=timeSelect.value;slots=null;timeSelect.disabled=true;
 timeSelect.replaceChildren(new Option('Checking availability…',''));
 if(!date){timeSelect.disabled=false;timeSelect.replaceChildren(new Option('Choose a date first',''));availabilityNote.textContent='Choose a preferred date.';return;}
 try{
 const response=await fetch('/api/availability?date='+encodeURIComponent(date),{cache:'no-store'});
 if(!response.ok)throw Error('Could not load hours');
 const result=await response.json();if(seq!==availabilitySequence)return;
 if(result.enabled){slots=result.slots;timeSelect.replaceChildren(new Option(slots.length?'Choose available time':'No openings on this date',''),...slots.map(v=>new Option(new Date('2000-01-01T'+v+':00').toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}),v)));availabilityNote.textContent=slots.length?'Eastern Time. Josh confirms each request after reviewing the job.':'No appointments available this date. Choose another date.';}
 else {timeSelect.replaceChildren(new Option('Choose a preferred window',''),...['Morning','Afternoon','Flexible'].map(v=>new Option(v,v)));availabilityNote.textContent='Preferred windows only; Josh confirms the appointment.';}
 if([...timeSelect.options].some(o=>o.value===previous))timeSelect.value=previous;
 timeSelect.disabled=false;
 }catch{if(seq!==availabilitySequence)return;timeSelect.replaceChildren(new Option('Hours unavailable — try again later',''));availabilityNote.textContent='Could not load available times. Please choose another date or try again later.';}
}
$('preferred-date').addEventListener('change',loadSlots);
document.querySelectorAll('[data-service]').forEach(link=>link.addEventListener('click',()=>{form.hidden=false;review.hidden=true;$('service').value=link.dataset.service;}));
const showError=(id,msg)=>{const el=$(id);el.textContent=msg;el.hidden=!msg;};
function renderFiles(){objectUrls.forEach(u=>URL.revokeObjectURL(u));objectUrls=[];$('file-previews').replaceChildren();files.forEach((file,i)=>{const card=document.createElement('div');card.className='file-preview';const remove=document.createElement('button');remove.type='button';remove.className='remove-file';remove.textContent='×';remove.setAttribute('aria-label','Remove '+file.name);remove.addEventListener('click',()=>{files.splice(i,1);renderFiles();showError('media-error','');});if(/^image\/(jpeg|png|webp)$/.test(file.type)){const img=document.createElement('img'),url=URL.createObjectURL(file);objectUrls.push(url);img.src=url;img.alt='Selected photo: '+file.name;card.append(img);}else{const badge=document.createElement('span');badge.className='file-type';badge.textContent=file.type.startsWith('video/')?'▷ VIDEO':'PHOTO';card.append(badge);}const caption=document.createElement('p');caption.textContent=file.name+' · '+(file.size/1024/1024).toFixed(1)+' MB';card.append(remove,caption);$('file-previews').append(card);});$('media-hint').textContent=files.length?`${files.length} file(s) selected on your device. Nothing has been uploaded yet.`:'Your files stay on your device until you submit your saved service request. No background uploads.';}
for(const id of ['media-picker','photo-capture','video-capture'])$(id).addEventListener('change',e=>{const additions=Array.from(e.target.files||[]),err=fileError(files,additions);if(err)showError('media-error',err);else{files.push(...additions);renderFiles();showError('media-error','');}e.target.value='';});
const receipt=()=>savedRequest?receiptMessage(savedRequest.reference):'';
function showReceipt(){
 if(!savedRequest)return;
 const links=deliveryLinks(savedRequest.reference),ios=/iPhone|iPad|iPod/.test(navigator.userAgent);
 $('review-title').textContent='Request received — reference '+savedRequest.reference;
 $('receipt-message').textContent='Josh will review and contact you by '+({text:'text',phone:'phone',email:'email',whatsapp:'WhatsApp'}[preparedData?.preferredContact]||'your preferred contact method')+'.';
 $('text-reference').href=(ios?'sms:&body=':'sms:?body=')+encodeURIComponent('Josh Mobile request '+savedRequest.reference);
 $('request-reference').textContent=savedRequest.reference;
 $('request-summary').textContent=receipt();
 $('send-sms').href=ios?links.smsIOS:links.smsAndroid;$('send-whatsapp').href=links.whatsapp;
 const expected=savedRequest.attachmentStatus?.expected??files.length,done=received.size,failed=savedRequest.attachmentStatus?.failed?.length||0;
 $('review-attachment-note').textContent=expected===0?'No photos selected.':failed?`${done} of ${expected} attachments received. ${failed} need${failed===1?'s':''} another attempt.`:`${done} of ${expected} attachments received.`;
 $('retry-uploads').hidden=done>=expected;
 $('edit-request').hidden=true;
 form.hidden=true;review.hidden=false;review.focus({preventScroll:true});review.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}
async function saveRequest({renew=false}={}){
 if(onlineConnected===false)throw new Error('Online service requests are temporarily unavailable. Please try again later.');
 if(!requestId)requestId=crypto.randomUUID?.()||'';if(!requestId)throw new Error('Your browser could not create a secure request key. Please update your browser and try again.');
 if(!continuationProof)continuationProof=makeProof();
 $('submit-request').disabled=true;$('share-status').textContent=renew?'Refreshing secure upload access…':'Saving your service request…';
 try{
  const response=await fetch('/api/booking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,continuationProof,website:preparedData.website||'',details:preparedData,attachments:files.map(f=>({name:f.name,type:f.type,size:f.size}))}),cache:'no-store'});
  const result=await response.json().catch(()=>({}));if(!response.ok||!result.ok)throw new Error(result.error||'Unable to save your request.');
  savedRequest=result;received=new Set(result.receivedIndices||[]);saveContinuity(result.reference);showReceipt();
  if(!result.duplicate)track('request_saved',{reference:result.reference});track('message_prepared',{reference:result.reference});
  if(files.length&&received.size<files.length)await uploadSelected();
 }finally{$('submit-request').disabled=false;}
}
async function uploadSelected(){
 if(!savedRequest)return;
 if(!files.length){$('retry-uploads').hidden=true;return;}
 const pending=files.map((file,index)=>({file,index})).filter(item=>!received.has(item.index));
 if(!pending.length){showReceipt();return;}
 if(!savedRequest.uploadToken){await saveRequest({renew:true});return;}
 $('retry-uploads').disabled=true;$('share-status').textContent=`Request saved. Uploading ${pending.length} attachment${pending.length===1?'':'s'}…`;
 try{
  const {sendAttachments}=await import('/upload.js');
  const outcome=await sendAttachments(savedRequest.id,savedRequest.uploadToken,pending,progress=>{$('share-status').textContent=progress.phase==='failed'?`Request saved. ${progress.name} did not upload: ${progress.reason}`:`Request saved. ${progress.phase==='verifying'?'Verifying':'Uploading'} attachment ${progress.index+1} of ${files.length}${progress.percentage?` (${progress.percentage}%)`:''}…`;});
  outcome.received.forEach(index=>received.add(index));
  savedRequest.attachmentStatus={expected:files.length,received:received.size,failed:outcome.failed};
  $('share-status').textContent=outcome.failed.length?`Request saved. ${received.size} of ${files.length} attachments received; retry the remaining file${outcome.failed.length===1?'':'s'} when ready.`:`Request saved. All ${files.length} attachment${files.length===1?'':'s'} received.`;
 }catch(error){$('share-status').textContent='Your request is saved, but attachments need another attempt. '+String(error.message||'');}
 finally{$('retry-uploads').disabled=false;showReceipt();}
}
form.addEventListener('submit',async event=>{event.preventDefault();const details=Object.fromEntries(new FormData(form));details.consent=!!details.consent;details.vin=String(details.vin||'').toUpperCase().replace(/\s/g,'');const error=validateRequest(details)||(Array.isArray(slots)&&!slots.includes(details.time)?'Please choose an available time.':'');showError('form-error',error);if(error)return;const nextFiles=JSON.stringify(files.map(file=>[file.name,file.type,file.size,file.lastModified]));if(preparedData&&(JSON.stringify(preparedData)!==JSON.stringify(details)||fileSignature!==nextFiles)){requestId='';continuationProof='';savedRequest=null;received.clear();try{sessionStorage.removeItem(continuityKey);}catch{}}preparedData=details;fileSignature=nextFiles;try{await saveRequest();}catch(err){showError('form-error',String(err.message||'Please retry your request.'));}});
$('retry-uploads').addEventListener('click',async()=>{if(!savedRequest)return;if(!files.length){$('share-status').textContent='Your request is already saved. After a reload, choose the original files again to retry incomplete attachments.';return;}try{await saveRequest({renew:true});}catch(error){$('share-status').textContent='Your request is saved. '+String(error.message||'Unable to renew uploads.');}});
$('edit-request').addEventListener('click',()=>{if(savedRequest)return;review.hidden=true;form.hidden=false;$('service').focus();});
$('copy-reference').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(savedRequest.reference);$('share-status').textContent='Reference copied.';}catch{$('share-status').textContent='Select the reference above to copy it.';}});
$('copy-message').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(receipt());$('share-status').textContent='Message copied. Your request is already saved.';track('message_copied',{reference:savedRequest?.reference||''});}catch{$('share-status').textContent='Automatic copying is unavailable. Select and copy the message above.';}});
$('copy-phone').addEventListener('click',async()=>{try{await navigator.clipboard.writeText('(646) 796-7322');$('share-status').textContent='Phone number copied. Your request is already saved.';}catch{$('share-status').textContent='Copy (646) 796-7322 into your messaging app. Your request is already saved.';}});
$('send-sms').addEventListener('click',()=>track('sms_link_opened',{reference:savedRequest?.reference||''}));
$('send-whatsapp').addEventListener('click',()=>track('whatsapp_link_opened',{reference:savedRequest?.reference||''}));
$('done-request').addEventListener('click',()=>{$('share-status').textContent='Done. Your request is already saved. Josh will contact you after review.';});
window.addEventListener('pagehide',()=>objectUrls.forEach(u=>URL.revokeObjectURL(u)));
})();
