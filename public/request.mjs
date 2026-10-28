export const SERVICES = Object.freeze({brakes:'Brake pads & rotors',suspension:'Suspension',ignition:'Spark plugs & ignition coils','engine-filter':'Engine air filters','cabin-filter':'Cabin air filters',inspection:'Vehicle inspections'});
export const LIMITS = Object.freeze({count:6,perFile:15*1024*1024,total:30*1024*1024});
export function easternToday(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const p = Object.fromEntries(parts.map(x=>[x.type,x.value])); return `${p.year}-${p.month}-${p.day}`;
}
export function validateRequest(d,today=easternToday()) {
  if(!Object.hasOwn(SERVICES,d.service)) return 'Please select a service.';
  const year=Number(d.year); const thisYear=Number(today.slice(0,4));
  if(!Number.isInteger(year)||year<1900||year>thisYear+2) return 'Please enter a valid vehicle year.';
  for(const [key,max,label] of [['make',60,'make'],['model',80,'model'],['name',90,'name'],['city',100,'city or ZIP code']]) if(!String(d[key]||'').trim()||String(d[key]).length>max) return `Please enter your ${label}.`;
  if(String(d.description||'').trim().length<8||String(d.description).length>1800) return 'Please describe the work in 8–1,800 characters.';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date||'')) return 'Please choose a preferred date.';
  const date=new Date(`${d.date}T12:00:00Z`); if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==d.date||d.date<today) return 'Please choose today or a future date.';
  if(!['Morning','Afternoon','Flexible'].includes(d.time)&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.time||'')) return 'Please choose an available time.';
  if(!['Come to my location','Ask about bringing my car'].includes(d.locationType)) return 'Please choose a service location option.';
  if(!['text','phone','email','whatsapp'].includes(d.preferredContact)) return 'Please choose how Josh should contact you.';
  const phone=String(d.phone||'').replace(/\D/g,''); if(phone.length<10||phone.length>15) return 'Please enter a phone number with at least 10 digits.';
  if(d.email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)||d.email.length>160)) return 'Please enter a valid email address.';
  if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(String(d.vin||'').trim().toUpperCase())) return 'Enter a valid 17-character VIN (letters I, O, Q are not used).';
  if(!String(d.address||'').trim()||String(d.address).length>240)return 'Enter the service street address.';
  if(!d.consent) return 'Please agree to being contacted about your request.';
  return '';
}
export function fileError(existing,added) {
  const all=[...existing,...added];
  if(all.length>LIMITS.count)return 'Please select no more than 6 photos or videos.';
  let total=0;
  for(const f of all) {
    if((f.type||'')==='image/heic'||(f.type||'')==='image/heif')return 'HEIC photos are not supported for secure upload. Please choose a JPG, PNG or WebP file, or convert the photo first.';
    if(!/^image\/(jpeg|png|webp)$|^video\/(mp4|quicktime|webm)$/.test(f.type||''))return 'Choose JPG, PNG, WebP photos or MP4, MOV, WebM videos.';
    if(f.size===0)return 'One of the selected files is empty. Please choose another file.';
    if(f.size>LIMITS.perFile)return 'Each file must be 15 MB or smaller. Please shorten or compress the video.';
    total+=f.size;
  }
  if(total>LIMITS.total)return 'Please keep the combined file size below 30 MB.';
  return '';
}
export function normalizePhone(value) {
  const digits=String(value||'').replace(/\D/g,'');
  if(digits.length===10)return '+1'+digits;
  if(digits.length===11&&digits.startsWith('1'))return '+'+digits;
  return '+'+digits;
}
export function receiptMessage(reference) {
  return `Hi Josh, I submitted request ${reference} on your website. Please review my car details and text me to confirm a time. Thanks!`;
}
export function deliveryLinks(reference) {
  const body=encodeURIComponent(receiptMessage(reference));
  return {whatsapp:`https://wa.me/16467967322?text=${body}`,smsAndroid:`sms:+16467967322?body=${body}`,smsIOS:`sms:+16467967322&body=${body}`};
}
