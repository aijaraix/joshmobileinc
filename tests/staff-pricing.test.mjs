import test from 'node:test';
import assert from 'node:assert/strict';
import {cents,pricingFields} from '../lib/staff-pricing.mjs';
import {catalogItemByName,catalogMargin,catalogPricingPrefill} from '../public/owner/catalog-pricing.mjs';
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

test('Catalog cost, customer price, margin, and defaults keep staff-entered values',()=>{
 const item={kind:'service',name:'Brake service',active:true,costCents:7525,defaultPartsCents:14550,defaultLaborCents:10000};
 assert.deepEqual(catalogMargin(item),{dollarsCents:7025,percent:7025/14550*100});
 assert.deepEqual(catalogMargin({costCents:null,defaultPartsCents:14550}),{dollarsCents:null,percent:null});
 assert.equal(catalogItemByName([item],' brake SERVICE ','service'),item);
 assert.equal(catalogItemByName([{...item,active:false}],'Brake service','service'),null);
 assert.deepEqual(catalogPricingPrefill(item,{quotedParts:'',quotedLabor:'',supplierPartsCost:''}),{quotedParts:'145.50',quotedLabor:'100.00',supplierPartsCost:'75.25'});
 assert.deepEqual(catalogPricingPrefill(item,{quotedParts:'180.00',quotedLabor:'',supplierPartsCost:'70.00'}),{quotedParts:'180.00',quotedLabor:'100.00',supplierPartsCost:'70.00'});
});

test('Private CRM exposes editable customers, historical appointments and manual supplier lookup',()=>{
 const html=readFileSync(new URL('../public/owner/index.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/owner/dashboard.js',import.meta.url),'utf8');
 for(const id of ['edit-name','edit-phone','edit-email','edit-year','edit-make',
 'edit-model','edit-service','edit-description','edit-preferred-date','edit-preferred-time',
 'quoted-parts','quoted-labor','supplier-parts-cost','final-charged','payment-status',
 'fitment-summary','copy-fitment','manual-record-kind','manual-appointment-at','pricing-view',
 'service-catalog-list','add-common-catalog-item','catalog-item-options']){
   assert(html.includes('id="'+id+'"'),id);
 }
 assert(js.includes('quotedParts:'));
 assert(js.includes('sectionConfig={'));
 assert(html.includes('data-section="pricing"'));
 assert(html.includes('https://app.partstech.com/'));
 assert(html.includes('Past completed job (historical)'));
});
