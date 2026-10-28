// Optional owner alerts. Ticket persistence never depends on this route.
import {randomUUID,createHmac} from 'node:crypto';
import {assert,text} from './auth.mjs';
import {jobById,jobPath,mutate,touchJobs} from './private-store.mjs';

const endpoint=()=>String(process.env.JM_ALERT_WEBHOOK_URL||'').trim();
const secret=()=>String(process.env.JM_ALERT_WEBHOOK_SECRET||'').trim();
const configured=()=>Boolean(endpoint()&&secret());
const ownerUrl=reference=>`https://joshmobileinc.com/owner#request=${encodeURIComponent(reference)}`;
const canonical=payload=>[payload.eventId,payload.expiresAt,payload.reference,payload.service,payload.requestedAt,payload.ownerUrl].join('\n');

function notificationFor(job){
 return job.notification||{eventId:`new-request:${job.id}`,state:configured()?'pending':'not_configured',attempts:0,lastAttemptAt:'',provider:'apps-script'};
}

async function update(id,fn){
 const job=await mutate(jobPath(id),old=>{
  const notification=fn(notificationFor(old),old);
  return {...old,version:old.version+1,updatedAt:new Date().toISOString(),notification};
 });
 await touchJobs('notification');return job;
}

export function initialNotification(id){
 return {eventId:`new-request:${id}`,state:configured()?'pending':'not_configured',attempts:0,lastAttemptAt:'',provider:'apps-script'};
}

export async function notifyNewRequest(id,{force=false}={}){
 const initial=await jobById(id);assert(initial,'Request not found.',404);
 if(!configured())return {state:'not_configured',attempted:false};
 const claimId=randomUUID(),now=Date.now();
 const claimed=await update(id,(current)=>{
  const canRetry=['pending','failed','uncertain'].includes(current.state);
  const oldEnough=!current.claimUntil||current.claimUntil<now;
  const retryWait=!current.lastAttemptAt||now-Date.parse(current.lastAttemptAt)>=15*60*1000;
  if(!canRetry||!oldEnough||(!force&&!retryWait))return current;
  return {...current,state:'sending',claimId,claimUntil:now+30_000,attempts:Number(current.attempts||0)+1,lastAttemptAt:new Date(now).toISOString(),lastError:''};
 });
 if(claimed.notification?.claimId!==claimId)return {state:claimed.notification?.state||'pending',attempted:false};
 const job=claimed;
 const payload={
  eventId:job.notification.eventId,
  expiresAt:now+5*60*1000,
  reference:job.reference||job.id,
  service:text(job.service,100),
  requestedAt:job.createdAt,
  ownerUrl:ownerUrl(job.reference||job.id)
 };
 payload.signature=createHmac('sha256',secret()).update(canonical(payload)).digest('base64url');
 let result;
 try{
  const response=await fetch(endpoint(),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(8_000)});
  const data=await response.json().catch(()=>null);
  if(!response.ok||!data?.accepted)throw Object.assign(new Error(data?.error||`Alert service returned ${response.status}.`),{kind:data?.uncertain?'uncertain':response.status===429?'quota':'failed'});
  result=await update(id,current=>current.claimId===claimId?{...current,state:'accepted',claimUntil:0,acceptedAt:new Date().toISOString(),provider:'apps-script',providerEventId:payload.eventId,quotaRemaining:Number.isInteger(data.quotaRemaining)?data.quotaRemaining:null,lastError:''}:current);
  return {state:result.notification.state,attempted:true,quotaRemaining:result.notification.quotaRemaining};
 }catch(error){
  const uncertain=error?.kind==='uncertain'||error?.name==='TimeoutError'||error?.name==='AbortError'||/fetch failed|network/i.test(String(error?.message||''));
  result=await update(id,current=>current.claimId===claimId?{...current,state:uncertain?'uncertain':'failed',claimUntil:0,lastError:text(error?.message||'Alert service did not accept the event.',180),lastFailureAt:new Date().toISOString()}:current);
  return {state:result.notification.state,attempted:true};
 }
}
