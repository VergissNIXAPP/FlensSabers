const CACHE = 'flenssabers-members-v2026-07';
const CORE = [
  './members.html', './styles.css', './site.js', './members-pwa.js',
  './members-live.js', './live-data.js', './remote-config.js',
  './members.webmanifest', './images/logo.png', './images/logo-ui.webp', './images/team.webp',
  './images/team.png', './images/psv.png', './images/shop/product-placeholder.webp', './icons/members-app-192.png',
  './icons/members-app-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('flenssabers-members-') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if(request.method !== 'GET') return;
  const url = new URL(request.url);
  if(url.origin !== self.location.origin) return;

  if(request.mode === 'navigate'){
    event.respondWith(
      fetch(request).then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
        return response;
      }).catch(() => caches.match(request).then(match => match || caches.match('./members.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(match => match || fetch(request).then(response => {
      if(response.ok){
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});
