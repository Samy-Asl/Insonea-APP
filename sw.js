const CACHE='insonea-app-v2.0.0';
const files=['./','./index.html','./styles.css','./app.js','./script.js','./results.js','./chart.js',
    './meter-processor.js','./service.js','./neo-idle.webp','./neo-alert.webp','./manifest.json',
    './icon-192%202.png','./icon-512%202.png'];
const urls=new Set(files.map(path=>new URL(path,self.registration.scope).href));
self.addEventListener('install',event=>{
    event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(files)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
    event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('insonea-app-') && k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
    if (event.request.method!=='GET') return;
    const url=new URL(event.request.url);
    url.search='';url.hash='';
    if (!urls.has(url.href)) return;
    event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.href)) || fetch(event.request)));
});