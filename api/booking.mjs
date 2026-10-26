import {randomUUID} from 'node:crypto';
import {validateRequest} from '../lib/request.mjs';
import {securityHeaders,isSameOrigin,validVin,digest} from '../lib/auth.mjs';
import {available,listAll,writeJson,bookingPath,putMedia,jobById} from '../lib/private-store.mjs';
const reply=(res,code,obj)=>res.status(code).json(obj);
export default async function handler(req,res){
 securityHeaders(res);
 if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(res,405,{error:'Method not allowed'})}
 if(!isSameOrigin(req))return reply(res,403,{error:'Invalid request origin'});
 if(!available())return reply(res,503,{error:'Online booking is temporarily unavailable. Please call or text Josh.'});
 if(!String(req.headers['content-type']||'').startsWith('application/json'))return reply(res,415,{error:'JSON required'});
 if(Number(req.headers['content-length']||0)>3600000)return reply(res,413,{error:'Online attachments exceed the 2.5 MB limit. Please send larger files by text or WhatsApp.'});
 try{
  const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  if(JSON.stringify(b).length>3500000)return reply(res,413,{error:'Request too large'});
  if(b.website)return reply(res,400,{error:'Request could not be processed'});
  const d=b.details||{};const error=validateRequest(d);if(error)return reply(res,400,{error});
  if(!validVin(d.vin))return reply(res,400,{error:'VIN must contain 17 valid letters or numbers without I, O or Q.'});
  const id=String(b.requestId||'');if(!/^[a-f0-9-]{36}$/i.test(id))return reply(res,400,{error:'Invalid request identifier'});
  if(await jobById(id))return reply(res,200,{ok:true,id,confirmed:false,duplicate:true});
  const today=new Date().toISOString().slice(0,10),existing=await listAll('jobs/',1500);
  if(existing.filter(f=>String(f.uploadedAt).slice(0,10)===today).length>=90)return reply(res,429,{error:'Daily capacity reached. Please contact Josh directly.'});
  const files=Array.isArray(b.files)?b.files:[];if(files.length>6)return reply(res,400,{error:'Maximum six attachments'});
  let total=0;const decoded=[];
  for(const f of files){
   const mime=String(f.type||'');if(!/^(image\/(jpeg|png|webp)|video\/(mp4|quicktime|webm))$/.test(mime))return reply(res,400,{error:'Unsupported online attachment type'});
   const encoded=String(f.base64||'');if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)||encoded.length>3500000)return reply(res,400,{error:'Invalid media encoding'});
   const bytes=Buffer.from(encoded,'base64');if(!bytes.length||bytes.toString('base64').replace(/=+$/,'')!==encoded.replace(/=+$/,''))return reply(res,400,{error:'Invalid attachment'});
   total+=bytes.length;if(total>2500000)return reply(res,413,{error:'Online attachments must total under 2.5 MB. Please send larger videos directly.'});
   if(mime==='image/jpeg'&&!(bytes[0]===255&&bytes[1]===216&&bytes[2]===255))return reply(res,400,{error:'Invalid JPEG file'});
   if(mime==='image/png'&&bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')return reply(res,400,{error:'Invalid PNG file'});
   if(mime==='image/webp'&&bytes.subarray(0,4).toString()!=='RIFF')return reply(res,400,{error:'Invalid WebP file'});
   decoded.push({bytes,mime});
  }
  const media=[];for(let i=0;i<decoded.length;i++)media.push(await putMedia(id,i,decoded[i].bytes,decoded[i].mime));
  const now=new Date().toISOString();
  const clean=(v,max)=>String(v||'').trim().slice(0,max);
  const record={id,createdAt:now,updatedAt:now,status:'requested',source:'website',name:clean(d.name,90),phone:clean(d.phone,30),email:clean(d.email,160),year:clean(d.year,4),make:clean(d.make,60),model:clean(d.model,80),vin:clean(d.vin,17).toUpperCase(),service:clean(d.service,80),description:clean(d.description,1800),address:clean(d.address,240),city:clean(d.city,100),locationType:d.locationType,date:d.date,time:d.time,appointmentAt:'',privateNotes:'',partsTools:'',conversation:[],media};
  await writeJson(bookingPath(id),record);
  return reply(res,201,{ok:true,id,confirmed:false,notificationSent:false});
 }catch(err){console.error('Booking failed:',err?.name||'Error');return reply(res,503,{error:'We could not save your request. Please call or text Josh directly.'})}
}
