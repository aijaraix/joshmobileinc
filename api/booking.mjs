
import {validateRequest} from '../lib/request.mjs';
import {validVin,isSameOrigin,securityHeaders} from '../lib/auth.mjs';
import {available,allJobs,jobById,writeJson,bookingPath,putMedia} from '../lib/private-store.mjs';
const send=(r,s,v)=>r.status(s).json(v);
const txt=(v,n)=>String(v??'').trim().slice(0,n);
export default async function handler(req,res){
 securityHeaders(res);
 if(req.method!=='POST'){res.setHeader('Allow','POST');return send(res,405,{error:'Method not allowed'});}
 if(!isSameOrigin(req))return send(res,403,{error:'Invalid origin'});
 if(!available())return send(res,503,{error:'Online booking is not ready. Please text or call Josh.'});
 if(!String(req.headers['content-type']||'').startsWith('application/json'))return send(res,415,{error:'JSON required'});
 if(Number(req.headers['content-length']||0)>3700000)return send(res,413,{error:'Upload too large; text Josh the photos instead.'});
 try{
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  if(JSON.stringify(body).length>3600000||body.website)return send(res,400,{error:'Invalid request'});
  const d=body.details||{},validation=validateRequest(d);
  if(validation)return send(res,400,{error:validation});
  if(!validVin(d.vin))return send(res,400,{error:'Please provide a valid 17-character VIN.'});
  const id=String(body.requestId||'');
  if(!/^[a-f0-9-]{36}$/i.test(id))return send(res,400,{error:'Invalid request reference'});
  if(await jobById(id))return send(res,200,{ok:true,id,duplicate:true,confirmed:false});
  const today=new Date().toISOString().slice(0,10);
  const recent=(await allJobs()).filter(j=>String(j.createdAt||'').startsWith(today));
  if(recent.length>=40)return send(res,429,{error:'Request limit reached. Please call or text Josh.'});
  const files=Array.isArray(body.files)?body.files:[];
  if(files.length>6)return send(res,400,{error:'Maximum six files'});
  let total=0;const decoded=[];
  const allowed=/^(image\/(jpeg|png|webp)|video\/(mp4|quicktime|webm))$/;
  for(const file of files){
   const type=String(file.type||''),b64=String(file.base64||'');
   if(!allowed.test(type)||b64.length>3450000||!/^[A-Za-z0-9+/]+={0,2}$/.test(b64))return send(res,400,{error:'Unsupported attachment'});
   const bytes=Buffer.from(b64,'base64');
   if(!bytes.length||bytes.toString('base64').replace(/=+$/,'')!==b64.replace(/=+$/,''))return send(res,400,{error:'Invalid attachment'});
   total+=bytes.length;if(total>2500000)return send(res,413,{error:'Online media limit 2.5 MB. Text larger media to Josh.'});
   if(type==='image/jpeg'&&bytes.subarray(0,3).toString('hex')!=='ffd8ff')return send(res,400,{error:'Invalid JPEG'});
   if(type==='image/png'&&bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')return send(res,400,{error:'Invalid PNG'});
   if(type==='image/webp'&&!(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'))return send(res,400,{error:'Invalid WebP'});
   decoded.push({bytes,type});
  }
  const media=[];for(let i=0;i<decoded.length;i++)media.push(await putMedia(id,i,decoded[i].bytes,decoded[i].type));
  const now=new Date().toISOString();
  const rec={id,createdAt:now,updatedAt:now,status:'requested',source:'website',name:txt(d.name,90),phone:txt(d.phone,30),email:txt(d.email,160),year:txt(d.year,4),make:txt(d.make,60),model:txt(d.model,80),vin:txt(d.vin,17).toUpperCase(),service:txt(d.service,80),description:txt(d.description,1800),address:txt(d.address,240),city:txt(d.city,100),locationType:txt(d.locationType,40),date:txt(d.date,10),time:txt(d.time,25),appointmentAt:'',privateNotes:'',partsTools:'',messages:[],media};
  await writeJson(bookingPath(id),rec);
  return send(res,201,{ok:true,id,confirmed:false,notificationSent:false});
 }catch(err){console.error('Booking save failure',err?.name||'Error');return send(res,503,{error:'Could not save request. Please text or call Josh.'});}
}
