export function isUpcomingAppointment(job,now=Date.now()){
 const start=Date.parse(job?.appointmentAt||'');
 return job?.status==='confirmed'&&Number.isFinite(start)&&start>now;
}

export function contactKey(job){
 let phone=String(job?.normalizedPhone||job?.phone||'').replace(/\D/g,'');
 if(phone.length===11&&phone.startsWith('1'))phone=phone.slice(1);
 if(phone)return `phone:${phone}`;
 const email=String(job?.email||'').trim().toLowerCase();
 return email?`email:${email}`:`record:${job?.id||''}`;
}

export function groupContacts(jobs=[]){
 const groups=new Map();
 for(const job of jobs){const key=contactKey(job);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(job);}
 return [...groups.entries()].map(([key,records])=>({key,records:records.sort((a,b)=>(b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''))})).sort((a,b)=>(b.records[0]?.updatedAt||b.records[0]?.createdAt||'').localeCompare(a.records[0]?.updatedAt||a.records[0]?.createdAt||''));
}
