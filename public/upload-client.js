import {upload} from '@vercel/blob/client';

const extension=Object.freeze({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm'});
const timeoutMs=90_000;
const request=async payload=>{
 const response=await fetch('/api/media',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||'Could not update attachment status.');
 return data;
};
const message=error=>String(error?.message||'Upload did not finish.').replace(/[\r\n]+/g,' ').slice(0,180);

export async function sendAttachments(id,token,files,onProgress){
 const received=[],failed=[];
 for(let position=0;position<files.length;position++){
  const entry=files[position],file=entry?.file||entry,index=Number.isInteger(entry?.index)?entry.index:position,controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(new DOMException('The upload took too long.','TimeoutError')),timeoutMs);
  try{
   onProgress?.({index,total:files.length,name:file.name,phase:'uploading',percentage:0});
   await upload(`job-media/${id}/${index}.${extension[file.type]}`,file,{access:'private',handleUploadUrl:'/api/upload',clientPayload:JSON.stringify({id,token,index}),contentType:file.type,abortSignal:controller.signal,onUploadProgress:event=>onProgress?.({index,total:files.length,name:file.name,phase:'uploading',percentage:Math.round(event.percentage||0)})});
   onProgress?.({index,total:files.length,name:file.name,phase:'verifying',percentage:100});
   await request({id,token,index,action:'complete'});received.push(index);
  }catch(error){
   const reason=message(error);failed.push({index,name:file.name,reason});
   try{await request({id,token,index,action:'failed',reason});}catch{}
   onProgress?.({index,total:files.length,name:file.name,phase:'failed',percentage:0,reason});
  }finally{clearTimeout(timer);}
 }
 return {received,failed};
}
