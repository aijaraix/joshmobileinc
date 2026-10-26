import {guard,assert,fail,headers} from '../lib/auth.mjs';
import {slotsForDate,validDate} from '../lib/availability.mjs';
export default async function handler(req,res){try{
 headers(res);assert(req.method==='GET','Method not allowed.',405);
 const date=String(req.query?.date||'');assert(validDate(date),'Choose a valid date.',400);
 const result=await slotsForDate(date);
 res.setHeader('Cache-Control','no-store');
 return res.status(200).json(result);
}catch(e){return fail(res,e);}}