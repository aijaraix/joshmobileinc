import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import admin from '../api/admin.mjs';
import {digest} from '../lib/auth.mjs';
import {call} from './scenario.mjs';
import {memoryStore} from './memory-store.mjs';
import {useTestStore,writeJson,readJson,jobPath,jobById,mediaPath,headMedia,putMedia,referencePath} from '../lib/private-store.mjs';
process.env.NODE_ENV='test';
useTestStore(memoryStore());
test('Staff can safely trash, restore and permanently delete only an individual lead',async()=>{
 const email='sholom@aicreates.ai',token=randomBytes(32).toString('hex'),pass=randomBytes(22).toString('base64url');
 process.env.JM_SESSION_SECRET=randomBytes(48).toString('hex');
 process.env.JM_MANAGER_INVITE_HASH=digest(token);
 process.env.JM_INVITE_EXPIRES=String(Date.now()+3600000);
 let r=await call(admin,'activate',{email,token,password:pass});
 assert.equal(r.status,200);
 const cookie=r.headers['set-cookie'].split(';')[0];
 const id=randomUUID(),reference='JM-ABCD2345',stamp=new Date().toISOString();
 await writeJson(jobPath(id),{id,reference,createdAt:stamp,updatedAt:stamp,version:1,status:'requested',
 name:'QA TEST',address:'123 Example Street',city:'Pompano Beach',phone:'2025550142',media:[],attachments:[],timeline:[]});
 const body={id,version:1,confirmReference:reference};
 assert.equal((await call(admin,'trash',body)).status,401);
 assert.equal((await call(admin,'trash',body,cookie,'POST','https://other.example')).status,403);
 assert.equal((await call(admin,'trash',{...body,confirmReference:'JM-WRONG'},cookie)).status,400);
 r=await call(admin,'trash',body,cookie);
 assert.equal(r.status,200);
 assert((await jobById(id)).value.deletedAt);
 assert.equal((await call(admin,'trash',body,cookie)).status,409);
 assert.equal((await call(admin,'update',{...body,status:'confirmed'},cookie)).status,409);
 r=await call(admin,'restore',{...body,version:2},cookie);
 assert.equal(r.status,200);
 assert.equal((await jobById(id)).value.deletedAt,'');
 const image=Buffer.from('ffd8ffe000104a46494600010201004800480000ffd9','hex');
 await putMedia(mediaPath(id,0,'image/jpeg'),image,'image/jpeg');
 await writeJson(referencePath(reference),{id,createdAt:stamp});
 const current=(await jobById(id)).value;
 await writeJson(jobPath(id),{...current,version:current.version+1,
  attachments:[{index:0,type:'image/jpeg',size:image.length,status:'received'}],
  media:[{index:0,type:'image/jpeg',size:image.length,path:mediaPath(id,0,'image/jpeg')}]},(await readJson(jobPath(id))).etag);
 const ready=(await jobById(id)).value;
 r=await call(admin,'trash',{id,version:ready.version,confirmReference:reference},cookie);
 assert.equal(r.status,200);
 const v=r.data.job.version;
 assert.equal((await call(admin,'purge',{id,version:v,confirmReference:reference,confirmText:'WRONG'},cookie)).status,400);
 assert.equal((await call(admin,'purge',{id,version:v,confirmReference:'JM-WRONG',confirmText:'DELETE'},cookie)).status,400);
 r=await call(admin,'purge',{id,version:v,confirmReference:reference,confirmText:'DELETE'},cookie);
 assert.equal(r.status,200);
 assert.equal(await jobById(id),null);
 assert.equal(await readJson(referencePath(reference)),null);
 assert.equal(await headMedia(mediaPath(id,0,'image/jpeg')).catch(()=>null),null);
 const confirmed=randomUUID();
 await writeJson(jobPath(confirmed),{id:confirmed,reference:'JM-PPPP2222',version:1,createdAt:stamp,updatedAt:stamp,status:'confirmed'});
 assert.equal((await call(admin,'trash',{id:confirmed,version:1,confirmReference:'JM-PPPP2222'},cookie)).status,409);
 assert(await jobById(confirmed));
});
test('Mobile CRM includes Overview, requests Back, history and confirmed lead deletion',async()=>{
 const {readFileSync}=await import('node:fs');
 const html=readFileSync(new URL('../public/owner/index.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/owner/dashboard.js',import.meta.url),'utf8');
 for(const id of ['back-overview','requests-overview','back-to-list','delete-lead','restore-lead','purge-lead','purge-dialog','crm-nav'])
  assert(html.includes('id="'+id+'"'));
 assert(html.includes('data-section="trash"'));
 assert(js.includes("window.addEventListener('popstate'"));
 assert(js.includes('history.pushState('));
 assert(js.includes('history.back()'));
});
