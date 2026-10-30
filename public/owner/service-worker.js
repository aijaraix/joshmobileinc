'use strict';
const CACHE='jm-owner-shell-v2';
const SHELL=['/owner','/owner/','/owner/dashboard.css','/owner/dashboard.js','/owner/manifest.webmanifest','/owner/app-icon.svg','/owner/app-icon-192.png','/owner/app-icon-512.png','/assets/jm-mark.svg','/assets/josh-mobile-touch-icon-blue-v4.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(SHELL.includes(url.pathname))event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
});
self.addEventListener('push',event=>{
 let payload={};try{payload=event.data?.json()||{};}catch{}
 const isRequest=payload.type==='request'&&/^JM-[A-HJ-NP-Z2-9]{8}$/.test(payload.reference||'');
 const title='Josh Mobile';
 const body=isRequest?`New service request · ${payload.reference}`:'Josh Mobile test notification';
 const url=isRequest?`/owner/#request=${encodeURIComponent(payload.reference)}`:'/owner/';
 event.waitUntil(self.registration.showNotification(title,{body,icon:'/owner/app-icon-192.png',badge:'/owner/app-icon-192.png',tag:isRequest?`joshmobile-${payload.reference}`:'joshmobile-test',renotify:false,data:{url}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const target=new URL(event.notification.data?.url||'/owner/',self.location.origin).href;
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
  const existing=clients.find(client=>new URL(client.url).origin===self.location.origin&&new URL(client.url).pathname.startsWith('/owner'));
  if(existing)return existing.focus().then(()=>existing.navigate(target));
  return self.clients.openWindow(target);
 }));
});
