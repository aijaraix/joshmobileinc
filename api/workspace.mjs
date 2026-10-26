import {available} from '../lib/private-store.mjs';
import {SECRET,headers} from '../lib/auth.mjs';
export default function handler(req,res){headers(res);const ready=available()&&SECRET().length>=40&&process.env.JM_BOOKING_ENABLED==='true';res.status(200).json({connected:ready,bookingMode:ready?'private':'direct-message',staffLogin:available()&&SECRET().length>=40});}
