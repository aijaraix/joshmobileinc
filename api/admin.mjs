import {randomUUID,randomBytes} from 'node:crypto';
import {ADMINS,SECRET,text,digest,same,validVin,passwordHash,verifyPassword,sign,unsign,cookie,cookieFrom,guard,body,assert,fail} from '../lib/auth.mjs';
import {available,readJson,writeJson,remove,account,accountPath,rate,clientIp,jobById,jobPath,allJobs,getMedia,withScheduleLock,reserveReference,releaseReference,touchJobs,jobMarker} from '../lib/private-store.mjs';
import {settings,validateSettings,SETTINGS_PATH,enforceConfirmedSlot,confirmedConflicts} from '../lib/availability.mjs';
import {normalizePhone} from '../lib/request.mjs';
import {notifyNewRequest} from '../lib/notifications.mjs';
const ok=(res,data={},status=200)=>res.status(status).json({ok:true,...data});
const now=()=>new Date().toISOString();
async function startSession(email,hash,res){const sid=randomBytes(32).toString('hex'),exp=Date.now()+43200000;await writeJson(`sessions/${digest(sid)}.json`,{email,exp,version:digest(hash)});res.setHeader('Set-Cookie',cookie(sign({email,sid,exp})));}
async function session(req){const d=unsign(cookieFrom(req));if(!d||!ADMINS.includes(d.email)||!/^[a-f0-9]{64}$/.test(d.sid||''))return null;const [s,a]=await Promise.all([readJson(`sessions/${digest(d.sid)}.json`),account(d.email)]);return s&&a&&s.value.email===d.email&&s.value.exp>Date.now()&&s.value.version===digest(a.value.hash)?d:null;}
function publicJob(j){const {uploadHash,uploadUntil,continuationHash,intakeHash,...safe}=j;return safe;}
const activity=(who,kind,message)=>({id:randomUUID(),at:now(),by:who,kind,text:message});
function normalizeManual(b,owner){const id=randomUUID();const j={id,createdAt:now(),updatedAt:now(),version:1,source:'manual',status:'requested',name:text(b.name,90),phone:text(b.phone,30),normalizedPhone:normalizePhone(b.phone),email:text(b.email,160),preferredContact:'text',year:text(b.year,4),make:text(b.make,60),model:text(b.model,80),vin:text(b.vin,17).toUpperCase(),service:text(b.service,100),description:text(b.description,1800),address:text(b.address,240),city:text(b.city,100),date:text(b.date,10),time:text(b.time,40),locationType:'Come to my location',appointmentAt:'',durationMinutes:60,privateNotes:'',partsTools:'',media:[],attachments:[],attachmentStatus:{expected:0,received:0,failed:[]},notification:{state:'manual',eventId:''},timeline:[activity(owner,'created','Job added by staff')],updatedBy:owner};assert(j.name&&j.phone.replace(/\D/g,'').length>=10&&j.address&&j.city,'Customer name, phone, address and city are required.');assert(!j.vin||validVin(j.vin),'VIN must contain 17 characters, excluding I, O and Q.');return j;}
function escapeICS(s){return String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/[,;]/g,'\\$&').replace(/\r/g,'');}
function calendar(j){assert(j.status==='confirmed'&&j.appointmentAt,'Only confirmed appointments can be added to a calendar.');const stamp=v=>new Date(v).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Josh Mobile//Appointments//EN','BEGIN:VEVENT',`UID:${j.id}@joshmobileinc.com`,`DTSTAMP:${stamp(Date.now())}`,`DTSTART:${stamp(j.appointmentAt)}`,`DTEND:${stamp(Date.parse(j.appointmentAt)+(j.durationMinutes||60)*60000)}`,`SUMMARY:${escapeICS('Josh Mobile: '+j.name+' — '+j.service)}`,`LOCATION:${escapeICS(j.address+', '+j.city)}`,`DESCRIPTION:${escapeICS([j.year,j.make,j.model].join(' ')+'\n'+j.description+'\nParts/tools: '+j.partsTools)}`,'BEGIN:VALARM','TRIGGER:-PT24H','ACTION:DISPLAY','DESCRIPTION:Josh Mobile appointment tomorrow','END:VALARM','BEGIN:VALARM','TRIGGER:-PT1H','ACTION:DISPLAY','DESCRIPTION:Josh Mobile appointment in one hour','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');}
export default async function handler(req,res){try{
 guard(req,res);assert(available()&&SECRET().length>=40,'Staff sign-in is temporarily unavailable.',503);
 const action=String(req.query?.action||'');
 if(req.method==='POST'&&['login','activate'].includes(action)){
  const b=body(req),email=text(b.email,180).toLowerCase();await rate('auth-ip:'+clientIp(req),30);await rate('auth-email:'+email,12);
  assert(ADMINS.includes(email),'Email or credentials were not accepted.',401);
  let a=await account(email);
  if(action==='activate'){
   const role=email===ADMINS[0]?'OWNER':'MANAGER';const expiry=Number(process.env.JM_INVITE_EXPIRES||0);
   assert(!a&&expiry>Date.now()&&same(digest(text(b.token,160)),process.env[`JM_${role}_INVITE_HASH`]||''),'This activation link is invalid, expired, or already used. Sign in or contact your site administrator.',401);
   assert(typeof b.password==='string'&&b.password.length>=12&&b.password.length<=128,'Choose a password of 12–128 characters.');
   const hash=await passwordHash(b.password);await writeJson(accountPath(email),{hash,createdAt:now(),changedAt:now()});await startSession(email,hash,res);return ok(res,{email});
  }
  assert(a&&await verifyPassword(b.password,a.value.hash),'Email or password was not accepted.',401);await startSession(email,a.value.hash,res);return ok(res,{email});
 }
 const user=await session(req);assert(user,'Sign in to view this private workspace.',401);
 if(req.method==='GET'&&action==='session')return ok(res,{email:user.email});
 if(req.method==='GET'&&action==='jobs'){const [jobs,marker]=await Promise.all([allJobs(),jobMarker()]);return ok(res,{jobs:jobs.map(publicJob),marker});}
 if(req.method==='GET'&&action==='changes')return ok(res,{marker:await jobMarker()});
 if(req.method==='GET'&&action==='availability')return ok(res,{availability:await settings()});
 if(req.method==='GET'&&['file','calendar'].includes(action)){
  const r=await jobById(req.query?.id);assert(r,'Not found.',404);
  if(action==='calendar'){res.setHeader('Content-Type','text/calendar; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="josh-mobile-appointment.ics"');return res.status(200).end(calendar(r.value));}
  const index=Number(req.query?.index);const m=Number.isInteger(index)&&index>=0&&index<6?r.value.media?.find(x=>x.index===index):null;assert(m,'Not found.',404);const file=await getMedia(m.path);assert(file,'Not found.',404);
  res.setHeader('Content-Type',m.type);res.setHeader('Content-Disposition','inline');res.status(200);for await(const chunk of file.stream)res.write(Buffer.from(chunk));return res.end();
 }
 assert(req.method==='POST','Method not allowed.',405);const b=body(req);
 if(action==='logout'){await remove(`sessions/${digest(user.sid)}.json`);res.setHeader('Set-Cookie',cookie('',0));return ok(res);}
 if(action==='change-password'){
  await rate('password:'+user.email,6);const a=await account(user.email);assert(await verifyPassword(b.oldPassword,a.value.hash),'Current password was not accepted.',400);assert(typeof b.newPassword==='string'&&b.newPassword.length>=12&&b.newPassword.length<=128,'Choose a password of 12–128 characters.');assert(b.newPassword!==b.oldPassword,'Use a different password.');const hash=await passwordHash(b.newPassword);await writeJson(accountPath(user.email),{...a.value,hash,changedAt:now()},a.etag);res.setHeader('Set-Cookie',cookie('',0));return ok(res,{signOut:true});
 }
 if(action==='availability'){const next=validateSettings(b);const saved=await withScheduleLock(async()=>{const old=await readJson(SETTINGS_PATH);await writeJson(SETTINGS_PATH,next,old?.etag);return next;});return ok(res,{availability:saved,conflicts:await confirmedConflicts(saved)});}
 if(action==='create'){const job=normalizeManual(b,user.email),reference=await reserveReference(job.id);job.reference=reference;try{await writeJson(jobPath(job.id),job);}catch(error){await releaseReference(reference,job.id).catch(()=>{});throw error;}await touchJobs('created');return ok(res,{id:job.id,reference},201);}
 if(action==='retry-notification'){assert(typeof b.id==='string','Choose a request.');const result=await notifyNewRequest(b.id);return ok(res,{notification:result});}
 assert(['update','message'].includes(action),'Unknown action.',400);
 return await withScheduleLock(async()=>{
  const r=await jobById(b.id);assert(r,'Job not found.',404);const old=r.value;assert(b.version===old.version,'This job changed in another window. Refresh before saving.',409);
  let j={...old,version:old.version+1,updatedAt:now(),updatedBy:user.email,timeline:[...(old.timeline||[])]};
  if(action==='message'){
   const note=text(b.text,2000);assert(note,'Enter what was discussed.');assert(['sms','whatsapp','call','note'].includes(b.channel),'Choose a communication type.');j.timeline.push(activity(user.email,b.channel,note));
  }else{
   assert(['requested','confirmed','completed','cancelled'].includes(b.status),'Choose a valid job status.');
   const at=b.appointmentAt?String(b.appointmentAt):'';const duration=Number(b.durationMinutes||60);assert(Number.isInteger(duration)&&duration>=30&&duration<=480,'Duration must be 30–480 minutes.');
   j={...j,status:b.status,vin:text(b.vin,17).toUpperCase(),address:text(b.address,240),city:text(b.city,100),privateNotes:text(b.privateNotes,6000),partsTools:text(b.partsTools,4000),durationMinutes:duration};
   assert(j.address&&j.city,'Service address and city are required.');assert(!j.vin||validVin(j.vin),'VIN must have 17 valid characters.');
   if(j.status==='confirmed'){
    assert(validVin(j.vin),'A valid VIN is required before confirming this appointment.');
    const start=Date.parse(at);const changed=old.status!=='confirmed'||old.appointmentAt!==at||old.durationMinutes!==duration;
    assert(Number.isFinite(start),'Choose an appointment date and time.');if(changed)assert(start>Date.now()&&start<Date.now()+365*86400000,'Choose a future appointment within one year.');
    if(changed)await enforceConfirmedSlot(new Date(start).toISOString(),duration,j.id);
    const end=start+duration*60000;const others=await allJobs();assert(!others.some(x=>x.id!==j.id&&x.status==='confirmed'&&Date.parse(x.appointmentAt)<end&&Date.parse(x.appointmentAt)+(x.durationMinutes||60)*60000>start),'This appointment overlaps another confirmed job.',409);j.appointmentAt=new Date(start).toISOString();
   }
   if(old.status!==j.status||old.appointmentAt!==j.appointmentAt)j.timeline.push(activity(user.email,'status',`Status: ${j.status}${j.appointmentAt?' · '+j.appointmentAt:''}`));
  }
  assert(j.timeline.length<=1000,'Conversation history capacity reached; contact your administrator.',409);await writeJson(jobPath(j.id),j,r.etag);await touchJobs(action);return ok(res,{id:j.id,job:publicJob(j)});
 });
}catch(e){return fail(res,e);}}
