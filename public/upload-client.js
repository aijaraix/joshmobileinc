import {upload} from '@vercel/blob/client';
const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm'};
const uploaded=new Set(),finished=new Set();
export async function sendAttachments(id,token,files,progress){for(let index=0;index<files.length;index++){
const key=id+':'+index,file=files[index];if(finished.has(key))continue;progress?.(index,files.length);
if(!uploaded.has(key)){await upload(`job-media/${id}/${index}.${ext[file.type]}`,file,{access:'private',handleUploadUrl:'/api/upload',clientPayload:JSON.stringify({id,token,index}),contentType:file.type});uploaded.add(key);}
const r=await fetch('/api/media',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,token,index})}),d=await r.json();if(!r.ok)throw new Error(d.error||'Could not verify the attachment.');finished.add(key);
}}
