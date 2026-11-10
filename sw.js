'use strict';

const CACHE_NAME = 'cbeth-monitor-v2.1.0';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './dashboard_interativo.html',
  './manifest.webmanifest',
  './manifest.json',
  './favicon.ico',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable.png',
  './assets/icons/icon.svg',
  './js/icons.js',
  './js/fallback-data.js',
  './js/calculator.js',
  './js/api.js',
  './js/charts.js',
  './js/app.js',
  './carteira.json',
  './dados/fato_posicao_atual.csv',
  './dados/fato_historico_30d.csv',
  './dados/fato_composicao_ativos.csv'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME && name.startsWith('cbeth-monitor-')) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Dynamic Blockchain & Oracle APIs bypass cache to guarantee fresh state
  const isDynamicApi = url.hostname.includes('base.org') ||
                       url.hostname.includes('publicnode.com') ||
                       url.hostname.includes('llama.fi') ||
                       url.hostname.includes('awesomeapi.com.br') ||
                       url.hostname.includes('coingecko.com');

  if (isDynamicApi) {
    event.respondWith(
      fetch(req).catch(() => {
        return new Response(JSON.stringify({ error: 'Rede indisponivel no modo offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // CDN & Static Assets: Stale-While-Revalidate / Cache-First strategy
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
