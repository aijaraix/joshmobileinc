import {waitUntil} from '@vercel/functions';
import {initialTelegram,notifyTelegram} from '../lib/telegram.mjs';
import {randomBytes} from 'node:crypto';
import {validateRequest,normalizePhone} from '../lib/request.mjs';
import {guard,body,assert,fail,SECRET,digest,text,same} from '../lib/auth.mjs';
import {available,rate,clientIp,uuid,jobById,jobPath,writeJson,mediaTypes,withScheduleLock,reserveReference,releaseReference,mutate,touchJobs} from '../lib/private-store.mjs';
import {enforcePublicSlot} from '../lib/availability.mjs';
import {initialNotification,notifyNewRequest} from '../lib/notifications.mjs';
const proofOK=v=>/^[A-Za-z0-9_-]{43,128}$/.test(String(v||''));
const fingerprint=(details,attachments)=>digest(JSON.stringify({details:{name:text(details.name,90),phone:normalizePhone(details.phone),email:text(details.email,160).toLowerCase(),preferredContact:details.preferredContact,year:String(details.year),make:text(details.make,60),model:text(details.model,80),vin:text(details.vin,17).toUpperCase(),service:details.service,description:text(details.description,1800),address:text(details.address,240),city:text(details.city,100),locationType:details.locationType,date:details.date,time:details.time},attachments:attachments.map(f=>({name:text(f.name,100),type:f.type,size:f.size}))}));
async function renewUpload(id,proof){
 const token=randomBytes(32).toString('base64url'),until=Date.now()+30*60*1000;
 const job=await mutate(jobPath(id),current=>{
  assert(current&&same(current.continuationHash,digest(proof)),'This saved request can only be resumed from the browser that created it.',403);
  return {...current,version:current.version+1,updatedAt:new Date().toISOString(),uploadHash:current.attachments?.length?digest(token):'',uploadUntil:current.attachments?.length?until:0};
 });
 await touchJobs('upload-permission');return {token:job.attachments?.length?token:'',job};
}
export default async function handler(req,res){try{
 guard(req,res);assert(req.method==='POST','Method not allowed.',405);assert(available()&&SECRET().length>=40&&process.env.JM_BOOKING_ENABLED==='true','Online requests are temporarily unavailable. Please try again later.',503);
 const b=body(req);assert(!b.website,'Unable to process the request.');const d=b.details||{};assert(!validateRequest(d),validateRequest(d)||'Check the form.');assert(uuid(b.requestId),'Invalid request ID.');assert(proofOK(b.continuationProof),'This browser cannot safely resume the request. Refresh and try again.');
 const attachments=Array.isArray(b.attachments)?b.attachments:[];assert(attachments.length<=6,'Choose no more than six files.');let total=0;attachments.forEach((f,i)=>{assert(mediaTypes[f.type]&&Number.isInteger(f.size)&&f.size>0&&f.size<=15*1024*1024,'Use JPG, PNG, WebP, MP4, MOV or WebM files up to 15 MB each.');total+=f.size;});assert(total<=30*1024*1024,'Attachments must total 30 MB or less.');
 const intakeHash=fingerprint(d,attachments),existing=await jobById(b.requestId);if(existing){
  assert(existing.value.intakeHash===intakeHash,'This submit key is already associated with different request details. Review your changes and submit them as a new request.',409);
  const renewal=await renewUpload(b.requestId,b.continuationProof);
  return res.status(200).json({ok:true,id:b.requestId,reference:existing.value.reference||b.requestId,duplicate:true,confirmed:false,uploadToken:renewal.token,attachmentStatus:renewal.job.attachmentStatus||{expected:attachments.length,received:renewal.job.media?.length||0,failed:[]},receivedIndices:(renewal.job.media||[]).map(m=>m.index),notificationState:renewal.job.notification?.state||'not_configured'});
 }
 await rate('intake-ip:'+clientIp(req),10,3600000);await rate('intake-phone:'+String(d.phone).replace(/\D/g,''),5,86400000);await rate('intake-global',150,86400000);
 const token=randomBytes(32).toString('base64url'),stamp=new Date().toISOString(),reference=await reserveReference(b.requestId);
 const j={id:b.requestId,reference,createdAt:stamp,updatedAt:stamp,version:1,source:'website',status:'requested',name:text(d.name,90),phone:text(d.phone,30),normalizedPhone:normalizePhone(d.phone),email:text(d.email,160),preferredContact:d.preferredContact,year:String(d.year),make:text(d.make,60),model:text(d.model,80),vin:text(d.vin,17).toUpperCase(),service:text(d.service,100),description:text(d.description,1800),address:text(d.address,240),city:text(d.city,100),locationType:d.locationType,date:d.date,time:d.time,appointmentAt:'',durationMinutes:60,privateNotes:'',partsTools:'',media:[],timeline:[{id:b.requestId,at:stamp,by:'Customer',kind:'created',text:'Website service request received. Awaiting staff confirmation.'}],attachments:attachments.map((f,index)=>({index,type:f.type,size:f.size,name:text(f.name,100),status:'pending'})),attachmentStatus:{expected:attachments.length,received:0,failed:[]},intakeHash,continuationHash:digest(b.continuationProof),uploadHash:attachments.length?digest(token):'',uploadUntil:attachments.length?Date.now()+30*60*1000:0,notification:initialNotification(b.requestId),telegram:initialTelegram()};
 try{await withScheduleLock(async()=>{await enforcePublicSlot(d.date,d.time);await writeJson(jobPath(j.id),j);});}catch(error){await releaseReference(reference,j.id).catch(()=>{});throw error;}
 await touchJobs('created');
 const response=res.status(201).json({ok:true,id:j.id,reference:j.reference,confirmed:false,uploadToken:attachments.length?token:'',attachmentStatus:j.attachmentStatus,receivedIndices:[],notificationState:j.notification.state});
 const work=Promise.allSettled([notifyNewRequest(j.id),notifyTelegram(j).catch(()=>{console.error('telegram_alert_failed',j.reference,0);})]);
 try{waitUntil(work);}catch{ /* The response is already committed. */ }
 return response;
}catch(e){return fail(res,e);}}
