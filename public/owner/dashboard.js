import {contactKey,groupContacts,isUpcomingAppointment} from './crm-model.mjs';
'use strict';
const $=id=>document.getElementById(id),msg=(id,value)=>{if($(id))$(id).textContent=value;};
const api=async(action,method='GET',body)=>{const r=await fetch('/api/admin?action='+encodeURIComponent(action),{method,credentials:'same-origin',headers:method==='POST'?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'});const d=await r.json().catch(()=>({error:'Could not read the response.'}));if(!r.ok){if(r.status===401&&!['login','activate'].includes(action))showLogin();throw new Error(d.error||'Request failed.');}return d;};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const services={brakes:'Brake pads & rotors',suspension:'Suspension',ignition:'Spark plugs & ignition coils','engine-filter':'Engine air filter','cabin-filter':'Cabin air filter',inspection:'Vehicle inspection',other:'Not sure / something else'};
const date=s=>s?new Date(s).toLocaleString('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'})+' ET':'Not confirmed';
function easternInput(s){if(!s)return '';const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(s));const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;}
function easternISO(s){if(!s)return '';const candidates=[new Date(s+'-04:00'),new Date(s+'-05:00')].filter(x=>Number.isFinite(+x)&&easternInput(x.toISOString())===s);if(candidates.length!==1)throw new Error('That Eastern time is ambiguous or does not exist because of daylight saving. Choose another time.');return candidates[0].toISOString();}
let jobs=[],selected=null,filter='overview',section='overview',activation=null,markerRevision=0,seenRequested=new Set(),unreadNew=0,soundAllowed=false,ownerEmail='',ownerPushState=null,installPrompt=null;
const params=new URLSearchParams(location.hash.slice(1)),requestedReference=params.get('request')||'';if(params.has('activate')){activation={token:params.get('activate'),email:params.get('email')||''};history.replaceState(null,'',location.pathname);$('login-email').value=activation.email;$('login-email').readOnly=true;$('login-password').autocomplete='new-password';$('confirm-label').hidden=false;$('confirm-password').required=true;msg('login-title','Set up your account.');msg('login-submit','Create password & sign in');msg('login-subtitle','Choose a private password of at least 12 characters. Your activation link can be used once.');}
function showLogin(){activation=null;closeCrmNav();$('login-email').readOnly=false;$('confirm-label').hidden=true;$('confirm-password').required=false;$('login-password').autocomplete='current-password';msg('login-title','Welcome back.');msg('login-submit','Sign in');$('login-screen').hidden=false;$('dashboard-screen').hidden=true;$('signout').hidden=true;jobs=[];selected=null;$('jobs-list').replaceChildren();$('detail-media').replaceChildren();}
function showDashboard(email){ownerEmail=email;$('telegram-test').hidden=email!=='joshmobileinc@gmail.com';$('phone-alert-settings').hidden=email!=='joshmobileinc@gmail.com';activation=null;$('login-screen').hidden=true;$('dashboard-screen').hidden=false;$('signout').hidden=false;msg('admin-email',email);msg('today-date',new Date().toLocaleDateString('en-US',{timeZone:'America/New_York',weekday:'long',month:'long',day:'numeric'})+' · Eastern time');setSection(requestedReference?'leads':'overview');if(email==='joshmobileinc@gmail.com')refreshPushStatus();load();}
function dirty(){if(!selected||$('job-detail').hidden)return false;return [['job-status-input',selected.status],['job-confirmed-at',easternInput(selected.appointmentAt)],['job-duration',String(selected.durationMinutes||60)],['job-vin-input',selected.vin||''],['job-address-input',selected.address||''],['job-city-input',selected.city||''],['job-notes',selected.privateNotes||''],['job-parts',selected.partsTools||''],['communication-text','']].some(([id,value])=>String($(id)?.value||'')!==String(value));}
function live(text){msg('live-status',text);}
function chime(){if(!soundAllowed||!window.AudioContext)return;try{const context=new AudioContext(),oscillator=context.createOscillator(),gain=context.createGain();oscillator.frequency.value=880;gain.gain.setValueAtTime(.035,context.currentTime);oscillator.connect(gain).connect(context.destination);oscillator.start();oscillator.stop(context.currentTime+.08);}catch{}}
async function load({automatic=false}={}){try{const currentId=selected?.id,keepDirty=automatic&&dirty(),previousRequests=new Set(jobs.filter(j=>j.status==='requested').map(j=>j.id)),result=await api('jobs');jobs=result.jobs||[];markerRevision=Number(result.marker?.revision||markerRevision);const fresh=jobs.filter(j=>j.status==='requested'&&!previousRequests.has(j.id));if(automatic&&fresh.length){unreadNew+=fresh.length;chime();}seenRequested=new Set(jobs.filter(j=>j.status==='requested').map(j=>j.id));render();if(currentId&&!keepDirty){const next=jobs.find(j=>j.id===currentId);if(next)choose(next.id);}if(requestedReference&&!selected){const requested=jobs.find(j=>j.reference===requestedReference);if(requested)choose(requested.id);}live(`${unreadNew?`${unreadNew} new · `:''}Updated ${new Date().toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'})} ET${keepDirty?' · unsaved edits preserved':''}`);}catch(e){live(navigator.onLine?'Refresh unavailable.':'Offline — refresh paused.');msg('list-count',e.message);}}
const sectionConfig={
 overview:{title:'Overview',pane:'overview-view',filter:'overview'},
 leads:{title:'New Requests',pane:'records-view',filter:'requested',description:'Review new requests that are waiting for staff follow-up.'},
 appointments:{title:'Appointments',pane:'records-view',filter:'upcoming',description:'Confirmed appointments with a future date and time.'},
 customers:{title:'Customers',pane:'records-view',filter:'customers',description:'Contacts grouped for browsing; each JM request remains its own record.'},
 jobs:{title:'Jobs',pane:'records-view',filter:'all',description:'All current, completed and cancelled job records.'},
 messages:{title:'Messages & Follow-ups',pane:'records-view',filter:'messages',description:'Manual contact history and follow-up notes. No messages send automatically.'},
 availability:{title:'Availability',pane:'availability-view',filter:'availability'},
 settings:{title:'Settings',pane:'settings-view',filter:'settings'}
};
function closeCrmNav(){if(!$('crm-sidebar'))return;$('crm-sidebar').classList.remove('open');$('crm-scrim').hidden=true;$('crm-menu-toggle').setAttribute('aria-expanded','false');}
function setSection(next){
 const config=sectionConfig[next];if(!config)return false;
 if(dirty()){msg('save-message','Save the current dossier edits before changing sections.');return false;}
 section=next;filter=config.filter;
 for(const pane of document.querySelectorAll('.module-pane'))pane.hidden=pane.id!==config.pane;
 msg('page-title',config.title);
 if(config.pane==='records-view'){
  msg('module-title',config.title);msg('module-description',config.description||'');
  const headings={overview:['Needs attention','New requests and confirmed appointments coming up.'],requested:['New requests','Review requests that are waiting for staff follow-up.'],upcoming:['Upcoming appointments','Confirmed appointments with a future date and time.'],customers:['Customer directory','Contacts are grouped for browsing; each request stays a separate record.'],all:['All jobs','Every request and job record, including completed and cancelled work.'],messages:['Messages & follow-ups','Manual conversation history and reminders. No messages send automatically.']};
  const details=headings[filter]||headings.requested;msg('job-list-heading',details[0]);msg('job-list-subtitle',details[1]);
 }
 selected=null;$('job-detail').hidden=true;$('empty-detail').hidden=false;$('back-to-list').hidden=true;$('workspace-grid').classList.remove('has-selection');
 document.querySelectorAll('#crm-nav [data-section]').forEach(button=>{const active=button.dataset.section===next;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
 closeCrmNav();if(next==='availability')loadAvailability();if(next==='settings'&&ownerEmail==='joshmobileinc@gmail.com')refreshPushStatus();render();return true;
}
function jobSearchText(j){return [j.reference,j.name,j.phone,j.normalizedPhone,j.email,j.vin,j.make,j.model,j.service,j.city,j.address].join(' ').toLowerCase();}
function renderJobButton(j){
 const newest=(j.timeline||[]).filter(item=>item.kind!=='created').at(-1);
 const message=filter==='messages'&&newest?'<small>'+esc(newest.kind)+' · '+esc(newest.text)+'</small>':'';
 const when=j.appointmentAt?date(j.appointmentAt):'Preferred: '+(j.date||'Not set')+' · '+(j.time||'Flexible');
 return '<button type="button" class="job-item '+(selected?.id===j.id?'selected':'')+'" data-id="'+esc(j.id)+'"><span class="status '+esc(j.status)+'">'+esc(j.status==='requested'?'New request':j.status)+'</span><strong>'+esc(j.name)+'</strong><span>'+esc([j.year,j.make,j.model].filter(Boolean).join(' '))+'</span><span>'+esc(services[j.service]||j.service)+'</span><small>'+esc(j.reference||j.id)+'</small><small>'+esc(when)+'</small><small>'+esc(j.city||'')+'</small>'+message+'</button>';
}
function renderCustomerButton(group){
 const j=group.records[0],vehicle=[j.year,j.make,j.model].filter(Boolean).join(' ');
 return '<button type="button" class="job-item customer-item '+(selected?.id===j.id?'selected':'')+'" data-id="'+esc(j.id)+'"><span class="status">'+group.records.length+' request'+(group.records.length===1?'':'s')+'</span><strong>'+esc(j.name)+'</strong><span>'+esc(j.phone||j.email||'Contact not available')+'</span><span>'+esc(vehicle||'Vehicle details pending')+'</span><small>Latest: '+esc(j.reference||j.id)+' · '+esc(services[j.service]||j.service)+'</small><small>'+esc(j.city||'')+'</small></button>';
}
function render(){
 const q=$('search-jobs').value.trim().toLowerCase(),contacts=groupContacts(jobs),upcoming=jobs.filter(j=>isUpcomingAppointment(j)),requested=jobs.filter(j=>j.status==='requested');
 msg('count-new',requested.length);msg('count-upcoming',upcoming.length);msg('count-customers',contacts.length);msg('count-done',jobs.filter(j=>j.status==='completed').length);
 msg('nav-count-leads',requested.length);msg('nav-count-appointments',upcoming.length);
 let html='',count=0;
 if(filter==='customers'){
  const items=contacts.filter(group=>group.records.some(job=>jobSearchText(job).includes(q)));
  count=items.length;html=items.map(renderCustomerButton).join('');
 }else{
  let items=jobs.filter(j=>{
   const inSection=filter==='all'||filter==='requested'&&j.status==='requested'||filter==='upcoming'&&isUpcomingAppointment(j)||filter==='messages'&&(j.timeline||[]).some(item=>item.kind!=='created')||filter==='overview'&&(j.status==='requested'||isUpcomingAppointment(j));
   return inSection&&jobSearchText(j).includes(q);
  });
  items.sort((a,b)=>filter==='upcoming'?Date.parse(a.appointmentAt)-Date.parse(b.appointmentAt):(b.createdAt||'').localeCompare(a.createdAt||''));
  count=items.length;html=items.map(renderJobButton).join('');
 }
 msg('list-count',count+' '+(count===1?'record':'records'));
 $('jobs-list').innerHTML=html||'<div class="empty-detail"><h3>No records here yet.</h3><p>New website requests will appear here. Use Add customer / job for customers who contacted you by phone.</p></div>';
 $('jobs-list').querySelectorAll('[data-id]').forEach(button=>button.onclick=()=>{unreadNew=0;choose(button.dataset.id);});
}
function choose(id){
 selected=jobs.find(j=>j.id===id);if(!selected)return;const j=selected;
 $('empty-detail').hidden=true;$('job-detail').hidden=false;
 const mobile=matchMedia('(max-width: 900px)').matches;$('workspace-grid').classList.toggle('has-selection',mobile);$('back-to-list').hidden=!mobile;
 msg('job-title',j.name);msg('job-reference','Reference: '+(j.reference||j.id));msg('job-summary',services[j.service]||j.service);
 msg('job-status',j.status==='requested'?'New request':j.status);$('job-status').className='status '+j.status;
 const details={'detail-name':j.name,'detail-phone':j.phone,'detail-email':j.email||'Not provided','detail-address':[j.address,j.city].filter(Boolean).join(', ')||'Location not provided','detail-car':[j.year,j.make,j.model].filter(Boolean).join(' ')||'Vehicle details pending','detail-vin':j.vin||'Needed before confirmation','detail-description':j.description||'No work description provided.','detail-preferred':'Requested: '+(j.date||'Flexible')+' · '+(j.time||'Flexible')+' · '+(j.locationType||'Mobile service')};
 for(const [key,value]of Object.entries(details))msg(key,value);
 $('job-status-input').value=j.status;$('job-confirmed-at').value=easternInput(j.appointmentAt);$('job-duration').value=j.durationMinutes||60;$('job-vin-input').value=j.vin||'';$('job-address-input').value=j.address||'';$('job-city-input').value=j.city||'';$('job-notes').value=j.privateNotes||'';$('job-parts').value=j.partsTools||'';
 const phone=(j.normalizedPhone||j.phone).replace(/[^+\d]/g,''),digits=phone.replace(/\D/g,''),reference=j.reference||j.id,followup='Hi '+j.name+', following up on your Josh Mobile request '+reference+'.';
 $('call-customer').href='tel:'+phone;$('text-customer').href='sms:'+phone+'?body='+encodeURIComponent(followup);$('whatsapp-customer').href='https://wa.me/'+digits+'?text='+encodeURIComponent(followup);
 $('map-customer').href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([j.address,j.city].filter(Boolean).join(', '));
 $('calendar-job').hidden=j.status!=='confirmed'||!j.appointmentAt;$('calendar-job').href='/api/admin?action=calendar&id='+encodeURIComponent(j.id);
 const history=jobs.filter(item=>item.id!==j.id&&contactKey(item)===contactKey(j)).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
 $('customer-history-list').innerHTML=history.length?history.map(item=>'<button type="button" class="history-record" data-history-id="'+esc(item.id)+'"><span class="status '+esc(item.status)+'">'+esc(item.status==='requested'?'New request':item.status)+'</span><strong>'+esc(item.reference||item.id)+'</strong><small>'+esc(services[item.service]||item.service)+' · '+esc(item.appointmentAt?date(item.appointmentAt):'Requested '+(item.date||'flexible'))+'</small></button>').join(''):'<p class="subtle">No other requests are linked to this contact.</p>';
 $('customer-history-list').querySelectorAll('[data-history-id]').forEach(button=>button.onclick=()=>choose(button.dataset.historyId));
 $('detail-media').innerHTML=(j.media||[]).map(m=>{const url='/api/admin?action=file&id='+encodeURIComponent(j.id)+'&index='+m.index;return m.type.startsWith('image/')?'<a href="'+url+'" target="_blank" rel="noopener"><img src="'+url+'" alt="Customer vehicle attachment '+(m.index+1)+'" loading="lazy"></a>':'<video controls preload="none" aria-label="Customer vehicle video '+(m.index+1)+'"><source src="'+url+'" type="'+esc(m.type)+'">Video playback is not supported in this browser.</video>';}).join('')||'<p class="subtle">No uploaded attachments.</p>';
 const attachment=j.attachmentStatus||{expected:(j.attachments||[]).length,received:(j.media||[]).length,failed:[]};
 msg('detail-media-status',attachment.expected?attachment.received+' of '+attachment.expected+' attachment'+(attachment.expected===1?'':'s')+' received'+(attachment.failed?.length?'; '+attachment.failed.length+' need attention':'')+'.':'No photos selected.');
 const alert=j.notification?.state||'not_configured',alertText=alert==='accepted'?'Owner email alert was accepted by the provider; inbox delivery is not verified.':alert==='not_configured'?'Automatic owner email alerts are NOT ACTIVE — owner setup is required.':alert==='manual'?'Phone-only request; no automatic owner alert was attempted.':alert==='uncertain'?'Owner alert outcome is uncertain. Review the owner inbox before any manual follow-up to avoid duplicates.':'Owner alert status: '+alert+'.';
 msg('detail-alert-status',alertText);refreshPushRequestStatus(j.id);msg('detail-telegram-status','Telegram alert: '+(j.telegram?.state||'not available')+(j.telegram?.attempts?' · '+j.telegram.attempts+' attempt(s)':'')+'.');
 $('retry-alert').hidden=alert!=='failed';$('timeline').innerHTML=[...(j.timeline||[])].reverse().map(t=>'<article class="timeline-entry"><small>'+esc(date(t.at))+' · '+esc(t.kind)+' · '+esc(t.by)+'</small><p>'+esc(t.text)+'</p></article>').join('');
 msg('save-message','');msg('communication-message','');render();
}
function returnToList(){if(dirty()){msg('save-message','Save the current dossier edits before returning to the list.');return;}selected=null;$('workspace-grid').classList.remove('has-selection');$('back-to-list').hidden=true;$('job-detail').hidden=true;$('empty-detail').hidden=false;render();}

$('login-form').onsubmit=async e=>{e.preventDefault();const button=$('login-submit');button.disabled=true;msg('login-message','Signing in…');try{if(activation&&$('login-password').value!==$('confirm-password').value)throw new Error('Passwords do not match.');const r=await api(activation?'activate':'login','POST',{email:$('login-email').value,password:$('login-password').value,...(activation?{token:activation.token}:{})});$('login-password').value='';$('confirm-password').value='';msg('login-message','');showDashboard(r.email);}catch(err){msg('login-message',err.message);}finally{button.disabled=false;}};
$('signout').onclick=async()=>{try{await api('logout','POST',{});location.reload();}catch(e){msg('list-count',e.message);}};
$('refresh-jobs').onclick=()=>load();$('search-jobs').oninput=render;
$('crm-nav').querySelectorAll('[data-section]').forEach(button=>button.onclick=()=>setSection(button.dataset.section));
document.querySelectorAll('[data-go-section]').forEach(button=>button.onclick=()=>setSection(button.dataset.goSection));
$('crm-menu-toggle').onclick=()=>{const open=!$('crm-sidebar').classList.contains('open');$('crm-sidebar').classList.toggle('open',open);$('crm-scrim').hidden=!open;$('crm-menu-toggle').setAttribute('aria-expanded',String(open));};
$('crm-scrim').onclick=closeCrmNav;$('back-to-list').onclick=returnToList;
window.addEventListener('resize',()=>{const mobile=matchMedia('(max-width: 900px)').matches;if(selected){$('workspace-grid').classList.toggle('has-selection',mobile);$('back-to-list').hidden=!mobile;}});

async function refreshPushRequestStatus(id){if(ownerEmail!=='joshmobileinc@gmail.com')return;try{const response=await fetch('/api/admin?action=push-request-status&id='+encodeURIComponent(id),{credentials:'same-origin',cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed.');const state=data.push;const detail=ownerPushState?.enabled?state.state:'not_active';const words={not_active:'Phone alert NOT ACTIVE until Josh completes VAPID setup and opts in.',no_subscriptions:'No opted-in phone is registered.',not_found:'Request not found.',not_attempted:'Phone alert has not been attempted for this request.',sending:'Phone alert is being sent.',accepted:'Push provider accepted this alert; phone receipt is not confirmed.',failed:'Phone alert failed for at least one device.'};msg('detail-push-status',words[detail]||'Phone alert status: '+detail+'.');$('retry-phone-alert').hidden=detail!=='failed';$('retry-phone-alert').dataset.id=id;}catch(error){msg('detail-push-status','Phone alert status unavailable.');$('retry-phone-alert').hidden=true;}}
$('retry-phone-alert').onclick=async()=>{const button=$('retry-phone-alert');button.disabled=true;try{const result=await api('push-retry','POST',{id:button.dataset.id});msg('detail-push-status',`Phone push retry: ${result.result.accepted} accepted by provider. Phone receipt is not confirmed.`);await refreshPushRequestStatus(button.dataset.id);}catch(error){msg('detail-push-status',error.message);}finally{button.disabled=false;}};
$('retry-alert').onclick=async()=>{if(!selected)return;$('retry-alert').disabled=true;try{const result=await api('retry-notification','POST',{id:selected.id});msg('detail-alert-status',result.notification?.attempted?'Owner alert retry submitted; provider acceptance is not inbox delivery.':'Owner alert retry is waiting for its retry window.');await load();}catch(error){msg('detail-alert-status',error.message);}finally{$('retry-alert').disabled=false;}};
$('job-form').onsubmit=async e=>{e.preventDefault();if(!selected)return;$('save-job').disabled=true;try{const r=await api('update','POST',{id:selected.id,version:selected.version,status:$('job-status-input').value,appointmentAt:easternISO($('job-confirmed-at').value),durationMinutes:Number($('job-duration').value),vin:$('job-vin-input').value,address:$('job-address-input').value,city:$('job-city-input').value,privateNotes:$('job-notes').value,partsTools:$('job-parts').value});jobs=jobs.map(j=>j.id===r.job.id?r.job:j);choose(r.job.id);msg('save-message','Saved. Text the customer to confirm any appointment changes.');}catch(err){msg('save-message',err.message);}finally{$('save-job').disabled=false;}};
$('communication-form').onsubmit=async e=>{e.preventDefault();if(!selected)return;try{const r=await api('message','POST',{id:selected.id,version:selected.version,channel:$('communication-type').value,text:$('communication-text').value});jobs=jobs.map(j=>j.id===r.job.id?r.job:j);choose(r.job.id);$('communication-text').value='';msg('communication-message','Conversation note saved.');}catch(err){msg('communication-message',err.message);}};
$('new-job-btn').onclick=()=>{if(dirty()){msg('save-message','Save the current dossier edits before adding another job.');return;}$('add-dialog').showModal();};
$('close-dialog').onclick=()=>$('add-dialog').close();
$('add-job-form').onsubmit=async e=>{e.preventDefault();try{const r=await api('create','POST',Object.fromEntries(new FormData(e.target)));e.target.reset();$('add-dialog').close();setSection('jobs');await load();choose(r.id);}catch(err){msg('add-message',err.message);}};
$('change-password-form').onsubmit=async e=>{e.preventDefault();try{await api('change-password','POST',{oldPassword:$('old-password').value,newPassword:$('new-password').value});e.target.reset();showLogin();msg('login-message','Password changed. Please sign in again.');}catch(err){msg('password-message',err.message);}};
$('telegram-test').onclick=async()=>{const button=$('telegram-test');button.disabled=true;try{const result=await api('telegram-test','POST',{});msg('telegram-test-status','Telegram test: '+result.telegram.state+'.');}catch(e){msg('telegram-test-status',e.message);}finally{button.disabled=false;}};
function pushKeyBytes(value){const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
function installedOwnerApp(){return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;}
async function refreshPushStatus(){
 if(ownerEmail!=='joshmobileinc@gmail.com')return;
 try{
  ownerPushState=(await api('push-status')).push;
  const p=ownerPushState;
  try{const registration=await navigator.serviceWorker?.ready;p.deviceSubscribed=Boolean(await registration?.pushManager.getSubscription());}catch{p.deviceSubscribed=false;}
  if(!p.enabled)msg('push-alert-status','Phone alerts are NOT ACTIVE. Josh must configure the private VAPID keys in Vercel before device opt-in is available.');
  else if(!p.subscriptions)msg('push-alert-status','Phone alerts are OFF. This owner account is ready; tap Enable on a device to opt in.');
  else msg('push-alert-status',`Phone alerts are enabled for ${p.subscriptions} opted-in device${p.subscriptions===1?'':'s'}.`);
  $('enable-phone-alerts').disabled=!p.enabled||!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window);
  $('enable-phone-alerts').hidden=!p.enabled||p.deviceSubscribed;
  $('send-push-test').hidden=!p.enabled||!p.subscriptions;
  $('disable-phone-alerts').hidden=!p.enabled||!p.deviceSubscribed;
  if(p.lastAttemptAt){const result=p.lastState==='accepted'?'provider accepted the last push (phone receipt not verified)':p.lastState==='failed'?'last push attempt failed':p.lastState==='subscribed'?'device subscription saved':p.lastState;msg('push-alert-history',`Last activity: ${result} · ${date(p.lastAttemptAt)}${p.lastError?' · '+p.lastError:''}`);}else msg('push-alert-history',p.enabled?'No notification has been sent from this workspace.':'No device is subscribed.');
 }catch(error){msg('push-alert-status','Could not read private phone-alert status. Sign in again or refresh.');msg('push-alert-history',error.message);}
}
$('enable-phone-alerts').onclick=async()=>{
 const button=$('enable-phone-alerts');button.disabled=true;msg('push-alert-message','');
 try{
  if(!ownerPushState?.enabled)throw new Error('Phone alerts are not configured. Josh must finish the private Vercel VAPID setup first.');
  const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent);if(ios&&!installedOwnerApp())throw new Error('On iPhone/iPad, use Share → Add to Home Screen and open the installed app before enabling alerts.');
  if(!('Notification'in window)||!('PushManager'in window)||!('serviceWorker'in navigator))throw new Error('This browser does not support web push notifications.');
  const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Notification permission was not granted. You can enable it in this browser’s settings.');
  const registration=await navigator.serviceWorker.ready;
  const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:pushKeyBytes(ownerPushState.publicKey)});
  await api('push-subscribe','POST',{subscription:subscription.toJSON()});
  msg('push-alert-message','This device is opted in. Tap Send test notification and confirm it reaches your phone.');await refreshPushStatus();
 }catch(error){msg('push-alert-message',error.message);}finally{button.disabled=false;}
};
$('send-push-test').onclick=async()=>{
 const button=$('send-push-test');button.disabled=true;msg('push-alert-message','Sending test notification…');
 try{const result=await api('push-test','POST',{});msg('push-alert-message',`Push provider accepted ${result.result.accepted} test notification${result.result.accepted===1?'':'s'}. Confirm the alert on your phone; provider acceptance is not a phone receipt.`);await refreshPushStatus();}
 catch(error){msg('push-alert-message',error.message);}finally{button.disabled=false;}
};
$('disable-phone-alerts').onclick=async()=>{
 const button=$('disable-phone-alerts');button.disabled=true;
 try{const registration=await navigator.serviceWorker.getRegistration('/owner/'),subscription=await registration?.pushManager.getSubscription();if(subscription){await api('push-unsubscribe','POST',{subscription:subscription.toJSON()});await subscription.unsubscribe();}msg('push-alert-message','Phone alerts are off for this device.');await refreshPushStatus();}
 catch(error){msg('push-alert-message',error.message);}finally{button.disabled=false;}
};
$('install-owner-app').onclick=async()=>{
 if(!installPrompt){msg('push-alert-message','Use your browser’s Install app option. On iPhone/iPad, choose Share → Add to Home Screen.');return;}
 installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('install-owner-app').hidden=true;
};
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('install-owner-app').hidden=false;});
window.addEventListener('appinstalled',()=>{$('install-owner-app').hidden=true;msg('push-alert-message','Josh Mobile Owner app installed. Sign in and enable alerts when ready.');});
if('serviceWorker'in navigator)navigator.serviceWorker.register('/owner/service-worker.js',{scope:'/owner'}).catch(()=>{});
if(!activation)api('session').then(r=>{ $('telegram-test').hidden=r.email!=='joshmobileinc@gmail.com';showDashboard(r.email);}).catch(()=>{});

const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
async function loadAvailability(){
 try{
  const config=(await api('availability')).availability;
  const host=$('availability-days');host.replaceChildren();
  DAYS.forEach((name,i)=>{
   const row=document.createElement('div');row.className='availability-day';
   const current=config.days[i]||[];
   const toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=current.length===2;
   const label=document.createElement('label');label.append(toggle,document.createTextNode(' '+name));
   const from=document.createElement('input');from.type='time';from.value=current[0]||'';from.setAttribute('aria-label',name+' from');
   const to=document.createElement('input');to.type='time';to.value=current[1]||'';to.setAttribute('aria-label',name+' to');
   row.append(label,from,to);host.append(row);
  });
  $('availability-enabled').checked=config.enabled;
  $('availability-blocked').value=config.blocked.join('\n');
  msg('availability-message','');
 }catch(err){msg('availability-message',err.message);}
}
$('availability-form').onsubmit=async event=>{
 event.preventDefault();
 const days=[...$('availability-days').children].map(row=>{
  const items=row.querySelectorAll('input');return items[0].checked?[items[1].value,items[2].value]:[];
 });
 const blocked=$('availability-blocked').value.split(/[\n,]+/).map(v=>v.trim()).filter(Boolean);
 const button=event.submitter;if(button)button.disabled=true;
 try{const result=await api('availability','POST',{enabled:$('availability-enabled').checked,days,blocked,slotMinutes:60});msg('availability-message',result.conflicts?.length?`Working hours saved. ${result.conflicts.length} existing confirmed appointment${result.conflicts.length===1?'':'s'} fall outside the new hours; they were preserved and need review.`:'Working hours saved. Customer time slots now reflect your schedule.');}
 catch(err){msg('availability-message',err.message);}
 finally{if(button)button.disabled=false;}
};
const enableSound=()=>{soundAllowed=true;document.removeEventListener('pointerdown',enableSound);document.removeEventListener('keydown',enableSound);};document.addEventListener('pointerdown',enableSound,{once:true});document.addEventListener('keydown',enableSound,{once:true});
async function checkChanges(){if(document.hidden||!navigator.onLine||$('dashboard-screen').hidden)return;try{const next=(await api('changes')).marker;if(Number(next?.revision||0)!==markerRevision)await load({automatic:true});else live(`${unreadNew?`${unreadNew} new · `:''}Up to date · checked ${new Date().toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'})} ET`);}catch{live('Refresh paused — retrying when connected.');}}
setInterval(checkChanges,75_000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkChanges();});window.addEventListener('online',checkChanges);window.addEventListener('offline',()=>live('Offline — refresh paused.'));
