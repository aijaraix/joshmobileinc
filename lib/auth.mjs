import {randomBytes,createHmac,createHash,scryptSync,timingSafeEqual} from 'node:crypto';
export const ALLOWED_ADMINS=Object.freeze(['joshmobileinc@gmail.com','sholom@aicreates.ai']);
const COOKIE='__Host-jm_admin';
export const digest=s=>createHash('sha256').update(String(s)).digest('hex');
export const emailKey=email=>digest(String(email).toLowerCase());
export function passwordHash(password,salt=randomBytes(16).toString('hex')){
 if(typeof password!=='string'||password.length<14||password.length>128)throw new Error('Password must be 14–128 characters.');
 return 'scrypt$'+salt+'$'+scryptSync(password,Buffer.from(salt,'hex'),64).toString('hex');
}
export function verifyPassword(password,stored){
 if(typeof password!=='string'||password.length>128||!/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(stored||''))return false;
 const [,salt,expected]=stored.split('$');return timingSafeEqual(scryptSync(password,Buffer.from(salt,'hex'),64),Buffer.from(expected,'hex'));
}
const b64=value=>Buffer.from(value).toString('base64url');
const mac=(value,secret)=>createHmac('sha256',secret).update(value).digest('base64url');
export function createSession(email,hash,secret,now=Date.now()){
 if(!ALLOWED_ADMINS.includes(email)||!secret||secret.length<32)throw new Error('Auth not configured');
 const payload=b64(JSON.stringify({email,exp:now+43200000,v:digest(hash).slice(0,24)}));return payload+'.'+mac(payload,secret);
}
export function parseSession(token,secret,now=Date.now()){
 try{
  if(!secret||secret.length<32||typeof token!=='string'||token.length>1500)return null;
  const [body,sig,...rest]=token.split('.');if(!body||!sig||rest.length)return null;
  const expected=mac(body,secret);if(expected.length!==sig.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(sig)))return null;
  const data=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
  return ALLOWED_ADMINS.includes(data.email)&&Number.isFinite(data.exp)&&data.exp>now&&data.exp<=now+43200000&&/^[a-f0-9]{24}$/.test(data.v||'')?data:null;
 }catch{return null}
}
export function cookieHeader(token,maxAge=43200){return COOKIE+'='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+maxAge;}
export const clearCookie=()=>cookieHeader('',0);
export function cookieFrom(req){const entry=String(req.headers?.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));return entry?.slice(COOKIE.length+1)||''}
export function isSameOrigin(req){return ['https://joshmobileinc.com','https://www.joshmobileinc.com'].includes(req.headers?.origin)}
export function securityHeaders(res){res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff')}
export const validVin=v=>/^[A-HJ-NPR-Z0-9]{17}$/.test(String(v||'').trim().toUpperCase());
export function validConfirmedAt(v){const t=Date.parse(v);return Number.isFinite(t)&&t>Date.now()&&t<Date.now()+365*86400000}
