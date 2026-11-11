// Private staff-entered amounts. All persisted values are integer cents;
// this module does not charge cards, calculate sales tax, or query suppliers.
import {assert} from './auth.mjs';
export function cents(value, label='Amount') {
 if(value===undefined) return undefined;
 if(value===null||value==='')return null;
 const input=String(value).trim();
 assert(/^\d{1,7}(?:\.\d{1,2})?$/.test(input),label+' must be a nonnegative dollar amount with up to two decimals.',400);
 const [whole,decimal='']=input.split('.');
 const output=Number(whole)*100+Number(decimal.padEnd(2,'0'));
 assert(Number.isSafeInteger(output)&&output<=100000000,label+' is too large.',400);
 return output;
}
export function pricingFields(body, previous={}) {
 const fields=[['quotedParts','quotedPartsCents'],['quotedLabor','quotedLaborCents'],['supplierPartsCost','supplierPartsCostCents'],['finalCharged','finalChargedCents']];
 const value={};
 for(const [input,stored] of fields){
  const parsed=cents(body[input],input);
  value[stored]=parsed===undefined?previous[stored]??null:parsed;
 }
 const status=body.paymentStatus===undefined?(previous.paymentStatus||'not_recorded'):String(body.paymentStatus);
 assert(['not_recorded','unpaid','partially_paid','paid'].includes(status),'Choose a valid payment status.',400);
 value.paymentStatus=status;
 value.quotedTotalCents=value.quotedPartsCents===null&&value.quotedLaborCents===null?null:(value.quotedPartsCents||0)+(value.quotedLaborCents||0);
 return value;
}
