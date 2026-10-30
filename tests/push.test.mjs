import test from 'node:test';
import assert from 'node:assert/strict';
import {createECDH,generateKeyPairSync,verify} from 'node:crypto';
import {encryptPushPayload,pushConfigured,sendWebPush,validatePushSubscription} from '../lib/web-push.mjs';
import {memoryStore} from './memory-store.mjs';
import {useTestStore} from '../lib/private-store.mjs';
process.env.NODE_ENV='test';useTestStore(memoryStore());

const b64=value=>Buffer.from(value).toString('base64url');
function keyPair(){
 const ecdh=createECDH('prime256v1');ecdh.generateKeys();
 return {p256dh:b64(ecdh.getPublicKey()),auth:b64(Buffer.alloc(16,19))};
}
function vapidKeys(){
 const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),jwk=pair.publicKey.export({format:'jwk'});
 return {pair,publicKey:b64(Buffer.concat([Buffer.from([4]),Buffer.from(jwk.x,'base64url'),Buffer.from(jwk.y,'base64url')])),privateKey:b64(pair.privateKey.export({format:'der',type:'pkcs8'}))};
}

test('phone push stays disabled unless owner explicitly configures it',()=>{
 delete process.env.JM_PUSH_ENABLED;delete process.env.JM_PUSH_PUBLIC_KEY;delete process.env.JM_PUSH_PRIVATE_KEY;
 assert.equal(pushConfigured(),false);
});

test('accepts only supported HTTPS push endpoints and valid P-256 keys',()=>{
 const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/synthetic',keys:keyPair()};
 assert.equal(validatePushSubscription(subscription).endpoint,subscription.endpoint);
 assert.throws(()=>validatePushSubscription({...subscription,endpoint:'http://fcm.googleapis.com/send/synthetic'}),/provider is not supported/);
 assert.throws(()=>validatePushSubscription({...subscription,endpoint:'https://attacker.example/push'}),/provider is not supported/);
 assert.throws(()=>validatePushSubscription({...subscription,keys:{p256dh:'bad',auth:'bad'}}),/keys are invalid/);
});

test('encrypts only the minimal push payload in an RFC 8291 aes128gcm record',()=>{
 const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/synthetic',keys:keyPair()};
 const plaintext=JSON.stringify({type:'request',reference:'JM-ABCDEFG2'});
 const record=encryptPushPayload(subscription,{type:'request',reference:'JM-ABCDEFG2'});
 assert.equal(record.readUInt32BE(16),4096);assert.equal(record[20],65);assert(record.length>102);
 assert(!record.includes(Buffer.from(plaintext)));
});

test('sends VAPID-signed encrypted pushes without exposing request details',async()=>{
 const keys=vapidKeys();process.env.JM_PUSH_ENABLED='true';process.env.JM_PUSH_PUBLIC_KEY=keys.publicKey;process.env.JM_PUSH_PRIVATE_KEY=keys.privateKey;
 const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/synthetic',keys:keyPair()};let captured;
 const oldFetch=globalThis.fetch;globalThis.fetch=async(url,init)=>{captured={url:String(url),init};return {ok:true,status:201};};
 try{
  const result=await sendWebPush(subscription,{type:'request',reference:'JM-ABCDEFG2'});
  assert.deepEqual(result,{ok:true,status:201});assert.equal(captured.url,subscription.endpoint);
  assert.equal(captured.init.headers['Content-Encoding'],'aes128gcm');assert.equal(captured.init.headers.TTL,'60');
  const match=captured.init.headers.Authorization.match(/^vapid t=([^,]+), k=(.+)$/);assert(match);
  const [header,claims,signature]=match[1].split('.');const jwt=JSON.parse(Buffer.from(claims,'base64url'));
  assert.equal(jwt.aud,'https://fcm.googleapis.com');assert.equal(jwt.sub,'mailto:joshmobileinc@gmail.com');
  assert(verify('sha256',Buffer.from(`${header}.${claims}`),{key:keys.pair.publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url')));
  assert(!captured.init.body.includes(Buffer.from('customer')));
 }finally{globalThis.fetch=oldFetch;delete process.env.JM_PUSH_ENABLED;delete process.env.JM_PUSH_PUBLIC_KEY;delete process.env.JM_PUSH_PRIVATE_KEY;}
});
