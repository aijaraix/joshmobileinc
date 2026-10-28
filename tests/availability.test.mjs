import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT,validateSettings,slotOptions} from '../lib/availability.mjs';
const WEEK=[[],['09:00','17:00'],['09:00','17:00'],['09:00','17:00'],['09:00','17:00'],['09:00','17:00'],[]];
const SETTINGS={enabled:true,days:WEEK,blocked:[],slotMinutes:60};
test('Hours are off until staff saves an enabled schedule',()=>{
 assert.equal(DEFAULT.enabled,false);
 assert.deepEqual(DEFAULT.days,[[],[],[],[],[],[],[]]);
 assert.equal(slotOptions(DEFAULT,'2026-11-02',[]).length,0);
});
test('Business hours include weekday slots but exclude Sunday',()=>{
 const cfg=validateSettings(SETTINGS);
 const now=Date.parse('2026-10-25T10:00:00Z');
 const monday=slotOptions(cfg,'2026-11-02',[],now);
 assert.deepEqual(monday,['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00']);
 assert.deepEqual(slotOptions(cfg,'2026-11-01',[],now),[]);
});
test('Closed dates and confirmed appointments are excluded',()=>{
 const cfg=validateSettings({...SETTINGS,blocked:['2026-11-03']});
 const now=Date.parse('2026-10-25T10:00:00Z');
 assert.deepEqual(slotOptions(cfg,'2026-11-03',[],now),[]);
 const jobs=[{status:'confirmed',appointmentAt:'2026-11-02T15:00:00.000Z',durationMinutes:90}];
 const options=slotOptions(cfg,'2026-11-02',jobs,now);
 assert(!options.includes('10:00'));
 assert(!options.includes('11:00'));
 assert(options.includes('09:00'));
});
test('Invalid working hours, dates and durations are rejected',()=>{
 assert.throws(()=>validateSettings({...SETTINGS,days:[['18:00','09:00'],...WEEK.slice(1)]}));
 assert.throws(()=>validateSettings({...SETTINGS,blocked:['2026-02-30']}));
 assert.throws(()=>validateSettings({...SETTINGS,slotMinutes:10}));
});
