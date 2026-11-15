import {randomUUID,randomBytes} from 'node:crypto';
import {sendTelegramTest} from '../lib/telegram.mjs';
import {ADMINS,SECRET,text,digest,same,passwordHash,verifyPassword,sign,unsign,cookie,cookieFrom,guard,body,assert,fail} from '../lib/auth.mjs';
import {
 available,readJson,writeJson,remove,account,accountPath,rate,clientIp,jobById,jobPath,allJobs,
 customerById,customerPath,allCustomers,vehicleById,vehiclePath,allVehicles,partsRequestById,
 partsRequestPath,allPartsRequests,serviceCatalogPath,partsSettingsPath,getMedia,mediaPath,
 withScheduleLock,reserveReference,releaseReference,touchJobs,jobMarker
} from '../lib/private-store.mjs';
import {settings,validateSettings,SETTINGS_PATH,enforceConfirmedSlot,confirmedConflicts} from '../lib/availability.mjs';
import {pricingFields} from '../lib/staff-pricing.mjs';
import {
 APPOINTMENT_STATUSES,customerFields,vehicleFields,jobContactSnapshot,jobVehicleSnapshot,
 customerCandidateFromJob,matchingCustomers,matchingVehicles,normalizeJobStatus,isScheduledStatus
} from '../lib/crm.mjs';
import {
 DEFAULT_PARTS_SETTINGS,partsReadiness,partsRequestFields,supplierQuoteFields,
 validatePartsSettings,proposedEstimate,categoryForService
} from '../lib/parts-workflow.mjs';
import {notifyNewRequest} from '../lib/notifications.mjs';
import {ownerPushStatus,ownerPushRequestStatus,saveOwnerPushSubscription,removeOwnerPushSubscription,sendOwnerPushTest,retryOwnerPushRequest} from '../lib/push.mjs';

const ok=(res,data={},status=200)=>res.status(status).json({ok:true,...data});
const now=()=>new Date().toISOString();
const ownerEmail=()=>ADMINS[0];
const activeStatuses=new Set(APPOINTMENT_STATUSES);
const websiteRequest=job=>job?.source!=='manual';
const DEFAULT_SERVICE_CATALOG=Object.freeze([
 {id:'brakes',name:'Brake pads & rotors',active:true,defaultPartsCents:null,defaultLaborCents:null},
 {id:'suspension',name:'Suspension',active:true,defaultPartsCents:null,defaultLaborCents:null},
 {id:'ignition',name:'Spark plugs & ignition coils',active:true,defaultPartsCents:null,defaultLaborCents:null},
 {id:'engine-filter',name:'Engine air filter',active:true,defaultPartsCents:null,defaultLaborCents:null},
 {id:'cabin-filter',name:'Cabin air filter',active:true,defaultPartsCents:null,defaultLaborCents:null},
 {id:'inspection',name:'Vehicle inspection',active:true,defaultPartsCents:null,defaultLaborCents:null},
 {id:'other',name:'Not sure / something else',active:true,defaultPartsCents:null,defaultLaborCents:null}
]);

async function startSession(email,hash,res){
 const sid=randomBytes(32).toString('hex'),exp=Date.now()+43200000;
 await writeJson(`sessions/${digest(sid)}.json`,{email,exp,version:digest(hash)});
 res.setHeader('Set-Cookie',cookie(sign({email,sid,exp})));
}
async function session(req){
 const data=unsign(cookieFrom(req));
 if(!data||!ADMINS.includes(data.email)||!/^[a-f0-9]{64}$/.test(data.sid||''))return null;
 const [stored,person]=await Promise.all([readJson(`sessions/${digest(data.sid)}.json`),account(data.email)]);
 return stored&&person&&stored.value.email===data.email&&stored.value.exp>Date.now()&&stored.value.version===digest(person.value.hash)?data:null;
}
function publicJob(job){const {uploadHash,uploadUntil,continuationHash,intakeHash,...safe}=job;return safe;}
const activity=(who,kind,message)=>({id:randomUUID(),at:now(),by:who,kind,text:message});
const field=(source,key,max,prior='')=>Object.hasOwn(source,key)?text(source[key],max):prior;
const copyVehicle=vehicle=>vehicle?{year:vehicle.year||'',make:vehicle.make||'',model:vehicle.model||'',trim:vehicle.trim||'',engine:vehicle.engine||'',vin:vehicle.vin||'',mileage:vehicle.mileage??null,licensePlate:vehicle.licensePlate||'',vehicleNotes:vehicle.notes||''}:{};
const dateValue=value=>{const parsed=Date.parse(String(value||''));assert(Number.isFinite(parsed),'Use a valid appointment date and time.',400);return new Date(parsed).toISOString();};
const requiresFutureSlot=status=>activeStatuses.has(status);

