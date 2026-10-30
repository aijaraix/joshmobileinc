import test from 'node:test';
import assert from 'node:assert/strict';
import {contactKey,groupContacts,isUpcomingAppointment} from '../public/owner/crm-model.mjs';

test('Upcoming means only a future confirmed appointment',()=>{
 const now=Date.parse('2026-10-30T12:00:00Z');
 assert.equal(isUpcomingAppointment({status:'requested',appointmentAt:'2026-11-01T12:00:00Z'},now),false);
 assert.equal(isUpcomingAppointment({status:'confirmed',appointmentAt:'2026-10-29T12:00:00Z'},now),false);
 assert.equal(isUpcomingAppointment({status:'confirmed',appointmentAt:'2026-11-01T12:00:00Z'},now),true);
 assert.equal(isUpcomingAppointment({status:'confirmed',appointmentAt:''},now),false);
});

test('customer grouping preserves each request as a distinct job record',()=>{
 const first={id:'one',phone:'(202) 555-0142',createdAt:'2026-10-01'};
 const second={id:'two',normalizedPhone:'+12025550142',createdAt:'2026-10-02'};
 const unrelated={id:'three',phone:'202-555-0178',createdAt:'2026-10-03'};
 const groups=groupContacts([first,second,unrelated]);
 assert.equal(groups.length,2);assert.equal(groups[0].records[0].id,'three');
 const shared=groups.find(group=>group.records.length===2);
 assert.deepEqual(shared.records.map(job=>job.id).sort(),['one','two']);
 assert.equal(new Set(shared.records.map(job=>job.id)).size,2);
 assert.equal(contactKey(first),contactKey(second));
});
