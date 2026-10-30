// Materialize the owner-approved public images and static page changes before tests/build.
// No credentials or production data are accessed. Public output serves same-origin files.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const assets=[
 ['hero-outside-v3.webp','https://cdn.openart.ai/openart-uploads/production/attachment-transfers/af79aa320d84d29f2b8b3fcce67fe8551946a47ce2c03811431dc15a89367c48.webp','0a556a1e7f159c36964ebd7abdfe28f3db1d961fca72cdf6ec63d5473f78290b'],
 ['cabin-filters-real-v1.webp','https://cdn.openart.ai/openart-uploads/production/attachment-transfers/acc657e89c82fce5fd93b514a0f1579101c0e7875cdc0d64e142f3e8b638cec7.webp','d400eafa2a1b6094b70ad73719a799f1ba1802da8283d8372659d47011717490'],
 ['josh-mobile-share-blue-v3.jpg','https://cdn.openart.ai/openart-uploads/production/attachment-transfers/152c5cbc9922d8e3972c2a6fa28f315d04cc96e1148e31ac4f42d3d86f19c535.jpg','29798157760ccd27503a785a81466ea49088e6b317a7926105e92d2250787bd1']
];
await mkdir('public/assets',{recursive:true});
for(const [name,url,expected] of assets){
 const file='public/assets/'+name;
 let bytes=await readFile(file).catch(()=>null);
 if(!bytes){
  let lastError;
  for(let attempt=0;attempt<2;attempt++){
   try{const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('HTTP '+response.status);bytes=Buffer.from(await response.arrayBuffer());break;}catch(error){lastError=error;}
  }
  if(!bytes)throw Error('Approved image unavailable: '+name,{cause:lastError});
 }
 if(bytes.length>2000000||createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Image integrity check failed: '+name);
 await writeFile(file,bytes);
}
const result=spawnSync('python3',['scripts/apply-public-refresh.py'],{stdio:'inherit'});
if(result.error)throw result.error;
if(result.status!==0)throw Error('Static public-site preparation failed');
// Describe the current source packaging honestly; normal visitors use no external image service.
const docs='docs/PUBLIC-BRAND-REFRESH.md';
const text=await readFile(docs,'utf8');
await writeFile(docs,text.replace('Images are vendored under public/assets with SHA-256 regression tests; the website and normal build do not depend on OpenArt or any external image service. The one-time import script retains the hash-verified transfer sources for reproducibility.','Approved image bytes are downloaded during preparation from pinned public transfer URLs and verified with SHA-256. Each deployed build includes them under public/assets: browsers do not hotlink to OpenArt. A fresh build requires those transfer sources unless the exact files are already present. Backups are retained with the project handoff. Run npm test or npm run build to prepare the complete public output.'));
