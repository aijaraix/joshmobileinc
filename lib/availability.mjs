import {readJson,allJobs} from './private-store.mjs';
import {assert} from './auth.mjs';
export const SETTINGS_PATH='settings/availability.json';
export const DEFAULT={enabled:false,days:[[],['09:00','17:00'],['09:00','17:00'],['09:00','17:00'],['09:00','17:00'],['09:00','17:00'],[]],blocked:[],slotMinutes:60};
const mins=s=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s||'')?Number(s.slice(0,2))*60+Number(s.slice(3)):NaN;
const clock=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
export const validDate=d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d||''))return false;const time=Date.parse(d+'T12:00:00Z');return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===d;};
export function validateSettings(v){
 assert(v&&typeof v==='object'&&!Array.isArray(v)&&typeof v.enabled==='boolean','Invalid availability configuration.',400);
 assert(Array.isArray(v.days)&&v.days.length===7,'Provide seven weekdays.',400);
 const days=v.days.map(a=>{assert(Array.isArray(a)&&(a.length===0||a.length===2),'Invalid weekday.',400);if(!a.length)return [];const x=mins(a[0]),y=mins(a[1]);assert(Number.isInteger(x)&&Number.isInteger(y)&&y-x>=60,'Business hours require at least one hour.',400);return [clock(x),clock(y)];});
 assert(Array.isArray(v.blocked)&&v.blocked.length<=120,'Too many blocked dates.',400);
 const blocked=[...new Set(v.blocked)];blocked.forEach(d=>assert(typeof d==='string'&&validDate(d),'Invalid blocked date.',400));
 assert(v.slotMinutes===60,'Slot duration must equal 60 minutes.',400);
 return {enabled:v.enabled,days,blocked,slotMinutes:60};
}
export async function settings(){const r=await readJson(SETTINGS_PATH);return r?validateSettings(r.value):DEFAULT;}
function localParts(epoch){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(epoch));const p=Object.fromEntries(parts.map(t=>[t.type,t.value]));return {date:p.year+'-'+p.month+'-'+p.day,time:p.hour+':'+p.minute};}
function easternMs(date,time){const guess=Date.parse(date+'T'+time+':00Z');for(const shift of [4,5]){const t=guess+shift*3600000,p=localParts(t);if(p.date===date&&p.time===time)return t;}return null;}
export function slotOptions(cfg,date,jobs=[],now=Date.now()){
 if(!cfg.enabled||!validDate(date)||cfg.blocked.includes(date))return [];
 const today=localParts(now).date;if(date<today||date>localParts(now+90*86400000).date)return [];
 const range=cfg.days[new Date(date+'T12:00:00Z').getUTCDay()];if(!range?.length)return [];
 const slots=[];for(let t=mins(range[0]);t+60<=mins(range[1]);t+=60){
  const start=easternMs(date,clock(t));if(start===null||start<=now+3600000)continue;
  if(jobs.some(j=>j.status==='confirmed'&&Date.parse(j.appointmentAt)<start+3600000&&Date.parse(j.appointmentAt)+(j.durationMinutes||60)*60000>start))continue;
  slots.push(clock(t));
 }return slots;
}
export async function slotsForDate(date){const cfg=await settings();return {enabled:cfg.enabled,slots:cfg.enabled?slotOptions(cfg,date,await allJobs()):[]};}
export async function enforcePublicSlot(date,time){const cfg=await settings();if(!cfg.enabled)return;assert(slotOptions(cfg,date,await allJobs()).includes(time),'That time is no longer available. Select another.',409);}
export async function enforceConfirmedSlot(iso,duration){const cfg=await settings();if(!cfg.enabled)return;const p=localParts(Date.parse(iso)),hours=cfg.days[new Date(p.date+'T12:00:00Z').getUTCDay()];assert(hours?.length&&!cfg.blocked.includes(p.date)&&mins(p.time)>=mins(hours[0])&&mins(p.time)+duration<=mins(hours[1]),'That time is outside scheduled working hours.',409);}
