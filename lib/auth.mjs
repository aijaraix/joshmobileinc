
import {randomBytes,createHash,createHmac,scryptSync,timingSafeEqual} from 'node:crypto';
export const ALLOWED_ADMINS=Object.freeze(['joshmobileinc@gmail.com','sholom@aicreates.ai']);
const COOKIE='__Host-jm_admin';
export const digest=value=>createHash('sha256').update(String(value)).digest('hex');
export const emailKey=email=>digest(email.toLowerCase());
export const validVin=value=>/^[A-HJ-NPR-Z0-9]{17}$/.test(String(value||'').trim().toUpperCase());
export function passwordHash(password,salt=randomBytes(16).toString('hex')){
 if(typeof password!=='string'||password.length<16||password.length>128)throw new Error('Password must have 16–128 characters');
 return 'scrypt$'+salt+'$'+scryptSync(password,Buffer.from(salt,'hex'),64).toString('hex');
}
export function verifyPassword(password,stored){
 if(typeof password!=='string'||password.length>128||!/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(stored||''))return false;
 const [,salt,expected]=stored.split('$');
 return timingSafeEqual(scryptSync(password,Buffer.from(salt,'hex'),64),Buffer.from(expected,'hex'));
}
const hmac=(v,secret)=>createHmac('sha256',secret).update(v).digest('base64url');
export function createSession(email,hash,secret,now=Date.now()){
 if(!ALLOWED_ADMINS.includes(email)||!secret||secret.length<32)throw new Error('Auth not configured');
 const body=Buffer.from(JSON.stringify({email,exp:now+12*3600000,v:digest(hash).slice(0,24)})).toString('base64url');
 return body+'.'+hmac(body,secret);
}
export function parseSession(token,secret,now=Date.now()){
 try{
  if(!secret||secret.length<32||typeof token!=='string'||token.length>1500)return null;
  const [body,sig,...extra]=token.split('.');
  if(!body||!sig||extra.length)return null;
  const expected=hmac(body,secret);
  if(expected.length!==sig.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(sig)))return null;
  const data=JSON.parse(Buffer.from(body,'base64url').toString());
  return ALLOWED_ADMINS.includes(data.email)&&Number.isFinite(data.exp)&&data.exp>now&&data.exp<=now+12*3600000&&/^[0-9a-f]{24}$/.test(data.v||'')?data:null;
 }catch{return null;}
}
export function cookieHeader(token,maxAge=43200){return COOKIE+'='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+maxAge;}
export function clearCookie(){return cookieHeader('',0);}
export function cookieFrom(req){const found=String(req.headers?.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='));return found?.slice(COOKIE.length+1)||'';}
export function isSameOrigin(req){return ['https://joshmobileinc.com','https://www.joshmobileinc.com'].includes(String(req.headers?.origin||''));}
export function securityHeaders(res){res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');}
export function validAppointment(value){const t=Date.parse(value);return Number.isFinite(t)&&t>Date.now()&&t<Date.now()+365*86400000;}
