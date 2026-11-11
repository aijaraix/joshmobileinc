// Private CRM validation and compatibility helpers.  This module deliberately
// does not decode VINs or infer fitment; all vehicle facts remain staff-entered.
import {assert,text,validVin} from './auth.mjs';
import {normalizePhone} from './request.mjs';

export const JOB_STATUSES=Object.freeze(['requested','confirmed','scheduled','in_progress','completed','cancelled','no_show']);
export const APPOINTMENT_STATUSES=Object.freeze(['confirmed','scheduled']);
export const TERMINAL_STATUSES=Object.freeze(['completed','cancelled','no_show']);
export const CUSTOMER_STATUSES=Object.freeze(['active','archived']);

const cleanPhone=value=>{
 const raw=text(value,30),digits=raw.replace(/\D/g,'');
 assert(!digits||digits.length>=10&&digits.length<=15,'Enter a phone number with 10–15 digits.',400);
 return {phone:raw,normalizedPhone:digits?normalizePhone(raw):''};
};
const cleanEmail=value=>{
 const email=text(value,160).toLowerCase();
 assert(!email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Enter a valid email address.',400);
 return email;
};
const cleanYear=value=>{
 const year=text(value,4);
 assert(!year||/^(?:19|20)\d{2}$/.test(year),'Vehicle year must be four digits.',400);
 return year;
};
const cleanMileage=value=>{
 if(value===undefined||value===null||String(value).trim()==='')return null;
 const numeric=Number(String(value).trim());
 assert(Number.isInteger(numeric)&&numeric>=0&&numeric<=2000000,'Mileage must be a whole number from 0 to 2,000,000.',400);
 return numeric;
};

export function normalizeJobStatus(value,prior='requested'){
 const status=value===undefined?prior:String(value);
 assert(JOB_STATUSES.includes(status),'Choose a valid appointment status.',400);
 return status;
}
export const isScheduledStatus=status=>APPOINTMENT_STATUSES.includes(status);
export const isTerminalStatus=status=>TERMINAL_STATUSES.includes(status);

export function customerFields(input={},prior={}){
 const contact=cleanPhone(Object.hasOwn(input,'phone')?input.phone:prior.phone||'');
 const email=cleanEmail(Object.hasOwn(input,'email')?input.email:prior.email||'');
 const name=text(Object.hasOwn(input,'name')?input.name:prior.name||'',90);
 assert(name,'Enter the customer name.',400);
 assert(contact.normalizedPhone||email,'Enter a phone number or email address for this customer.',400);
 const status=Object.hasOwn(input,'status')?String(input.status):prior.status||'active';
 assert(CUSTOMER_STATUSES.includes(status),'Choose a valid customer status.',400);
 return {
  name,phone:contact.phone,normalizedPhone:contact.normalizedPhone,email,
  address:text(Object.hasOwn(input,'address')?input.address:prior.address||'',240),
  city:text(Object.hasOwn(input,'city')?input.city:prior.city||'',100),
  notes:text(Object.hasOwn(input,'notes')?input.notes:prior.notes||'',6000),
  preferences:text(Object.hasOwn(input,'preferences')?input.preferences:prior.preferences||'',2000),
  communicationInstructions:text(Object.hasOwn(input,'communicationInstructions')?input.communicationInstructions:prior.communicationInstructions||'',2000),
  status
 };
}

export function vehicleFields(input={},prior={},requireIdentity=true){
 const vin=text(Object.hasOwn(input,'vin')?input.vin:prior.vin||'',17).toUpperCase();
 assert(!vin||validVin(vin),'VIN must contain 17 valid characters (I, O and Q are not used).',400);
 const year=cleanYear(Object.hasOwn(input,'year')?input.year:prior.year||'');
 const make=text(Object.hasOwn(input,'make')?input.make:prior.make||'',60);
 const model=text(Object.hasOwn(input,'model')?input.model:prior.model||'',80);
 const trim=text(Object.hasOwn(input,'trim')?input.trim:prior.trim||'',80);
 const engine=text(Object.hasOwn(input,'engine')?input.engine:prior.engine||'',100);
 const licensePlate=text(Object.hasOwn(input,'licensePlate')?input.licensePlate:prior.licensePlate||'',20).toUpperCase();
 const mileage=cleanMileage(Object.hasOwn(input,'mileage')?input.mileage:prior.mileage);
 if(requireIdentity){
  assert(vin||year&&make&&model,'Enter a VIN or a year, make and model before saving a vehicle.',400);
 }
 return {vin,year,make,model,trim,engine,mileage,licensePlate,notes:text(Object.hasOwn(input,'vehicleNotes')?input.vehicleNotes:Object.hasOwn(input,'notes')?input.notes:prior.notes||'',4000)};
}

export function vehicleLabel(vehicle={}){
 return [vehicle.year,vehicle.make,vehicle.model,vehicle.trim].filter(Boolean).join(' ')||vehicle.vin||'Vehicle details pending';
}

export function matchingCustomers(customers=[],candidate={},excludeId=''){
 const phone=String(candidate.normalizedPhone||'');
 const email=String(candidate.email||'').trim().toLowerCase();
 if(!phone&&!email)return [];
 return customers.filter(customer=>customer.id!==excludeId&&customer.status!=='archived'&&(
  phone&&customer.normalizedPhone===phone||email&&String(customer.email||'').toLowerCase()===email
 ));
}

export function matchingVehicles(vehicles=[],customerId,vehicle={}){
 const vin=String(vehicle.vin||'').toUpperCase();
 const plate=String(vehicle.licensePlate||'').toUpperCase();
 return vehicles.filter(item=>item.customerId===customerId&&(
  vin&&String(item.vin||'').toUpperCase()===vin||plate&&String(item.licensePlate||'').toUpperCase()===plate
 ));
}

export function jobVehicleSnapshot(input={},prior={}){
 // Jobs keep their own snapshot.  Updating a customer or vehicle later never
 // rewrites a historical repair record.
 return vehicleFields(input,prior,false);
}

export function jobContactSnapshot(input={},prior={}){
 const contact=cleanPhone(Object.hasOwn(input,'phone')?input.phone:prior.phone||'');
 const email=cleanEmail(Object.hasOwn(input,'email')?input.email:prior.email||'');
 const name=text(Object.hasOwn(input,'name')?input.name:prior.name||'',90);
 assert(name,'Enter the customer name.',400);
 assert(contact.normalizedPhone||email,'Enter a phone number or email address.',400);
 return {name,phone:contact.phone,normalizedPhone:contact.normalizedPhone,email};
}

export function customerCandidateFromJob(job={}){
 return {name:job.name||'',phone:job.phone||'',normalizedPhone:job.normalizedPhone||'',email:job.email||'',address:job.address||'',city:job.city||''};
}
