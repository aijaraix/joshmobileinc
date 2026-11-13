import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import admin from '../api/admin.mjs';import booking from '../api/booking.mjs';import media from '../api/media.mjs';
import {digest} from '../lib/auth.mjs';import {jobById,putMedia,mediaPath} from '../lib/private-store.mjs';
export async function call(handler,action,body,cookie='',method='POST',origin='https://joshmobileinc.com'){
const req={method,url:'/api/admin?action='+action,query:{action},headers:{origin,'content-type':'application/json','x-vercel-forwarded-for':'192.0.2.44',...(cookie?{cookie}:{})},body};const result={status:200,headers:{},data:null};const res={setHeader(k,v){result.headers[k.toLowerCase()]=v;},status(n){result.status=n;return this;},json(v){result.data=v;return result;},write(v){result.chunks??=[];result.chunks.push(v);},end(v){result.data=v||result.data;return result;}};await handler(req,res);return result;}
export async function scenario(){
const checks=[],check=(name,fn)=>{fn();checks.push(name);};const owner='joshmobileinc@gmail.com',manager='sholom@aicreates.ai';const token=randomBytes(32).toString('hex'),managerToken=randomBytes(32).toString('hex'),password=randomBytes(24).toString('base64url');process.env.JM_SESSION_SECRET=randomBytes(48).toString('hex');process.env.JM_OWNER_INVITE_HASH=digest(token);process.env.JM_MANAGER_INVITE_HASH=digest(managerToken);process.env.JM_INVITE_EXPIRES=String(Date.now()+3600000);process.env.JM_BOOKING_ENABLED='true';delete process.env.JM_PUSH_ENABLED;delete process.env.JM_PUSH_PUBLIC_KEY;delete process.env.JM_PUSH_PRIVATE_KEY;
let r=await call(admin,'jobs',null,'','GET');check('Anonymous customer records blocked',()=>assert.equal(r.status,401));
r=await call(admin,'activate',{email:owner,token:'wrong',password});check('Invalid activation rejected',()=>assert.equal(r.status,401));
r=await call(admin,'activate',{email:owner,token,password},'','POST','https://attacker.example');check('Cross-site activation rejected',()=>assert.equal(r.status,403));
r=await call(admin,'activate',{email:owner,token,password});check('Owner activation creates private account',()=>assert.equal(r.status,200));const ownerCookie=r.headers['set-cookie'].split(';')[0];check('Session cookie security attributes',()=>assert.match(r.headers['set-cookie'],/Secure; HttpOnly; SameSite=Strict/));
r=await call(admin,'activate',{email:owner,token,password});check('Invitation cannot be reused',()=>assert.equal(r.status,401));
r=await call(admin,'activate',{email:manager,token:managerToken,password});check('Manager has separate account',()=>assert.equal(r.status,200));const managerCookie=r.headers['set-cookie'].split(';')[0];
r=await call(admin,'login',{email:'someone@example.com',password});check('Unapproved email rejected',()=>assert.equal(r.status,401));
r=await call(admin,'login',{email:owner,password:'incorrect-password-xxxx'});check('Wrong password rejected',()=>assert.equal(r.status,401));
r=await call(admin,'login',{email:owner,password});check('Existing staff password login works',()=>assert.equal(r.status,200));
 r=await call(admin,'push-status',null,ownerCookie,'GET');check('Owner phone alerts default to inactive',()=>{assert.equal(r.data.push.enabled,false);assert.equal(r.data.push.subscriptions,0);});
 r=await call(admin,'push-status',null,managerCookie,'GET');check('Manager cannot inspect owner device subscriptions',()=>assert.equal(r.status,403));
 r=await call(admin,'push-test',{},ownerCookie);check('Push test cannot send before owner VAPID setup',()=>assert.equal(r.status,503));
const id=randomUUID(),continuationProof=randomBytes(32).toString('base64url'),date=new Date(Date.now()+3*86400000).toISOString().slice(0,10),details={service:'brakes',year:'2018',make:'Honda',model:'Accord',vin:'1HGCM82633A004352',description:'SYNTHETIC TEST ONLY: brake pad inspection.',name:'Synthetic Acceptance Customer',phone:'202-555-0142',email:'test@example.com',address:'123 Example Street',city:'North Broward',date,time:'Morning',locationType:'Come to my location',preferredContact:'text',consent:true};
r=await call(booking,'',{requestId:randomUUID(),continuationProof:randomBytes(32).toString('base64url'),details:{...details,vin:''}});check('Public VIN is required server-side',()=>assert.equal(r.status,400));
r=await call(booking,'',{requestId:randomUUID(),continuationProof:randomBytes(32).toString('base64url'),details:{...details,vin:'BADVIN'}});check('Public VIN rejects invalid characters server-side',()=>assert.equal(r.status,400));
const image=Buffer.from('ffd8ffe000104a46494600010201004800480000ffd9','hex');r=await call(booking,'',{requestId:id,continuationProof,details,attachments:[{type:'image/jpeg',size:image.length,name:'synthetic.jpg'}]});check('Public request persisted',()=>assert.equal(r.status,201));check('Short request reference assigned',()=>assert.match(r.data.reference,/^JM-[A-Z2-9]{8}$/));const proof=r.data.uploadToken;
r=await call(booking,'',{requestId:id,continuationProof,details,attachments:[{type:'image/jpeg',size:image.length,name:'synthetic.jpg'}]});check('Retry does not duplicate a request and restores upload authority',()=>assert.equal(r.status,200));const retryProof=r.data.uploadToken;
r=await call(booking,'',{requestId:id,continuationProof:randomBytes(32).toString('base64url'),details,attachments:[{type:'image/jpeg',size:image.length,name:'synthetic.jpg'}]});check('A UUID alone cannot restore upload authority',()=>assert.equal(r.status,403));
r=await call(admin,'jobs',null,managerCookie,'GET');check('Manager sees saved request',()=>assert(r.data.jobs.some(x=>x.id===id)));check('Upload permission never exposed in job list',()=>assert(!JSON.stringify(r.data).includes(proof)&&!JSON.stringify(r.data).includes('uploadHash')));
r=await call(admin,'availability',null,ownerCookie,'GET');check('Working hours are private and initially disabled',()=>assert.equal(r.data.availability.enabled,false));
const closedSchedule={enabled:true,days:[[],[],[],[],[],[],[]],blocked:[],slotMinutes:60};
r=await call(admin,'availability',closedSchedule,ownerCookie);check('Staff can save closed working hours',()=>assert.equal(r.status,200));
r=await call(booking,'',{requestId:randomUUID(),continuationProof:randomBytes(32).toString('base64url'),details});check('Public request outside configured hours rejected',()=>assert.equal(r.status,409));
r=await call(admin,'availability',{...closedSchedule,enabled:false},ownerCookie);check('Staff can restore flexible customer requests',()=>assert.equal(r.status,200));
r=await call(media,'',{id,token:'wrong',index:0});check('Unauthorized media completion blocked',()=>assert.equal(r.status,403));
r=await call(media,'',{id,token:retryProof,index:0,action:'failed',reason:'Synthetic network timeout'});check('Failed attachment is recorded without losing the saved request',()=>assert.equal(r.status,200));
let pending=(await jobById(id)).value;check('Attachment failure is visible separately from no selection',()=>assert.equal(pending.attachmentStatus.expected,1)&&assert.equal(pending.attachmentStatus.received,0)&&assert.equal(pending.attachmentStatus.failed.length,1));
await putMedia(mediaPath(id,0,'image/jpeg'),image,'image/jpeg');r=await call(media,'',{id,token:retryProof,index:0});check('Private uploaded media attached to the correct job',()=>assert.equal(r.status,200));
let j=(await jobById(id)).value;check('Photo reference and attachment receipt status saved',()=>assert.equal(j.media.length,1)&&assert.equal(j.attachmentStatus.received,1));const appointmentAt=new Date(Date.now()+4*86400000).toISOString(),update={id,version:j.version,status:'confirmed',appointmentAt,durationMinutes:90,vin:j.vin,address:j.address,city:j.city,privateNotes:'Synthetic private note',partsTools:'Pads; torque wrench'};
r=await call(admin,'update',update,ownerCookie);check('Appointment confirmed and notes saved',()=>assert.equal(r.status,200));j=r.data.job;
r=await call(admin,'update',update,managerCookie);check('Stale edit rejected, not overwritten',()=>assert.equal(r.status,409));
r=await call(admin,'create',{...details,phone:'202-555-0143'},managerCookie);check('Staff can add phone/text customers',()=>assert.equal(r.status,201));const second=(await jobById(r.data.id)).value;
r=await call(admin,'update',{...update,id:second.id,version:second.version},managerCookie);check('Overlapping appointments rejected',()=>assert.equal(r.status,409));
r=await call(admin,'message',{id,version:j.version,channel:'sms',text:'Synthetic customer confirmed the appointment by text.'},ownerCookie);check('Conversation trail persisted',()=>assert.equal(r.status,200));j=r.data.job;
r=await call(admin,'jobs',null,managerCookie,'GET');check('Second administrator reads saved notes and conversation',()=>{const x=r.data.jobs.find(x=>x.id===id);assert.equal(x.privateNotes,'Synthetic private note');assert(x.timeline.some(x=>x.kind==='sms'));});

const historicDate=new Date(Date.now()-4*86400000).toISOString();
r=await call(admin,'update',{...update,version:j.version,status:'completed',appointmentAt:historicDate},ownerCookie);check('Job marked complete',()=>assert.equal(r.status,200));
j=r.data.job;
const edited={...update,version:j.version,status:'completed',appointmentAt:historicDate,
 name:'Corrected Synthetic Customer',phone:'202-555-0194',email:'synthetic@example.com',
 year:'2017',make:'Toyota',model:'Camry',service:'Brake pads and rotors',
 description:'Historically completed brake service.',date:'2026-10-22',time:'Afternoon',
 quotedParts:'145.50',quotedLabor:'100',supplierPartsCost:'75.25',
 finalCharged:'245.50',paymentStatus:'paid'};
r=await call(admin,'update',edited,ownerCookie);
check('Staff can edit completed historical job and all customer details',()=>assert.equal(r.status,200)&&assert.equal(r.data.job.name,edited.name)&&assert.equal(r.data.job.make,'Toyota')&&assert.equal(r.data.job.appointmentAt,historicDate));
j=r.data.job;
check('Historical editing preserves identity, attachments and audit history',()=>assert(j.reference)&&j.media.length===1&&j.timeline.some(t=>t.kind==='edited'));
check('Parts/labor quote and final amount stored in cents',()=>assert.equal(j.quotedPartsCents,14550)&&assert.equal(j.quotedLaborCents,10000)&&assert.equal(j.quotedTotalCents,24550)&&assert.equal(j.finalChargedCents,24550));
r=await call(admin,'update',{...edited,version:j.version,quotedLabor:'-10'},ownerCookie);
check('Invalid negative pricing is rejected',()=>assert.equal(r.status,400));
r=await call(admin,'update',{...edited,version:j.version-1},managerCookie);
check('Stale edits to completed job rejected',()=>assert.equal(r.status,409));
r=await call(admin,'create',{name:'Synthetic Past Customer',phone:'202-555-0167',recordKind:'completed',appointmentAt:historicDate,year:'2016',make:'Honda',model:'Accord',service:'Starter replacement',quotedParts:'100.25',quotedLabor:'80',finalCharged:'180.25',paymentStatus:'unpaid'},ownerCookie);
check('Staff can add a completed past appointment without customer address',()=>assert.equal(r.status,201));
const pastEntry=(await jobById(r.data.id)).value;
check('Historical customer stores completion time and pricing',()=>assert.equal(pastEntry.status,'completed')&&pastEntry.appointmentAt===historicDate&&pastEntry.quotedTotalCents===18025);
r=await call(admin,'create',{name:'Synthetic Past Customer',phone:'202-555-0167',recordKind:'completed',appointmentAt:new Date(Date.now()+86400000).toISOString()},ownerCookie);
check('Future date cannot be entered as completed historical work',()=>assert.equal(r.status,400));
r=await call(admin,'create-customer',{name:'Synthetic Fleet Customer',phone:'202-555-0171',email:'fleet@example.test',address:'42 Fleet Lane',city:'North Broward',preferences:'Morning visits preferred',communicationInstructions:'Text before arrival',notes:'Synthetic CRM fixture.'},managerCookie);
check('Staff can create a standalone customer without a website booking',()=>assert.equal(r.status,201)&&r.data.customer.id);const standaloneCustomer=r.data.customer;
r=await call(admin,'create-customer',{name:'Duplicate Fleet Customer',phone:'202-555-0171'},managerCookie);
check('Exact customer contact duplicate is rejected',()=>assert.equal(r.status,409));
r=await call(admin,'create-vehicle',{customerId:standaloneCustomer.id,year:'2019',make:'Ford',model:'Transit',trim:'XLT',engine:'3.7L V6',mileage:'85000',licensePlate:'SYNTH1',vehicleNotes:'Synthetic fleet van; no VIN fixture.'},managerCookie);
check('Staff can add a VIN-optional vehicle to a customer',()=>assert.equal(r.status,201)&&r.data.vehicle.vin==='');const standaloneVehicle=r.data.vehicle;
r=await call(admin,'create',{customerId:standaloneCustomer.id,vehicleId:standaloneVehicle.id,recordKind:'completed',appointmentAt:historicDate,service:'Front brake replacement',description:'Synthetic historical brake repair.',partsCharge:'100.00',laborCharge:'85.00',additionalFees:'5.00',discount:'10.00',tax:'9.00',amountPaid:'189.00',paymentStatus:'paid'},managerCookie);
check('Staff can create a historical repair linked to existing customer and vehicle',()=>assert.equal(r.status,201));const crmJobId=r.data.id,crmJob=(await jobById(crmJobId)).value;
check('Historical job stores accurate cents, total and paid balance',()=>assert.equal(crmJob.finalJobTotalCents,18900)&&assert.equal(crmJob.amountPaidCents,18900)&&assert.equal(crmJob.outstandingBalanceCents,0));
r=await call(admin,'update-customer',{id:standaloneCustomer.id,version:standaloneCustomer.version,name:'Synthetic Fleet Customer Updated'},managerCookie);
const preservedHistoricalJob=(await jobById(crmJobId)).value;
check('Staff can edit a customer profile without overwriting historical job snapshot',()=>{assert.equal(r.status,200);assert.equal(r.data.customer.name,'Synthetic Fleet Customer Updated');assert.equal(preservedHistoricalJob.name,'Synthetic Fleet Customer');});const updatedCustomer=r.data.customer;
r=await call(admin,'parts-settings',{markupPercent:'25',defaultLabor:'85.00'},managerCookie);
check('Staff can configure manual parts estimate defaults',()=>assert.equal(r.status,200)&&r.data.partsSettings.markupPercent===25);
r=await call(admin,'create-parts-request',{jobId:crmJobId,requestedPart:'Front brake pads',partCategory:'brake parts',quantity:1,compatibilityStatus:'unverified',notes:'Check brake package before quote.'},managerCookie);
check('Staff can create a parts lookup task linked to job, customer and vehicle',()=>assert.equal(r.status,201)&&r.data.partsRequest.customerId===standaloneCustomer.id&&r.data.partsRequest.vehicleId===standaloneVehicle.id);let partsRecord=r.data.partsRequest;
r=await call(admin,'add-supplier-quote',{id:partsRecord.id,version:partsRecord.version,supplier:'Synthetic Parts Co.',supplierSku:'SYN-BPAD-1',partNumber:'BP-123',supplierPrice:'100.00',retailPrice:'140.00',availability:'In stock',sourceUrl:'https://supplier.example.test/product/BP-123',notes:'Synthetic manual quote.'},managerCookie);
check('Staff can save a manually researched supplier quote without a supplier integration',()=>assert.equal(r.status,200)&&r.data.partsRequest.quotes.length===1&&r.data.partsRequest.proposedEstimateCents===21000);partsRecord=r.data.partsRequest;
r=await call(admin,'update-parts-request',{id:partsRecord.id,version:partsRecord.version,compatibilityStatus:'verified_by_josh'},managerCookie);
check('Staff can record a manual compatibility verification status',()=>assert.equal(r.status,200)&&r.data.partsRequest.compatibilityStatus==='verified_by_josh');partsRecord=r.data.partsRequest;
r=await call(admin,'approve-parts-estimate',{id:partsRecord.id,version:partsRecord.version},managerCookie);
check('Manager cannot approve a parts estimate as Josh',()=>assert.equal(r.status,403));
r=await call(admin,'approve-parts-estimate',{id:partsRecord.id,version:partsRecord.version},ownerCookie);
check('Owner approval is required before manual final-price discussion',()=>assert.equal(r.status,200)&&r.data.partsRequest.approval.state==='approved_for_manual_discussion');
r=await call(admin,'crm',null,managerCookie,'GET');
check('Authorized staff can retrieve private CRM records and unauthorized visitors cannot',()=>assert(r.data.customers.some(customer=>customer.id===standaloneCustomer.id)&&r.data.vehicles.some(vehicle=>vehicle.id===standaloneVehicle.id)&&r.data.partsRequests.some(record=>record.id===partsRecord.id)));
r=await call(admin,'logout',{},managerCookie);check('Logout succeeds',()=>assert.equal(r.status,200));r=await call(admin,'jobs',null,managerCookie,'GET');check('Logged-out session revoked server-side',()=>assert.equal(r.status,401));
r=await call(admin,'change-password',{oldPassword:password,newPassword:password+'new'},ownerCookie);check('Password change accepted',()=>assert.equal(r.status,200));r=await call(admin,'jobs',null,ownerCookie,'GET');check('Old sessions invalidated after password change',()=>assert.equal(r.status,401));return checks;}
