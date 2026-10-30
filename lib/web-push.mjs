import {createECDH,createHmac,createPrivateKey,createPublicKey,randomBytes,sign as signData,createCipheriv} from 'node:crypto';
import {assert,text} from './auth.mjs';

const b64=value=>Buffer.from(value).toString('base64url');
const from64=value=>Buffer.from(String(value||''),'base64url');
const extract=(salt,ikm)=>createHmac('sha256',salt).update(ikm).digest();
function expand(prk,info,length){
 let output=Buffer.alloc(0),previous=Buffer.alloc(0),counter=1;
 while(output.length<length){previous=createHmac('sha256',prk).update(Buffer.concat([previous,info,Buffer.from([counter++])])).digest();output=Buffer.concat([output,previous]);}
 return output.subarray(0,length);
}
function publicKey(){const key=from64(process.env.JM_PUSH_PUBLIC_KEY);assert(key.length===65&&key[0]===4,'Push is not configured.',503);return key;}
function privateKey(){const key=from64(process.env.JM_PUSH_PRIVATE_KEY);assert(key.length>0,'Push is not configured.',503);return createPrivateKey({key,format:'der',type:'pkcs8'});}
export function pushConfigured(){try{if(process.env.JM_PUSH_ENABLED!=='true')return false;const pub=publicKey(),privateKeyObject=privateKey(),jwk=createPublicKey(privateKeyObject).export({format:'jwk'}),derived=Buffer.concat([Buffer.from([4]),from64(jwk.x),from64(jwk.y)]);return pub.equals(derived);}catch{return false;}}
export function validatePushSubscription(value){
 assert(value&&typeof value==='object'&&!Array.isArray(value),'Choose a device subscription.');
 const endpoint=typeof value.endpoint==='string'?value.endpoint.trim():'';assert(endpoint.length>0&&endpoint.length<=2048,'The device subscription is invalid.');let url;
 try{url=new URL(endpoint);}catch{throw Object.assign(new Error('The device subscription is invalid.'),{status:400});}
 const hosts=new Set(['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com']);
 assert(url.protocol==='https:'&&hosts.has(url.hostname.toLowerCase())&&!url.username&&!url.password,'This push provider is not supported.',400);
 const keys=value.keys||{},p256dh=from64(keys.p256dh),auth=from64(keys.auth);
 assert(p256dh.length===65&&p256dh[0]===4&&auth.length>=16&&auth.length<=32,'The device subscription keys are invalid.',400);
 try{const check=createECDH('prime256v1');check.generateKeys();check.computeSecret(p256dh);}catch{throw Object.assign(new Error('The device subscription keys are invalid.'),{status:400});}
 return {endpoint,keys:{p256dh:b64(p256dh),auth:b64(auth)},expirationTime:Number.isFinite(value.expirationTime)?value.expirationTime:null};
}
function vapidToken(audience){
 const header=b64(JSON.stringify({typ:'JWT',alg:'ES256'}));
 const claims=b64(JSON.stringify({aud:audience,exp:Math.floor(Date.now()/1000)+12*60*60,sub:'mailto:joshmobileinc@gmail.com'}));
 const message=`${header}.${claims}`;
 const signature=signData('sha256',Buffer.from(message),{key:privateKey(),dsaEncoding:'ieee-p1363'});
 return `${message}.${b64(signature)}`;
}
export function encryptPushPayload(subscription,payload){
 const receiver=from64(subscription.keys.p256dh),auth=from64(subscription.keys.auth);
 assert(receiver.length===65&&receiver[0]===4&&auth.length>=16,'The device subscription keys are invalid.',400);
 const ephemeral=createECDH('prime256v1');ephemeral.generateKeys();
 const sender=ephemeral.getPublicKey();const shared=ephemeral.computeSecret(receiver);
 const authPrk=extract(auth,shared);
 const keyInfo=Buffer.concat([Buffer.from('WebPush: info\0'),receiver,sender]);
 const ikm=expand(authPrk,keyInfo,32);const salt=randomBytes(16);const prk=extract(salt,ikm);
 const cek=expand(prk,Buffer.from('Content-Encoding: aes128gcm\0'),16);
 const nonce=expand(prk,Buffer.from('Content-Encoding: nonce\0'),12);
 const encoded=Buffer.from(JSON.stringify(payload));assert(encoded.length<=3000,'Notification payload is too large.',400);
 const plaintext=Buffer.concat([encoded,Buffer.from([2])]);
 const cipher=createCipheriv('aes-128-gcm',cek,nonce);const ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final(),cipher.getAuthTag()]);
 const recordSize=Buffer.alloc(4);recordSize.writeUInt32BE(4096);
 return Buffer.concat([salt,recordSize,Buffer.from([sender.length]),sender,ciphertext]);
}
export async function sendWebPush(subscription,payload){
 const validated=validatePushSubscription(subscription);const endpoint=new URL(validated.endpoint);
 const body=encryptPushPayload(validated,payload);const authorization=`vapid t=${vapidToken(endpoint.origin)}, k=${b64(publicKey())}`;
 try{
  const response=await fetch(endpoint,{method:'POST',headers:{Authorization:authorization,'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream','TTL':'60','Urgency':'high'},body,signal:AbortSignal.timeout(8000)});
  return {ok:response.ok,status:response.status};
 }catch(error){return {ok:false,status:0,error:text(error?.message||'Network error',160)};}
}
