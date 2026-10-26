import {randomUUID} from 'node:crypto';
import {ALLOWED_ADMINS,digest,passwordHash,verifyPassword,createSession,parseSession,cookieHeader,clearCookie,cookieFrom,isSameOrigin,securityHeaders,validVin,validConfirmedAt} from '../lib/auth.mjs';
import {available,readJson,writeJson,bookingPath,jobById,allJobs,storedAdminHash,setAdminHash,failedAttempts,recordFailure,getMedia} from '../lib/private-store.mjs';
const reply=(res,status,payload)=>res.status(status).json(payload);
const body=req=>typeof req.body==='string'?JSON.parse(req.body):req.body||{};
const clean=(v,max)=>String(v??'').trim().slice(0,max);
async function currentHash(email){
 const initial=email==='joshmobileinc@gmail.com'?process.env.JM_OWNER_PASSWORD_HASH:process.env.JM_MANAGER_PASSWORD_HASH;
 return await storedAdminHash(email)||initial||'';
}
async function authorized(req){
 const claims=parseSession(cookieFrom(req),process.env.JM_SESSION_SECRET);if(!claims)return null;
 const hash=await currentHash(claims.email);return hash&&claims.v===digest(hash).slice(0,24)?claims:null;
}
export default async function handler(req,res){
 securityHeaders(res);
 if(!available()||!process.env.JM_SESSION_SECRET)return reply(res,503,{error:'Private admin login is not activated. Contact the website manager.'});
 const action=String(req.query?.action||'');
 if(req.method==='POST'&&!isSameOrigin(req))return reply(res,403,{error:'Invalid request origin'});
 if(req.method==='POST'&&!String(req.headers['content-type']||'').startsWith('application/json'))return reply(res,415,{error:'JSON required'});
 if(req.method==='POST'&&Number(req.headers['content-length']||0)>64000)return reply(res,413,{error:'Request too large'});
 try{
  if(req.method==='POST'&&action==='login'){
   const data=body(req),email=clean(data.email,180).toLowerCase(),password=String(data.password||'');
   const generic={error:'Email or password was not accepted.'};
   if(!ALLOWED_ADMINS.includes(email)||password.length>128)return reply(res,401,generic);
   if(await failedAttempts(email)>=8)return reply(res,429,{error:'Too many sign-in attempts. Try again later.'});
   const hash=await currentHash(email);
   if(!verifyPassword(password,hash)){await recordFailure(email);return reply(res,401,generic)}
   res.setHeader('Set-Cookie',cookieHeader(createSession(email,hash,process.env.JM_SESSION_SECRET)));
   return reply(res,200,{ok:true,email});
  }
  const owner=await authorized(req);
  if(!owner)return reply(res,401,{error:'Please sign in to access this private workspace.'});
  if(req.method==='GET'&&action==='session')return reply(res,200,{ok:true,email:owner.email});
  if(req.method==='GET'&&action==='jobs')return reply(res,200,{ok:true,jobs:await allJobs()});
  if(req.method==='GET'&&action==='file'){
   const item=await jobById(String(req.query?.id||'')),index=Number(req.query?.index);
   if(!item||!Number.isInteger(index)||index<0||index>5)return reply(res,404,{error:'Not found'});
   const file=item.value.media?.[index];if(!file)return reply(res,404,{error:'Not found'});
   const response=await getMedia(file.path);if(!response||response.statusCode!==200||!response.stream)return reply(res,404,{error:'Not found'});
   res.setHeader('Content-Type',file.type);res.setHeader('Content-Disposition','inline');res.setHeader('Cache-Control','private, no-store');
   return res.status(200).end(Buffer.from(await new Response(response.stream).arrayBuffer()));
  }
  if(req.method==='POST'&&action==='logout'){res.setHeader('Set-Cookie',clearCookie());return reply(res,200,{ok:true})}
  if(req.method==='POST'&&action==='change-password'){
   const data=body(req),hash=await currentHash(owner.email);
   if(!verifyPassword(data.oldPassword,hash))return reply(res,400,{error:'Current password is incorrect'});
   if(typeof data.newPassword!=='string'||data.newPassword.length<16||data.newPassword.length>128||data.newPassword===data.oldPassword)return reply(res,400,{error:'Choose a different password of at least 16 characters'});
   await setAdminHash(owner.email,passwordHash(data.newPassword));res.setHeader('Set-Cookie',clearCookie());return reply(res,200,{ok:true,signOut:true});
  }
  if(req.method==='POST'&&action==='create'){
   const data=body(req),id=randomUUID(),now=new Date().toISOString();
   const name=clean(data.name,90),phone=clean(data.phone,30),address=clean(data.address,240),city=clean(data.city,100);
   if(!name||phone.replace(/\D/g,'').length<10||!address||!city)return reply(res,400,{error:'Customer name, phone, street address, and city are required'});
   const vin=clean(data.vin,17).toUpperCase();if(vin&&!validVin(vin))return reply(res,400,{error:'VIN must contain 17 characters without I, O or Q'});
   const item={id,createdAt:now,updatedAt:now,status:'requested',source:'manual',name,phone,email:clean(data.email,160),year:clean(data.year,4),make:clean(data.make,60),model:clean(data.model,80),vin,service:clean(data.service,100),description:clean(data.description,1800),address,city,locationType:'Come to my location',date:clean(data.date,10),time:clean(data.time,40),appointmentAt:'',privateNotes:'',partsTools:'',conversation:[],media:[],updatedBy:owner.email};
   await writeJson(bookingPath(id),item);return reply(res,201,{ok:true,id});
  }
  if(req.method==='POST'&&action==='log-message'){
   const data=body(req),record=await jobById(String(data.id||''));if(!record)return reply(res,404,{error:'Job not found'});
   const message=clean(data.message,1500),channel=String(data.channel||''),direction=String(data.direction||'');
   if(!message||!['sms','whatsapp','phone'].includes(channel)||!['incoming','outgoing','note'].includes(direction))return reply(res,400,{error:'Provide channel, direction, and message'});
   const log=Array.isArray(record.value.conversation)?record.value.conversation:[];
   if(log.length>=300)return reply(res,409,{error:'Conversation log limit reached'});
   const updated={...record.value,conversation:[...log,{id:randomUUID(),at:new Date().toISOString(),author:owner.email,channel,direction,message,verified:false}],updatedAt:new Date().toISOString(),updatedBy:owner.email};
   try{await writeJson(bookingPath(record.value.id),updated,record.etag)}catch(e){if(/precondition|match|conflict/i.test(String(e)))return reply(res,409,{error:'This job was updated. Refresh and try again'});throw e}
   return reply(res,200,{ok:true,id:record.value.id});
  }
  if(req.method==='POST'&&action==='update'){
   const data=body(req),record=await jobById(String(data.id||''));if(!record)return reply(res,404,{error:'Job not found'});
   const status=String(data.status||'');if(!['requested','confirmed','completed','cancelled'].includes(status))return reply(res,400,{error:'Invalid status'});
   const confirmedAt=data.appointmentAt?String(data.appointmentAt):'';
   const vin=clean(data.vin||record.value.vin,17).toUpperCase();
   if(vin&&!validVin(vin))return reply(res,400,{error:'Invalid VIN'});
   if(status==='confirmed'){
    if(!validVin(vin))return reply(res,400,{error:'Valid VIN required to confirm'});
    if(!validConfirmedAt(confirmedAt))return reply(res,400,{error:'Choose a future appointment date and time'});
    const others=await allJobs();const start=Date.parse(confirmedAt);
    if(others.some(j=>j.id!==data.id&&j.status==='confirmed'&&j.appointmentAt&&Math.abs(Date.parse(j.appointmentAt)-start)<3600000))return reply(res,409,{error:'Another appointment conflicts with that time'});
   }
   const old=record.value,updated={...old,status,vin,appointmentAt:status==='confirmed'?confirmedAt:old.appointmentAt||'',privateNotes:clean(data.privateNotes,4000),partsTools:clean(data.partsTools,3000),address:clean(data.address||old.address,240),city:clean(data.city||old.city,100),updatedAt:new Date().toISOString(),updatedBy:owner.email};
   try{await writeJson(bookingPath(old.id),updated,record.etag)}catch(e){if(/precondition|match|conflict/i.test(String(e)))return reply(res,409,{error:'This job was updated. Refresh and retry'});throw e}
   return reply(res,200,{ok:true,id:old.id});
  }
  res.setHeader('Allow','GET,POST');return reply(res,405,{error:'Unsupported action'});
 }catch(err){console.error('Admin operation error',err?.name||'Error');return reply(res,503,{error:'Could not complete operation. Try again.'})}
}
