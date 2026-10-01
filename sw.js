const PREFIX='laya-breakfast-local-'+encodeURIComponent(self.registration.scope)+'-';
const CACHE=PREFIX+'v2.1.0';
const ASSETS=["./", "./index.html", "./app.js", "./style.css", "./domain.js", "./local-store.js", "./store.js", "./pdf-import.js", "./pdf-workflow.js", "./icon.svg", "./manifest.webmanifest", "./sample-guests.csv", "./fonts/noto-sans-thai-thai-400-normal.woff2", "./fonts/noto-sans-thai-thai-600-normal.woff2", "./vendor/xlsx.full.min.js", "./vendor/pdfjs/pdf.min.mjs", "./vendor/pdfjs/pdf.worker.min.mjs"];
self.addEventListener('install',e=>e.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'})));await self.skipWaiting();})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('message',e=>{if(e.data==='STATUS')e.source?.postMessage('OFFLINE_READY');});
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 e.respondWith((async()=>{const cache=await caches.open(CACHE);if(e.request.mode==='navigate'){try{const response=await fetch(new Request(e.request,{cache:'no-store'}));if(response.ok){await cache.put(new URL('./index.html',self.registration.scope),response.clone());return response;}return await cache.match('./index.html')||response;}catch{return await cache.match('./index.html')||Response.error();}}const hit=await cache.match(e.request,{ignoreSearch:true});return hit||fetch(e.request);})());
});
