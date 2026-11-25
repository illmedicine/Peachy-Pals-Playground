const CACHE_NAME = 'peachy-pals-v12';
const ASSETS = [
  './',
  './index.html',
  './css/style.css?v=20261125d',
  './js/app.js?v=20261125d',
  './js/firebase-config.js?v=20261125d',
  './images/logo.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('firebaseio.com') ||
      e.request.url.includes('googleapis.com') ||
      e.request.url.includes('gstatic.com')) {
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
