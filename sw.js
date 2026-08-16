const CACHE_NAME = 'm17liv3-v28-8-1-20260816';
const ASSETS = [
  './','./index.html','./cliente.html','./cartelera.html','./resultados.html','./config.js','./manifest.webmanifest',
  './styles.m17liv3-neon-pro-v20-20260802.css','./script.m17liv3-admin-v28-8-1-20260816.js',
  './assets/logo.png','./assets/icons/icon-192.png','./assets/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  const path = url.pathname;
  const fresh =
    path.endsWith('/index.html') ||
    path.endsWith('/') ||
    path.endsWith('/script.m17liv3-admin-v28-8-1-20260816.js') ||
    path.endsWith('/styles.m17liv3-neon-pro-v20-20260802.css') ||
    path.endsWith('/cartelera.html') ||
    path.endsWith('/resultados.html') ||
    path.endsWith('/cliente.html');

  if (fresh) {
    event.respondWith(
      fetch(event.request, {cache:'no-store'})
        .then(response => {
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)).catch(()=>{});
          return response;
        })
        .catch(()=>caches.match(event.request))
    );
    return;
  }

  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
