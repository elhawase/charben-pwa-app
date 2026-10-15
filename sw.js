/* sw.js — Service Worker CharbenAPK v8.9
   Stratégies :
   - API Firebase : network-first, fallback cache, timeout 5s
   - Code applicatif (js/css/html) : network-first, fallback cache/index.html
   - Fonts/icons : stale-while-revalidate (affichage immédiat + update en fond)
   - Images/vendor : cache-first, fallback réseau
   - Navigation : fallback index.html (SPA offline) */
const CACHE_NAME = 'charben-v9.0';
const NET_TIMEOUT = 5000; /* 5s — timeout pour les requêtes réseau */

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/err-boundary.js',
  '/vendor-loader.js',
  '/firebase-config.js',
  '/firebase-core.js',
  '/app-config.js',
  '/offline-queue.js',
  '/data.js',
  '/data-v7.js',
  '/state.js',
  '/auth.js',
  '/core.js',
  '/app.js',
  '/modules/trace-source.js',
  '/trace-api.js',
  '/essence-api.js',
  '/data-tables.js',
  '/migrations.js',
  '/rules-engine.js',
  '/event-bus.js',
  '/task-allocator.js',
  '/prediction.js',
  '/module-aliases.js',
  '/transactions.js',
  '/inventree-patterns.js',
  '/of-tracking.js',
  '/realtime-sync.js',
  '/modules/constants.js',
  '/modules/utils.js',
  '/modules/err-utils.js',
  '/modules/stock-manager.js',
  '/modules/of-logic.js',
  '/modules/wip-manager.js',
  '/modules/of-manager.js',
  '/modules/ui-renderer.js',
  '/modules/ui-components.js',
  '/modules/fiche-renderer.js',
  '/modules/dashboard-renderer.js',
  '/modules/orders-renderer.js',
  '/modules/qc-manager.js',
  '/modules/equipment-manager.js',
  '/modules/settings-manager.js',
  '/modules/fardeaux-renderer.js',
  '/modules/rapports.js',
  '/modules/planning-renderer.js',
  '/modules/agenda-renderer.js',
  '/modules/of-reminders.js',
  '/modules/of-templates.js',
  '/modules/of-steps.js',
  '/modules/of-objectives.js',
  '/modules/of-icons.js',
  '/modules/of-flash.js',
  '/modules/sciage-logic.js',
  '/modules/grumes-manager.js',
  '/modules/sync-manager.js',
  '/modules/yield-helpers.js',
  '/modules/calc-utils.js',
  '/modules/cutting-engine.js',
  '/modules/dashboard-kpi.js',
  '/modules/disques-renderer.js',
  '/modules/of-list-manager.js',
  '/modules/pdf-export.js',
  '/modules/fardeaux-manager.js',
  '/modules/permissions.js',
  '/modules/rbac-functions.js',
  '/vendor/dexie.min.js',
  '/vendor/qrcode.js',
  '/vendor/jsqr.js',
  '/vendor/xlsx.full.min.js',
  '/logo charben industrie.webp',
  '/header-logo.png',
  '/fonts/material-symbols-outlined.woff2',
  '/manifest.json',
];

/* Helper : requête réseau avec timeout */
function fetchWithTimeout(request, timeout) {
  return Promise.race([
    fetch(request),
    new Promise(function(_, reject) {
      setTimeout(function() { reject(new Error('Network timeout')); }, timeout);
    })
  ]);
}

/* Install — pré-cache les assets */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

/* Activate — nettoie les anciens caches */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

/* Fetch — routing par type de requête */
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  /* 1. API Firebase : network-first + timeout 5s + fallback cache */
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('firebaseio.com')) {
    event.respondWith(
      fetchWithTimeout(event.request, NET_TIMEOUT).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  var isAppOrigin = url.origin === self.location.origin;
  var isAppCode = isAppOrigin && (url.pathname === '/' || /\.(js|css|html)$/.test(url.pathname));
  var isFont = /\.(woff2?|ttf|eot|otf)$/.test(url.pathname) || url.pathname.includes('/fonts/');
  var isImage = /\.(png|jpg|jpeg|gif|webp|svg|ico)$/.test(url.pathname);

  /* 2. Code applicatif : network-first pour le CODE APPLICATIF,
     fallback cache, fallback index.html.
     Raison : en cache-first, un correctif pousse n'atteint JAMAIS un
     appareil deja installe. Reseau d'abord = code frais. */
  if (isAppCode) {
    event.respondWith(
      fetchWithTimeout(event.request, NET_TIMEOUT).then(function(response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        return caches.match(event.request).then(function(cached) {
          return cached || caches.match('/index.html');
        });
      })
    );
    return;
  }

  /* 3. Fonts/icons : stale-while-revalidate (affichage rapide + update en fond) */
  if (isFont) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request).then(function(cached) {
          var fetchPromise = fetch(event.request).then(function(response) {
            if (response && response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(function() { return cached; });
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  /* 4. Images/vendor : cache-first, fallback réseau */
  if (isImage || url.pathname.includes('/vendor/')) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        return fetch(event.request).then(function(response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  /* 5. Navigation (SPA) : fallback index.html pour les routes non-cachées */
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetchWithTimeout(event.request, NET_TIMEOUT).catch(function() {
        return caches.match('/index.html');
      })
    );
    return;
  }

  /* 6. Par défaut : réseau d'abord, fallback cache */
  event.respondWith(
    fetch(event.request).catch(function() {
      return caches.match(event.request);
    })
  );
});
