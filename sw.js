// Caddy Coach offline support. Version changes whenever the app changes, which refreshes the cache.
const V='cc-82e9c5246f',SHELL=["./", "index.html", "manifest.webmanifest", "drills.js", "drillstudio.js", "flyover.js", "golfer.js", "grip.js", "hand.js", "hand_model.js", "ideal.js", "live.js", "metrics.js", "models.js", "pose.js", "posework.js", "setup.js", "tflite.js", "three.min.js", "tracer-mp4.js", "tracer-ui.js", "tracer.js", "whs.js", "zones.js", "golfer-eye.jpg", "golfer-mesh.wasm", "golfer-skin.jpg", "hero-swing.jpg", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&k!=='cc-tiles'&&k!=='cc-cdn').map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET')return;
 if(u.hostname==='server.arcgisonline.com'){e.respondWith(caches.open('cc-tiles').then(async c=>{const hit=await c.match(e.request);const net=fetch(e.request).then(r=>{if(r.ok||r.type==='opaque')c.put(e.request,r.clone());return r}).catch(()=>hit);return hit||net}));return}
 if(u.hostname==='cdnjs.cloudflare.com'||u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com'){e.respondWith(caches.open('cc-cdn').then(async c=>{const hit=await c.match(e.request);if(hit)return hit;const r=await fetch(e.request);c.put(e.request,r.clone());return r}));return}
 if(u.origin===location.origin){if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).then(r=>{caches.open(V).then(c=>c.put('index.html',r.clone()));return r}).catch(()=>caches.match('index.html')));return}
  e.respondWith(caches.match(e.request).then(h=>h||fetch(e.request)))}});
// tapping a notification opens Caddy Coach (or brings it to the front)
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{const c=cs.find(x=>'focus' in x);return c?c.focus():self.clients.openWindow('./')}))});
