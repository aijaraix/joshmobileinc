/**
 * Josh Mobile owner-alert helper. Deploy this as its own Apps Script web app
 * under joshmobileinc@gmail.com. It never stores jobs, accepts browser calls,
 * or exposes a dashboard; the website remains the private system of record.
 */
var OWNER_ALERT_RECIPIENT = 'joshmobileinc@gmail.com';
var OWNER_ALERT_ADMINS = ['joshmobileinc@gmail.com', 'sholom@aicreates.ai'];

function ownerAlertJson_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
function ownerAlertText_(value, max) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
}
function ownerAlertSafeEqual_(left, right) {
  left = String(left || ''); right = String(right || '');
  if (left.length !== right.length) return false;
  var different = 0;
  for (var i = 0; i < left.length; i++) different |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return different === 0;
}
function ownerAlertCanonical_(event) {
  return [event.eventId, event.expiresAt, event.reference, event.service, event.requestedAt, event.ownerUrl].join('\n');
}
function ownerAlertSignature_(canonical, secret) {
  var bytes = Utilities.computeHmacSha256Signature(canonical, secret);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '');
}
function ownerAlertRecipients_(properties) {
  var recipients = [OWNER_ALERT_RECIPIENT];
  var manager = String(properties.getProperty('ALERT_MANAGER_EMAIL') || '').toLowerCase().trim();
  if (manager && OWNER_ALERT_ADMINS.indexOf(manager) !== -1 && manager !== OWNER_ALERT_RECIPIENT) recipients.push(manager);
  return recipients;
}
function ownerAlertPrune_(properties) {
  var cutoff = Date.now() - 35 * 24 * 60 * 60 * 1000;
  var all = properties.getProperties();
  Object.keys(all).filter(function (key) { return key.indexOf('alert:') === 0; }).forEach(function (key) {
    var value = all[key], stamp = Date.parse(value);
    try { stamp = Date.parse(JSON.parse(value).at || ''); } catch (ignored) {}
    if (stamp < cutoff) properties.deleteProperty(key);
  });
}
function doPost(event) {
  try {
    var body = JSON.parse(event && event.postData && event.postData.contents || '{}');
    var properties = PropertiesService.getScriptProperties();
    var secret = properties.getProperty('OWNER_ALERT_SECRET') || '';
    if (!secret) throw new Error('Owner alert helper is not configured.');
    if (!/^new-request:[0-9a-f-]{36}$/i.test(String(body.eventId || ''))) throw new Error('Invalid event.');
    if (!/^JM-[A-Z2-9]{8}$/.test(String(body.reference || ''))) throw new Error('Invalid reference.');
    if (!Number.isFinite(Number(body.expiresAt)) || Number(body.expiresAt) < Date.now() || Number(body.expiresAt) > Date.now() + 10 * 60 * 1000) throw new Error('Expired alert.');
    if (!ownerAlertSafeEqual_(ownerAlertSignature_(ownerAlertCanonical_(body), secret), body.signature)) throw new Error('Not authorized.');
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) throw new Error('Alert service is busy; retry later.');
    try {
      var key = 'alert:' + body.eventId, existing = properties.getProperty(key);
      if (existing) {
        try {
          if (JSON.parse(existing).state === 'sending') return ownerAlertJson_({accepted:false, uncertain:true, error:'The prior alert outcome is uncertain. Do not retry automatically.'});
        } catch (ignored) {}
        return ownerAlertJson_({accepted:true, duplicate:true, quotaRemaining:MailApp.getRemainingDailyQuota()});
      }
      var recipients = ownerAlertRecipients_(properties), quota = MailApp.getRemainingDailyQuota();
      if (quota < recipients.length) return ownerAlertJson_({accepted:false, error:'Daily recipient quota is too low for this alert.', quotaRemaining:quota});
      properties.setProperty(key, JSON.stringify({state:'sending',at:new Date().toISOString()}));
      MailApp.sendEmail({to:recipients.join(','),subject:'New Josh Mobile request '+body.reference,body:'Reference: '+body.reference+'\nService: '+ownerAlertText_(body.service,100)+'\nRequested: '+ownerAlertText_(body.requestedAt,40)+'\n\nOpen the authenticated workspace:\n'+ownerAlertText_(body.ownerUrl,300)});
      properties.setProperty(key, JSON.stringify({state:'accepted',at:new Date().toISOString()})); ownerAlertPrune_(properties);
      return ownerAlertJson_({accepted:true, quotaRemaining:Math.max(0, quota - recipients.length)});
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return ownerAlertJson_({accepted:false, error:ownerAlertText_(error && error.message, 180) || 'Alert was not accepted.'});
  }
}
