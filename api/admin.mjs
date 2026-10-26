
import {randomUUID} from 'node:crypto';
import {ALLOWED_ADMINS,digest,passwordHash,verifyPassword,createSession,parseSession,cookieHeader,clearCookie,cookieFrom,isSameOrigin,securityHeaders,validVin,validAppointment} from '../lib/auth.mjs';
import {available,readJson,writeJson,bookingPath,jobById,allJobs,storedAdminHash,setAdminHash,failedAttempts,recordFailure,getMedia} from '../lib/private-store.mjs';
const send=(res,status,value)=>res.status(status).json(value);
const text=(v,max)=>String(v??'').trim().slice(0,max);
async function authInfo(email){
 const stored=await storedAdminHash(email);
 const initial=email==='joshmobileinc@gmail.com'?process.env.JM_OWNER_PASSWORD_HASH:process.env.JM_MANAGER_PASSWORD_HASH;
 return {hash:stored||initial||'',requiresChange:!stored};
}
async function session(req){
 const data=parseSession(cookieFrom(req),process.env.JM_SESSION_SECRET);if(!data)return null;
 const info=await authInfo(data.email);
 if(!info.hash||data.v!==digest(info.hash).slice(0,24))return null;
 return {...data,...info};
}
const bodyOf=req=>typeof req.body==='string'?JSON.parse(req.body):(req.body||{});
const isConflict=err=>/precondition|match|conflict|BlobPreconditionFailed/i.test(String(err?.name||err?.message||err));
export default async function handler(req,res){
 securityHeaders(res);
 if(!available()||!process.env.JM_SESSION_SECRET)return send(res,503,{error:'Private workspace configuration incomplete'});
 const action=String(req.query?.action||'');
 if(req.method==='POST'){
  if(!isSameOrigin(req))return send(res,403,{error:'Invalid origin'});
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return send(res,415,{error:'JSON required'});
  if(Number(req.headers['content-length']||0)>64000)return send(res,413,{error:'Request too large'});
 }
 try{
  if(action==='login'&&req.method==='POST'){
   const b=bodyOf(req),email=text(b.email,180).toLowerCase(),password=String(b.password||'');
   const invalid={error:'Email or password was not accepted.'};
   if(!ALLOWED_ADMINS.includes(email)||password.length>128)return send(res,401,invalid);
   if(await failedAttempts(email)>=8)return send(res,429,{error:'Too many attempts. Try again later.'});
   const info=await authInfo(email);
   if(!verifyPassword(password,info.hash)){await recordFailure(email);return send(res,401,invalid);}
   res.setHeader('Set-Cookie',cookieHeader(createSession(email,info.hash,process.env.JM_SESSION_SECRET)));
   return send(res,200,{ok:true,email,requiresChange:info.requiresChange});
  }
  const owner=await session(req);
  if(!owner)return send(res,401,{error:'Please sign in'});
  if(action==='session'&&req.method==='GET')return send(res,200,{ok:true,email:owner.email,requiresChange:owner.requiresChange});
  if(action==='logout'&&req.method==='POST'){res.setHeader('Set-Cookie',clearCookie());return send(res,200,{ok:true});}
  if(action==='change-password'&&req.method==='POST'){
   const b=bodyOf(req);
   if(!verifyPassword(b.oldPassword,owner.hash))return send(res,400,{error:'Current password is incorrect'});
   if(typeof b.newPassword!=='string'||b.newPassword.length<16||b.newPassword.length>128||b.newPassword===b.oldPassword)return send(res,400,{error:'Choose a different password of at least 16 characters'});
   await setAdminHash(owner.email,passwordHash(b.newPassword));
   res.setHeader('Set-Cookie',clearCookie());
   return send(res,200,{ok:true,signOut:true});
  }
  if(owner.requiresChange)return send(res,403,{error:'Change your temporary password before viewing customer information'});
  if(action==='jobs'&&req.method==='GET')return send(res,200,{ok:true,jobs:await allJobs()});
  if(action==='file'&&req.method==='GET'){
   const item=await jobById(String(req.query?.id||'')),index=Number(req.query?.index);
   if(!item||!Number.isInteger(index)||index<0||index>5)return send(res,404,{error:'Not found'});
   const file=item.value.media?.[index];if(!file)return send(res,404,{error:'Not found'});
   const data=await getMedia(file.path);if(!data||data.statusCode!==200)return send(res,404,{error:'Not found'});
   res.setHeader('Content-Type',file.type);res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Disposition','attachment');
   return res.status(200).end(Buffer.from(await new Response(data.stream).arrayBuffer()));
  }
  if(action==='create'&&req.method==='POST'){
   const b=bodyOf(req),id=randomUUID(),now=new Date().toISOString();
   const name=text(b.name,90),phone=text(b.phone,30),address=text(b.address,240),city=text(b.city,100),vin=text(b.vin,17).toUpperCase();
   if(!name||phone.replace(/\D/g,'').length<10||!address||!city)return send(res,400,{error:'Name, phone, address and city are required'});
   if(vin&&!validVin(vin))return send(res,400,{error:'Enter a valid 17-character VIN'});
   const value={id,createdAt:now,updatedAt:now,status:'requested',source:'manual',name,phone,email:text(b.email,160),year:text(b.year,4),make:text(b.make,60),model:text(b.model,80),vin,service:text(b.service,90),description:text(b.description,1800),address,city,locationType:'Come to my location',date:text(b.date,10),time:text(b.time,25),appointmentAt:'',privateNotes:'',partsTools:'',messages:[],media:[],updatedBy:owner.email};
   await writeJson(bookingPath(id),value);
   return send(res,201,{ok:true,id});
  }
  if(action==='update'&&req.method==='POST'){
   const b=bodyOf(req),r=await jobById(String(b.id||''));
   if(!r)return send(res,404,{error:'Job not found'});
   const status=String(b.status||'');
   if(!['requested','confirmed','completed','cancelled'].includes(status))return send(res,400,{error:'Invalid job status'});
   const at=text(b.appointmentAt,40),vin=text(b.vin||r.value.vin,17).toUpperCase();
   if(vin&&!validVin(vin))return send(res,400,{error:'Invalid VIN'});
   if(status==='confirmed'){
    if(!validVin(vin))return send(res,400,{error:'VIN is required before confirming an appointment'});
    if(!validAppointment(at))return send(res,400,{error:'Select a future date and time'});
    const jobs=await allJobs();if(jobs.some(j=>j.id!==r.value.id&&j.status==='confirmed'&&j.appointmentAt&&Math.abs(Date.parse(j.appointmentAt)-Date.parse(at))<3600000))return send(res,409,{error:'This time overlaps another job'});
   }
   const updated={...r.value,status,appointmentAt:at||r.value.appointmentAt||'',vin,address:text(b.address||r.value.address,240),city:text(b.city||r.value.city,100),privateNotes:text(b.privateNotes,4000),partsTools:text(b.partsTools,3000),updatedAt:new Date().toISOString(),updatedBy:owner.email};
   try{await writeJson(bookingPath(updated.id),updated,r.etag);}catch(err){if(isConflict(err))return send(res,409,{error:'Job changed elsewhere. Refresh and retry'});throw err}
   return send(res,200,{ok:true,id:updated.id});
  }
  if(action==='message'&&req.method==='POST'){
   const b=bodyOf(req),r=await jobById(String(b.id||''));
   if(!r)return send(res,404,{error:'Job not found'});
   const direction=String(b.direction||''),content=text(b.message,1600);
   if(!['inbound','outbound','note'].includes(direction)||content.length<1)return send(res,400,{error:'Choose a message type and add text'});
   const messages=Array.isArray(r.value.messages)?r.value.messages:[];
   if(messages.length>=300)return send(res,413,{error:'Conversation log full'});
   const item={id:randomUUID(),direction,text:content,createdAt:new Date().toISOString(),loggedBy:owner.email,source:'manual-log'};
   const updated={...r.value,messages:[...messages,item],updatedAt:item.createdAt,updatedBy:owner.email};
   try{await writeJson(bookingPath(updated.id),updated,r.etag);}catch(err){if(isConflict(err))return send(res,409,{error:'Conversation changed; refresh and retry'});throw err}
   return send(res,201,{ok:true,message:item});
  }
  res.setHeader('Allow','GET,POST');return send(res,405,{error:'Unsupported action'});
 }catch(err){console.error('Admin operation failed',err?.name||'Error');return send(res,503,{error:'Could not complete that operation. Retry.'});}
}
