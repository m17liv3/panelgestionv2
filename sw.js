const CACHE_NAME = 'm17liv3-renew-amount-required-v4-borrar-force-mensajes-editables-mensajes-editables-force-balance-finanzas-balance-finanzas-k13-jordan-finance-date-fix-finanzas-mas-anos-balance-ano-completo-msg-duplicate-fix-final-graficas-etiquetas-avisos-v2-etiquetas-finales-dos-sin-avisos-historial-renovaciones-recordar-dispositivo-mfa-login-rapido-sin-mfa-sin-menu-google-authenticator-whatsapp-renovar-graficas-inicio-sin-rapido-sin-whatsapp-diseno-premium-nav-confirm-toast-custom-limpieza-respuesta-settings-sync-colores-respuesta-renovacion-clientes-deslizar-buscador-clientes-deslizar-home-opcion1-fix-ver-mas-home';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './config.js',
  './manifest.webmanifest',
  './assets/logo.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-192.png',
  './assets/icons/maskable-512.png',
  './assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // No interceptar APIs externas: TMDB, imgBB, JSONBin, CDN, etc.
  if (url.origin !== self.location.origin) return;

  // Navegación: intenta online, si no hay conexión carga la app guardada.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Archivos principales: network-first para que GitHub Pages actualice rápido.
  if (/\.(html|js|css|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Imágenes e iconos: cache-first.
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
      return res;
    }))
  );
});
