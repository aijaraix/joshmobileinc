import test from 'node:test';
import assert from 'node:assert/strict';
import {customerFields,vehicleFields,matchingCustomers,normalizeJobStatus} from '../lib/crm.mjs';
import {partsReadiness,proposedEstimate,validatePartsSettings} from '../lib/parts-workflow.mjs';
import {pricingFields} from '../lib/staff-pricing.mjs';
import {readFileSync} from 'node:fs';

test('customer and VIN-optional vehicle validation protects identity without inventing details',()=>{
 const customer=customerFields({name:'Pat Test',phone:'202-555-0188',email:'PAT@example.test'});
 assert.equal(customer.normalizedPhone,'+12025550188');assert.equal(customer.email,'pat@example.test');
 const vehicle=vehicleFields({year:'2017',make:'Honda',model:'Accord',trim:'Sport',engine:'2.4L',mileage:'100000'}, {}, true);
 assert.equal(vehicle.vin,'');assert.equal(vehicle.mileage,100000);
 assert.throws(()=>vehicleFields({year:'2017',make:'Honda'}, {}, true));
 assert.equal(matchingCustomers([{id:'a',status:'active',...customer}],customer).length,1);
 assert.equal(normalizeJobStatus('no_show'),'no_show');
});

test('brake research makes fitment limits visible and estimates use real cents only',()=>{
 const incomplete=partsReadiness({service:'brakes',vehicle:{year:'2020',make:'Ford',model:'F-150'}});
 assert.equal(incomplete.compatibilityStatus,'needs_vehicle_details');assert(incomplete.missingDetails.includes('trim or VIN'));
 const complete=partsReadiness({service:'brakes',vehicle:{year:'2020',make:'Ford',model:'F-150',vin:'1FTFW1E5XLFA00001'}});
 assert.equal(complete.compatibilityStatus,'unverified');
 const settings=validatePartsSettings({markupPercent:'25',defaultLabor:'85'});
 assert.equal(proposedEstimate({supplierPriceCents:10000},settings,{quantity:1}),21000);
 assert.equal(proposedEstimate({},settings,{quantity:1}),null);
});

test('job pricing supports override charges, staff payment and a cents balance',()=>{
 const price=pricingFields({partsCharge:'100',laborCharge:'85',additionalFees:'5',discount:'10',tax:'9',amountPaid:'189',paymentStatus:'paid'});
 assert.equal(price.calculatedTotalCents,18900);assert.equal(price.finalJobTotalCents,18900);assert.equal(price.outstandingBalanceCents,0);
 assert.throws(()=>pricingFields({finalCharged:'10',amountPaid:'11',paymentStatus:'paid'}));
});

test('owner UI exposes V2/V2.5 controls and keeps manual supplier workflow explicit',()=>{
 const html=readFileSync(new URL('../public/owner/index.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/owner/dashboard.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../public/owner/dashboard.css',import.meta.url),'utf8');
 const booking=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 for(const id of ['new-customer-btn','customer-dialog','vehicle-dialog','parts-view','parts-request-dialog','parts-charge','amount-paid','create-parts-request','service-catalog-list'])assert(html.includes('id="'+id+'"'),id);
 assert(html.includes('Manual research only. No supplier account'));
 assert(js.includes("api('create-customer'"));assert(js.includes("api('create-parts-request'"));assert(js.includes("api('approve-parts-estimate'"));
 assert(js.includes('function customerSearchText'));assert(js.includes('customerSearchText(customer).includes(q)'));
 assert(css.includes('.vehicle-card'));assert(css.includes('@media(max-width:650px)'));
 for(const name of ['trim','engine','mileage'])assert(booking.includes('name="'+name+'"'),name);
 assert(!booking.includes('name="vin" required'));
});
