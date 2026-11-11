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
 // Every monetary value is an integer number of cents at rest.  These records
 // are staff bookkeeping only: this function never creates a payment, invoice,
 // tax filing, or outbound customer communication.
 const fields=[
  ['quotedParts','quotedPartsCents'],['quotedLabor','quotedLaborCents'],
  ['supplierPartsCost','supplierPartsCostCents'],['finalCharged','finalChargedCents'],
  ['partsCharge','partsChargeCents'],['laborCharge','laborChargeCents'],
  ['additionalFees','additionalFeesCents'],['discount','discountCents'],
  ['tax','taxCents'],['amountPaid','amountPaidCents']
 ];
 const value={};
 for(const [input,stored] of fields){
  const parsed=cents(body[input],input);
  value[stored]=parsed===undefined?previous[stored]??null:parsed;
 }
 const status=body.paymentStatus===undefined?(previous.paymentStatus||'not_recorded'):String(body.paymentStatus);
 assert(['not_recorded','unpaid','partially_paid','paid'].includes(status),'Choose a valid payment status.',400);
 value.paymentStatus=status;
 value.quotedTotalCents=value.quotedPartsCents===null&&value.quotedLaborCents===null?null:(value.quotedPartsCents||0)+(value.quotedLaborCents||0);
 const parts=value.partsChargeCents??value.quotedPartsCents;
 const labor=value.laborChargeCents??value.quotedLaborCents;
 const hasCalculation=[parts,labor,value.additionalFeesCents,value.discountCents,value.taxCents].some(Number.isSafeInteger);
 value.calculatedTotalCents=hasCalculation?Math.max(0,(parts||0)+(labor||0)+(value.additionalFeesCents||0)+(value.taxCents||0)-(value.discountCents||0)):null;
 value.finalJobTotalCents=value.finalChargedCents??value.calculatedTotalCents;
 if(status==='paid'&&value.finalJobTotalCents!==null&&value.amountPaidCents===null)value.amountPaidCents=value.finalJobTotalCents;
 if(status==='unpaid'&&value.amountPaidCents===null)value.amountPaidCents=0;
 if(status==='partially_paid'){
  assert(value.finalJobTotalCents!==null,'Enter a final total before recording a partial payment.',400);
  assert(Number.isSafeInteger(value.amountPaidCents)&&value.amountPaidCents>0&&value.amountPaidCents<value.finalJobTotalCents,'A partial payment must be greater than $0 and less than the final total.',400);
 }
 if(value.finalJobTotalCents!==null&&value.amountPaidCents!==null){
  assert(value.amountPaidCents<=value.finalJobTotalCents,'Amount paid cannot exceed the final job total.',400);
  value.outstandingBalanceCents=Math.max(0,value.finalJobTotalCents-value.amountPaidCents);
 }else value.outstandingBalanceCents=null;
 return value;
}
