import test from 'node:test';
import assert from 'node:assert/strict';
import {cents,pricingFields} from '../lib/staff-pricing.mjs';
import {readFileSync} from 'node:fs';

test('Staff price amounts are validated and stored in integer cents',()=>{
 assert.equal(cents('12.34'),1234);
 assert.equal(cents('0.09'),9);
 assert.equal(cents(''),null);
 assert.equal(cents(undefined),undefined);
 assert.throws(()=>cents('-4.50'));
 assert.throws(()=>cents('19.999'));
 const p=pricingFields({quotedParts:'125.25',quotedLabor:'80.50'});
 assert.equal(p.quotedTotalCents,20575);
 assert.equal(p.supplierPartsCostCents,null);
 assert.equal(p.finalChargedCents,null);
 assert.equal(p.paymentStatus,'not_recorded');
});

test('Private CRM exposes editable customers, historical appointments and manual supplier lookup',()=>{
 const html=readFileSync(new URL('../public/owner/index.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/owner/dashboard.js',import.meta.url),'utf8');
 for(const id of ['edit-name','edit-phone','edit-email','edit-year','edit-make',
 'edit-model','edit-service','edit-description','edit-preferred-date','edit-preferred-time',
 'quoted-parts','quoted-labor','supplier-parts-cost','final-charged','payment-status',
 'fitment-summary','copy-fitment','manual-record-kind','manual-appointment-at']){
   assert(html.includes('id="'+id+'"'),id);
 }
 assert(js.includes('quotedParts:'));
 assert(html.includes('https://app.partstech.com/'));
 assert(html.includes('Past completed job (historical)'));
});
