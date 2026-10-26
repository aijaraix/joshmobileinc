import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import admin from '../api/admin.mjs';import booking from '../api/booking.mjs';import media from '../api/media.mjs';
import {digest} from '../lib/auth.mjs';import {jobById,putMedia,mediaPath} from '../lib/private-store.mjs';
export async function call(handler,action,body,cookie='',method='POST',origin='https://joshmobileinc.com'){
const req={method,url:'/api/admin?action='+action,query:{action},headers:{origin,'content-type':'application/json','x-vercel-forwarded-for':'192.0.2.44',...(cookie?{cookie}:{})},body};const result={status:200,headers:{},data:null};const res={setHeader(k,v){result.headers[k.toLowerCase()]=v;},status(n){result.status=n;return this;},json(v){result.data=v;return result;},write(v){result.chunks??=[];result.chunks.push(v);},end(v){result.data=v||result.data;return result;}};await handler(req,res);return result;}
export async function scenario(){
const checks=[],check=(name,fn)=>{fn();checks.push(name);};const owner='joshmobileinc@gmail.com',manager='sholom@aicreates.ai';const token=randomBytes(32).toString('hex'),managerToken=randomBytes(32).toString('hex'),password=randomBytes(24).toString('base64url');process.env.JM_SESSION_SECRET=randomBytes(48).toString('hex');process.env.JM_OWNER_INVITE_HASH=digest(token);process.env.JM_MANAGER_INVITE_HASH=digest(managerToken);process.env.JM_INVITE_EXPIRES=String(Date.now()+3600000);process.env.JM_BOOKING_ENABLED='true';
let r=await call(admin,'jobs',null,'','GET');check('Anonymous customer records blocked',()=>assert.equal(r.status,401));
r=await call(admin,'activate',{email:owner,token:'wrong',password});check('Invalid activation rejected',()=>assert.equal(r.status,401));
r=await call(admin,'activate',{email:owner,token,password},'','POST','https://attacker.example');check('Cross-site activation rejected',()=>assert.equal(r.status,403));
r=await call(admin,'activate',{email:owner,token,password});check('Owner activation creates private account',()=>assert.equal(r.status,200));const ownerCookie=r.headers['set-cookie'].split(';')[0];check('Session cookie security attributes',()=>assert.match(r.headers['set-cookie'],/Secure; HttpOnly; SameSite=Strict/));
r=await call(admin,'activate',{email:owner,token,password});check('Invitation cannot be reused',()=>assert.equal(r.status,401));
r=await call(admin,'activate',{email:manager,token:managerToken,password});check('Manager has separate account',()=>assert.equal(r.status,200));const managerCookie=r.headers['set-cookie'].split(';')[0];
r=await call(admin,'login',{email:'someone@example.com',password});check('Unapproved email rejected',()=>assert.equal(r.status,401));
r=await call(admin,'login',{email:owner,password:'incorrect-password-xxxx'});check('Wrong password rejected',()=>assert.equal(r.status,401));
r=await call(admin,'login',{email:owner,password});check('Existing staff password login works',()=>assert.equal(r.status,200));
const id=randomUUID(),date=new Date(Date.now()+3*86400000).toISOString().slice(0,10),details={service:'brakes',year:'2018',make:'Honda',model:'Accord',vin:'1HGCM82633A004352',description:'SYNTHETIC TEST ONLY: brake pad inspection.',name:'Synthetic Acceptance Customer',phone:'202-555-0142',email:'test@example.com',address:'123 Example Street',city:'North Broward',date,time:'Morning',locationType:'Come to my location',consent:true};
r=await call(booking,'',{requestId:id,details:{...details,vin:''}});check('Public intake requires VIN',()=>assert.equal(r.status,400));
const image=Buffer.from('ffd8ffe000104a46494600010201004800480000ffd9','hex');r=await call(booking,'',{requestId:id,details,attachments:[{type:'image/jpeg',size:image.length,name:'synthetic.jpg'}]});check('Public request persisted',()=>assert.equal(r.status,201));const proof=r.data.uploadToken;
r=await call(booking,'',{requestId:id,details});check('Retry does not duplicate a request',()=>assert.equal(r.status,200));
r=await call(admin,'jobs',null,managerCookie,'GET');check('Manager sees saved request',()=>assert(r.data.jobs.some(x=>x.id===id)));check('Upload permission never exposed in job list',()=>assert(!JSON.stringify(r.data).includes(proof)&&!JSON.stringify(r.data).includes('uploadHash')));
r=await call(media,'',{id,token:'wrong',index:0});check('Unauthorized media completion blocked',()=>assert.equal(r.status,403));
await putMedia(mediaPath(id,0,'image/jpeg'),image,'image/jpeg');r=await call(media,'',{id,token:proof,index:0});check('Private uploaded media attached to the correct job',()=>assert.equal(r.status,200));
let j=(await jobById(id)).value;check('Photo reference saved',()=>assert.equal(j.media.length,1));const appointmentAt=new Date(Date.now()+4*86400000).toISOString(),update={id,version:j.version,status:'confirmed',appointmentAt,durationMinutes:90,vin:j.vin,address:j.address,city:j.city,privateNotes:'Synthetic private note',partsTools:'Pads; torque wrench'};
r=await call(admin,'update',update,ownerCookie);check('Appointment confirmed and notes saved',()=>assert.equal(r.status,200));j=r.data.job;
r=await call(admin,'update',update,managerCookie);check('Stale edit rejected, not overwritten',()=>assert.equal(r.status,409));
r=await call(admin,'create',{...details,phone:'202-555-0143'},managerCookie);check('Staff can add phone/text customers',()=>assert.equal(r.status,201));const second=(await jobById(r.data.id)).value;
r=await call(admin,'update',{...update,id:second.id,version:second.version},managerCookie);check('Overlapping appointments rejected',()=>assert.equal(r.status,409));
r=await call(admin,'message',{id,version:j.version,channel:'sms',text:'Synthetic customer confirmed the appointment by text.'},ownerCookie);check('Conversation trail persisted',()=>assert.equal(r.status,200));j=r.data.job;
r=await call(admin,'jobs',null,managerCookie,'GET');check('Second administrator reads saved notes and conversation',()=>{const x=r.data.jobs.find(x=>x.id===id);assert.equal(x.privateNotes,'Synthetic private note');assert(x.timeline.some(x=>x.kind==='sms'));});
r=await call(admin,'update',{...update,version:j.version,status:'completed'},ownerCookie);check('Job marked complete',()=>assert.equal(r.status,200));
r=await call(admin,'logout',{},managerCookie);check('Logout succeeds',()=>assert.equal(r.status,200));r=await call(admin,'jobs',null,managerCookie,'GET');check('Logged-out session revoked server-side',()=>assert.equal(r.status,401));
r=await call(admin,'change-password',{oldPassword:password,newPassword:password+'new'},ownerCookie);check('Password change accepted',()=>assert.equal(r.status,200));r=await call(admin,'jobs',null,ownerCookie,'GET');check('Old sessions invalidated after password change',()=>assert.equal(r.status,401));return checks;}
