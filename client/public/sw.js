const CACHE = 'blackbox-shell-v4'
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    const shell = await fetch('/', { cache: 'reload' })
    if (!shell.ok) throw new Error('Application shell unavailable')
    const html = await shell.clone().text()
    // On first install the current page's JS/CSS may already have loaded before
    // this worker took control. Precache built entry assets for the first offline refresh.
    const assets = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)]
      .map((match) => new URL(match[1], self.location.origin))
      .filter((url) => url.origin === self.location.origin && url.pathname.startsWith('/assets/'))
      .map((url) => url.href)
    await cache.put('/', shell)
    await cache.addAll(['/manifest.webmanifest', ...new Set(assets)])
  })())
})
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('blackbox-shell-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return
  // Cache only the application shell and static assets. API/account data belongs
  // in the account-scoped IndexedDB cache, never in a shared HTTP cache.
  if (!['document', 'script', 'style', 'image', 'font', 'manifest', 'worker'].includes(event.request.destination)) return
  if (new URL(event.request.url).pathname.startsWith('/api/')) return
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok && !response.redirected && response.type === 'basic') {
      const copy = response.clone()
      event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)))
    }
    return response
  }).catch(async () => {
    const cache = await caches.open(CACHE)
    return await cache.match(event.request) || (event.request.mode === 'navigate' ? await cache.match('/') : undefined) || Response.error()
  }))
})
