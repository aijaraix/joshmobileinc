import {available} from '../lib/private-store.mjs';
export default function handler(req,res){res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex');res.status(200).json({connected:available(),ownerUrl:null,bookingMode:available()?'private':'direct-message'});}
