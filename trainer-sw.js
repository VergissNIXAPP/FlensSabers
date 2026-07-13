const CACHE = 'flenssabers-trainer-v2026-07';
const CORE = [
  './trainer.html', './styles.css', './trainer.js', './live-data.js',
  './remote-config.js', './trainer.webmanifest', './images/logo.png',
  './images/team.webp', './images/team.png', './icons/trainer-app-192.png',
  './icons/trainer-app-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('flenssabers-trainer-') && key !== CACHE).map(key => caches.delete(key))))
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
      }).catch(() => caches.match(request).then(match => match || caches.match('./trainer.html')))
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
