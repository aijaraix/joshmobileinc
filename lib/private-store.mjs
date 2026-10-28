// Server only. Every object is private; no customer data is published in GitHub.
import {randomUUID,randomBytes} from 'node:crypto';
import {digest,assert} from './auth.mjs';
let fake;
export function useTestStore(adapter){if(process.env.NODE_ENV!=='test'||process.env.VERCEL)throw new Error('Test adapter unavailable');fake=adapter;}
const sdk=async()=>fake||await import('@vercel/blob');
export const available=()=>Boolean(process.env.BLOB_READ_WRITE_TOKEN||fake);
const prefix=()=>process.env.JM_DATA_PREFIX||'';
const path=p=>prefix()+p;
export async function readJson(p){const r=await(await sdk()).get(path(p),{access:'private',useCache:false,headers:{'accept-encoding':'identity'}});if(!r)return null;return {value:JSON.parse(await new Response(r.stream).text()),etag:r.blob.etag};}
export async function writeJson(p,value,etag){return(await sdk()).put(path(p),JSON.stringify(value),{access:'private',contentType:'application/json',addRandomSuffix:false,cacheControlMaxAge:60,...(etag?{allowOverwrite:true,ifMatch:etag}:{allowOverwrite:false})});}
export async function remove(p){return(await sdk()).del(path(p));}
export async function listAll(p,limit=2000){const items=[];let cursor;do{const r=await(await sdk()).list({prefix:path(p),limit:Math.min(1000,limit-items.length),...(cursor?{cursor}:{})});items.push(...r.blobs);cursor=r.hasMore?r.cursor:null;}while(cursor&&items.length<limit);return items;}
export const jobPath=id=>`jobs/${id}.json`;
export const markerPath='jobs-change.json';
export const referencePath=reference=>`references/${reference}.json`;
export const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(String(v||''));
export const jobById=id=>uuid(id)?readJson(jobPath(id)):null;
export async function reserveReference(id){
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
 for(let attempt=0;attempt<32;attempt++){
  const bytes=randomBytes(8);let suffix='';for(const byte of bytes)suffix+=alphabet[byte%alphabet.length];
  const reference='JM-'+suffix;
  try{await writeJson(referencePath(reference),{id,createdAt:new Date().toISOString()});return reference;}
  catch(error){if(!/precondition|already exists|conflict/i.test(error.message||''))throw error;}
 }
 throw Object.assign(new Error('Could not reserve a request reference. Please retry.'),{status:503});
}
export async function releaseReference(reference,id){
 const r=await readJson(referencePath(reference));if(r?.value?.id===id)await remove(referencePath(reference));
}
export async function touchJobs(kind='changed'){
 return mutate(markerPath,v=>({revision:Number(v?.revision||0)+1,updatedAt:new Date().toISOString(),kind}));
}
export async function jobMarker(){return (await readJson(markerPath))?.value||{revision:0,updatedAt:''};}
export async function allJobs(){const files=await listAll('jobs/');assert(files.length<2000,'Workspace capacity reached. Contact your administrator.',503);const jobs=[];for(let i=0;i<files.length;i+=12){const rows=await Promise.all(files.slice(i,i+12).map(f=>readJson(f.pathname.slice(prefix().length))));jobs.push(...rows.filter(Boolean).map(r=>r.value));}return jobs.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
export const accountPath=email=>`accounts/${digest(email)}.json`;
export async function account(email){return readJson(accountPath(email));}
export async function mutate(p,fn,attempts=5){for(let n=0;n<attempts;n++){const prev=await readJson(p);const next=await fn(prev?.value);try{await writeJson(p,next,prev?.etag);return next;}catch(e){if(!/precondition|already exists|conflict/i.test(e.message||'')||n===attempts-1)throw e;}}}
export async function rate(key,max,ms=1800000){const bucket=Math.floor(Date.now()/ms);await mutate(`limits/${digest(key)}.json`,v=>{const count=v?.bucket===bucket?v.count:0;assert(count<max,'Too many attempts. Please try again later.',429);return {bucket,count:count+1};});}
export const clientIp=req=>String(req.headers?.['x-vercel-forwarded-for']||req.headers?.['x-forwarded-for']||'unknown').split(',')[0].trim();
export async function withScheduleLock(fn){const p='schedule-lock.json',owner=randomUUID();await mutate(p,v=>{assert(!v?.until||v.until<Date.now(),'Another appointment is being saved. Try again.',409);return {owner,until:Date.now()+45000};});try{return await fn();}finally{await mutate(p,v=>v?.owner===owner?{owner:'',until:0}:v).catch(()=>{});}}
export const mediaTypes=Object.freeze({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm'});
export function mediaPath(id,index,type){assert(uuid(id)&&Number.isInteger(index)&&index>=0&&index<6&&mediaTypes[type],'Invalid attachment.');return `job-media/${id}/${index}.${mediaTypes[type]}`;}
export async function getMedia(p){assert(/^job-media\/[a-f0-9-]{36}\/[0-5]\.(jpg|png|webp|mp4|mov|webm)$/.test(p),'Invalid attachment.');return(await sdk()).get(path(p),{access:'private',useCache:false});}
export async function headMedia(p){return(await sdk()).head(path(p));}
export async function putMedia(p,bytes,type){return(await sdk()).put(path(p),bytes,{access:'private',contentType:type,addRandomSuffix:false,allowOverwrite:false,cacheControlMaxAge:60});}
export async function cleanPrefix(){assert(prefix().startsWith('smoke/'),'Cleanup requires isolated smoke prefix.');for(const f of await listAll(''))await(await sdk()).del(f.pathname);}
