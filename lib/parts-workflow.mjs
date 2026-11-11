// Rules and contracts for manual parts research.  No supplier is contacted from
// this module, and it never asserts that a part fits a vehicle.
import {assert,text} from './auth.mjs';
import {cents} from './staff-pricing.mjs';

export const PARTS_REQUEST_STATUSES=Object.freeze(['draft','lookup_needed','researching','quoted','approved','ordered','received','cancelled']);
export const COMPATIBILITY_STATUSES=Object.freeze(['not_checked','needs_vehicle_details','unverified','verified_by_josh','not_compatible']);
export const DEFAULT_PARTS_SETTINGS=Object.freeze({markupPercent:null,defaultLaborCents:null,updatedAt:''});

// This is an interface contract, not an implementation. Supplier connections
// stay disabled until Josh has authorized a supplier and supplied credentials.
export const SUPPLIER_INTEGRATION_CONTRACT=Object.freeze({
 version:1,
 disabledByDefault:true,
 capabilities:['searchByPartNumber','searchByVehicleFitment','wholesalePrice','availability','productUrl'],
 requiredConfiguration:['supplierIdentifier','authenticationConfiguration'],
 resultFields:['supplierIdentifier','supplierSku','partNumber','wholesalePriceCents','availability','productUrl','checkedAt'],
 safeguards:['never store credentials in source','never scrape or bypass a supplier login','never claim fitment without supplier or Josh verification']
});

const lookupCategories={
 brakes:'brake parts',suspension:'suspension parts',ignition:'ignition parts',
 'engine-filter':'engine air filter','cabin-filter':'cabin air filter',inspection:'inspection supplies',other:'parts research'
};

export function categoryForService(service){return lookupCategories[String(service||'')]||'parts research';}
export function partsReadiness({service,vehicle={}}={}){
 const missing=[];
 for(const field of ['year','make','model'])if(!String(vehicle[field]||'').trim())missing.push(field);
 const fitmentCritical=String(service||'')==='brakes'||/brake/i.test(String(service||''));
 if(fitmentCritical){
  if(!String(vehicle.trim||'').trim()&&!String(vehicle.vin||'').trim())missing.push('trim or VIN');
  if(!String(vehicle.engine||'').trim()&&!String(vehicle.vin||'').trim())missing.push('engine or VIN');
 }
 const base={
  partCategory:categoryForService(service),
  missingDetails:[...new Set(missing)],
  compatibilityStatus:missing.length?'needs_vehicle_details':'unverified',
  warning:fitmentCritical?'Brake fitment can vary by trim, engine, brake package and VIN. Verify before quoting.':'Verify exact fitment and part numbers before quoting.'
 };
 return {...base,readyForManualLookup:base.missingDetails.length===0};
}

export function validatePartsSettings(value={},prior=DEFAULT_PARTS_SETTINGS){
 const rawMarkup=value.markupPercent===undefined?prior.markupPercent:value.markupPercent;
 const markup=rawMarkup===null||rawMarkup===''?null:Number(rawMarkup);
 assert(markup===null||Number.isFinite(markup)&&markup>=0&&markup<=500,'Markup must be between 0% and 500%, or left blank.',400);
 const savedLabor=prior.defaultLaborCents??null;
 const labor=cents(value.defaultLabor===undefined?(savedLabor===null?null:(savedLabor/100).toFixed(2)):value.defaultLabor,'Default labor');
 return {markupPercent:markup===null?null:Number(markup.toFixed(2)),defaultLaborCents:labor===undefined?prior.defaultLaborCents??null:labor};
}

export function proposedEstimate(quote={},settings=DEFAULT_PARTS_SETTINGS,request={}){
 const parts=Number.isSafeInteger(quote.supplierPriceCents)?quote.supplierPriceCents:null;
 const markup=settings.markupPercent;
 const labor=Number.isSafeInteger(request.laborCents)?request.laborCents:Number.isSafeInteger(settings.defaultLaborCents)?settings.defaultLaborCents:null;
 if(parts===null||markup===null||markup===undefined||labor===null)return null;
 const quantity=Number.isInteger(request.quantity)&&request.quantity>0?request.quantity:1;
 const markedUp=Math.round(parts*quantity*(1+markup/100));
 return markedUp+labor;
}

export function partsRequestFields(input={},prior={}){
 const quantity=Number(input.quantity===undefined?prior.quantity??1:input.quantity);
 assert(Number.isInteger(quantity)&&quantity>=1&&quantity<=100,'Quantity must be a whole number from 1 to 100.',400);
 const status=String(input.status===undefined?prior.status||'lookup_needed':input.status);
 assert(PARTS_REQUEST_STATUSES.includes(status),'Choose a valid parts request status.',400);
 const compatibilityStatus=String(input.compatibilityStatus===undefined?prior.compatibilityStatus||'not_checked':input.compatibilityStatus);
 assert(COMPATIBILITY_STATUSES.includes(compatibilityStatus),'Choose a valid compatibility status.',400);
 const savedLabor=prior.laborCents??null;
 const labor=cents(input.labor===undefined?(savedLabor===null?null:(savedLabor/100).toFixed(2)):input.labor,'Parts-request labor');
 return {
  requestedPart:text(input.requestedPart===undefined?prior.requestedPart||'':input.requestedPart,160),
  partCategory:text(input.partCategory===undefined?prior.partCategory||'':input.partCategory,100),
  oemPartNumber:text(input.oemPartNumber===undefined?prior.oemPartNumber||'':input.oemPartNumber,100),
  aftermarketPartNumber:text(input.aftermarketPartNumber===undefined?prior.aftermarketPartNumber||'':input.aftermarketPartNumber,100),
  quantity,status,compatibilityStatus,
  laborCents:labor===undefined?prior.laborCents??null:labor,
  notes:text(input.notes===undefined?prior.notes||'':input.notes,6000)
 };
}

export function supplierQuoteFields(input={}){
 const sourceUrl=text(input.sourceUrl,2048);
 if(sourceUrl){let url;try{url=new URL(sourceUrl);}catch{assert(false,'Enter a valid supplier source URL.',400);}assert(['https:','http:'].includes(url.protocol),'Supplier source URL must use http or https.',400);}
 const supplier=text(input.supplier,120);
 assert(supplier||sourceUrl,'Enter a supplier name or source URL.',400);
 const supplierPrice=cents(input.supplierPrice,'Supplier price');
 const retailPrice=cents(input.retailPrice,'Retail price');
 return {
  supplier,supplierSku:text(input.supplierSku,120),
  supplierPriceCents:supplierPrice===undefined?null:supplierPrice,
  retailPriceCents:retailPrice===undefined?null:retailPrice,
  availability:text(input.availability,240),sourceUrl,
  partNumber:text(input.partNumber,100),notes:text(input.notes,4000)
 };
}
