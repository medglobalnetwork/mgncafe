// MGN Cafe Smart Tablet POS - Offline-First Service Worker (v5.6)
const CACHE_NAME = 'mgn-pos-cache-v5.6';

const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './assets/mgn_logo.png',
  './mgn_logo.png'
];

// Install Event: Pre-cache core app shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Non-critical asset cache skip:', err);
      });
    })
  );
});

// Activate Event: Clean up legacy caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network-First for HTML / Navigation, Cache-First for static assets
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  if (event.request.method !== 'GET') return;

  // HTML Navigation: Network-First so file changes reflect immediately
  if (event.request.mode === 'navigate' || requestUrl.pathname.endsWith('index.html') || requestUrl.pathname === '/') {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => {
        return caches.match('./index.html') || caches.match('/');
      })
    );
    return;
  }

  // External CDNs & Fonts: Stale-While-Revalidate
  if (requestUrl.origin.includes('googleapis.com') || 
      requestUrl.origin.includes('gstatic.com') || 
      requestUrl.origin.includes('tailwindcss.com')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        }).catch(() => cachedResponse);
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Project JS / CSS / Images: Network First with cache fallback
  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
      }
      return networkResponse;
    }).catch(() => caches.match(event.request))
  );
});