function normalizeCatalogItem(input={},prior={}){
 const id=text(input.id===undefined?prior.id||'':input.id,80).toLowerCase().replace(/[^a-z0-9_-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
 assert(id,'Service catalog ID is required.',400);
 const name=text(input.name===undefined?prior.name||'':input.name,100);assert(name,'Enter a service name.',400);
 const parse=(key,stored)=>{const raw=input[key]===undefined?(prior[stored]===null||prior[stored]===undefined?'':(prior[stored]/100).toFixed(2)):input[key];if(raw===''||raw===null)return null;assert(/^\d{1,7}(?:\.\d{1,2})?$/.test(String(raw).trim()),`${key} must be a nonnegative dollar amount with up to two decimals.`,400);return Math.round(Number(raw)*100);};
 return {id,name,active:input.active===undefined?prior.active!==false:Boolean(input.active),defaultPartsCents:parse('defaultParts','defaultPartsCents'),defaultLaborCents:parse('defaultLabor','defaultLaborCents')};
}
async function catalog(){const row=await readJson(serviceCatalogPath),input=Array.isArray(row?.value?.items)?row.value.items:DEFAULT_SERVICE_CATALOG;return input.map(item=>normalizeCatalogItem(item,item));}
async function saveCatalog(items,user){
 assert(Array.isArray(items)&&items.length>0&&items.length<=100,'Save between 1 and 100 services.',400);
 const normalized=items.map(item=>normalizeCatalogItem(item,item));assert(new Set(normalized.map(item=>item.id)).size===normalized.length,'Each service catalog ID must be unique.',400);
 const previous=await readJson(serviceCatalogPath),value={items:normalized,updatedAt:now(),updatedBy:user};await writeJson(serviceCatalogPath,value,previous?.etag);await touchJobs('service-catalog');return value.items;
}
async function partsSettings(){const row=await readJson(partsSettingsPath);return {...DEFAULT_PARTS_SETTINGS,...(row?.value||{})};}
async function savePartsSettings(input,user){const row=await readJson(partsSettingsPath),next={...validatePartsSettings(input,row?.value||DEFAULT_PARTS_SETTINGS),updatedAt:now(),updatedBy:user};await writeJson(partsSettingsPath,next,row?.etag);await touchJobs('parts-pricing-settings');return next;}

async function createCustomer(input,user){
 const fields=customerFields(input),matches=matchingCustomers(await allCustomers(),fields);assert(!matches.length,'A customer with this exact phone number or email already exists. Open that customer instead of creating a duplicate.',409);
 const stamp=now(),record={id:randomUUID(),createdAt:stamp,updatedAt:stamp,version:1,...fields,timeline:[activity(user,'created','Customer record created by staff.')]};await writeJson(customerPath(record.id),record);await touchJobs('customer-created');return record;
}
async function resolveCustomer(input,user,{existingId='',fallback={}}={}){
 const requested=text(input.customerId===undefined?existingId:input.customerId,80);
 if(requested){const row=await customerById(requested);assert(row,'Customer not found.',404);assert(row.value.status!=='archived','Restore the customer before assigning new work.',409);return row.value;}
 const candidate=customerFields({
  name:input.name===undefined?fallback.name:input.name,phone:input.phone===undefined?fallback.phone:input.phone,
  email:input.email===undefined?fallback.email:input.email,address:input.address===undefined?fallback.address:input.address,
  city:input.city===undefined?fallback.city:input.city
 }),matches=matchingCustomers(await allCustomers(),candidate);
 if(matches.length===1)return matches[0];assert(matches.length===0,'More than one matching customer exists. Choose the exact customer before linking this job.',409);return createCustomer(candidate,user);
}
async function updateCustomer(input,user){
 const row=await customerById(input.id);assert(row,'Customer not found.',404);const old=row.value;assert(Number(input.version)===old.version,'This customer changed. Refresh and try again.',409);
 const fields=customerFields(input,old),matches=matchingCustomers(await allCustomers(),fields,old.id);assert(!matches.length,'Another active customer has this exact phone number or email. Review that record instead of creating a duplicate.',409);
 const changed=Object.keys(fields).filter(key=>String(fields[key]??'')!==String(old[key]??'')),next={...old,...fields,version:old.version+1,updatedAt:now(),updatedBy:user,timeline:[...(old.timeline||[]),...(changed.length?[activity(user,'edited','Updated customer profile: '+changed.join(', '))]:[])]};await writeJson(customerPath(next.id),next,row.etag);await touchJobs('customer-updated');return next;
}
async function archiveCustomer(input,user){
 const row=await customerById(input.id);assert(row,'Customer not found.',404);const old=row.value;assert(Number(input.version)===old.version,'This customer changed. Refresh and try again.',409);
 const next={...old,status:'archived',version:old.version+1,updatedAt:now(),updatedBy:user,timeline:[...(old.timeline||[]),activity(user,'archived','Customer archived; job history was retained.')]};await writeJson(customerPath(next.id),next,row.etag);await touchJobs('customer-archived');return next;
}
async function createVehicle(input,user){
 const customer=await customerById(input.customerId);assert(customer,'Customer not found.',404);assert(customer.value.status!=='archived','Restore the customer before adding a vehicle.',409);
 const fields=vehicleFields(input,{},true),matches=matchingVehicles(await allVehicles(),customer.value.id,fields);assert(!matches.length,'This customer already has a vehicle with that VIN or license plate.',409);
 const stamp=now(),record={id:randomUUID(),customerId:customer.value.id,createdAt:stamp,updatedAt:stamp,version:1,...fields,timeline:[activity(user,'created','Vehicle added by staff.')]};await writeJson(vehiclePath(record.id),record);await touchJobs('vehicle-created');return record;
}
async function updateVehicle(input,user){
 const row=await vehicleById(input.id);assert(row,'Vehicle not found.',404);const old=row.value;assert(Number(input.version)===old.version,'This vehicle changed. Refresh and try again.',409);
 const fields=vehicleFields(input,old,true),matches=matchingVehicles(await allVehicles(),old.customerId,fields).filter(item=>item.id!==old.id);assert(!matches.length,'This customer already has a vehicle with that VIN or license plate.',409);
 const changed=Object.keys(fields).filter(key=>String(fields[key]??'')!==String(old[key]??'')),next={...old,...fields,version:old.version+1,updatedAt:now(),updatedBy:user,timeline:[...(old.timeline||[]),...(changed.length?[activity(user,'edited','Updated vehicle: '+changed.join(', '))]:[])]};await writeJson(vehiclePath(next.id),next,row.etag);await touchJobs('vehicle-updated');return next;
}
async function resolveVehicle(input,user,customer,{existingId='',fallback={}}={}){
 const requested=text(input.vehicleId===undefined?existingId:input.vehicleId,80);
 if(requested){const row=await vehicleById(requested);assert(row,'Vehicle not found.',404);assert(row.value.customerId===customer.id,'This vehicle belongs to another customer.',409);return row.value;}
 const fields=vehicleFields({...fallback,...input},{},false);if(!fields.vin&&!fields.year&&!fields.make&&!fields.model&&!fields.licensePlate)return null;
 const matches=matchingVehicles(await allVehicles(),customer.id,fields);if(matches.length===1)return matches[0];assert(matches.length===0,'More than one matching vehicle exists. Choose the exact vehicle before linking this job.',409);
 const stamp=now(),record={id:randomUUID(),customerId:customer.id,createdAt:stamp,updatedAt:stamp,version:1,...vehicleFields({...fallback,...input},{},true),timeline:[activity(user,'created','Vehicle added while linking a job.')]};await writeJson(vehiclePath(record.id),record);return record;
}

function manualJob(input,user,customer,vehicle){
 const stamp=now(),status=input.recordKind==='completed'?'completed':normalizeJobStatus(input.status||'requested'),rawAt=String(input.appointmentAt||'').trim();
 const contact=jobContactSnapshot({...customer,...input},customer),snapshot=jobVehicleSnapshot({...copyVehicle(vehicle),...input},vehicle||{}),duration=Number(input.durationMinutes||60);assert(Number.isInteger(duration)&&duration>=30&&duration<=480,'Duration must be 30–480 minutes.',400);
 let appointmentAt=rawAt?dateValue(rawAt):'';
 if(requiresFutureSlot(status)){assert(appointmentAt&&Date.parse(appointmentAt)>Date.now(),'Choose a future appointment date and time.',400);assert(text(input.address,240)||customer.address,'Address is required before scheduling an appointment.',400);assert(text(input.city,100)||customer.city,'City is required before scheduling an appointment.',400);}
 if(status==='completed')assert(!appointmentAt||Date.parse(appointmentAt)<=Date.now(),'A completed historical job must have a past appointment.',400);if(status==='requested')appointmentAt='';
 return {id:randomUUID(),createdAt:stamp,updatedAt:stamp,version:1,source:'manual',status,customerId:customer.id,vehicleId:vehicle?.id||'',...contact,...snapshot,service:text(input.service,100),description:text(input.description,1800),address:text(input.address,240)||customer.address||'',city:text(input.city,100)||customer.city||'',date:text(input.date,10),time:text(input.time,40),locationType:text(input.locationType,80)||'Come to my location',appointmentAt,durationMinutes:duration,privateNotes:text(input.privateNotes,6000),partsTools:text(input.partsTools,4000),...pricingFields(input),media:[],attachments:[],attachmentStatus:{expected:0,received:0,failed:[]},notification:{state:'manual',eventId:''},timeline:[activity(user,'created',status==='completed'?'Historical completed job entered by staff.':'Customer/job entered by staff.')],updatedBy:user};
}
function escapeICS(value){return String(value||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/[,;]/g,'\\$&').replace(/\r/g,'');}
function calendar(job){
 assert(activeStatuses.has(job.status)&&job.appointmentAt,'Only scheduled or confirmed appointments can be added to a calendar.');const stamp=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Josh Mobile//Appointments//EN','BEGIN:VEVENT',`UID:${job.id}@joshmobileinc.com`,`DTSTAMP:${stamp(Date.now())}`,`DTSTART:${stamp(job.appointmentAt)}`,`DTEND:${stamp(Date.parse(job.appointmentAt)+(job.durationMinutes||60)*60000)}`,`SUMMARY:${escapeICS('Josh Mobile: '+job.name+' — '+job.service)}`,`LOCATION:${escapeICS(job.address+', '+job.city)}`,`DESCRIPTION:${escapeICS([job.year,job.make,job.model,job.trim,job.engine].filter(Boolean).join(' ')+'\n'+job.description+'\nParts/tools: '+job.partsTools)}`,'BEGIN:VALARM','TRIGGER:-PT24H','ACTION:DISPLAY','DESCRIPTION:Josh Mobile appointment tomorrow','END:VALARM','BEGIN:VALARM','TRIGGER:-PT1H','ACTION:DISPLAY','DESCRIPTION:Josh Mobile appointment in one hour','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
}
async function ensureJobRelations(row,user){
 const old=row.value,customer=await resolveCustomer({},user,{existingId:old.customerId||'',fallback:customerCandidateFromJob(old)}),vehicle=await resolveVehicle({},user,customer,{existingId:old.vehicleId||'',fallback:old});
 if(old.customerId===customer.id&&(old.vehicleId||'')===(vehicle?.id||''))return {job:old,customer,vehicle};
 const next={...old,customerId:customer.id,vehicleId:vehicle?.id||'',version:old.version+1,updatedAt:now(),updatedBy:user,timeline:[...(old.timeline||[]),activity(user,'linked','Linked this job to the customer and vehicle records.')]};await writeJson(jobPath(next.id),next,row.etag);await touchJobs('job-linked');return {job:next,customer,vehicle};
}
async function updateJob(input,user){
 const row=await jobById(input.id);assert(row,'Job not found.',404);const old=row.value;assert(!old.deletedAt,'Restore this lead from Trash before editing it.',409);assert(Number(input.version)===old.version,'This job changed in another window. Refresh before saving.',409);
 const status=normalizeJobStatus(input.status,old.status),duration=Number(input.durationMinutes===undefined?old.durationMinutes||60:input.durationMinutes);assert(Number.isInteger(duration)&&duration>=30&&duration<=480,'Duration must be 30–480 minutes.',400);
 const contact=jobContactSnapshot(input,old),vehicle=jobVehicleSnapshot(input,old),at=Object.hasOwn(input,'appointmentAt')?String(input.appointmentAt||''):old.appointmentAt||'';let appointmentAt=at?dateValue(at):'';
 const next={...old,...contact,...vehicle,status,durationMinutes:duration,service:field(input,'service',100,old.service||''),description:field(input,'description',1800,old.description||''),date:field(input,'date',10,old.date||''),time:field(input,'time',40,old.time||''),address:field(input,'address',240,old.address||''),city:field(input,'city',100,old.city||''),privateNotes:field(input,'privateNotes',6000,old.privateNotes||''),partsTools:field(input,'partsTools',4000,old.partsTools||''),...pricingFields(input,old),version:old.version+1,updatedAt:now(),updatedBy:user,timeline:[...(old.timeline||[])]};
 if(requiresFutureSlot(status)){
  assert(next.address&&next.city,'Address and city are required before scheduling an appointment.',400);assert(appointmentAt&&Date.parse(appointmentAt)>Date.now()&&Date.parse(appointmentAt)<Date.now()+365*86400000,'Choose a future appointment within one year.',400);
  const changed=!activeStatuses.has(old.status)||old.appointmentAt!==appointmentAt||old.durationMinutes!==duration;if(changed)await enforceConfirmedSlot(appointmentAt,duration,next.id);
  if(changed){const end=Date.parse(appointmentAt)+duration*60000,others=await allJobs();assert(!others.some(item=>item.id!==next.id&&activeStatuses.has(item.status)&&Date.parse(item.appointmentAt)<end&&Date.parse(item.appointmentAt)+(item.durationMinutes||60)*60000>Date.parse(appointmentAt)),'This appointment overlaps another scheduled job.',409);}
 }else if(status==='completed')assert(!appointmentAt||Date.parse(appointmentAt)<=Date.now(),'A completed job must have a past appointment.',400);else if(status==='requested')appointmentAt='';
 next.appointmentAt=appointmentAt;
 const customer=await resolveCustomer(input,user,{existingId:input.customerId===undefined?old.customerId||'':input.customerId,fallback:next}),linkedVehicle=await resolveVehicle(input,user,customer,{existingId:input.vehicleId===undefined?old.vehicleId||'':input.vehicleId,fallback:next});next.customerId=customer.id;next.vehicleId=linkedVehicle?.id||'';
 const changedFields=['name','phone','email','year','make','model','trim','engine','mileage','licensePlate','vin','service','description','address','city','appointmentAt','status','quotedPartsCents','quotedLaborCents','partsChargeCents','laborChargeCents','additionalFeesCents','discountCents','taxCents','finalChargedCents','amountPaidCents','paymentStatus'].filter(key=>String(old[key]??'')!==String(next[key]??''));
 if(changedFields.length)next.timeline.push(activity(user,'edited','Updated customer, vehicle, appointment or pricing: '+changedFields.join(', ')));if(old.status!==next.status||old.appointmentAt!==next.appointmentAt)next.timeline.push(activity(user,'status',`Status: ${next.status}${next.appointmentAt?' · '+next.appointmentAt:''}`));assert(next.timeline.length<=1000,'Conversation history capacity reached; contact your administrator.',409);await writeJson(jobPath(next.id),next,row.etag);await touchJobs('updated');return next;
}
async function addMessage(input,user){
 const row=await jobById(input.id);assert(row,'Job not found.',404);const old=row.value;assert(!old.deletedAt,'Restore this lead from Trash before editing it.',409);assert(Number(input.version)===old.version,'This job changed in another window. Refresh before saving.',409);const note=text(input.text,2000);assert(note,'Enter what was discussed.',400);assert(['sms','whatsapp','call','note'].includes(input.channel),'Choose a communication type.',400);
 const next={...old,version:old.version+1,updatedAt:now(),updatedBy:user,timeline:[...(old.timeline||[]),activity(user,input.channel,note)]};assert(next.timeline.length<=1000,'Conversation history capacity reached; contact your administrator.',409);await writeJson(jobPath(next.id),next,row.etag);await touchJobs('message');return next;
}
async function createPartsRequest(input,user){
 const jobRow=await jobById(input.jobId);assert(jobRow,'Choose an existing customer job before creating a parts request.',404);const linked=await ensureJobRelations(jobRow,user);assert(linked.vehicle,'Add the customer vehicle before creating a parts request.',409);
 const readiness=partsReadiness({service:linked.job.service,vehicle:linked.vehicle}),base=partsRequestFields({...input,partCategory:input.partCategory||categoryForService(linked.job.service),compatibilityStatus:input.compatibilityStatus||readiness.compatibilityStatus},{status:'lookup_needed',quantity:1,compatibilityStatus:readiness.compatibilityStatus});assert(base.requestedPart||linked.job.service,'Describe the part or service being researched.',400);
 const stamp=now(),record={id:randomUUID(),customerId:linked.customer.id,vehicleId:linked.vehicle.id,jobId:linked.job.id,createdAt:stamp,updatedAt:stamp,version:1,...base,workflow:{...readiness,createdAt:stamp},quotes:[],selectedQuoteId:'',proposedEstimateCents:null,approval:{state:'requires_owner_approval',approvedAt:'',approvedBy:''},timeline:[activity(user,'created','Parts lookup task created. No supplier was contacted.')]};await writeJson(partsRequestPath(record.id),record);await touchJobs('parts-request-created');return record;
}
async function updatePartsRequest(input,user){
 const row=await partsRequestById(input.id);assert(row,'Parts request not found.',404);const old=row.value;assert(Number(input.version)===old.version,'This parts request changed. Refresh and try again.',409);const vehicle=await vehicleById(old.vehicleId);assert(vehicle,'The linked vehicle is no longer available.',409);const job=await jobById(old.jobId),readiness=partsReadiness({service:job?.value?.service||old.requestedPart,vehicle:vehicle.value}),fields=partsRequestFields(input,old),selected=(old.quotes||[]).find(quote=>quote.id===old.selectedQuoteId)||{};
 const next={...old,...fields,workflow:{...readiness,updatedAt:now()},proposedEstimateCents:proposedEstimate(selected,await partsSettings(),fields),version:old.version+1,updatedAt:now(),updatedBy:user,timeline:[...(old.timeline||[]),activity(user,'edited','Updated parts lookup details.')]};await writeJson(partsRequestPath(next.id),next,row.etag);await touchJobs('parts-request-updated');return next;
}
async function addSupplierQuote(input,user){
 const row=await partsRequestById(input.id);assert(row,'Parts request not found.',404);const old=row.value;assert(Number(input.version)===old.version,'This parts request changed. Refresh and try again.',409);const quote={id:randomUUID(),...supplierQuoteFields(input),checkedAt:now(),enteredBy:user},quotes=[...(old.quotes||[]),quote].slice(-40),settings=await partsSettings();
 const next={...old,quotes,selectedQuoteId:quote.id,status:['draft','lookup_needed','researching'].includes(old.status)?'quoted':old.status,proposedEstimateCents:proposedEstimate(quote,settings,old),approval:{state:'requires_owner_approval',approvedAt:'',approvedBy:''},version:old.version+1,updatedAt:now(),updatedBy:user,timeline:[...(old.timeline||[]),activity(user,'supplier_quote','Manual supplier quote recorded. Verify fitment before communicating a price.')]};await writeJson(partsRequestPath(next.id),next,row.etag);await touchJobs('supplier-quote-recorded');return next;
}
async function approvePartsEstimate(input,user){
 assert(user===ownerEmail(),'Only the owner can approve a parts estimate for manual customer discussion.',403);const row=await partsRequestById(input.id);assert(row,'Parts request not found.',404);const old=row.value;assert(Number(input.version)===old.version,'This parts request changed. Refresh and try again.',409);assert(old.compatibilityStatus==='verified_by_josh','Verify compatibility before approving an estimate.',409);assert(Number.isSafeInteger(old.proposedEstimateCents),'Record a real supplier price and configure markup/labor before approving an estimate.',409);
 const next={...old,status:'approved',approval:{state:'approved_for_manual_discussion',approvedAt:now(),approvedBy:user},version:old.version+1,updatedAt:now(),updatedBy:user,timeline:[...(old.timeline||[]),activity(user,'approved','Owner approved this estimate for manual discussion. No message was sent.')]};await writeJson(partsRequestPath(next.id),next,row.etag);await touchJobs('parts-estimate-approved');return next;
}

export default async function handler(req,res){try{
 guard(req,res);assert(available()&&SECRET().length>=40,'Staff sign-in is temporarily unavailable.',503);const action=String(req.query?.action||'');
 if(req.method==='POST'&&['login','activate'].includes(action)){
  const input=body(req),email=text(input.email,180).toLowerCase();await rate('auth-ip:'+clientIp(req),30);await rate('auth-email:'+email,12);assert(ADMINS.includes(email),'Email or credentials were not accepted.',401);const person=await account(email);
  if(action==='activate'){const role=email===ADMINS[0]?'OWNER':'MANAGER',expiry=Number(process.env.JM_INVITE_EXPIRES||0);assert(!person&&expiry>Date.now()&&same(digest(text(input.token,160)),process.env[`JM_${role}_INVITE_HASH`]||''),'This activation link is invalid, expired, or already used. Sign in or contact your site administrator.',401);assert(typeof input.password==='string'&&input.password.length>=12&&input.password.length<=128,'Choose a password of 12–128 characters.',400);const hash=await passwordHash(input.password);await writeJson(accountPath(email),{hash,createdAt:now(),changedAt:now()});await startSession(email,hash,res);return ok(res,{email});}
  assert(person&&await verifyPassword(input.password,person.value.hash),'Email or password was not accepted.',401);await startSession(email,person.value.hash,res);return ok(res,{email});
 }
 const user=await session(req);assert(user,'Sign in to view this private workspace.',401);
 if(req.method==='GET'&&action==='session')return ok(res,{email:user.email});
 if(req.method==='GET'&&action==='jobs'){const [jobs,marker]=await Promise.all([allJobs(),jobMarker()]);return ok(res,{jobs:jobs.map(publicJob),marker});}
 if(req.method==='GET'&&action==='crm'){const [customers,vehicles,partsRequests,items,pricing]=await Promise.all([allCustomers(),allVehicles(),allPartsRequests(),catalog(),partsSettings()]);return ok(res,{customers,vehicles,partsRequests,serviceCatalog:items,partsSettings:pricing});}
 if(req.method==='GET'&&action==='changes')return ok(res,{marker:await jobMarker()});
 if(req.method==='GET'&&action==='availability')return ok(res,{availability:await settings()});
 if(req.method==='GET'&&action==='push-status'){assert(user.email===ownerEmail(),'Owner access required.',403);return ok(res,{push:await ownerPushStatus()});}
 if(req.method==='GET'&&action==='push-request-status'){assert(user.email===ownerEmail(),'Owner access required.',403);return ok(res,{push:await ownerPushRequestStatus(req.query?.id)});}
 if(req.method==='GET'&&['file','calendar'].includes(action)){
  const record=await jobById(req.query?.id);assert(record,'Not found.',404);if(action==='calendar'){res.setHeader('Content-Type','text/calendar; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="josh-mobile-appointment.ics"');return res.status(200).end(calendar(record.value));}
  const index=Number(req.query?.index),media=Number.isInteger(index)&&index>=0&&index<6?record.value.media?.find(item=>item.index===index):null;assert(media,'Not found.',404);const file=await getMedia(media.path);assert(file,'Not found.',404);res.setHeader('Content-Type',media.type);res.setHeader('Content-Disposition','inline');res.status(200);for await(const chunk of file.stream)res.write(Buffer.from(chunk));return res.end();
 }
 assert(req.method==='POST','Method not allowed.',405);const input=body(req);
 if(action==='telegram-test'){assert(user.email===ownerEmail(),'Owner access required.',403);await rate('telegram-test:'+user.email,3,3600000);return ok(res,{telegram:await sendTelegramTest()});}
 if(action==='push-subscribe'){assert(user.email===ownerEmail(),'Owner access required.',403);return ok(res,{push:await saveOwnerPushSubscription(input.subscription)});}
 if(action==='push-unsubscribe'){assert(user.email===ownerEmail(),'Owner access required.',403);return ok(res,{push:await removeOwnerPushSubscription(input.subscription)});}
 if(action==='push-test'){assert(user.email===ownerEmail(),'Owner access required.',403);return ok(res,{result:await sendOwnerPushTest()});}
 if(action==='push-retry'){assert(user.email===ownerEmail(),'Owner access required.',403);return ok(res,{result:await retryOwnerPushRequest(input.id)});}
 if(action==='logout'){await remove(`sessions/${digest(user.sid)}.json`);res.setHeader('Set-Cookie',cookie('',0));return ok(res);}
 if(action==='change-password'){await rate('password:'+user.email,6);const person=await account(user.email);assert(await verifyPassword(input.oldPassword,person.value.hash),'Current password was not accepted.',400);assert(typeof input.newPassword==='string'&&input.newPassword.length>=12&&input.newPassword.length<=128,'Choose a password of 12–128 characters.',400);assert(input.newPassword!==input.oldPassword,'Use a different password.',400);const hash=await passwordHash(input.newPassword);await writeJson(accountPath(user.email),{...person.value,hash,changedAt:now()},person.etag);res.setHeader('Set-Cookie',cookie('',0));return ok(res,{signOut:true});}
 if(action==='availability'){const next=validateSettings(input),saved=await withScheduleLock(async()=>{const old=await readJson(SETTINGS_PATH);await writeJson(SETTINGS_PATH,next,old?.etag);return next;});return ok(res,{availability:saved,conflicts:await confirmedConflicts(saved)});}
 if(action==='create-customer')return ok(res,{customer:await withScheduleLock(()=>createCustomer(input,user.email))},201);
 if(action==='update-customer')return ok(res,{customer:await withScheduleLock(()=>updateCustomer(input,user.email))});
 if(action==='archive-customer')return ok(res,{customer:await withScheduleLock(()=>archiveCustomer(input,user.email))});
 if(action==='create-vehicle')return ok(res,{vehicle:await withScheduleLock(()=>createVehicle(input,user.email))},201);
 if(action==='update-vehicle')return ok(res,{vehicle:await withScheduleLock(()=>updateVehicle(input,user.email))});
 if(action==='catalog-save')return ok(res,{serviceCatalog:await withScheduleLock(()=>saveCatalog(input.items,user.email))});
 if(action==='parts-settings')return ok(res,{partsSettings:await withScheduleLock(()=>savePartsSettings(input,user.email))});
 if(action==='create-parts-request')return ok(res,{partsRequest:await withScheduleLock(()=>createPartsRequest(input,user.email))},201);
 if(action==='update-parts-request')return ok(res,{partsRequest:await withScheduleLock(()=>updatePartsRequest(input,user.email))});
 if(action==='add-supplier-quote')return ok(res,{partsRequest:await withScheduleLock(()=>addSupplierQuote(input,user.email))});
 if(action==='approve-parts-estimate')return ok(res,{partsRequest:await withScheduleLock(()=>approvePartsEstimate(input,user.email))});
 if(action==='create')return await withScheduleLock(async()=>{const customer=await resolveCustomer(input,user.email,{fallback:input}),vehicle=await resolveVehicle(input,user.email,customer,{fallback:input}),job=manualJob(input,user.email,customer,vehicle),reference=await reserveReference(job.id);job.reference=reference;try{await writeJson(jobPath(job.id),job);}catch(error){await releaseReference(reference,job.id).catch(()=>{});throw error;}await touchJobs('created');return ok(res,{id:job.id,reference,job:publicJob(job)},201);});
 if(action==='retry-notification'){assert(typeof input.id==='string','Choose a request.',400);return ok(res,{notification:await notifyNewRequest(input.id)});}
 if(['trash','restore','purge'].includes(action))return await withScheduleLock(async()=>{
  assert(user.email===ownerEmail(),'Owner access required.',403);assert(typeof input.id==='string'&&typeof input.confirmReference==='string','Choose a lead and confirm its reference.',400);const record=await jobById(input.id);assert(record,'Lead not found.',404);const old=record.value;assert(websiteRequest(old),'Only website service requests can be moved to Trash.',409);assert(Number(input.version)===old.version,'This lead changed. Refresh and try again.',409);assert(input.confirmReference===(old.reference||old.id),'Lead reference does not match.',400);assert(['requested','cancelled'].includes(old.status),'Only unconfirmed or cancelled leads can be deleted. Cancel a scheduled appointment first.',409);
  if(action==='trash'){assert(!old.deletedAt,'This lead is already in Trash.',409);const at=now(),job={...old,version:old.version+1,updatedAt:at,deletedAt:at,deletedBy:user.email,timeline:[...(old.timeline||[]),activity(user.email,'trash','Lead moved to Trash by staff.')]};await writeJson(jobPath(job.id),job,record.etag);await touchJobs('trash');return ok(res,{id:job.id,job:publicJob(job)});}
  assert(old.deletedAt,'Move this lead to Trash first.',409);if(action==='restore'){assert(!old.purgePendingAt,'A permanent deletion was started; this record cannot be restored.',409);const job={...old,version:old.version+1,updatedAt:now(),deletedAt:'',deletedBy:'',timeline:[...(old.timeline||[]),activity(user.email,'restore','Lead restored from Trash.')]};await writeJson(jobPath(job.id),job,record.etag);await touchJobs('restore');return ok(res,{id:job.id,job:publicJob(job)});}
  assert(input.confirmText==='DELETE','Type DELETE to confirm permanent deletion.',400);await rate('purge-lead:'+user.email,6,3600000);let job=old;if(!old.purgePendingAt){job={...old,version:old.version+1,updatedAt:now(),purgePendingAt:now(),purgeBy:user.email};await writeJson(jobPath(job.id),job,record.etag);}const paths=new Set();for(const file of [...(job.attachments||[]),...(job.media||[])])if(Number.isInteger(file.index)&&file.type)paths.add(mediaPath(job.id,file.index,file.type));for(const path of paths)await remove(path);await remove(jobPath(job.id));if(job.reference)await releaseReference(job.reference,job.id);await touchJobs('purge');return ok(res,{id:job.id,deleted:true,mediaRemoved:paths.size});
 });
 if(action==='message')return ok(res,{id:input.id,job:publicJob(await withScheduleLock(()=>addMessage(input,user.email)))});
 if(action==='update')return ok(res,{id:input.id,job:publicJob(await withScheduleLock(()=>updateJob(input,user.email)))});
 assert(false,'Unknown action.',400);
}catch(error){return fail(res,error);}}
