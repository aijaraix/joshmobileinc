// Pure client-side helpers for the private owner catalog. These helpers only
// prepare form values; saving a job or supplier quote remains an explicit staff
// action in the dashboard.
export const centsToInput=value=>Number.isSafeInteger(value)?(value/100).toFixed(2):'';

export function catalogMargin(item={}){
 const cost=item.costCents,price=item.defaultPartsCents;
 if(!Number.isSafeInteger(cost)||!Number.isSafeInteger(price))return {dollarsCents:null,percent:null};
 const dollarsCents=price-cost;
 return {dollarsCents,percent:price===0?null:(dollarsCents/price)*100};
}

export function catalogItemByName(items=[],name='',kind=''){
 const needle=String(name||'').trim().toLocaleLowerCase('en-US');
 if(!needle)return null;
 return items.find(item=>item.active!==false&&(kind===''||item.kind===kind)&&String(item.name||'').trim().toLocaleLowerCase('en-US')===needle)||null;
}

const fillIfBlank=(current,cents)=>String(current??'').trim()===''?centsToInput(cents):current??'';

export function catalogPricingPrefill(item,current={}){
 if(!item)return {...current};
 return {
  ...current,
  quotedParts:fillIfBlank(current.quotedParts,item.defaultPartsCents),
  quotedLabor:fillIfBlank(current.quotedLabor,item.defaultLaborCents),
  supplierPartsCost:fillIfBlank(current.supplierPartsCost,item.costCents)
 };
}
