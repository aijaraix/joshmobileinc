import {assert,digest,same} from './auth.mjs';
import {jobById,jobPath,mediaPath,headMedia,getMedia,mutate,remove,touchJobs} from './private-store.mjs';
export function magicOK(type,b){if(type==='image/jpeg')return b[0]===255&&b[1]===216&&b[2]===255;if(type==='image/png')return b.subarray(0,8).toString('hex')==='89504e470d0a1a0a';if(type==='image/webp')return b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP';if(type==='video/webm')return b.subarray(0,4).toString('hex')==='1a45dfa3';if(['video/mp4','video/quicktime'].includes(type))return ['ftyp','moov','mdat','wide','free'].includes(b.subarray(4,8).toString());return false;}
export async function verifyUpload(id,token,index){const r=await jobById(id);assert(r&&r.value.uploadUntil>Date.now()&&same(digest(String(token||'')),r.value.uploadHash),'Upload permission expired.',403);assert(Number.isInteger(index)&&r.value.attachments?.[index],'Invalid attachment.');return r.value.attachments[index];}
function attachmentStatus(job){
 const attachments=job.attachments||[];const received=(job.media||[]).length;
 const failed=attachments.filter(f=>f.status==='failed').map(f=>({index:f.index,reason:f.failureReason||'Upload did not finish.',at:f.failedAt||''}));
 return {expected:attachments.length,received,failed};
}
async function mark(jobId,index,change){
 const next=await mutate(jobPath(jobId),job=>{
  const attachments=(job.attachments||[]).map(f=>f.index===index?{...f,...change}:f);
  return {...job,version:job.version+1,updatedAt:new Date().toISOString(),attachments,attachmentStatus:attachmentStatus({...job,attachments})};
 });
 await touchJobs('attachment');return next;
}
export async function recordUploadFailure(id,token,index,reason){
 await verifyUpload(id,token,index);
 const job=await jobById(id);if(job?.value.media?.some(m=>m.index===index))return job.value;
 return mark(id,index,{status:'failed',failureReason:String(reason||'Upload did not finish.').slice(0,180),failedAt:new Date().toISOString()});
}
export async function finishUpload(id,index){const r=await jobById(id);const f=r?.value.attachments?.[index];assert(f,'Unknown upload.',404);if(r.value.media.some(m=>m.index===index))return;
 const path=mediaPath(id,index,f.type),head=await headMedia(path);assert(head.size===f.size,'The uploaded file size does not match.');const media=await getMedia(path);assert(media,'Upload was not found.',404);const reader=media.stream.getReader();let bytes=Buffer.alloc(0);try{while(bytes.length<32){const part=await reader.read();if(part.done)break;bytes=Buffer.concat([bytes,Buffer.from(part.value)]);}}finally{await reader.cancel().catch(()=>{});}
 if(!magicOK(f.type,bytes)){await remove(path);await mark(id,index,{status:'failed',failureReason:'The uploaded file did not match its declared format.',failedAt:new Date().toISOString()});assert(false,'That file is not a valid photo or video. Please send another file.',400);}
 const next=await mutate(jobPath(id),j=>{
  const media=j.media.some(m=>m.index===index)?j.media:[...j.media,{index,path,type:f.type,size:f.size}].sort((a,b)=>a.index-b.index);
  const attachments=(j.attachments||[]).map(a=>a.index===index?{...a,status:'received',receivedAt:new Date().toISOString(),failureReason:'',failedAt:''}:a);
  return {...j,version:j.version+1,updatedAt:new Date().toISOString(),media,attachments,attachmentStatus:attachmentStatus({...j,media,attachments})};
 });
 await touchJobs('attachment');return next;
}
