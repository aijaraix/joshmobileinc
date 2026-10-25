/** Josh Mobile private workspace. Install only under the approved business owner account.
 * No secret, customer, address or credential belongs in GitHub. */
var OWNER_EMAIL = 'joshmobileinc@gmail.com';
var ADMIN_EMAILS = ['joshmobileinc@gmail.com', 'sholom@aicreates.ai'];
var COLUMNS = ['id','createdAt','status','name','phone','email','vehicle','service','description','city','locationType','preferredDate','preferredTime','appointmentAt','privateNotes','partsTools','files','calendarEventId','reminderSent','updatedAt'];
function install() {
  var p=PropertiesService.getScriptProperties();
  if(Session.getEffectiveUser().getEmail().toLowerCase()!==OWNER_EMAIL)throw new Error('Run setup while signed in as the business owner.');
  if(p.getProperty('SHEET_ID'))return 'Workspace already installed.';
  var folder=DriveApp.createFolder('Josh Mobile — private job files');
  var sheet=SpreadsheetApp.create('Josh Mobile — private appointments');
  sheet.getSheets()[0].appendRow(COLUMNS);sheet.getSheets()[0].setFrozenRows(1);
  var calendar=CalendarApp.createCalendar('Josh Mobile — confirmed appointments',{timeZone:'America/New_York'});
  var secret=Utilities.getUuid()+Utilities.getUuid();
  p.setProperties({FOLDER_ID:folder.getId(),SHEET_ID:sheet.getId(),CALENDAR_ID:calendar.getId(),API_SECRET:secret});
  ScriptApp.newTrigger('sendOwnerReminders').timeBased().everyHours(1).create();
  return 'Installed private files, job register, appointments calendar and hourly reminder checks. Copy API_SECRET from Project settings > Script properties to encrypted Vercel settings; never paste it in chat.';
}
function doGet(){return HtmlService.createHtmlOutputFromFile('Owner').setTitle('Josh Mobile — Owner workspace').addMetaTag('viewport','width=device-width, initial-scale=1');}
function json_(v){return ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON);}
function sheet_(){var id=PropertiesService.getScriptProperties().getProperty('SHEET_ID');if(!id)throw new Error('Workspace setup is not complete.');return SpreadsheetApp.openById(id).getSheets()[0];}
function hash_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(s)).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2)}).join('');}
function text_(v,n){return String(v||'').trim().slice(0,n);}
function safeCell_(v){v=String(v||'');return /^[=+@\-]/.test(v)?"'"+v:v;}
function record_(values){var r={};COLUMNS.forEach(function(k,i){r[k]=String(values[i]||'')});try{r.files=JSON.parse(r.files||'[]')}catch(e){r.files=[]}return r;}
function same_(a,b){a=String(a);b=String(b);if(a.length!==b.length)return false;var n=0;for(var i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;}
function doPost(e){
 try{
  if(!e||!e.postData||e.postData.contents.length>3500000)throw new Error('Invalid request size.');
  var b=JSON.parse(e.postData.contents),p=PropertiesService.getScriptProperties();
  if(!p.getProperty('API_SECRET')||!same_(b.secret,p.getProperty('API_SECRET')))throw new Error('Not authorized.');
  if(b.action!=='createRequest')throw new Error('Unknown action.');
  var d=b.details||{},id=String(b.requestId||'');
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Invalid request ID.');
  ['name','phone','year','make','model','description','city','date','time','service'].forEach(function(k){if(!text_(d[k],1800))throw new Error('Missing '+k)});
  if(!d.consent)throw new Error('Consent is required.');
  if(!/^[\d\s()+.-]{10,30}$/.test(d.phone))throw new Error('Invalid phone.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||d.date<Utilities.formatDate(new Date(),'America/New_York','yyyy-MM-dd'))throw new Error('Choose a future date.');
  var fileData=b.files||[];if(!Array.isArray(fileData)||fileData.length>6)throw new Error('Too many files.');
  var total=0,decoded=[];
  fileData.forEach(function(f){if(!/^(image\/(jpeg|png|webp|heic|heif)|video\/(mp4|quicktime|webm))$/.test(f.type||''))throw new Error('Unsupported file type.');var bytes=Utilities.base64Decode(f.base64||'');total+=bytes.length;if(!bytes.length||total>2500000)throw new Error('Media must be below 2.5 MB total for online submission.');decoded.push({name:text_(f.name,90).replace(/[^a-zA-Z0-9_.-]/g,'_'),type:f.type,bytes:bytes})});
  var lock=LockService.getScriptLock();if(!lock.tryLock(10000))return json_({ok:false,error:'Please try again shortly.'});
  try{
   var sheet=sheet_(),values=sheet.getDataRange().getValues();
   for(var i=1;i<values.length;i++)if(String(values[i][0])===id)return json_({ok:true,id:id,notificationSent:false});
   var today=Utilities.formatDate(new Date(),'America/New_York','yyyy-MM-dd'),todayCount=0,phoneCount=0;
   for(var j=1;j<values.length;j++){if(Utilities.formatDate(new Date(String(values[j][1])),'America/New_York','yyyy-MM-dd')===today){todayCount++;if(String(values[j][4]).replace(/\D/g,'')===String(d.phone).replace(/\D/g,''))phoneCount++;}}
   if(todayCount>=30||phoneCount>=3)return json_({ok:false,code:'limit',error:'Daily request limit reached. Please contact Josh directly.'});
   var folder=DriveApp.getFolderById(p.getProperty('FOLDER_ID')).createFolder(id),files=[];
   decoded.forEach(function(f){var file=folder.createFile(Utilities.newBlob(f.bytes,f.type,f.name));files.push({id:file.getId(),name:f.name,url:file.getUrl()});});
   var now=new Date().toISOString();var r={id:id,createdAt:now,status:'requested',name:text_(d.name,90),phone:text_(d.phone,30),email:text_(d.email,160),vehicle:text_(d.year+' '+d.make+' '+d.model,160),service:text_(d.service,100),description:text_(d.description,1800),city:text_(d.city,100),locationType:text_(d.locationType,100),preferredDate:d.date,preferredTime:text_(d.time,30),appointmentAt:'',privateNotes:'',partsTools:'',files:JSON.stringify(files),calendarEventId:'',reminderSent:'',updatedAt:now};
   sheet.appendRow(COLUMNS.map(function(k){return safeCell_(r[k])}));
   var notified=false;try{MailApp.sendEmail(OWNER_EMAIL,'New Josh Mobile service request',r.name+'\n'+r.phone+'\n'+r.vehicle+'\n'+r.service+'\n'+r.description+'\nPreferred: '+r.preferredDate+' '+r.preferredTime+'\n\nOpen your private workspace to review.');notified=true}catch(mailError){}
   return json_({ok:true,id:id,notificationSent:notified});
  }finally{lock.releaseLock();}
 }catch(err){return json_({ok:false,error:String(err.message||'Request failed').slice(0,200)});}
}
function requestLoginCode(email){
 email=String(email||'').trim().toLowerCase();var generic='If this email is authorized, a sign-in code has been sent.';
 if(ADMIN_EMAILS.indexOf(email)===-1)return generic;
 var cache=CacheService.getScriptCache(),key=hash_(email);if(cache.get('cooldown:'+key))return generic;
 var code=String(parseInt(Utilities.getUuid().replace(/-/g,'').slice(0,8),16)%1000000).padStart(6,'0');
 cache.put('otp:'+key,JSON.stringify({hash:hash_(code),attempts:0}),600);cache.put('cooldown:'+key,'1',90);
 MailApp.sendEmail(email,'Your Josh Mobile sign-in code','Your code is '+code+'. It expires in 10 minutes. If you did not request this code, ignore this email.');return generic;
}
function verifyLoginCode(email,code){
 email=String(email||'').trim().toLowerCase();if(ADMIN_EMAILS.indexOf(email)===-1)throw new Error('Invalid or expired code.');
 var lock=LockService.getScriptLock();lock.waitLock(10000);try{var cache=CacheService.getScriptCache(),key='otp:'+hash_(email),raw=cache.get(key);if(!raw)throw new Error('Invalid or expired code.');var r=JSON.parse(raw);if(r.attempts>=5){cache.remove(key);throw new Error('Too many attempts. Request a new code.');}if(!same_(r.hash,hash_(String(code).trim()))){r.attempts++;cache.put(key,JSON.stringify(r),300);throw new Error('Invalid or expired code.');}cache.remove(key);var token=Utilities.getUuid()+Utilities.getUuid();cache.put('session:'+hash_(token),email,3600);return {token:token,email:email};}finally{lock.releaseLock();}
}
function authorize_(token){var email=CacheService.getScriptCache().get('session:'+hash_(token||''));if(ADMIN_EMAILS.indexOf(email)===-1)throw new Error('Please sign in again.');return email;}
function logout(token){CacheService.getScriptCache().remove('session:'+hash_(token||''));return true;}
function listJobs(token){authorize_(token);return sheet_().getDataRange().getValues().slice(1).filter(function(r){return r[0]}).map(record_).reverse();}
function updateJob(token,id,changes){
 var actor=authorize_(token);changes=changes||{};if(['requested','confirmed','completed','cancelled'].indexOf(changes.status)===-1)throw new Error('Invalid status.');
 var lock=LockService.getScriptLock();lock.waitLock(10000);try{var sheet=sheet_(),rows=sheet.getDataRange().getValues();for(var i=1;i<rows.length;i++){if(String(rows[i][0])!==String(id))continue;var r=record_(rows[i]),previous=r.appointmentAt;
  r.privateNotes=text_(changes.privateNotes,4000);r.partsTools=text_(changes.partsTools,2000);r.status=changes.status;r.appointmentAt=text_(changes.appointmentAt,50);r.updatedAt=new Date().toISOString();
  var calendar=CalendarApp.getCalendarById(PropertiesService.getScriptProperties().getProperty('CALENDAR_ID')),event=r.calendarEventId?calendar.getEventById(r.calendarEventId):null;
  if(r.status==='confirmed'){var start=new Date(r.appointmentAt);if(isNaN(start.getTime())||start<=new Date())throw new Error('Choose a valid future confirmed time.');var end=new Date(start.getTime()+60*60*1000);var overlaps=calendar.getEvents(start,end).filter(function(e){return !event||e.getId()!==event.getId()});if(overlaps.length)throw new Error('This hour overlaps an existing appointment. Choose another time.');var desc=r.vehicle+'\n'+r.description+'\nContact: '+r.phone+'\nPreparation: '+r.partsTools+'\nNotes: '+r.privateNotes+'\nUpdated by authorized administrator.';if(event){event.setTitle('Josh Mobile: '+r.service+' — '+r.name);event.setTime(start,end);event.setDescription(desc);}else event=calendar.createEvent('Josh Mobile: '+r.service+' — '+r.name,start,end,{description:desc,location:r.city});r.calendarEventId=event.getId();if(previous!==r.appointmentAt)r.reminderSent='';}
  if((r.status==='cancelled'||r.status==='requested')&&event){event.deleteEvent();r.calendarEventId='';r.reminderSent='';}
  var out=COLUMNS.map(function(k){return safeCell_(k==='files'?JSON.stringify(r.files):r[k])});sheet.getRange(i+1,1,1,COLUMNS.length).setValues([out]);return {ok:true};
 }throw new Error('Job not found.');}finally{lock.releaseLock();}
}
function sendOwnerReminders(){
 var lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;try{var sheet=sheet_(),rows=sheet.getDataRange().getValues(),now=Date.now();for(var i=1;i<rows.length;i++){var r=record_(rows[i]);if(r.status!=='confirmed'||r.reminderSent||!r.appointmentAt)continue;var delta=new Date(r.appointmentAt).getTime()-now;if(delta<=0||delta>24*60*60*1000)continue;MailApp.sendEmail(OWNER_EMAIL,'Upcoming Josh Mobile appointment: '+r.service,r.name+'\n'+r.phone+'\n'+r.vehicle+'\n'+Utilities.formatDate(new Date(r.appointmentAt),'America/New_York','EEE, MMM d, yyyy h:mm a')+' ET\n'+r.city+'\n\nBring / prepare:\n'+r.partsTools+'\n\nNotes:\n'+r.privateNotes);sheet.getRange(i+1,COLUMNS.indexOf('reminderSent')+1).setValue(new Date().toISOString());}}finally{lock.releaseLock();}
}
