import {randomBytes} from 'node:crypto';
import {validateRequest} from '../lib/request.mjs';
import {guard,body,assert,fail,SECRET,digest,text} from '../lib/auth.mjs';
import {available,rate,clientIp,uuid,jobById,jobPath,writeJson,mediaTypes,withScheduleLock} from '../lib/private-store.mjs';
import {enforcePublicSlot} from '../lib/availability.mjs';
export default async function handler(req,res){try{
 guard(req,res);assert(req.method==='POST','Method not allowed.',405);assert(available()&&SECRET().length>=40&&process.env.JM_BOOKING_ENABLED==='true','Online requests are unavailable. Please text Josh.',503);
 const b=body(req);assert(!b.website,'Unable to process the request.');const d=b.details||{};assert(!validateRequest(d),validateRequest(d)||'Check the form.');assert(uuid(b.requestId),'Invalid request ID.');
 const attachments=Array.isArray(b.attachments)?b.attachments:[];assert(attachments.length<=6,'Choose no more than six files.');let total=0;attachments.forEach((f,i)=>{assert(mediaTypes[f.type]&&Number.isInteger(f.size)&&f.size>0&&f.size<=15*1024*1024,'Use JPG, PNG, WebP, MP4, MOV or WebM files up to 15 MB each.');total+=f.size;});assert(total<=30*1024*1024,'Attachments must total 30 MB or less.');
 const existing=await jobById(b.requestId);if(existing)return res.status(200).json({ok:true,id:b.requestId,duplicate:true,confirmed:false});
 await rate('intake-ip:'+clientIp(req),10,3600000);await rate('intake-phone:'+String(d.phone).replace(/\D/g,''),5,86400000);await rate('intake-global',150,86400000);
 const token=randomBytes(32).toString('base64url'),stamp=new Date().toISOString();
 const j={id:b.requestId,createdAt:stamp,updatedAt:stamp,version:1,source:'website',status:'requested',name:text(d.name,90),phone:text(d.phone,30),email:text(d.email,160),year:String(d.year),make:text(d.make,60),model:text(d.model,80),vin:text(d.vin,17).toUpperCase(),service:text(d.service,100),description:text(d.description,1800),address:text(d.address,240),city:text(d.city,100),locationType:d.locationType,date:d.date,time:d.time,appointmentAt:'',durationMinutes:60,privateNotes:'',partsTools:'',media:[],timeline:[{id:b.requestId,at:stamp,by:'Customer',kind:'created',text:'Website service request received. Awaiting staff confirmation.'}],attachments:attachments.map((f,index)=>({index,type:f.type,size:f.size,name:text(f.name,100)})),uploadHash:digest(token),uploadUntil:Date.now()+30*60*1000};
 await withScheduleLock(async()=>{await enforcePublicSlot(d.date,d.time);await writeJson(jobPath(j.id),j);});return res.status(201).json({ok:true,id:j.id,confirmed:false,uploadToken:token,notificationSent:false});
}catch(e){return fail(res,e);}}
