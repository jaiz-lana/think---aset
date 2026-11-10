const CACHE_PREFIX = 'thinkaset-';
const CACHE_VERSION = 'thinkaset-v0.4.13';
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.html',
  './manifest.json',
  './css/variables.css',
  './css/base.css',
  './css/components.css',
  './css/app.css',
  './profile.css',
  './js/app.js',
  './js/config.js',
  './js/deployment-config.js',
  './js/features.js',
  './js/public-features.js',
  './js/theme-init.js',
  './js/pwa.js',
  './js/theme.js',
  './js/router.js',
  './js/auth.js',
  './js/onboarding.js',
  './js/ui/layout.js',
  './js/ui/dashboard.js',
  './js/ui/assets.js',
  './js/ui/asset-detail.js',
  './js/ui/categories.js',
  './js/ui/locations.js',
  './js/ui/holders.js',
  './js/ui/settings.js',
  './js/ui/modal.js',
  './js/ui/profile.js',
  './js/storage/adapter.js',
  './js/storage/google.js',
  './js/storage/local.js',
  './js/utils/dom.js',
  './js/utils/toast.js',
  './js/utils/uuid.js',
  './js/utils/image.js',
  './js/utils/excel.js',
  './js/utils/depreciation.js',
  './js/utils/external-libs.js',
  './pages/manfaat.html',
  './pages/fitur.html',
  './pages/panduan.html',
  './pages/kontak.html',
  './pages/privasi.html',
  './icons/icon.svg',
  './icons/logo.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];
const STATIC_PATHS = new Set(
  STATIC_ASSETS.map(asset => new URL(asset, self.registration.scope).pathname)
);

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const resources = await Promise.all(STATIC_ASSETS.map(async asset => {
      const url = new URL(asset, self.registration.scope);
      const response = await fetch(new Request(url, { cache: 'reload' }));
      if (!response.ok) throw new Error(`Gagal menyimpan aset offline: ${asset} (${response.status})`);
      return [url, response];
    }));
    await Promise.all(resources.map(([url, response]) => cache.put(url, response)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(Promise.all([
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_VERSION)
        .map(k => caches.delete(k)))
    ),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  const scopeUrl = new URL(self.registration.scope);
  if (!url.pathname.startsWith(scopeUrl.pathname)) return;
  if (!STATIC_PATHS.has(url.pathname)) return;
  const cachePromise = caches.open(CACHE_VERSION);

  // HTML: network-first
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const copy = res.clone();
          cachePromise.then(cache => cache.put(e.request, copy)).catch(() => {});
        }
        return res;
      }).catch(async () => {
        const cache = await cachePromise;
        const cached = await cache.match(e.request);
        if (cached) return cached;
        const fallbackName = url.pathname.endsWith('/app.html') ? 'app.html' : 'index.html';
        const response = await cache.match(new URL(fallbackName, scopeUrl));
        return response || Response.error();
      })
    );
    return;
  }

  // Aset lain: network-first, cache sebagai cadangan offline
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const copy = res.clone();
        cachePromise.then(cache => cache.put(e.request, copy)).catch(() => {});
      }
      return res;
    }).catch(() =>
      cachePromise.then(cache => cache.match(e.request)).then(r => r || Response.error())
    )
  );
});
