import {randomBytes,createHash,createHmac,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
export const ADMINS=Object.freeze(['joshmobileinc@gmail.com','sholom@aicreates.ai']);
export const digest=v=>createHash('sha256').update(String(v)).digest('hex');
export const text=(v,n=200)=>String(v??'').trim().slice(0,n);
export const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export const validVin=v=>/^[A-HJ-NPR-Z0-9]{17}$/.test(String(v||'').trim().toUpperCase());
export async function passwordHash(p,salt=randomBytes(16).toString('hex')){
 if(typeof p!=='string'||p.length<16||p.length>128)throw new Error('Use 16–128 characters for your password.');
 const key=await derive(p,Buffer.from(salt,'hex'),64,{N:131072,r:8,p:1,maxmem:256*1024*1024});
 return `scrypt17$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(p,h){
 if(typeof p!=='string'||p.length<16||p.length>128||!/^scrypt17\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(h||''))return false;
 const [,salt]=h.split('$');return same(await passwordHash(p,salt),h);
}
export const SECRET=()=>process.env.JM_SESSION_SECRET||'';
export function sign(data){if(SECRET().length<40)throw new Error('Authentication unavailable');const b=Buffer.from(JSON.stringify(data)).toString('base64url');return `${b}.${createHmac('sha256',SECRET()).update(b).digest('base64url')}`;}
export function unsign(token){try{if(typeof token!=='string'||token.length>1800)return null;const [b,s,...extra]=token.split('.');if(extra.length||!same(s,createHmac('sha256',SECRET()).update(b).digest('base64url')))return null;const d=JSON.parse(Buffer.from(b,'base64url'));return Number.isFinite(d.exp)&&d.exp>Date.now()?d:null;}catch{return null;}}
export function cookie(token,age=43200){return `__Host-jm_admin=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;}
export function cookieFrom(req){return String(req.headers?.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-jm_admin='))?.split('=').slice(1).join('=')||'';}
export const sameOrigin=req=>['https://joshmobileinc.com','https://www.joshmobileinc.com'].includes(req.headers?.origin);
export function headers(res){res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Type','application/json; charset=utf-8');}
export function body(req,max=65536){if(Number(req.headers?.['content-length']||0)>max)throw Object.assign(new Error('Request too large.'),{status:413});let b;try{b=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{throw Object.assign(new Error('Invalid JSON.'),{status:400});}if(!b||typeof b!=='object'||Array.isArray(b)||JSON.stringify(b).length>max)throw Object.assign(new Error('Invalid request.'),{status:400});return b;}
export function guard(req,res){headers(res);if(req.method==='POST'&&(!sameOrigin(req)||!String(req.headers?.['content-type']).startsWith('application/json')))throw Object.assign(new Error('Request not allowed.'),{status:403});}
export function fail(res,e){const status=e.status||(/precondition|already exists|conflict/i.test(e.message||'')?409:503);if(status===503)console.error('Workspace operation failed',e.name||'Error');return res.status(status).json({error:status===503?'The service is temporarily unavailable. Please retry or text Josh.':status===409?'This record changed. Refresh and try again.':e.message});}
export function assert(ok,msg,status=400){if(!ok)throw Object.assign(new Error(msg),{status});}
