const CACHE_NAME = 'm17liv3-eventos-auto-v26-20260807';
const ASSETS = [
  './',
  './index.html',
  './cliente.html',
  './cartelera.html',
  './resultados.html',
  './config.js',
  './manifest.webmanifest',
  './styles.m17liv3-neon-pro-v20-20260802.css',
  './script.m17liv3-eventos-auto-v26-20260807.js',
  './assets/logo.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(()=>self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.endsWith('/cartelera.html') || url.pathname.endsWith('/resultados.html') || url.pathname.endsWith('/cliente.html')) {
    event.respondWith(fetch(event.request, {cache:'no-store'}).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
