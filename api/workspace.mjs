import {available} from '../lib/private-store.mjs';
export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex');res.setHeader('X-Content-Type-Options','nosniff');
 return res.status(200).json({connected:available(),bookingMode:available()?'private':'direct-message'});
}
