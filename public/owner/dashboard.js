import {contactKey,groupContacts,isUpcomingAppointment} from './crm-model.mjs';
import {isOwnerEmail,trashUiVisibility} from './owner-access.mjs';
'use strict';
const $=id=>document.getElementById(id),msg=(id,value)=>{if($(id))$(id).textContent=value;};
const api=async(action,method='GET',body)=>{const r=await fetch('/api/admin?action='+encodeURIComponent(action),{method,credentials:'same-origin',headers:method==='POST'?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'});const d=await r.json().catch(()=>({error:'Could not read the response.'}));if(!r.ok){if(r.status===401&&!['login','activate'].includes(action))showLogin();throw new Error(d.error||'Request failed.');}return d;};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const services={brakes:'Brake pads & rotors',suspension:'Suspension',ignition:'Spark plugs & ignition coils','engine-filter':'Engine air filter','cabin-filter':'Cabin air filter',inspection:'Vehicle inspection',other:'Not sure / something else'};
const date=s=>s?new Date(s).toLocaleString('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'})+' ET':'Not confirmed';
function easternInput(s){if(!s)return '';const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(s));const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;}
function easternISO(s){if(!s)return '';const candidates=[new Date(s+'-04:00'),new Date(s+'-05:00')].filter(x=>Number.isFinite(+x)&&easternInput(x.toISOString())===s);if(candidates.length!==1)throw new Error('That Eastern time is ambiguous or does not exist because of daylight saving. Choose another time.');return candidates[0].toISOString();}
let jobs=[],customers=[],vehicles=[],partsRequests=[],serviceCatalog=[],partsSettings={},selected=null,selectedParts=null,editingCustomer=null,editingVehicle=null,filter='overview',section='overview',activation=null,markerRevision=0,seenRequested=new Set(),unreadNew=0,soundAllowed=false,ownerEmail='',ownerPushState=null,installPrompt=null,deleteTarget=null,undoDelete=null,undoTimer=0;
const params=new URLSearchParams(location.hash.slice(1)),requestedReference=params.get('request')||'',initialRecordId=params.get('record')||'';
let pendingDeepLink=requestedReference,pendingRecordId=initialRecordId;
const initialSection=params.get('view')||((requestedReference||initialRecordId)?'leads':'overview');if(params.has('activate')){activation={token:params.get('activate'),email:params.get('email')||''};history.replaceState(null,'',location.pathname);$('login-email').value=activation.email;$('login-email').readOnly=true;$('login-password').autocomplete='new-password';$('confirm-label').hidden=false;$('confirm-password').required=true;msg('login-title','Set up your account.');msg('login-submit','Create password & sign in');msg('login-subtitle','Choose a private password of at least 12 characters. Your activation link can be used once.');}
const isOwner=()=>isOwnerEmail(ownerEmail);
function updateOwnerOnlyUi(){const owner=isOwner();$('telegram-test').hidden=!owner;$('phone-alert-settings').hidden=!owner;$('show-deleted').hidden=!owner;const trashNav=document.querySelector('#crm-nav [data-section="trash"]');if(trashNav)trashNav.hidden=!owner;if(!owner)hideRequestToast();}
function showLogin(){activation=null;closeCrmNav();hideRequestToast();$('login-email').readOnly=false;$('confirm-label').hidden=true;$('confirm-password').required=false;$('login-password').autocomplete='current-password';msg('login-title','Welcome back.');msg('login-submit','Sign in');$('login-screen').hidden=false;$('dashboard-screen').hidden=true;$('signout').hidden=true;jobs=[];selected=null;$('jobs-list').replaceChildren();$('detail-media').replaceChildren();}
function showDashboard(email){ownerEmail=email;updateOwnerOnlyUi();activation=null;$('login-screen').hidden=true;$('dashboard-screen').hidden=false;$('signout').hidden=false;msg('admin-email',email);msg('today-date',new Date().toLocaleDateString('en-US',{timeZone:'America/New_York',weekday:'long',month:'long',day:'numeric'})+' · Eastern time');setSection(sectionConfig[initialSection]?initialSection:'overview','replace');if(isOwner())refreshPushStatus();load();loadCrm();}
const currencyInput=value=>Number.isSafeInteger(value)?(value/100).toFixed(2):'';
const currencyDisplay=value=>Number.isSafeInteger(value)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value/100):'Not quoted';
function updateQuoteTotal(){
 const parts=$('quoted-parts').value.trim(),labor=$('quoted-labor').value.trim();
 const a=parts===''?0:Number(parts),b=labor===''?0:Number(labor);
 msg('quote-total',parts===''&&labor===''?'Not quoted':Number.isFinite(a+b)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(a+b):'Check amounts');
 const amount=id=>{const raw=$(id)?.value.trim()||'';return raw===''?null:Number(raw);};
 const partsCharge=amount('parts-charge')??(parts===''?null:a),laborCharge=amount('labor-charge')??(labor===''?null:b),fees=amount('additional-fees')??0,discount=amount('discount')??0,tax=amount('tax')??0,override=amount('final-charged'),paid=amount('amount-paid');
 const calculated=[partsCharge,laborCharge,fees,discount,tax].some(value=>value!==null)?Math.max(0,(partsCharge||0)+(laborCharge||0)+fees+tax-discount):null,total=override??calculated;
 msg('final-job-total',total===null||!Number.isFinite(total)?'Not recorded':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(total));
 msg('outstanding-balance',total===null||paid===null||!Number.isFinite(total)||!Number.isFinite(paid)?'Not recorded':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Math.max(0,total-paid)));
}
function dirty(){
 if(!selected||$('job-detail').hidden||$('job-form').hidden)return false;
 const j=selected;
 const values=[['job-status-input',j.status],['job-confirmed-at',easternInput(j.appointmentAt)],
 ['job-duration',String(j.durationMinutes||60)],['edit-name',j.name||''],['edit-phone',j.phone||''],
 ['edit-email',j.email||''],['edit-year',j.year||''],['edit-make',j.make||''],
 ['edit-model',j.model||''],['edit-trim',j.trim||''],['edit-engine',j.engine||''],['edit-mileage',j.mileage??''],['edit-license-plate',j.licensePlate||''],['edit-vehicle-id',j.vehicleId||''],['edit-vehicle-notes',j.vehicleNotes||''],['edit-service',j.service||''],['edit-description',j.description||''],
 ['edit-preferred-date',j.date||''],['edit-preferred-time',j.time||''],
 ['job-vin-input',j.vin||''],['job-address-input',j.address||''],['job-city-input',j.city||''],
 ['job-notes',j.privateNotes||''],['job-parts',j.partsTools||''],
 ['quoted-parts',currencyInput(j.quotedPartsCents)],['quoted-labor',currencyInput(j.quotedLaborCents)],['parts-charge',currencyInput(j.partsChargeCents)],['labor-charge',currencyInput(j.laborChargeCents)],['additional-fees',currencyInput(j.additionalFeesCents)],['discount',currencyInput(j.discountCents)],['tax',currencyInput(j.taxCents)],
 ['supplier-parts-cost',currencyInput(j.supplierPartsCostCents)],['final-charged',currencyInput(j.finalChargedCents)],['amount-paid',currencyInput(j.amountPaidCents)],
 ['payment-status',j.paymentStatus||'not_recorded'],['communication-text','']];
 return values.some(([id,value])=>String($(id)?.value||'')!==String(value));
}
function live(text){msg('live-status',text);}
function chime(){if(!soundAllowed||!window.AudioContext)return;try{const context=new AudioContext(),oscillator=context.createOscillator(),gain=context.createGain();oscillator.frequency.value=880;gain.gain.setValueAtTime(.035,context.currentTime);oscillator.connect(gain).connect(context.destination);oscillator.start();oscillator.stop(context.currentTime+.08);}catch{}}
async function load({automatic=false}={}){try{const currentId=selected?.id,keepDirty=automatic&&dirty(),previousRequests=new Set(jobs.filter(j=>j.status==='requested').map(j=>j.id)),result=await api('jobs');jobs=result.jobs||[];markerRevision=Number(result.marker?.revision||markerRevision);const fresh=jobs.filter(j=>j.status==='requested'&&!previousRequests.has(j.id));if(automatic&&fresh.length){unreadNew+=fresh.length;chime();}seenRequested=new Set(jobs.filter(j=>j.status==='requested').map(j=>j.id));render();if(currentId&&!keepDirty){const next=jobs.find(j=>j.id===currentId);if(next)choose(next.id);else returnToList('replace');}if(pendingDeepLink&&!selected){const requested=jobs.find(j=>j.reference===pendingDeepLink&&!j.deletedAt);if(requested){choose(requested.id);syncNav('replace',requested.id,false);pendingDeepLink='';}}
 if(pendingRecordId&&!selected){const requested=jobs.find(j=>j.id===pendingRecordId&&!j.deletedAt);if(requested){choose(requested.id);syncNav('replace',requested.id,false);pendingRecordId='';}}live(`${unreadNew?`${unreadNew} new · `:''}Updated ${new Date().toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'})} ET${keepDirty?' · unsaved edits preserved':''}`);}catch(e){live(navigator.onLine?'Refresh unavailable.':'Offline — refresh paused.');msg('list-count',e.message);}}
