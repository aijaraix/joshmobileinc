
'use strict';
const by=id=>document.getElementById(id);
const set=(id,value)=>{const el=by(id);if(el)el.textContent=String(value??'')};
async function api(action,method='GET',payload){
 const r=await fetch('/api/admin?action='+encodeURIComponent(action),{method,credentials:'same-origin',cache:'no-store',headers:method==='POST'?{'Content-Type':'application/json'}:{},body:payload?JSON.stringify(payload):undefined});
 const data=await r.json().catch(()=>({error:'Could not read server response'}));
 if(!r.ok)throw Error(data.error||'Request failed');
 return data;
}
let jobs=[],selectedId=null,filter='upcoming';
const label=s=>({requested:'New request',confirmed:'Confirmed',completed:'Completed',cancelled:'Cancelled'}[s]||s||'Request');
const safePhone=s=>String(s||'').replace(/[^\d+]/g,'');
const humanDate=s=>{try{return new Date(s).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'America/New_York'})}catch{return s||'Not confirmed'}};
function localDatetime(iso){if(!iso)return'';const d=new Date(iso),t=d.getTime()-d.getTimezoneOffset()*60000;return new Date(t).toISOString().slice(0,16)}
function show(screen,email=''){
 for(const id of ['login-screen','change-screen','dashboard'])by(id).hidden=id!==screen;
 by('logout').hidden=screen==='login-screen';if(email)set('admin-label','Signed in as '+email);
 if(screen==='dashboard')reloadJobs();
}
function goLoggedIn(data){show(data.requiresChange?'change-screen':'dashboard',data.email)}
async function reloadJobs(){
 try{jobs=(await api('jobs')).jobs||[];render();if(selectedId)selectJob(selectedId);}
 catch(e){set('job-list',e.message);if(/sign in/i.test(e.message))show('login-screen')}
}
function render(){
 const count=s=>jobs.filter(j=>j.status===s).length;
 set('stat-requested',count('requested'));
 set('stat-upcoming',jobs.filter(j=>j.status==='confirmed'&&Date.parse(j.appointmentAt)>Date.now()).length);
 set('stat-customers',new Set(jobs.map(j=>String(j.phone).replace(/\D/g,''))).size);
 set('stat-completed',count('completed'));
 const query=by('search').value.toLowerCase();
 const list=jobs.filter(j=>{
  const statusOk=filter==='all'||filter==='requested'&&j.status==='requested'||filter==='upcoming'&&['requested','confirmed'].includes(j.status);
  return statusOk&&[j.name,j.phone,j.vin,j.year,j.make,j.model,j.service,j.city].join(' ').toLowerCase().includes(query);
 });
 const target=by('job-list');target.replaceChildren();
 if(!list.length){const p=document.createElement('p');p.className='empty';p.textContent='No matching appointments yet. New website requests will appear here.';target.append(p);return;}
 for(const j of list){
  const b=document.createElement('button');b.type='button';b.className='job-row'+(j.id===selectedId?' selected':'');
  const head=document.createElement('div');head.className='rowhead';
  const name=document.createElement('strong');name.textContent=j.name||'Customer';
  const chip=document.createElement('span');chip.className='label '+j.status;chip.textContent=label(j.status);
  head.append(name,chip);
  const vehicle=document.createElement('p');vehicle.textContent=[j.year,j.make,j.model].filter(Boolean).join(' ')+' · '+(j.service||'Service');
  const time=document.createElement('small');time.textContent=j.appointmentAt?humanDate(j.appointmentAt):(j.date||'Date to confirm');
  b.append(head,vehicle,time);b.onclick=()=>selectJob(j.id);target.append(b);
 }
}
function selectJob(id){
 const j=jobs.find(x=>x.id===id);if(!j)return;
 selectedId=j.id;by('no-selection').hidden=true;by('detail').hidden=false;
 set('detail-title',(j.name||'Customer')+' · '+(j.service||'Service'));
 set('detail-status',label(j.status));by('detail-status').className='label '+j.status;
 set('detail-vehicle',[j.year,j.make,j.model].filter(Boolean).join(' '));
 const fields={'d-name':j.name,'d-phone':j.phone,'d-email':j.email||'—','d-car':[j.year,j.make,j.model].filter(Boolean).join(' '),'d-vin':j.vin||'Awaiting VIN','d-address':[j.address,j.city].filter(Boolean).join(', '),'d-work':j.description||'No additional description','d-preferred':j.appointmentAt?'Confirmed '+humanDate(j.appointmentAt):'Requested '+(j.date||'date pending')+' · '+(j.time||'time flexible')};
 for(const [id,value]of Object.entries(fields))set(id,value);
 const phone=safePhone(j.phone);by('call-link').href='tel:'+phone;
 const body='Hi '+String(j.name||'there').split(' ')[0]+', this is Josh Mobile. I am following up about your '+(j.service||'car service')+' request.';
 by('text-link').href='sms:'+phone+'?body='+encodeURIComponent(body);
 by('maps-link').href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([j.address,j.city].filter(Boolean).join(', '));
 by('edit-status').value=j.status||'requested';
 by('edit-date').value=localDatetime(j.appointmentAt);
 by('edit-vin').value=j.vin||'';
 by('edit-address').value=j.address||'';
 by('edit-notes').value=j.privateNotes||'';
 by('edit-parts').value=j.partsTools||'';
 set('save-message','');
 const media=by('d-media');media.replaceChildren();
 if((j.media||[]).length){
  j.media.forEach((f,i)=>{
   const a=document.createElement('a');a.href='/api/admin?action=file&id='+encodeURIComponent(j.id)+'&index='+i;
   a.textContent=(String(f.type||'').startsWith('video/')?'Video ':'Photo ')+(i+1)+' ↗';
   a.target='_blank';a.rel='noopener noreferrer';media.append(a);
  });
 }else{const p=document.createElement('p');p.className='muted';p.textContent='No photos or videos attached.';media.append(p);}
 const timeline=by('timeline');timeline.replaceChildren();
 const messages=Array.isArray(j.messages)?j.messages:[];
 if(!messages.length){const p=document.createElement('p');p.className='muted';p.textContent='No messages logged. Use the form below after texting or calling.';timeline.append(p);}
 for(const item of messages){
  const div=document.createElement('div');div.className='entry';
  const head=document.createElement('strong');head.textContent=({inbound:'Customer text received',outbound:'Text sent',note:'Call / note'}[item.direction]||'Conversation note');
  const time=document.createElement('time');time.textContent=humanDate(item.createdAt);
  const p=document.createElement('p');p.textContent=item.text;
  div.append(head,time,p);timeline.append(div);
 }
 document.querySelectorAll('.job-row').forEach(b=>b.classList.toggle('selected',b.textContent.includes(j.name)&&b.textContent.includes(j.service)));
}
by('login-form').addEventListener('submit',async e=>{
 e.preventDefault();set('login-message','Signing in…');
 try{const result=await api('login','POST',{email:by('email').value.toLowerCase().trim(),password:by('password').value});by('password').value='';set('login-message','');goLoggedIn(result)}
 catch(err){set('login-message',err.message)}
});
by('initial-change').addEventListener('submit',async e=>{
 e.preventDefault();set('initial-message','Saving…');
 try{await api('change-password','POST',{oldPassword:by('initial-old').value,newPassword:by('initial-new').value});
  by('initial-old').value='';by('initial-new').value='';show('login-screen');set('login-message','Password saved. Sign in with your new password.');}
 catch(err){set('initial-message',err.message)}
});
by('logout').onclick=async()=>{await api('logout','POST').catch(()=>{});location.reload()};
by('refresh').onclick=reloadJobs;
by('search').oninput=render;
document.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>{
 filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b===button));render();
});
by('job-form').onsubmit=async e=>{
 e.preventDefault();if(!selectedId)return;set('save-message','Saving…');
 const orig=jobs.find(j=>j.id===selectedId);
 try{
  const at=by('edit-date').value?new Date(by('edit-date').value).toISOString():'';
  await api('update','POST',{id:selectedId,status:by('edit-status').value,appointmentAt:at,vin:by('edit-vin').value.toUpperCase(),address:by('edit-address').value,city:orig?.city||'',privateNotes:by('edit-notes').value,partsTools:by('edit-parts').value});
  set('save-message','Job saved.');await reloadJobs();
 }catch(err){set('save-message',err.message)}
};
by('message-form').onsubmit=async e=>{
 e.preventDefault();if(!selectedId)return;set('message-notice','Saving…');
 try{await api('message','POST',{id:selectedId,direction:by('message-direction').value,message:by('message-text').value});by('message-text').value='';set('message-notice','Added to this job’s log.');await reloadJobs()}
 catch(err){set('message-notice',err.message)}
};
by('add-new').onclick=()=>by('new-dialog').showModal();
by('close-new').onclick=()=>by('new-dialog').close();
by('new-form').onsubmit=async e=>{
 e.preventDefault();set('new-notice','Saving…');
 try{await api('create','POST',Object.fromEntries(new FormData(e.currentTarget)));e.currentTarget.reset();by('new-dialog').close();await reloadJobs()}
 catch(err){set('new-notice',err.message)}
};
by('change-form').onsubmit=async e=>{
 e.preventDefault();set('change-notice','Saving…');
 try{await api('change-password','POST',{oldPassword:by('current-password').value,newPassword:by('next-password').value});show('login-screen');set('login-message','Password changed. Sign in again.');}
 catch(err){set('change-notice',err.message)}
};
api('session').then(goLoggedIn).catch(()=>show('login-screen'));
