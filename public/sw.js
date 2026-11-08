// Cache only the application shell. API responses and shop images never enter this cache.
const CACHE = 'herzenswuensche-shell-v1'
// The build fills this with the emitted JS/CSS files, available on first install.
const BUILD_ASSETS = []
const scope = new URL(self.registration.scope)
const shell = ['index.html', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable.png', 'manifest.webmanifest', ...BUILD_ASSETS].map(path => new URL(path, scope).href)
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(shell)))
  self.skipWaiting()
})
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('herzenswuensche-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(new URL('index.html', scope).href)))
    return
  }
  if (!shell.includes(url.href) && !url.pathname.startsWith(`${scope.pathname}assets/`)) return
  // These allowlisted static files do not vary by requesting Origin. Module
  // requests and installation fetches can carry different Origin headers.
  event.respondWith(caches.match(event.request, { ignoreVary: true }).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone()
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)))
    }
    return response
  })))
})
