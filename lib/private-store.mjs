
import {get,list,put} from '@vercel/blob';
import {emailKey} from './auth.mjs';
const opts={access:'private'};
export const available=()=>Boolean(process.env.BLOB_READ_WRITE_TOKEN);
export async function readJson(path){
 const response=await get(path,{...opts,useCache:false});
 if(!response||response.statusCode!==200)return null;
 return {value:JSON.parse(await new Response(response.stream).text()),etag:response.blob.etag};
}
export async function writeJson(path,value,etag){
 return put(path,JSON.stringify(value),{...opts,contentType:'application/json',addRandomSuffix:false,cacheControlMaxAge:60,...(etag?{allowOverwrite:true,ifMatch:etag}:{})});
}
export async function listAll(prefix,limit=1000){
 let cursor,items=[];do{
  const b=await list({prefix,limit:Math.min(1000,limit-items.length),cursor});
  items.push(...b.blobs);cursor=b.hasMore?b.cursor:null;
 }while(cursor&&items.length<limit);
 return items;
}
export const bookingPath=id=>'jobs/'+id+'.json';
export async function jobById(id){return /^[a-f0-9-]{36}$/i.test(id||'')?readJson(bookingPath(id)):null;}
export async function allJobs(){
 const files=await listAll('jobs/',1200);
 const jobs=await Promise.all(files.filter(f=>/^jobs\/[a-f0-9-]{36}\.json$/i.test(f.pathname)).map(async f=>{
  try{const r=await readJson(f.pathname);return r?.value||null}catch{return null}
 }));
 return jobs.filter(Boolean).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
}
export async function storedAdminHash(email){
 const r=await readJson('admin-accounts/'+emailKey(email)+'.json');return r?.value?.hash||null;
}
export async function setAdminHash(email,hash){
 const path='admin-accounts/'+emailKey(email)+'.json';
 const old=await readJson(path);
 return writeJson(path,{hash,changedAt:new Date().toISOString()},old?.etag);
}
export async function failedAttempts(email){
 const since=Date.now()-30*60000;
 const all=await listAll('failed-logins/'+emailKey(email)+'/',200);
 return all.filter(f=>new Date(f.uploadedAt).getTime()>since).length;
}
export async function recordFailure(email){
 const path='failed-logins/'+emailKey(email)+'/'+Date.now()+'-'+crypto.randomUUID()+'.txt';
 return put(path,'x',{...opts,contentType:'text/plain',addRandomSuffix:false});
}
export async function putMedia(id,index,bytes,mime){
 const exts={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm'};
 const ext=exts[mime];if(!ext)throw new Error('Invalid media type');
 const path='job-media/'+id+'/'+index+'.'+ext;
 await put(path,bytes,{...opts,contentType:mime,addRandomSuffix:false,cacheControlMaxAge:60});
 return {path,type:mime};
}
export async function getMedia(path){
 if(!/^job-media\/[a-f0-9-]{36}\/[0-5]\.(jpg|png|webp|mp4|mov|webm)$/.test(path||''))return null;
 return get(path,{...opts,useCache:false});
}
