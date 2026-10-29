import {normalizePhone,SERVICES} from './request.mjs';
import {jobPath,mutate,touchJobs} from './private-store.mjs';

const enabled=()=>process.env.TELEGRAM_ALERTS_ENABLED==='true';
const configured=()=>enabled()&&Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()&&process.env.TELEGRAM_CHAT_ID?.trim());
const limit=(s,n)=>Array.from(String(s??'')).slice(0,n).join('');
const escape=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
export function initialTelegram(){return {state:configured()?'pending':enabled()?'not_configured':'disabled',attempts:0,lastAttemptAt:'',lastError:''};}
export function telegramMessage(j){
 let address=Array.from([j.address,j.city].filter(Boolean).join(', '));
 const phone=normalizePhone(j.phone), reference=j.reference||j.id;
 const count=type=>(j.attachments||[]).filter(a=>String(a.type).startsWith(type+'/')).length;
 const makeHead=()=>{const addr=address.join('');return `<b>New request ${escape(reference)}</b>\nName: ${escape(limit(j.name,90))}\nPhone: <a href="tel:${escape(phone)}">${escape(phone)}</a>\nVIN: ${escape(j.vin)}\nVehicle: ${escape(limit([j.year,j.make,j.model].filter(Boolean).join(' '),160))}\nService: ${escape(SERVICES[j.service]||j.service)}\nAddress: <a href="${escape('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(addr))}">${escape(addr)}</a>\nLocation: ${escape(limit(j.locationType,60))}\nDescription: `;};
 const tail=`\nPreferred: ${escape(j.date)} ${escape(j.time)}\nContact: ${escape(j.preferredContact)}\nPhotos: ${count('image')} · Videos: ${count('video')}\n<a href="${escape('https://joshmobileinc.com/owner#request='+encodeURIComponent(reference))}">Open dashboard</a>`;
 while(address.length&&Array.from(makeHead()+tail).length>4096)address.pop();
 const head=makeHead();let description=Array.from(String(j.description||''));
 while(description.length&&Array.from(head+escape(description.join(''))+tail).length>4096)description.pop();
 return head+escape(description.join(''))+tail;
}

async function send(text){
 const response=await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN.trim()}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:process.env.TELEGRAM_CHAT_ID.trim(),text,parse_mode:'HTML',disable_web_page_preview:true}),signal:AbortSignal.timeout(8000)});
 if(!response.ok)return {ok:false,status:response.status};
 const data=await response.json().catch(()=>null);return data?.ok?{ok:true,status:response.status}:{ok:false,status:response.status};
}
export async function sendTelegramTest(){if(!configured())return {state:enabled()?'not_configured':'disabled'};try{const r=await send('🧪 TEST — Josh Mobile alert check (no customer data)');return {state:r.ok?'sent':'failed'};}catch{return {state:'failed'};}}
export async function notifyTelegram(job,{retryDelay=2000}={}){
 if(!configured())return initialTelegram();
 for(let attempt=1;attempt<=2;attempt++){
  const at=new Date().toISOString();
  await mutate(jobPath(job.id),old=>({...old,version:old.version+1,updatedAt:at,telegram:{state:'sending',attempts:attempt,lastAttemptAt:at,lastError:''}}));
  let result;try{result=await send(telegramMessage(job));}catch{result={ok:false,status:0};}
  const status=Number(result.status)||0, state=result.ok?'sent':attempt===2?'failed':'retrying';
  const telegram={state,attempts:attempt,lastAttemptAt:at,lastError:result.ok?'':`status ${status}`};
  await mutate(jobPath(job.id),old=>({...old,version:old.version+1,updatedAt:new Date().toISOString(),telegram}));
  await touchJobs('telegram');
  if(result.ok)return telegram;
  if(attempt===2){console.error('telegram_alert_failed',job.reference,status);return telegram;}
  await new Promise(resolve=>setTimeout(resolve,retryDelay));
 }
}
