/* NAUVIS Command Center offline shell. Does not cache private cloud API responses. */
const VERSION='nauvis-shell-v045';
const STATIC=['./','./index.html','./sync/cloud-sync.js','./quick-add.js','./quick-add.css','./recipe-ratios.js','./recipe-ratios.css','./ratio-flow.js','./ratio-flow.css','./projects.js','./projects.css','./item-icons.js','./item-icons.css','./journal.js','./workspace-ui.js','./workspace-v025.css','./production-presets.js','./preset-v026.css','./inventory-v027.css','./factory-reset.js','./production-effects.js','./machine-upgrades.js','./advanced-v028.css','./logistics.js','./logistics.css'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(STATIC)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('nauvis-shell-')&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin)return;
 const scope=new URL(self.registration.scope);
 if(!url.pathname.startsWith(scope.pathname))return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).then(res=>{
   if(res.ok){const copy=res.clone();event.waitUntil(caches.open(VERSION).then(cache=>cache.put('./index.html',copy)));}
   return res;
  }).catch(()=>caches.match('./index.html').then(x=>x||Response.error())));
 }else{
  // Network first for code and manifest: users must not be stuck with old JS.
  event.respondWith(fetch(req).then(res=>{
   if(res.ok){const copy=res.clone();event.waitUntil(caches.open(VERSION).then(cache=>cache.put(req,copy)));}
   return res;
  }).catch(()=>caches.match(req).then(hit=>hit||Response.error())));
 }
});
