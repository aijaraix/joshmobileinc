import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {memoryStore} from './memory-store.mjs';
import {useTestStore,writeJson,jobPath} from '../lib/private-store.mjs';
import {initialNotification,notifyNewRequest} from '../lib/notifications.mjs';

process.env.NODE_ENV='test';useTestStore(memoryStore());
test('owner alert has one durable event and never sends customer details',async()=>{
 const id=randomUUID(),originalFetch=globalThis.fetch;process.env.JM_ALERT_WEBHOOK_URL='https://alerts.example.test/exec';process.env.JM_ALERT_WEBHOOK_SECRET='alert-test-secret';
 await writeJson(jobPath(id),{id,reference:'JM-K7P4D2Q9',version:1,createdAt:'2026-10-28T12:00:00.000Z',updatedAt:'2026-10-28T12:00:00.000Z',name:'Synthetic Customer',phone:'+12025550142',vin:'1HGCM82633A004352',address:'123 Synthetic Test Street',service:'brakes',media:[],attachments:[],notification:initialNotification(id)});
 let calls=0,payload;globalThis.fetch=async(_url,options)=>{calls++;payload=JSON.parse(options.body);return new Response(JSON.stringify({accepted:true,quotaRemaining:99}),{status:200,headers:{'content-type':'application/json'}});};
 try{
  const first=await notifyNewRequest(id),second=await notifyNewRequest(id);
  assert.equal(first.state,'accepted');assert.equal(second.attempted,false);assert.equal(calls,1);assert.equal(payload.reference,'JM-K7P4D2Q9');assert.match(payload.eventId,/^new-request:/);assert(payload.signature);assert(!JSON.stringify(payload).includes('1HGCM82633A004352'));assert(!JSON.stringify(payload).includes('123 Synthetic'));
  const uncertainId=randomUUID();await writeJson(jobPath(uncertainId),{id:uncertainId,reference:'JM-M4N7P2Q8',version:1,createdAt:'2026-10-28T12:00:00.000Z',updatedAt:'2026-10-28T12:00:00.000Z',service:'inspection',media:[],attachments:[],notification:initialNotification(uncertainId)});
  globalThis.fetch=async()=>new Response(JSON.stringify({accepted:false,uncertain:true,error:'Prior outcome unknown'}),{status:200,headers:{'content-type':'application/json'}});
  const uncertain=await notifyNewRequest(uncertainId),held=await notifyNewRequest(uncertainId);
  assert.equal(uncertain.state,'uncertain');assert.equal(held.attempted,false);
 }finally{globalThis.fetch=originalFetch;delete process.env.JM_ALERT_WEBHOOK_URL;delete process.env.JM_ALERT_WEBHOOK_SECRET;}
});
