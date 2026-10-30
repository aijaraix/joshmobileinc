import {generateKeyPairSync} from 'node:crypto';
const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const jwk=publicKey.export({format:'jwk'});
const fromUrl=value=>Buffer.from(value,'base64url');
const publicBytes=Buffer.concat([Buffer.from([4]),fromUrl(jwk.x),fromUrl(jwk.y)]);
const privateBytes=privateKey.export({format:'der',type:'pkcs8'});
console.log(JSON.stringify({JM_PUSH_PUBLIC_KEY:publicBytes.toString('base64url'),JM_PUSH_PRIVATE_KEY:privateBytes.toString('base64url')},null,2));
