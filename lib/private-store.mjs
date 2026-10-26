// PRIVATE Vercel Blob storage: never import this module into the public browser.
import {get,put,list} from '@vercel/blob';
import {emailKey,digest} from './auth.mjs';
const options={access:'private'};
export const available=()=>Boolean(process.env.BLOB_READ_WRITE_TOKEN);
export async function readJson(path){
 const r=await get(path,{...options,useCache:false});if(!r||r.statusCode!==200||!r.stream)return null;
 return {value:JSON.parse(await new Response(r.stream).text()),etag:r.blob.etag};
}
export async function writeJson(path,value,etag){
 return put(path,JSON.stringify(value),{...options,contentType:'application/json',addRandomSuffix:false,cacheControlMaxAge:60,...(etag?{ifMatch:etag,allowOverwrite:true}:{})});
}
export async function listAll(prefix,limit=1500){
 let cursor=null,items=[];
 do{const batch=await list({prefix,limit:Math.min(1000,limit-items.length),...(cursor?{cursor}:{})});items.push(...batch.blobs);cursor=batch.hasMore?batch.cursor:null}while(cursor&&items.length<limit);
 return items;
}
export const bookingPath=id=>'jobs/'+id+'.json';
export async function jobById(id){if(!/^[a-f0-9-]{36}$/i.test(id||''))return null;return readJson(bookingPath(id))}
export async function allJobs(){
 const files=await listAll('jobs/',1500);
 const jobs=await Promise.all(files.filter(f=>/^jobs\/[a-f0-9-]{36}\.json$/i.test(f.pathname)).map(async f=>{try{return (await readJson(f.pathname))?.value||null}catch{return null}}));
 return jobs.filter(Boolean).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
}
export async function storedAdminHash(email){return (await readJson('admin-accounts/'+emailKey(email)+'.json'))?.value?.hash||null}
export async function setAdminHash(email,hash){const path='admin-accounts/'+emailKey(email)+'.json';const prev=await readJson(path);return writeJson(path,{hash,changedAt:new Date().toISOString()},prev?.etag)}
export async function failedAttempts(email){const since=Date.now()-1800000;const files=await listAll('login-attempts/'+emailKey(email)+'/',400);return files.filter(f=>new Date(f.uploadedAt).getTime()>since).length}
export async function recordFailure(email){const date=new Date().toISOString().replace(/[:.]/g,'-');await put('login-attempts/'+emailKey(email)+'/'+date+'-'+crypto.randomUUID()+'.txt','failed',{...options,contentType:'text/plain',addRandomSuffix:false})}
export async function putMedia(id,index,body,mime){
 const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm'}[mime];if(!ext)throw new Error('Unsupported media');
 const path='job-media/'+id+'/'+index+'.'+ext;await put(path,body,{...options,contentType:mime,addRandomSuffix:false,cacheControlMaxAge:60});return {path,type:mime};
}
export async function getMedia(path){if(!/^job-media\/[a-f0-9-]{36}\/[0-5]\.(jpg|png|webp|mp4|mov|webm)$/.test(path||''))return null;return get(path,{...options,useCache:false})}
export const phoneFingerprint=phone=>digest(String(phone||'').replace(/\D/g,''));
