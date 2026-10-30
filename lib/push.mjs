import {digest,assert} from './auth.mjs';
import {jobById,listAll,readJson,writeJson,remove,rate,mutate} from './private-store.mjs';
import {pushConfigured,sendWebPush,validatePushSubscription} from './web-push.mjs';

const OWNER='joshmobileinc@gmail.com';
const SUBS='owner-push/subscriptions/';
const STATUS='owner-push/status.json';
const eventPath=(eventId,deviceId)=>`owner-push/events/${digest(`${eventId}:${deviceId}`)}.json`;
const now=()=>new Date().toISOString();
const publicKey=()=>pushConfigured()?process.env.JM_PUSH_PUBLIC_KEY:'';
function relative(path){return path.slice(String(process.env.JM_DATA_PREFIX||'').length);}

async function subscriptions(){
 const files=await listAll(SUBS);const results=[];
 for(const file of files){const path=relative(file.pathname),record=await readJson(path);if(!record)continue;
  if(record.value.expirationTime&&record.value.expirationTime<Date.now()){await remove(path);continue;}
  if(record.value.active&&record.value.owner===OWNER)results.push({...record.value,path,etag:record.etag});
 }
 return results;
}
async function saveStatus(state,extra={}){
 return mutate(STATUS,current=>({...current,state,updatedAt:now(),...extra}));
}
export async function ownerPushStatus(){
 const enabled=pushConfigured();const active=enabled?await subscriptions():[];const status=(await readJson(STATUS))?.value||{};
 return {enabled,subscriptions:active.length,publicKey:enabled?publicKey():'',lastAttemptAt:status.lastAttemptAt||'',lastState:status.lastState||'not_active',lastError:status.lastError||''};
}
export async function saveOwnerPushSubscription(value){
 assert(pushConfigured(),'Phone alerts are not configured yet. Notifications remain off.',503);
 const sub=validatePushSubscription(value);const path=SUBS+digest(OWNER+':'+sub.endpoint),previous=await readJson(path);
 await writeJson(path,{owner:OWNER,active:true,endpoint:sub.endpoint,keys:sub.keys,expirationTime:sub.expirationTime,updatedAt:now()},previous?.etag);
 await saveStatus('subscribed',{lastState:'subscribed',lastError:''});return ownerPushStatus();
}
export async function removeOwnerPushSubscription(value){
 const sub=validatePushSubscription(value);
 const path=SUBS+digest(OWNER+':'+sub.endpoint);await remove(path);await saveStatus('unsubscribed',{lastState:'unsubscribed',lastError:''});return ownerPushStatus();
}
async function deliver(payload,eventId,devices,{force=false}={}){
 let accepted=0,failed=0,attempted=0,removed=0;
 for(const device of devices){
  const path=eventPath(eventId,digest(device.endpoint)),claim=digest(`${Date.now()}:${Math.random()}:${device.endpoint}`),time=Date.now();
  let event;
  try{event=await mutate(path,current=>{
   if(current?.state==='accepted')return current;
   if(current?.claimUntil>time)return current;
   if(!force&&current?.lastAttemptAt&&time-Date.parse(current.lastAttemptAt)<15*60*1000)return current;
   return {state:'sending',claim,claimUntil:time+30000,attempts:Number(current?.attempts||0)+1,lastAttemptAt:new Date(time).toISOString()};
  });}catch{failed++;continue;}
  if(event.claim!==claim){if(event.state==='accepted')accepted++;continue;}
  attempted++;const result=await sendWebPush(device,payload);
  if(result.status===404||result.status===410){await remove(device.path).catch(()=>{});removed++;}
  const state=result.ok?'accepted':'failed';
  await mutate(path,current=>current?.claim===claim?{...current,state,claimUntil:0,lastAttemptAt:new Date(time).toISOString(),lastError:result.ok?'':String(result.status||'network')}:current).catch(()=>{});
  if(result.ok)accepted++;else failed++;
 }
 const lastState=accepted?'accepted':attempted||failed?'failed':'not_active';
 await saveStatus(lastState,{lastAttemptAt:now(),lastState,lastError:failed?`${failed} device delivery${failed===1?'':'ies'} failed.`:''}).catch(()=>{});
 return {state:lastState,attempted,accepted,failed,removed};
}
export async function ownerPushRequestStatus(id){
 if(!pushConfigured())return {state:'not_active'};
 const job=await jobById(id);if(!job)return {state:'not_found'};
 const devices=await subscriptions();if(!devices.length)return {state:'no_subscriptions'};
 const records=await Promise.all(devices.map(device=>readJson(eventPath(`request:${job.value.id}`,digest(device.endpoint)))));
 const states=records.map(record=>record?.value?.state||'not_attempted');
 return {state:states.includes('accepted')?'accepted':states.includes('sending')?'sending':states.includes('failed')?'failed':'not_attempted'};
}
export async function notifyOwnerRequest(id,{force=false}={}){
 if(!pushConfigured())return {state:'not_active',attempted:0};
 const job=await jobById(id);if(!job)return {state:'not_found',attempted:0};
 const reference=String(job.value.reference||'');if(!/^JM-[A-HJ-NP-Z2-9]{8}$/.test(reference))return {state:'invalid_reference',attempted:0};
 const devices=await subscriptions();if(!devices.length)return {state:'no_subscriptions',attempted:0};
 return deliver({type:'request',reference},`request:${job.value.id}`,devices,{force});
}
export async function retryOwnerPushRequest(id){
 const status=await ownerPushRequestStatus(id);assert(status.state==='failed','There is no failed phone notification to retry.',409);
 await rate('owner-push-retry:'+OWNER,3,60*60*1000);return notifyOwnerRequest(id,{force:true});
}
export async function sendOwnerPushTest(){
 assert(pushConfigured(),'Phone alerts are not configured yet.',503);await rate('owner-push-test:'+OWNER,1,60*60*1000);
 const devices=await subscriptions();assert(devices.length,'Install the owner app and turn on phone alerts first.',409);
 return deliver({type:'test'},`test:${Date.now()}`,devices,{force:true});
}
