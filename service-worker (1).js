// ═══════════════════════════════════════════════════════
//  ArgiQare — Service Worker
//  Cache offline-first pour une expérience fluide
//
//  ⚠️ RÈGLE D'OR : à chaque mise en ligne d'une nouvelle version
//  de ArgiQare_v101.html, OBLIGATOIREMENT incrémenter APP_VERSION
//  ci-dessous. Sans ça, les assurés qui ont déjà installé l'app
//  continueront de voir l'ancienne version indéfiniment, même
//  si le fichier a changé sur le serveur.
// ═══════════════════════════════════════════════════════

const APP_VERSION = '1.1.3'; // ← à incrémenter à CHAQUE déploiement
const CACHE_NAME = 'argicare-' + APP_VERSION;

const CACHE_URLS = [
  './',
  './ArgiQare_v101.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// ── INSTALLATION : mise en cache des ressources de base ──
self.addEventListener('install', event => {
  console.log('[ArgiQare SW] Installation v' + APP_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ArgiQare SW] Mise en cache des ressources');
        return cache.addAll(CACHE_URLS);
      })
    // Pas de self.skipWaiting() ici : on laisse le nouveau SW
    // attendre en "waiting" tant que l'assuré n'a pas confirmé
    // vouloir recharger (voir gestion côté app principale).
  );
});

// ── ACTIVATION : nettoyage des anciens caches ──
self.addEventListener('activate', event => {
  console.log('[ArgiQare SW] Activation v' + APP_VERSION);
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

// ── FETCH : stratégie réseau-prioritaire pour le HTML principal,
//    cache-prioritaire pour le reste (libs externes, manifest...) ──
self.addEventListener('fetch', event => {
  const url = event.request.url;
  const isMainDocument = event.request.destination === 'document';

  if (isMainDocument) {
    // Pour le fichier HTML principal : toujours essayer le réseau
    // EN PREMIER, pour détecter une nouvelle version dès que possible.
    // Le cache ne sert que de filet de secours hors-ligne.
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Pour le reste (ressources statiques, libs CDN) : cache-first classique
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => {
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
