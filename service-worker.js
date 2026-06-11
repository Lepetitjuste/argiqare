// ═══════════════════════════════════════════════════════
//  ArgiQare — Service Worker v1.0.1
//  Cache offline-first pour une expérience fluide
// ═══════════════════════════════════════════════════════

const CACHE_NAME = 'argicare-v101';
const CACHE_URLS = [
  './',
  './ArgiQare_v101.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// ── INSTALLATION : mise en cache des ressources de base ──
self.addEventListener('install', event => {
  console.log('[ArgiQare SW] Installation v1.0.1');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ArgiQare SW] Mise en cache des ressources');
        return cache.addAll(CACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATION : nettoyage des anciens caches ──
self.addEventListener('activate', event => {
  console.log('[ArgiQare SW] Activation');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[ArgiQare SW] Suppression ancien cache :', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ── FETCH : stratégie Cache First, réseau en fallback ──
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Ressource trouvée dans le cache → on la retourne
        if (cachedResponse) {
          return cachedResponse;
        }
        // Pas dans le cache → on va chercher sur le réseau
        return fetch(event.request)
          .then(networkResponse => {
            // Si la réponse réseau est valide, on la met en cache pour la prochaine fois
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Pas de réseau du tout → page de fallback offline
            if (event.request.destination === 'document') {
              return caches.match('./ArgiQare_v101.html');
            }
          });
      })
  );
});

// ── MESSAGE : forcer la mise à jour depuis l'app ──
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