async function loadCrm(){
 try{
  const data=await api('crm');customers=data.customers||[];vehicles=data.vehicles||[];partsRequests=data.partsRequests||[];serviceCatalog=data.serviceCatalog||[];partsSettings=data.partsSettings||{};
  renderCatalogOptions();renderManualCustomerOptions();renderServiceCatalog();renderPartsList();render();
  if(selected&&!dirty())renderCustomerProfile(selected);
 }catch(error){live('Customer records could not refresh.');}
}
const sectionConfig={
 overview:{title:'Overview',pane:'overview-view',filter:'overview'},
 leads:{title:'New Requests',pane:'records-view',filter:'requested',description:'Review new requests that are waiting for staff follow-up.'},
 appointments:{title:'Appointments',pane:'records-view',filter:'upcoming',description:'Confirmed appointments with a future date and time.'},
 customers:{title:'Customers',pane:'records-view',filter:'customers',description:'Contacts grouped for browsing; each JM request remains its own record.'},
 jobs:{title:'Jobs',pane:'records-view',filter:'all',description:'All current, completed and cancelled job records.'},
 trash:{title:'Trash',pane:'records-view',filter:'trash',description:'Deleted leads stay here until restored or explicitly removed forever.'},
 messages:{title:'Messages & Follow-ups',pane:'records-view',filter:'messages',description:'Manual contact history and follow-up notes. No messages send automatically.'},
 availability:{title:'Availability',pane:'availability-view',filter:'availability'},
 settings:{title:'Settings',pane:'settings-view',filter:'settings'},
 parts:{title:'Parts & Suppliers',pane:'parts-view',filter:'parts'}
};
function closeCrmNav(){if(!$('crm-sidebar'))return;$('crm-sidebar').classList.remove('open');$('crm-scrim').hidden=true;$('crm-menu-toggle').setAttribute('aria-expanded','false');}
function syncNav(mode='push',id='',fromList=false){
 const hash=new URLSearchParams({view:section});
 if(id)hash.set('record',id);
 const url=location.pathname+'#'+hash.toString();
 const state={jmNav:{section,record:id,fromList}};
 if(mode==='replace')history.replaceState(state,'',url);
 else if(mode==='push')history.pushState(state,'',url);
}
function confirmDiscard(){
 return !dirty()||window.confirm('You have unsaved changes. Leave this record and discard those changes?');
}
function setSection(next,historyMode='push'){
 if(next==='trash'&&!isOwner())next='jobs';
 const config=sectionConfig[next];if(!config)return false;
 if(!confirmDiscard())return false;
 section=next;filter=config.filter;
 for(const pane of document.querySelectorAll('.module-pane'))pane.hidden=pane.id!==config.pane;
 msg('page-title',config.title);
 $('back-overview').hidden=next==='overview';
 $('requests-overview').hidden=next==='overview';
 if(config.pane==='records-view'){
  msg('module-title',config.title);msg('module-description',config.description||'');
  const headings={overview:['Needs attention','New requests and confirmed appointments coming up.'],requested:['New requests','Review requests that are waiting for staff follow-up.'],upcoming:['Upcoming appointments','Confirmed appointments with a future date and time.'],customers:['Customer directory','Contacts are grouped for browsing; each request stays a separate record.'],all:['All jobs','Every active request and job record.'],trash:['Trash','Restore accidentally deleted leads, or permanently remove an individual lead.'],messages:['Messages & follow-ups','Manual conversation history and reminders. No messages send automatically.']};
  const details=headings[filter]||headings.requested;msg('job-list-heading',details[0]);msg('job-list-subtitle',details[1]);
 }
 selected=null;$('job-detail').hidden=true;$('empty-detail').hidden=false;$('back-to-list').hidden=true;$('workspace-grid').classList.remove('has-selection');
 document.querySelectorAll('#crm-nav [data-section]').forEach(button=>{const active=button.dataset.section===next;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
 closeCrmNav();if(next==='availability')loadAvailability();if(next==='settings'&&ownerEmail==='joshmobileinc@gmail.com')refreshPushStatus();if(next==='parts')renderPartsList();
 render();if(historyMode!=='none')syncNav(historyMode);
 if(historyMode==='push')window.scrollTo({top:0,behavior:'instant'});
 return true;
}
function jobSearchText(j){return [j.reference,j.name,j.phone,j.normalizedPhone,j.email,j.vin,j.year,j.make,j.model,j.trim,j.engine,j.licensePlate,j.mileage,j.service,j.city,j.address].join(' ').toLowerCase();}
function customerSearchText(customer){
 return [jobSearchText(customer),...vehicles.filter(vehicle=>vehicle.customerId===customer.id).map(vehicle=>jobSearchText(vehicle))].join(' ');
}
const statusLabel=status=>({requested:'New request',confirmed:'Confirmed',scheduled:'Scheduled',in_progress:'In progress',completed:'Completed',cancelled:'Cancelled',no_show:'No show'}[status]||status);
const canSoftDeleteRequest=job=>trashUiVisibility(ownerEmail,job).showDelete;
const canRestoreRequest=job=>trashUiVisibility(ownerEmail,job).showRestore;
function renderJobButton(j){
 const newest=(j.timeline||[]).filter(item=>item.kind!=='created').at(-1);
 const message=filter==='messages'&&newest?'<small>'+esc(newest.kind)+' · '+esc(newest.text)+'</small>':'';
 const when=j.appointmentAt?date(j.appointmentAt):'Preferred: '+(j.date||'Not set')+' · '+(j.time||'Flexible');
 const deleteAction=canSoftDeleteRequest(j)?'<button type="button" class="list-delete destructive" data-delete-request="'+esc(j.id)+'" aria-label="Delete request '+esc(j.reference||j.id)+'">Delete</button>':'';
 return '<article class="job-list-row"><button type="button" class="job-item '+(selected?.id===j.id?'selected':'')+'" data-id="'+esc(j.id)+'"><span class="status '+esc(j.status)+'">'+esc(statusLabel(j.status))+'</span><strong>'+esc(j.name)+'</strong><span>'+esc([j.year,j.make,j.model,j.trim].filter(Boolean).join(' '))+'</span><span>'+esc(services[j.service]||j.service)+'</span><small>'+esc(j.reference||j.id)+'</small><small>'+esc(when)+'</small><small>'+esc(j.city||'')+'</small>'+message+'</button>'+deleteAction+'</article>';
}
function renderCustomerButton(group){
 const j=group.records[0],vehicle=[j.year,j.make,j.model].filter(Boolean).join(' ');
 return '<button type="button" class="job-item customer-item '+(selected?.id===j.id?'selected':'')+'" data-id="'+esc(j.id)+'"><span class="status">'+group.records.length+' request'+(group.records.length===1?'':'s')+'</span><strong>'+esc(j.name)+'</strong><span>'+esc(j.phone||j.email||'Contact not available')+'</span><span>'+esc(vehicle||'Vehicle details pending')+'</span><small>Latest: '+esc(j.reference||j.id)+' · '+esc(services[j.service]||j.service)+'</small><small>'+esc(j.city||'')+'</small></button>';
}
function renderCanonicalCustomerButton(customer){
 const ownVehicles=vehicles.filter(vehicle=>vehicle.customerId===customer.id),records=jobs.filter(job=>!job.deletedAt&&(job.customerId===customer.id||(!job.customerId&&contactKey(job)===contactKey(customer))));
 const vehicleText=ownVehicles.length?ownVehicles.map(vehicle=>[vehicle.year,vehicle.make,vehicle.model].filter(Boolean).join(' ')).filter(Boolean).join(' · '):'No saved vehicle';
 return '<button type="button" class="job-item customer-item" data-customer-id="'+esc(customer.id)+'"><span class="status '+esc(customer.status)+'">'+esc(customer.status==='archived'?'Archived':records.length+' job'+(records.length===1?'':'s'))+'</span><strong>'+esc(customer.name)+'</strong><span>'+esc(customer.phone||customer.email||'Contact not available')+'</span><span>'+esc(vehicleText)+'</span><small>'+esc(customer.communicationInstructions||customer.preferences||'Open customer profile')+'</small></button>';
}
function render(){
 const q=$('search-jobs').value.trim().toLowerCase(),active=jobs.filter(j=>!j.deletedAt),trashed=jobs.filter(j=>j.deletedAt),
 contacts=groupContacts(active),upcoming=active.filter(j=>isUpcomingAppointment(j)),requested=active.filter(j=>j.status==='requested');
 const customerKeys=new Set(customers.filter(customer=>customer.status!=='archived').map(contactKey)),legacyContacts=contacts.filter(group=>!customerKeys.has(group.key));
 msg('count-new',requested.length);msg('count-upcoming',upcoming.length);msg('count-customers',customers.filter(customer=>customer.status!=='archived').length+legacyContacts.length);msg('count-done',jobs.filter(j=>j.status==='completed').length);
 msg('nav-count-leads',requested.length);msg('nav-count-appointments',upcoming.length);msg('nav-count-trash',trashed.length);
 const showingDeleted=filter==='trash',showDeleted=$('show-deleted');showDeleted.hidden=!trashUiVisibility(ownerEmail).showTrash;showDeleted.textContent=showingDeleted?'Hide deleted':'Show deleted'+(trashed.length?' ('+trashed.length+')':'');showDeleted.setAttribute('aria-pressed',String(showingDeleted));
 let html='',count=0;
 if(filter==='customers'){
  const items=customers.filter(customer=>customerSearchText(customer).includes(q)),legacy=legacyContacts.filter(group=>group.records.some(job=>jobSearchText(job).includes(q)));
  count=items.length+legacy.length;html=items.map(renderCanonicalCustomerButton).join('')+legacy.map(renderCustomerButton).join('');
 }else{
  let items=jobs.filter(j=>{
   if(filter==='trash')return !!j.deletedAt&&jobSearchText(j).includes(q);
   if(j.deletedAt)return false;
   const inSection=filter==='all'||filter==='requested'&&j.status==='requested'||filter==='upcoming'&&isUpcomingAppointment(j)||filter==='messages'&&(j.timeline||[]).some(item=>item.kind!=='created')||filter==='overview'&&(j.status==='requested'||isUpcomingAppointment(j));
   return inSection&&jobSearchText(j).includes(q);
  });
  items.sort((a,b)=>filter==='upcoming'?Date.parse(a.appointmentAt)-Date.parse(b.appointmentAt):(b.createdAt||'').localeCompare(a.createdAt||''));
  count=items.length;html=items.map(renderJobButton).join('');
 }
 msg('list-count',count+' '+(count===1?'record':'records'));
 $('jobs-list').innerHTML=html||'<div class="empty-detail"><h3>No records here yet.</h3><p>New website requests will appear here. Use Add customer / job for customers who contacted you by phone.</p></div>';
 $('jobs-list').querySelectorAll('[data-id]').forEach(button=>button.onclick=()=>{unreadNew=0;choose(button.dataset.id,true);});
 $('jobs-list').querySelectorAll('[data-delete-request]').forEach(button=>button.onclick=event=>{event.stopPropagation();openDeleteRequestDialog(button.dataset.deleteRequest);});
  $('jobs-list').querySelectorAll('[data-customer-id]').forEach(button=>button.onclick=()=>openCustomerFromList(button.dataset.customerId));
}
function renderCatalogOptions(){
 const list=$('service-catalog-options');if(!list)return;list.replaceChildren();
 for(const item of serviceCatalog.filter(item=>item.active!==false)){const option=document.createElement('option');option.value=item.name;list.append(option);}
}
function renderManualCustomerOptions(){
 const select=$('manual-customer-id');if(!select)return;const prior=select.value;select.replaceChildren(new Option('Create or match by exact contact details',''));
 for(const customer of customers.filter(customer=>customer.status!=='archived'))select.add(new Option(`${customer.name} · ${customer.phone||customer.email}`,customer.id));
 select.value=customers.some(customer=>customer.id===prior)?prior:'';renderManualVehicleOptions();
}
function renderManualVehicleOptions(){
 const select=$('manual-vehicle-id'),customerId=$('manual-customer-id')?.value;if(!select)return;const prior=select.value;select.replaceChildren(new Option('Create or match from the vehicle details below',''));
 for(const vehicle of vehicles.filter(vehicle=>vehicle.customerId===customerId))select.add(new Option([vehicle.year,vehicle.make,vehicle.model,vehicle.trim,vehicle.vin?`VIN ${vehicle.vin}`:''].filter(Boolean).join(' · '),vehicle.id));
 select.value=vehicles.some(vehicle=>vehicle.id===prior&&vehicle.customerId===customerId)?prior:'';
}
function renderServiceCatalog(){
 const host=$('service-catalog-list');if(!host)return;host.innerHTML=serviceCatalog.map(item=>'<div class="service-catalog-row" data-catalog-id="'+esc(item.id)+'"><label>Service<input data-field="name" value="'+esc(item.name)+'" maxlength="100" required></label><label>Default parts ($)<input data-field="defaultParts" type="number" inputmode="decimal" min="0" max="1000000" step="0.01" value="'+esc(currencyInput(item.defaultPartsCents))+'"></label><label>Default labor ($)<input data-field="defaultLabor" type="number" inputmode="decimal" min="0" max="1000000" step="0.01" value="'+esc(currencyInput(item.defaultLaborCents))+'"></label><label class="catalog-active"><input data-field="active" type="checkbox" '+(item.active!==false?'checked':'')+'> Active</label></div>').join('');
 $('parts-markup-percent').value=partsSettings.markupPercent??'';$('parts-default-labor').value=currencyInput(partsSettings.defaultLaborCents);
}
function renderJobVehicleOptions(job){
 const select=$('edit-vehicle-id');if(!select)return;select.replaceChildren(new Option("Use this job's vehicle details",''));
 const ownerVehicles=vehicles.filter(vehicle=>vehicle.customerId===job.customerId);
 for(const vehicle of ownerVehicles)select.add(new Option([vehicle.year,vehicle.make,vehicle.model,vehicle.trim,vehicle.vin?`VIN ${vehicle.vin}`:''].filter(Boolean).join(' · '),vehicle.id));
 if(job.vehicleId&&!ownerVehicles.some(vehicle=>vehicle.id===job.vehicleId))select.add(new Option('Linked vehicle record unavailable',job.vehicleId));
 select.value=job.vehicleId||'';
}
function renderCustomerProfile(job){
 const block=$('customer-profile-block'),customer=customers.find(item=>item.id===job.customerId);
 if(!customer){block.hidden=true;return;}
 block.hidden=false;msg('customer-profile-summary',`${customer.status==='archived'?'Archived · ':''}${customer.phone||''}${customer.email?(customer.phone?' · ':'')+customer.email:''}`);
 const extra=[customer.preferences&&`Preferences: ${customer.preferences}`,customer.communicationInstructions&&`Contact: ${customer.communicationInstructions}`,customer.notes&&`Internal: ${customer.notes}`].filter(Boolean).join(' · ');msg('customer-preferences',extra||'No saved preferences or communication instructions.');
 const ownVehicles=vehicles.filter(vehicle=>vehicle.customerId===customer.id),jobCounts=new Map();for(const record of jobs.filter(item=>item.customerId===customer.id))jobCounts.set(record.vehicleId,(jobCounts.get(record.vehicleId)||0)+1);
 $('customer-vehicles').innerHTML=ownVehicles.length?ownVehicles.map(vehicle=>'<article class="vehicle-card"><strong>'+esc([vehicle.year,vehicle.make,vehicle.model,vehicle.trim].filter(Boolean).join(' ')||vehicle.vin)+'</strong><span>'+esc([vehicle.engine,vehicle.mileage===null||vehicle.mileage===undefined?'':vehicle.mileage+' mi',vehicle.licensePlate?'Plate '+vehicle.licensePlate:'',vehicle.vin?'VIN '+vehicle.vin:''].filter(Boolean).join(' · '))+'</span><small>'+esc((jobCounts.get(vehicle.id)||0)+' saved job'+((jobCounts.get(vehicle.id)||0)===1?'':'s'))+'</small><button type="button" class="outline" data-edit-vehicle="'+esc(vehicle.id)+'">Edit vehicle</button></article>').join(''):'<p class="subtle">No vehicle record saved yet.</p>';
 $('customer-vehicles').querySelectorAll('[data-edit-vehicle]').forEach(button=>button.onclick=()=>openVehicleDialog(button.dataset.editVehicle));
}
function renderJobPartsRequests(job){
 const relevant=partsRequests.filter(item=>item.jobId===job.id),host=$('job-parts-requests');
 host.innerHTML=relevant.length?'<h4>Saved lookup tasks</h4>'+relevant.map(item=>'<button type="button" class="parts-link" data-part-id="'+esc(item.id)+'"><strong>'+esc(item.requestedPart||item.partCategory||'Parts lookup')+'</strong><span>'+esc(item.compatibilityStatus.replaceAll('_',' '))+' · '+esc(item.status)+'</span></button>').join(''):'<p class="subtle">No parts lookup tasks for this job yet.</p>';
 host.querySelectorAll('[data-part-id]').forEach(button=>button.onclick=()=>{setSection('parts');chooseParts(button.dataset.partId);});
}
function openCustomerFromList(id){
 const customer=customers.find(item=>item.id===id);if(!customer)return;
 const records=jobs.filter(job=>!job.deletedAt&&(job.customerId===id||!job.customerId&&contactKey(job)===contactKey(customer))).sort((a,b)=>(b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''));
 if(records.length){choose(records[0].id,true);return;}openCustomerDialog(id);
}
function renderPartsList(){
 const host=$('parts-list');if(!host)return;const ordered=[...partsRequests].sort((a,b)=>(b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''));
 host.innerHTML=ordered.length?ordered.map(item=>{const vehicle=vehicles.find(vehicle=>vehicle.id===item.vehicleId),customer=customers.find(customer=>customer.id===item.customerId);return '<button type="button" class="job-item '+(selectedParts?.id===item.id?'selected':'')+'" data-parts-id="'+esc(item.id)+'"><span class="status '+esc(item.status)+'">'+esc(item.status.replaceAll('_',' '))+'</span><strong>'+esc(item.requestedPart||item.partCategory||'Parts lookup')+'</strong><span>'+esc(customer?.name||'Customer record')+'</span><small>'+esc([vehicle?.year,vehicle?.make,vehicle?.model,vehicle?.trim].filter(Boolean).join(' '))+'</small><small>'+esc(item.compatibilityStatus.replaceAll('_',' '))+'</small></button>';}).join(''):'<div class="empty-detail"><h3>No parts tasks yet.</h3><p>Create one from a customer job when a replacement part needs research.</p></div>';
 host.querySelectorAll('[data-parts-id]').forEach(button=>button.onclick=()=>chooseParts(button.dataset.partsId));
}
function chooseParts(id){
 selectedParts=partsRequests.find(item=>item.id===id);if(!selectedParts)return;const item=selectedParts,vehicle=vehicles.find(row=>row.id===item.vehicleId),customer=customers.find(row=>row.id===item.customerId),workflow=item.workflow||{};
 const mobile=matchMedia('(max-width: 900px)').matches;$('parts-grid').classList.toggle('has-selection',mobile);$('back-to-parts-list').hidden=!mobile;$('empty-parts-detail').hidden=true;$('parts-detail').hidden=false;msg('parts-status',item.status.replaceAll('_',' '));$('parts-status').className='status '+item.status;msg('parts-title',item.requestedPart||item.partCategory||'Parts lookup');msg('parts-vehicle',[customer?.name,[vehicle?.year,vehicle?.make,vehicle?.model,vehicle?.trim].filter(Boolean).join(' ')].filter(Boolean).join(' · '));msg('parts-readiness',`${workflow.warning||'Verify fitment before quoting.'}${workflow.missingDetails?.length?' Missing: '+workflow.missingDetails.join(', ')+'.':''}`);
 $('parts-requested-part').value=item.requestedPart||'';$('parts-category').value=item.partCategory||'';$('parts-oem').value=item.oemPartNumber||'';$('parts-aftermarket').value=item.aftermarketPartNumber||'';$('parts-quantity').value=item.quantity||1;$('parts-compatibility').value=item.compatibilityStatus||'not_checked';$('parts-request-status').value=item.status||'lookup_needed';$('parts-labor').value=currencyInput(item.laborCents);$('parts-notes').value=item.notes||'';
 const estimate=currencyDisplay(item.proposedEstimateCents),approval=item.approval||{};msg('parts-estimate',`Proposed estimate: ${estimate}. ${approval.state==='approved_for_manual_discussion'?'Owner approved for manual discussion; no message was sent.':'Owner approval and verified compatibility are required before a final price is communicated.'}`);$('approve-parts-estimate').hidden=ownerEmail!=='joshmobileinc@gmail.com'||approval.state==='approved_for_manual_discussion';
 $('parts-quotes').innerHTML=(item.quotes||[]).length?'<h4>Saved researched quotes</h4>'+[...item.quotes].reverse().map(quote=>'<article class="quote-card"><strong>'+esc(quote.supplier||'Supplier source')+'</strong><span>'+esc(quote.partNumber||quote.supplierSku||'No part number')+' · '+esc(currencyDisplay(quote.supplierPriceCents))+'</span><small>'+esc(quote.availability||'Availability not recorded')+' · checked '+esc(date(quote.checkedAt))+'</small>'+(quote.sourceUrl?'<a href="'+esc(quote.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Open source ↗</a>':'')+'</article>').join(''):'<p class="subtle">No researched supplier quote saved.</p>';
 renderPartsList();
}
function choose(id,writeHistory=false){
 if(selected?.id!==id&&!confirmDiscard())return false;
 selected=jobs.find(j=>j.id===id);if(!selected)return false;const j=selected;
 $('empty-detail').hidden=true;$('job-detail').hidden=false;
 const mobile=matchMedia('(max-width: 900px)').matches;$('workspace-grid').classList.toggle('has-selection',mobile);$('back-to-list').hidden=!mobile;
 $('back-to-list').textContent=section==='trash'?'← Back to Trash':section==='leads'?'← Back to requests':'← Back to '+(sectionConfig[section]?.title||'list');
 $('lead-management').hidden=!canSoftDeleteRequest(j)&&!canRestoreRequest(j);
 $('delete-lead').hidden=!canSoftDeleteRequest(j);
 $('trashed-lead-actions').hidden=!canRestoreRequest(j);
 $('job-form').hidden=!!j.deletedAt;
 document.querySelector('.job-actions').hidden=!!j.deletedAt;
 msg('job-title',j.name);msg('job-reference','Reference: '+(j.reference||j.id));msg('job-summary',services[j.service]||j.service);
 msg('job-status',statusLabel(j.status));$('job-status').className='status '+j.status;
 const details={'detail-name':j.name,'detail-phone':j.phone,'detail-email':j.email||'Not provided','detail-address':[j.address,j.city].filter(Boolean).join(', ')||'Location not provided','detail-car':[j.year,j.make,j.model,j.trim,j.engine].filter(Boolean).join(' ')||'Vehicle details pending','detail-vin':j.vin||'Not recorded','detail-description':j.description||'No work description provided.','detail-preferred':'Requested: '+(j.date||'Flexible')+' · '+(j.time||'Flexible')+' · '+(j.locationType||'Mobile service')};
 for(const [key,value]of Object.entries(details))msg(key,value);
 $('job-status-input').value=j.status;$('job-confirmed-at').value=easternInput(j.appointmentAt);$('job-duration').value=j.durationMinutes||60;
 $('edit-name').value=j.name||'';$('edit-phone').value=j.phone||'';$('edit-email').value=j.email||'';
 $('edit-year').value=j.year||'';$('edit-make').value=j.make||'';$('edit-model').value=j.model||'';$('edit-trim').value=j.trim||'';$('edit-engine').value=j.engine||'';$('edit-mileage').value=j.mileage??'';$('edit-license-plate').value=j.licensePlate||'';$('edit-vehicle-notes').value=j.vehicleNotes||'';
 renderJobVehicleOptions(j);
 $('edit-service').value=j.service||'';$('edit-description').value=j.description||'';
 $('edit-preferred-date').value=j.date||'';$('edit-preferred-time').value=j.time||'';
 $('job-vin-input').value=j.vin||'';$('job-address-input').value=j.address||'';$('job-city-input').value=j.city||'';
 $('job-notes').value=j.privateNotes||'';$('job-parts').value=j.partsTools||'';
 $('quoted-parts').value=currencyInput(j.quotedPartsCents);$('quoted-labor').value=currencyInput(j.quotedLaborCents);$('parts-charge').value=currencyInput(j.partsChargeCents);$('labor-charge').value=currencyInput(j.laborChargeCents);$('additional-fees').value=currencyInput(j.additionalFeesCents);$('discount').value=currencyInput(j.discountCents);$('tax').value=currencyInput(j.taxCents);
 $('supplier-parts-cost').value=currencyInput(j.supplierPartsCostCents);$('final-charged').value=currencyInput(j.finalChargedCents);$('amount-paid').value=currencyInput(j.amountPaidCents);
 $('payment-status').value=j.paymentStatus||'not_recorded';updateQuoteTotal();
 msg('fitment-summary',[j.year,j.make,j.model,j.trim,j.engine,j.vin?'VIN '+j.vin:'VIN not recorded',services[j.service]||j.service].filter(Boolean).join(' · '));
 const phone=(j.normalizedPhone||j.phone).replace(/[^+\d]/g,''),digits=phone.replace(/\D/g,''),reference=j.reference||j.id,followup='Hi '+j.name+', following up on your Josh Mobile request '+reference+'.';
 $('call-customer').href='tel:'+phone;$('text-customer').href='sms:'+phone+'?body='+encodeURIComponent(followup);$('whatsapp-customer').href='https://wa.me/'+digits+'?text='+encodeURIComponent(followup);
 $('map-customer').href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([j.address,j.city].filter(Boolean).join(', '));
 $('calendar-job').hidden=!['confirmed','scheduled'].includes(j.status)||!j.appointmentAt;$('calendar-job').href='/api/admin?action=calendar&id='+encodeURIComponent(j.id);
 const history=jobs.filter(item=>!item.deletedAt&&item.id!==j.id&&(j.customerId&&item.customerId===j.customerId||contactKey(item)===contactKey(j))).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
 $('customer-history-list').innerHTML=history.length?history.map(item=>'<button type="button" class="history-record" data-history-id="'+esc(item.id)+'"><span class="status '+esc(item.status)+'">'+esc(item.status==='requested'?'New request':item.status)+'</span><strong>'+esc(item.reference||item.id)+'</strong><small>'+esc(services[item.service]||item.service)+' · '+esc(item.appointmentAt?date(item.appointmentAt):'Requested '+(item.date||'flexible'))+'</small></button>').join(''):'<p class="subtle">No other requests are linked to this contact.</p>';
 $('customer-history-list').querySelectorAll('[data-history-id]').forEach(button=>button.onclick=()=>choose(button.dataset.historyId));
 $('detail-media').innerHTML=(j.media||[]).map(m=>{const url='/api/admin?action=file&id='+encodeURIComponent(j.id)+'&index='+m.index;return m.type.startsWith('image/')?'<a href="'+url+'" target="_blank" rel="noopener"><img src="'+url+'" alt="Customer vehicle attachment '+(m.index+1)+'" loading="lazy"></a>':'<video controls preload="none" aria-label="Customer vehicle video '+(m.index+1)+'"><source src="'+url+'" type="'+esc(m.type)+'">Video playback is not supported in this browser.</video>';}).join('')||'<p class="subtle">No uploaded attachments.</p>';
 const attachment=j.attachmentStatus||{expected:(j.attachments||[]).length,received:(j.media||[]).length,failed:[]};
 msg('detail-media-status',attachment.expected?attachment.received+' of '+attachment.expected+' attachment'+(attachment.expected===1?'':'s')+' received'+(attachment.failed?.length?'; '+attachment.failed.length+' need attention':'')+'.':'No photos selected.');
 const alert=j.notification?.state||'not_configured',alertText=alert==='accepted'?'Owner email alert was accepted by the provider; inbox delivery is not verified.':alert==='not_configured'?'Automatic owner email alerts are NOT ACTIVE — owner setup is required.':alert==='manual'?'Phone-only request; no automatic owner alert was attempted.':alert==='uncertain'?'Owner alert outcome is uncertain. Review the owner inbox before any manual follow-up to avoid duplicates.':'Owner alert status: '+alert+'.';
 msg('detail-alert-status',alertText);refreshPushRequestStatus(j.id);msg('detail-telegram-status','Telegram alert: '+(j.telegram?.state||'not available')+(j.telegram?.attempts?' · '+j.telegram.attempts+' attempt(s)':'')+'.');
 $('retry-alert').hidden=alert!=='failed';$('timeline').innerHTML=[...(j.timeline||[])].reverse().map(t=>'<article class="timeline-entry"><small>'+esc(date(t.at))+' · '+esc(t.kind)+' · '+esc(t.by)+'</small><p>'+esc(t.text)+'</p></article>').join('');
 renderCustomerProfile(j);renderJobPartsRequests(j);msg('save-message','');msg('communication-message','');render();
 if(writeHistory)syncNav('push',id,true);
 return true;
}
function returnToList(historyMode='push'){
 if(!confirmDiscard())return false;
 const useBrowserBack=historyMode==='push'&&history.state?.jmNav?.fromList;
 selected=null;$('workspace-grid').classList.remove('has-selection');$('back-to-list').hidden=true;
 $('job-detail').hidden=true;$('empty-detail').hidden=false;render();
 if(useBrowserBack)history.back();
 else if(historyMode!=='none')syncNav('replace');
 const heading=$('job-list-heading');heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});
 return true;
}

function clearSelectedRequest(id){
 if(selected?.id!==id)return;selected=null;$('workspace-grid').classList.remove('has-selection');$('back-to-list').hidden=true;$('job-detail').hidden=true;$('empty-detail').hidden=false;
}
function hideRequestToast(){clearTimeout(undoTimer);undoDelete=null;$('request-toast').hidden=true;}
function showRequestToast(message,undoRecord=null){
 if(!trashUiVisibility(ownerEmail).showUndo){hideRequestToast();return;}
 clearTimeout(undoTimer);undoDelete=undoRecord;msg('request-toast-message',message);$('undo-delete').hidden=!undoRecord;$('request-toast').hidden=false;undoTimer=window.setTimeout(hideRequestToast,12000);
}
async function modifyLead(action,item=selected,confirmation={}){
 if(!item)return null;const reference=item.reference||item.id;
 const response=await api(action,'POST',{id:item.id,version:item.version,confirmReference:reference,...confirmation});await load();return response;
}
function openDeleteRequestDialog(id){
 const item=jobs.find(job=>job.id===id);if(!canSoftDeleteRequest(item))return;deleteTarget=item;msg('delete-request-summary','Move '+item.name+'\'s request ('+(item.reference||item.id)+') to Trash? It does not delete the linked customer, vehicle, other jobs, photos, or history.');msg('delete-request-message','');$('delete-request-dialog').showModal();
}
async function trashWebsiteRequest(item){
 const response=await modifyLead('trash',item);clearSelectedRequest(item.id);render();showRequestToast('Request moved to Trash.',response.job);return response;
}
async function restoreWebsiteRequest(item,{fromUndo=false}={}){
 const response=await modifyLead('restore',item);clearSelectedRequest(item.id);render();if(fromUndo){hideRequestToast();showRequestToast('Request restored.');}else{msg('lead-action-message','Request restored.');showRequestToast('Request restored.');}return response;
}
$('delete-lead').onclick=()=>openDeleteRequestDialog(selected?.id);
$('cancel-delete-request').onclick=()=>$('delete-request-dialog').close();
$('delete-request-dialog').addEventListener('close',()=>{deleteTarget=null;});
$('delete-request-form').onsubmit=async event=>{
 event.preventDefault();const item=deleteTarget;if(!item)return;$('confirm-delete-request').disabled=true;
 try{await trashWebsiteRequest(item);$('delete-request-dialog').close();}catch(error){msg('delete-request-message',error.message);}finally{$('confirm-delete-request').disabled=false;}
};
$('restore-lead').onclick=async()=>{if(!isOwner())return;try{await restoreWebsiteRequest(selected);setSection('leads','replace');}catch(error){msg('lead-action-message',error.message);}};
$('undo-delete').onclick=async()=>{if(!isOwner())return;const item=undoDelete;if(!item)return;$('undo-delete').disabled=true;try{await restoreWebsiteRequest(item,{fromUndo:true});setSection('leads','replace');}catch(error){showRequestToast(error.message,item);}finally{$('undo-delete').disabled=false;}};
$('dismiss-request-toast').onclick=hideRequestToast;
$('purge-lead').onclick=()=>{
 if(!isOwner()||!selected?.deletedAt)return;
 msg('purge-message','');$('purge-confirm-reference').value='';
 msg('purge-reference-label',selected.reference||selected.id);
 $('purge-dialog').showModal();
};
$('cancel-purge').onclick=()=>$('purge-dialog').close();
$('purge-form').onsubmit=async event=>{
 event.preventDefault();if(!selected)return;
 const j=selected,reference=j.reference||j.id;
 if($('purge-confirm-reference').value.trim()!==reference){
  msg('purge-message','The reference does not match. No data was deleted.');return;
 }
 $('confirm-purge').disabled=true;
 try{await modifyLead('purge',selected,{confirmText:'DELETE'});clearSelectedRequest(j.id);render();$('purge-dialog').close();}
 catch(error){msg('purge-message',error.message);}
 finally{$('confirm-purge').disabled=false;}
};
$('login-form').onsubmit=async e=>{e.preventDefault();const button=$('login-submit');button.disabled=true;msg('login-message','Signing in…');try{if(activation&&$('login-password').value!==$('confirm-password').value)throw new Error('Passwords do not match.');const r=await api(activation?'activate':'login','POST',{email:$('login-email').value,password:$('login-password').value,...(activation?{token:activation.token}:{})});$('login-password').value='';$('confirm-password').value='';msg('login-message','');showDashboard(r.email);}catch(err){msg('login-message',err.message);}finally{button.disabled=false;}};
$('signout').onclick=async()=>{try{await api('logout','POST',{});location.reload();}catch(e){msg('list-count',e.message);}};
$('refresh-jobs').onclick=()=>load();$('search-jobs').oninput=render;$('show-deleted').onclick=()=>{if(isOwner())setSection(filter==='trash'?'jobs':'trash');};
$('crm-nav').querySelectorAll('[data-section]').forEach(button=>button.onclick=()=>setSection(button.dataset.section));
$('back-overview').onclick=()=>setSection('overview');
$('requests-overview').onclick=()=>setSection('overview');
window.addEventListener('popstate',event=>{
 if($('dashboard-screen').hidden)return;
 const state=event.state?.jmNav;
 const next=state?.section||'overview',id=state?.record||'';
 if(!confirmDiscard()){syncNav('push',selected?.id||'',!!selected);return;}
 if(setSection(sectionConfig[next]?next:'overview','none')&&id)choose(id);
});
document.querySelectorAll('[data-go-section]').forEach(button=>button.onclick=()=>setSection(button.dataset.goSection));
$('crm-menu-toggle').onclick=()=>{const open=!$('crm-sidebar').classList.contains('open');$('crm-sidebar').classList.toggle('open',open);$('crm-scrim').hidden=!open;$('crm-menu-toggle').setAttribute('aria-expanded',String(open));};
$('crm-scrim').onclick=closeCrmNav;$('back-to-list').onclick=()=>returnToList();
$('back-to-parts-list').onclick=()=>{selectedParts=null;$('parts-grid').classList.remove('has-selection');$('back-to-parts-list').hidden=true;$('parts-detail').hidden=true;$('empty-parts-detail').hidden=false;renderPartsList();};
window.addEventListener('resize',()=>{const mobile=matchMedia('(max-width: 900px)').matches;if(selected){$('workspace-grid').classList.toggle('has-selection',mobile);$('back-to-list').hidden=!mobile;}if(selectedParts){$('parts-grid').classList.toggle('has-selection',mobile);$('back-to-parts-list').hidden=!mobile;}});

async function refreshPushRequestStatus(id){if(ownerEmail!=='joshmobileinc@gmail.com')return;try{const response=await fetch('/api/admin?action=push-request-status&id='+encodeURIComponent(id),{credentials:'same-origin',cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed.');const state=data.push;const detail=ownerPushState?.enabled?state.state:'not_active';const words={not_active:'Phone alert NOT ACTIVE until Josh completes VAPID setup and opts in.',no_subscriptions:'No opted-in phone is registered.',not_found:'Request not found.',not_attempted:'Phone alert has not been attempted for this request.',sending:'Phone alert is being sent.',accepted:'Push provider accepted this alert; phone receipt is not confirmed.',failed:'Phone alert failed for at least one device.'};msg('detail-push-status',words[detail]||'Phone alert status: '+detail+'.');$('retry-phone-alert').hidden=detail!=='failed';$('retry-phone-alert').dataset.id=id;}catch(error){msg('detail-push-status','Phone alert status unavailable.');$('retry-phone-alert').hidden=true;}}
$('retry-phone-alert').onclick=async()=>{const button=$('retry-phone-alert');button.disabled=true;try{const result=await api('push-retry','POST',{id:button.dataset.id});msg('detail-push-status',`Phone push retry: ${result.result.accepted} accepted by provider. Phone receipt is not confirmed.`);await refreshPushRequestStatus(button.dataset.id);}catch(error){msg('detail-push-status',error.message);}finally{button.disabled=false;}};
$('retry-alert').onclick=async()=>{if(!selected)return;$('retry-alert').disabled=true;try{const result=await api('retry-notification','POST',{id:selected.id});msg('detail-alert-status',result.notification?.attempted?'Owner alert retry submitted; provider acceptance is not inbox delivery.':'Owner alert retry is waiting for its retry window.');await load();}catch(error){msg('detail-alert-status',error.message);}finally{$('retry-alert').disabled=false;}};
$('job-form').onsubmit=async event=>{
 event.preventDefault();if(!selected)return;
 $('save-job').disabled=true;
 try{
  const body={id:selected.id,version:selected.version,status:$('job-status-input').value,
   appointmentAt:easternISO($('job-confirmed-at').value),durationMinutes:Number($('job-duration').value),
   name:$('edit-name').value,phone:$('edit-phone').value,email:$('edit-email').value,
   year:$('edit-year').value,make:$('edit-make').value,model:$('edit-model').value,trim:$('edit-trim').value,engine:$('edit-engine').value,mileage:$('edit-mileage').value,licensePlate:$('edit-license-plate').value,vehicleId:$('edit-vehicle-id').value,vehicleNotes:$('edit-vehicle-notes').value,
   service:$('edit-service').value,description:$('edit-description').value,
   date:$('edit-preferred-date').value,time:$('edit-preferred-time').value,
   vin:$('job-vin-input').value,address:$('job-address-input').value,city:$('job-city-input').value,
   privateNotes:$('job-notes').value,partsTools:$('job-parts').value,
   quotedParts:$('quoted-parts').value,quotedLabor:$('quoted-labor').value,partsCharge:$('parts-charge').value,laborCharge:$('labor-charge').value,additionalFees:$('additional-fees').value,discount:$('discount').value,tax:$('tax').value,
   supplierPartsCost:$('supplier-parts-cost').value,finalCharged:$('final-charged').value,amountPaid:$('amount-paid').value,
   paymentStatus:$('payment-status').value};
  const result=await api('update','POST',body);
  jobs=jobs.map(j=>j.id===result.job.id?result.job:j);
  await loadCrm();choose(result.job.id);msg('save-message','Customer, appointment, and pricing changes saved.');
 }catch(error){msg('save-message',error.message);}
 finally{$('save-job').disabled=false;}
};
for(const id of ['quoted-parts','quoted-labor','parts-charge','labor-charge','additional-fees','discount','tax','final-charged','amount-paid'])$(id).addEventListener('input',updateQuoteTotal);
$('copy-fitment').onclick=async()=>{
 if(!selected)return;
 const value=[selected.year,selected.make,selected.model,selected.trim,selected.engine,'VIN: '+(selected.vin||'not recorded'),'Service: '+(services[selected.service]||selected.service||'not specified')].filter(Boolean).join(' · ');
 try{await navigator.clipboard.writeText(value);msg('fitment-copy-status','Vehicle details copied. Verify part fitment in your supplier account.');}
 catch{msg('fitment-copy-status',value);}
};
function openCustomerDialog(id=''){
 editingCustomer=id?customers.find(customer=>customer.id===id):null;const customer=editingCustomer||{};
 msg('customer-dialog-title',editingCustomer?'Edit customer':'Add customer');$('customer-name').value=customer.name||'';$('customer-phone').value=customer.phone||'';$('customer-email').value=customer.email||'';$('customer-address').value=customer.address||'';$('customer-city').value=customer.city||'';$('customer-status').value=customer.status||'active';$('customer-notes').value=customer.notes||'';$('customer-preferences-input').value=customer.preferences||'';$('customer-communication').value=customer.communicationInstructions||'';$('archive-customer-btn').hidden=!editingCustomer;$('customer-form-message').textContent='';$('customer-dialog').showModal();
}
function openVehicleDialog(id=''){
 editingVehicle=id?vehicles.find(vehicle=>vehicle.id===id):null;const customerId=editingVehicle?.customerId||selected?.customerId||editingCustomer?.id;
 if(!customerId){msg('save-message','Save or link a customer before adding a vehicle.');return;}
 const vehicle=editingVehicle||{};msg('vehicle-dialog-title',editingVehicle?'Edit vehicle':'Add vehicle');$('vehicle-year').value=vehicle.year||'';$('vehicle-make').value=vehicle.make||'';$('vehicle-model').value=vehicle.model||'';$('vehicle-trim').value=vehicle.trim||'';$('vehicle-engine').value=vehicle.engine||'';$('vehicle-mileage').value=vehicle.mileage??'';$('vehicle-license-plate').value=vehicle.licensePlate||'';$('vehicle-vin').value=vehicle.vin||'';$('vehicle-notes').value=vehicle.notes||'';$('vehicle-form').dataset.customerId=customerId;$('vehicle-form-message').textContent='';$('vehicle-dialog').showModal();
}
$('close-customer-dialog').onclick=()=>$('customer-dialog').close();
$('close-vehicle-dialog').onclick=()=>$('vehicle-dialog').close();
$('customer-form').onsubmit=async event=>{
 event.preventDefault();const payload={name:$('customer-name').value,phone:$('customer-phone').value,email:$('customer-email').value,address:$('customer-address').value,city:$('customer-city').value,status:$('customer-status').value,notes:$('customer-notes').value,preferences:$('customer-preferences-input').value,communicationInstructions:$('customer-communication').value};
 try{const result=editingCustomer?await api('update-customer','POST',{...payload,id:editingCustomer.id,version:editingCustomer.version}):await api('create-customer','POST',payload);await loadCrm();$('customer-dialog').close();editingCustomer=result.customer;if(selected?.customerId===result.customer.id)renderCustomerProfile(selected);}
 catch(error){msg('customer-form-message',error.message);}
};
$('archive-customer-btn').onclick=async()=>{
 if(!editingCustomer||!window.confirm(`Archive ${editingCustomer.name}? Their vehicles and job history will remain.`))return;
 try{await api('archive-customer','POST',{id:editingCustomer.id,version:editingCustomer.version});await loadCrm();$('customer-dialog').close();}
 catch(error){msg('customer-form-message',error.message);}
};
$('vehicle-form').onsubmit=async event=>{
 event.preventDefault();const payload={customerId:$('vehicle-form').dataset.customerId,year:$('vehicle-year').value,make:$('vehicle-make').value,model:$('vehicle-model').value,trim:$('vehicle-trim').value,engine:$('vehicle-engine').value,mileage:$('vehicle-mileage').value,licensePlate:$('vehicle-license-plate').value,vin:$('vehicle-vin').value,vehicleNotes:$('vehicle-notes').value};
 try{const result=editingVehicle?await api('update-vehicle','POST',{...payload,id:editingVehicle.id,version:editingVehicle.version}):await api('create-vehicle','POST',payload);await loadCrm();$('vehicle-dialog').close();if(selected?.customerId===result.vehicle.customerId)renderCustomerProfile(selected);}
 catch(error){msg('vehicle-form-message',error.message);}
};
$('edit-customer-profile').onclick=()=>{if(selected?.customerId)openCustomerDialog(selected.customerId);};
$('add-vehicle-btn').onclick=()=>openVehicleDialog();
$('manual-customer-id').onchange=()=>{
 const customer=customers.find(item=>item.id===$('manual-customer-id').value);renderManualVehicleOptions();if(!customer)return;
 const form=$('add-job-form');for(const [key,value] of Object.entries({name:customer.name,phone:customer.phone,email:customer.email,address:customer.address,city:customer.city}))if(form.elements[key])form.elements[key].value=value||'';
};
$('manual-vehicle-id').onchange=()=>{
 const vehicle=vehicles.find(item=>item.id===$('manual-vehicle-id').value);if(!vehicle)return;const form=$('add-job-form');for(const [key,value] of Object.entries({year:vehicle.year,make:vehicle.make,model:vehicle.model,trim:vehicle.trim,engine:vehicle.engine,mileage:vehicle.mileage,licensePlate:vehicle.licensePlate,vin:vehicle.vin,vehicleNotes:vehicle.notes}))if(form.elements[key])form.elements[key].value=value??'';
};
$('edit-vehicle-id').onchange=()=>{
 const vehicle=vehicles.find(item=>item.id===$('edit-vehicle-id').value);if(!vehicle)return;for(const [id,value] of Object.entries({'edit-year':vehicle.year,'edit-make':vehicle.make,'edit-model':vehicle.model,'edit-trim':vehicle.trim,'edit-engine':vehicle.engine,'edit-mileage':vehicle.mileage,'edit-license-plate':vehicle.licensePlate,'job-vin-input':vehicle.vin,'edit-vehicle-notes':vehicle.notes}))$(id).value=value??'';
};
$('create-parts-request').onclick=()=>{
 if(!selected)return;const vehicle=vehicles.find(item=>item.id===selected.vehicleId);$('new-parts-requested-part').value=services[selected.service]||selected.service||'';$('new-parts-category').value=selected.service==='brakes'?'brake parts':'';$('new-parts-quantity').value='1';$('new-parts-compatibility').value=vehicle?.year&&vehicle?.make&&vehicle?.model?'unverified':'needs_vehicle_details';$('new-parts-notes').value='';msg('parts-request-create-message','');$('parts-request-dialog').showModal();
};
$('close-parts-request-dialog').onclick=()=>$('parts-request-dialog').close();
$('parts-request-create-form').onsubmit=async event=>{
 event.preventDefault();if(!selected)return;try{const result=await api('create-parts-request','POST',{jobId:selected.id,requestedPart:$('new-parts-requested-part').value,partCategory:$('new-parts-category').value,quantity:$('new-parts-quantity').value,compatibilityStatus:$('new-parts-compatibility').value,notes:$('new-parts-notes').value});await load();await loadCrm();$('parts-request-dialog').close();setSection('parts');chooseParts(result.partsRequest.id);}catch(error){msg('parts-request-create-message',error.message);}
};
$('parts-form').onsubmit=async event=>{
 event.preventDefault();if(!selectedParts)return;try{const result=await api('update-parts-request','POST',{id:selectedParts.id,version:selectedParts.version,requestedPart:$('parts-requested-part').value,partCategory:$('parts-category').value,oemPartNumber:$('parts-oem').value,aftermarketPartNumber:$('parts-aftermarket').value,quantity:$('parts-quantity').value,compatibilityStatus:$('parts-compatibility').value,status:$('parts-request-status').value,labor:$('parts-labor').value,notes:$('parts-notes').value});await loadCrm();chooseParts(result.partsRequest.id);msg('parts-save-message','Parts task saved.');}catch(error){msg('parts-save-message',error.message);}
};
$('supplier-quote-form').onsubmit=async event=>{
 event.preventDefault();if(!selectedParts)return;try{const result=await api('add-supplier-quote','POST',{id:selectedParts.id,version:selectedParts.version,supplier:$('quote-supplier').value,supplierSku:$('quote-sku').value,partNumber:$('quote-part-number').value,supplierPrice:$('quote-supplier-price').value,retailPrice:$('quote-retail-price').value,availability:$('quote-availability').value,sourceUrl:$('quote-source-url').value,notes:$('quote-notes').value});event.target.reset();await loadCrm();chooseParts(result.partsRequest.id);msg('quote-save-message','Researched supplier quote saved.');}catch(error){msg('quote-save-message',error.message);}
};
$('approve-parts-estimate').onclick=async()=>{if(!selectedParts)return;try{const result=await api('approve-parts-estimate','POST',{id:selectedParts.id,version:selectedParts.version});await loadCrm();chooseParts(result.partsRequest.id);}catch(error){msg('parts-save-message',error.message);}};
$('parts-pricing-settings-form').onsubmit=async event=>{event.preventDefault();try{const result=await api('parts-settings','POST',{markupPercent:$('parts-markup-percent').value,defaultLabor:$('parts-default-labor').value});partsSettings=result.partsSettings;renderServiceCatalog();msg('parts-settings-message','Parts estimate defaults saved.');}catch(error){msg('parts-settings-message',error.message);}};
$('add-service-catalog-item').onclick=()=>{serviceCatalog.push({id:'service-'+Date.now(),name:'New service',active:true,defaultPartsCents:null,defaultLaborCents:null});renderServiceCatalog();};
$('service-catalog-form').onsubmit=async event=>{event.preventDefault();const items=[...$('service-catalog-list').querySelectorAll('[data-catalog-id]')].map(row=>({id:row.dataset.catalogId,name:row.querySelector('[data-field="name"]').value,defaultParts:row.querySelector('[data-field="defaultParts"]').value,defaultLabor:row.querySelector('[data-field="defaultLabor"]').value,active:row.querySelector('[data-field="active"]').checked}));try{const result=await api('catalog-save','POST',{items});serviceCatalog=result.serviceCatalog;renderCatalogOptions();renderServiceCatalog();msg('service-catalog-message','Service catalog saved. Existing jobs kept their original prices.');}catch(error){msg('service-catalog-message',error.message);}};
$('communication-form').onsubmit=async e=>{e.preventDefault();if(!selected)return;try{const r=await api('message','POST',{id:selected.id,version:selected.version,channel:$('communication-type').value,text:$('communication-text').value});jobs=jobs.map(j=>j.id===r.job.id?r.job:j);choose(r.job.id);$('communication-text').value='';msg('communication-message','Conversation note saved.');}catch(err){msg('communication-message',err.message);}};
$('new-job-btn').onclick=()=>{if(dirty()){msg('save-message','Save the current dossier edits before adding another job.');return;}renderManualCustomerOptions();$('add-message').textContent='';$('add-dialog').showModal();};
$('new-customer-btn').onclick=()=>openCustomerDialog();
$('close-dialog').onclick=()=>$('add-dialog').close();
$('add-job-form').onsubmit=async event=>{
 event.preventDefault();
 const button=event.submitter;if(button)button.disabled=true;
 try{
  const data=Object.fromEntries(new FormData(event.target));
  if(data.appointmentAt)data.appointmentAt=easternISO(data.appointmentAt);
  const r=await api('create','POST',data);
  event.target.reset();$('add-dialog').close();
  setSection('jobs');await load();await loadCrm();choose(r.id,true);
 }catch(error){msg('add-message',error.message);}
 finally{if(button)button.disabled=false;}
};
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
if(!activation)api('session').then(r=>showDashboard(r.email)).catch(()=>{});

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
