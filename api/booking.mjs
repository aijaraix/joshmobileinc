import {validateRequest} from '../lib/request.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'});}
 const origin=req.headers.origin; if(origin!=='https://joshmobileinc.com'&&origin!=='https://www.joshmobileinc.com')return res.status(403).json({error:'Unrecognized request origin'});
 const endpoint=process.env.JM_GOOGLE_WEBAPP_URL||'';const secret=process.env.JM_GOOGLE_API_SECRET;
 if(process.env.JM_ONLINE_INTAKE_ENABLED!=='true'||!secret||!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint))return res.status(503).json({error:'Online storage is not active. Please send your request by WhatsApp, text, or email.'});
 if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({error:'JSON required'});
 try{
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(!body||JSON.stringify(body).length>3500000)return res.status(413).json({error:'Request is too large. Send media through WhatsApp instead.'});
  const error=validateRequest(body.details||{});if(error)return res.status(400).json({error});
  if(!/^[0-9a-f-]{36}$/i.test(body.requestId||''))return res.status(400).json({error:'Missing request identifier'});
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'createRequest',secret,details:body.details,requestId:body.requestId,files:body.files||[]}),signal:AbortSignal.timeout(25000),redirect:'follow'});
  if(!response.ok)throw new Error('Storage unavailable');const result=await response.json();
  if(!result.ok)return res.status(result.code==='limit'?429:400).json({error:result.error||'Request was not saved.'});
  return res.status(201).json({ok:true,id:result.id,status:'requested',confirmed:false,notificationSent:result.notificationSent===true});
 }catch{return res.status(502).json({error:'We could not confirm your submission. Keep your details and send them directly to Josh.'});}
}
