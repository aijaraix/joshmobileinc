import {guard,body,assert,fail} from '../lib/auth.mjs';
import {verifyUpload,finishUpload} from '../lib/media.mjs';
export default async function handler(req,res){try{guard(req,res);assert(req.method==='POST','Method not allowed.',405);const b=body(req);await verifyUpload(b.id,b.token,b.index);await finishUpload(b.id,b.index);return res.status(200).json({ok:true,index:b.index});}catch(e){return fail(res,e);}}
